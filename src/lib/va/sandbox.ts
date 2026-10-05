import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  createLogger,
  recordVaApiError,
  recordVaApiLatency,
} from "@/lib/observability/logger";
import {
  VA_SHARED_STATE_REQUIRED_ERROR,
  resolveVaReferenceMode,
  vaProcessLocalStateAllowed,
  type VaReferenceMode,
} from "./runtime-state";
import { parseRetryAfterMs } from "./circuit-breaker";
import {
  abandonVaOutboundCircuitProbe,
  evaluateVaOutboundCircuit,
  recordVaOutboundCircuitOutcome,
} from "./outbound-circuit";
import {
  reserveVaSharedConsumerSlot,
  vaSharedConsumerBudgetEnabled,
} from "./reference-shared-cache";
import { isTrustedHttpsUrl, TRUSTED_LINK_REQUIREMENT } from "./trusted-link";

const DEFAULT_FORMS_BASE_URLS = {
  sandbox: "https://sandbox-api.va.gov/services/va_forms/v0",
  production: "https://api.va.gov/services/va_forms/v0",
} as const;
const DEFAULT_REFERENCE_BASE_URLS = {
  sandbox: "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  production: "https://api.va.gov/services/benefits-reference-data/v1",
} as const;
const DEFAULT_ACCREDITED_REP_BASE_URLS = {
  sandbox: "https://sandbox-api.va.gov/services/accredited-representatives/v1",
  production: "https://api.va.gov/services/accredited-representatives/v1",
} as const;
const TRUSTED_API_ORIGINS = {
  sandbox: "https://sandbox-api.va.gov",
  production: "https://api.va.gov",
} as const;
const DEFAULT_TIMEOUT_MS = 4_000;
/** Upper bound for a configured per-attempt timeout; a typo cannot disable it. */
export const VA_API_MAX_TIMEOUT_MS = 30_000;
/** Maximum bytes of a VA JSON response body that will be read and parsed. */
export const VA_API_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([503, 504]);
export const VA_API_OUTBOUND_WINDOW_MS = 60_000;
export const VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE = 60;
export const VA_API_RETRY_BASE_DELAY_MS = 100;
export const VA_API_RETRY_MAX_DELAY_MS = 400;
export const VA_API_MAX_RETRIES = 2;
/** @deprecated Use VA_API_RETRY_BASE_DELAY_MS; retained for test compatibility. */
export const VA_API_RETRY_DELAY_MS = VA_API_RETRY_BASE_DELAY_MS;

/**
 * Deterministic backoff with bounded jitter. Jitter spreads retries across
 * instances so a shared upstream incident does not get a synchronized retry
 * wave; the bound keeps the base/max contract testable.
 */
function vaApiRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(
    VA_API_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    VA_API_RETRY_MAX_DELAY_MS,
  );
  const jitter = Math.floor(base * 0.2 * random());
  return base + jitter;
}

type VaApiEnvironmentVariables = Record<string, string | undefined>;

export type VaApiEnvironment = "sandbox" | "production";
export type VaApiSource = "va-sandbox-api" | "va-production-api" | "local-fallback";

export type VaApiConfig = {
  enabled: boolean;
  /**
   * Deliberate tri-state runtime mode required by issue #287. Derived, never
   * read from a single variable, so `disabled` is the fail-closed default and
   * `production` requires an explicit access acknowledgement.
   */
  mode: VaReferenceMode;
  /** Auditable, non-sensitive explanation of how `mode` was resolved. */
  modeReason: string;
  environment?: VaApiEnvironment;
  formsApiKey?: string;
  benefitsReferenceDataApiKey?: string;
  accreditedRepApiKey?: string;
  formsBaseUrl: string;
  benefitsReferenceDataBaseUrl: string;
  accreditedRepBaseUrl?: string;
  timeoutMs: number;
  accreditedRepEnabled?: boolean;
} & Record<string, unknown>;

/** Backward-compatible name retained for existing tests and callers. */
export type VaSandboxConfig = VaApiConfig;

export interface VaApiObservation {
  requestId: string;
  service: "va-forms" | "benefits-reference-data" | "accredited-representatives";
  path: string;
  attempt: number;
  outcome:
    | "success"
    | "http-error"
    | "timeout"
    | "network-error"
    | "invalid-payload"
    | "rate-limited"
    | "circuit-open";
  status?: number;
  durationMs: number;
}

/** Backward-compatible name retained for the Phase 2 smoke-test contract. */
export type VaSandboxObservation = VaApiObservation;

export interface VaApiResult<T> {
  success: boolean;
  data: T | null;
  source: VaApiSource;
  environment?: VaApiEnvironment;
  requestId?: string;
  error?: string;
}

/** Backward-compatible name retained for existing callers. */
export type VaSandboxResult<T> = VaApiResult<T>;

export interface VaApiRequestOptions {
  config?: VaApiConfig;
  observe?: (observation: VaApiObservation) => void;
}

/** Backward-compatible name retained for existing callers. */
export type VaSandboxRequestOptions = VaApiRequestOptions;

const outboundRequestTimes = new Map<VaApiObservation["service"], number[]>();

function claimOutboundRequestSlot(
  service: VaApiObservation["service"],
  now = Date.now(),
): boolean {
  const cutoff = now - VA_API_OUTBOUND_WINDOW_MS;
  const recent = (outboundRequestTimes.get(service) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE) {
    outboundRequestTimes.set(service, recent);
    return false;
  }
  recent.push(now);
  outboundRequestTimes.set(service, recent);
  return true;
}

/** Test/reset hook for the single-process request budget. */
export function clearVaApiOutboundRateLimitState(): void {
  outboundRequestTimes.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * VA-provided link (audit A-03 "approved HTTPS links"): rendered directly as
 * `<a href>`, so the schema rejects non-HTTPS schemes (`javascript:`,
 * `data:`, `http:`), credential-bearing URLs, and unparsable values instead of
 * passing them through. A payload with such a link fails validation and the
 * loader degrades to its explicit local fallback (see trusted-link.ts).
 */
const trustedHttpsUrlSchema = z
  .string()
  .refine(isTrustedHttpsUrl, { message: TRUSTED_LINK_REQUIREMENT });

const formIndexItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  attributes: z.object({
    form_name: z.string().min(1),
    url: trustedHttpsUrlSchema,
    title: z.string().min(1),
    last_revision_on: z.string().nullable().optional(),
    pages: z.number().int().nonnegative().optional(),
    sha256: z.string().nullable().optional(),
    valid_pdf: z.boolean().optional(),
    deleted_at: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough();

const formsIndexSchema = z.object({
  data: z.array(formIndexItemSchema),
}).passthrough();

const disabilitySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  endDateTime: z.string().nullable().optional(),
}).passthrough();

const disabilityReferenceSchema = z.object({
  items: z.array(disabilitySchema),
  totalItems: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
}).passthrough();

const serviceBranchSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
}).passthrough();

const serviceBranchReferenceSchema = z.object({
  items: z.array(serviceBranchSchema),
}).passthrough();

export type VaFormIndex = z.infer<typeof formsIndexSchema>;
export type VaDisabilityReference = z.infer<typeof disabilityReferenceSchema>;
export type VaServiceBranchReference = z.infer<typeof serviceBranchReferenceSchema>;

export function loadVaApiConfig(
  env: VaApiEnvironmentVariables = process.env,
): VaApiConfig {
  // Single deliberate tri-state decision point (issue #287): disabled | sandbox |
  // production. Production additionally requires an explicit acknowledgement that
  // VA granted production access, so the #287 gate rule cannot be bypassed by a
  // lone VA_API_ENV/VA_API_ENABLED pair.
  const resolution = resolveVaReferenceMode(env);
  const environment = resolution.environment as VaApiEnvironment;
  const timeout = Number(env.VA_API_TIMEOUT_MS ?? env.VA_SANDBOX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  // Credentials and endpoints follow the *effective* mode, never the merely
  // requested environment. A production selection that failed closed must not
  // carry production base URLs or production keys, so even a caller that forgot
  // to check `enabled` cannot reach or be labelled as production.
  const production = resolution.mode === "production";
  const effectiveEnvironment: VaApiEnvironment = production ? "production" : "sandbox";

  return {
    enabled: resolution.enabled,
    mode: resolution.mode,
    modeReason: resolution.reason,
    environment,
    formsApiKey: (
      production
        ? env.VA_FORMS_PRODUCTION_API_KEY
        : env.VA_FORMS_SANDBOX_API_KEY
    )?.trim() || undefined,
    benefitsReferenceDataApiKey: (
      production
        ? env.VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY
        : env.VA_BENEFITS_REFERENCE_SANDBOX_API_KEY
    )?.trim() || undefined,
    accreditedRepApiKey: (
      production
        ? env.VA_ACCREDITED_REP_PRODUCTION_API_KEY
        : env.VA_ACCREDITED_REP_SANDBOX_API_KEY
    )?.trim() || undefined,
    formsBaseUrl:
      (production
        ? env.VA_FORMS_PRODUCTION_BASE_URL
        : env.VA_FORMS_SANDBOX_BASE_URL)?.trim() ||
      DEFAULT_FORMS_BASE_URLS[effectiveEnvironment],
    benefitsReferenceDataBaseUrl:
      (production
        ? env.VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL
        : env.VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL)?.trim() ||
      DEFAULT_REFERENCE_BASE_URLS[effectiveEnvironment],
    accreditedRepBaseUrl:
      (production
        ? env.VA_ACCREDITED_REP_PRODUCTION_BASE_URL
        : env.VA_ACCREDITED_REP_SANDBOX_BASE_URL)?.trim() ||
      DEFAULT_ACCREDITED_REP_BASE_URLS[effectiveEnvironment],
    // A configured timeout is clamped to VA_API_MAX_TIMEOUT_MS, so a typo
    // (e.g. VA_API_TIMEOUT_MS=4000000) cannot pin a request open indefinitely.
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? Math.min(Math.floor(timeout), VA_API_MAX_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS,
    accreditedRepEnabled: env.VA_ACCREDITED_REP_ENABLED === "true",
  };
}

/** Backward-compatible entry point; now returns environment-aware configuration. */
export function loadVaSandboxConfig(
  env: VaApiEnvironmentVariables = process.env,
): VaApiConfig {
  return loadVaApiConfig(env);
}

function configEnvironment(config: VaApiConfig): VaApiEnvironment {
  return config.environment ?? "sandbox";
}

/** The live API source a loader in this environment must present. */
export function liveSource(environment: VaApiEnvironment): VaApiSource {
  return environment === "production" ? "va-production-api" : "va-sandbox-api";
}

function fallback<T>(
  error: string,
  environment: VaApiEnvironment,
  requestId?: string,
): VaApiResult<T> {
  return {
    success: false,
    data: null,
    source: "local-fallback",
    environment,
    requestId,
    error,
  };
}

function validatedBaseUrl(
  value: string,
  environment: VaApiEnvironment,
): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.origin !== TRUSTED_API_ORIGINS[environment]) return null;
    return url;
  } catch {
    return null;
  }
}

const vaApiLogger = createLogger("va-api");

/**
 * Read at most `maxBytes` of a JSON response and parse it.
 *
 * `response.json()` buffers whatever the upstream sends; an unbounded public
 * API body would be trusted to fit in memory. The read is streamed with a hard
 * byte cap and throws (routed into the caller's network-error path) when the
 * payload exceeds it.
 */
async function readBoundedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const body = response.body;
  if (!body) throw new Error("VA response body is empty.");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`VA response exceeded ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}

async function requestVaJson<T>(args: {
  service: VaApiObservation["service"];
  apiKey?: string;
  baseUrl: string;
  path: string;
  schema: z.ZodType<T>;
  config: VaApiConfig;
  observe?: VaApiRequestOptions["observe"];
  query?: URLSearchParams;
}): Promise<VaApiResult<T>> {
  const environment = configEnvironment(args.config);
  if (!args.config.enabled) {
    return fallback(`VA ${environment} integration is disabled by feature flag.`, environment);
  }
  const distributed = !vaProcessLocalStateAllowed();
  // Finding #3: a shared KV cache is NOT a rate-limit coordinator, so the
  // distributed consumer budget is a separate explicit opt-in. Every upstream
  // attempt in a distributed runtime must first atomically reserve a
  // consumer-wide slot; a missing opt-in, missing coordinator, or unreachable
  // coordinator fails closed instead of granting a per-process budget that
  // can exceed VA's quota.
  if (distributed && !vaSharedConsumerBudgetEnabled()) {
    return fallback(VA_SHARED_STATE_REQUIRED_ERROR, environment);
  }
  if (!args.apiKey) {
    return fallback(
      `${args.service} ${environment} API key is required when integration is enabled.`,
      environment,
    );
  }

  const baseUrl = validatedBaseUrl(args.baseUrl, environment);
  if (!baseUrl) {
    return fallback(
      "VA API base URL must be a valid HTTPS URL on the expected VA API origin.",
      environment,
    );
  }

  const endpoint = new URL(
    args.path.replace(/^\//, ""),
    `${baseUrl.toString().replace(/\/$/, "")}/`,
  );
  if (args.query) endpoint.search = args.query.toString();
  const requestId = randomUUID();

  // Circuit admission happens once per logical request, before any budget slot
  // is consumed: a request that will not reach the network must not spend VA
  // quota. Distributed runtimes require the shared coordinator — an unreachable
  // coordinator is `unavailable` and fails closed rather than assuming the
  // fleet circuit is closed.
  const circuit = await evaluateVaOutboundCircuit({
    service: args.service,
    distributed,
  });
  if (circuit.decision === "unavailable") {
    return fallback(VA_SHARED_STATE_REQUIRED_ERROR, environment, requestId);
  }
  const probeAdmitted = circuit.decision === "probe";
  if (circuit.decision === "blocked") {
    const observation: VaApiObservation = {
      requestId,
      service: args.service,
      path: args.path,
      attempt: 1,
      outcome: "circuit-open",
      durationMs: 0,
    };
    args.observe?.(observation);
    vaApiLogger.warn("va request blocked by circuit breaker", {
      requestId,
      service: args.service,
      path: args.path,
      outcome: "circuit-open",
    });
    recordVaApiError({ service: args.service, outcome: "circuit-open", environment });
    return fallback(
      `VA ${environment} ${args.service} is temporarily unavailable (circuit open). Using local reference fallback.`,
      environment,
      requestId,
    );
  }

  for (let attempt = 1; attempt <= VA_API_MAX_RETRIES + 1; attempt += 1) {
    if (distributed) {
      // Every attempt, including retries, atomically reserves a consumer-wide
      // slot; a coordinator failure fails closed for the whole request. A probe
      // claimed above is released so a dead lease does not block the fleet.
      if (!(await reserveVaSharedConsumerSlot())) {
        await abandonVaOutboundCircuitProbe(args.service, { distributed });
        return fallback(VA_SHARED_STATE_REQUIRED_ERROR, environment, requestId);
      }
    } else if (!claimOutboundRequestSlot(args.service)) {
      await abandonVaOutboundCircuitProbe(args.service, { distributed });
      args.observe?.({
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome: "rate-limited",
        durationMs: 0,
      });
      return fallback(
        `VA ${environment} ${args.service} request was blocked by the single-process outbound request budget.`,
        environment,
        requestId,
      );
    }

    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), args.config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: args.apiKey,
          "X-Request-ID": requestId,
        },
        // Never follow a redirect: a redirected request would replay the VA
        // apikey header to a cross-origin location chosen by the response.
        redirect: "error",
        signal: controller.signal,
      });

      if (!response.ok) {
        const durationMs = Date.now() - startedAt;
        const observation: VaApiObservation = {
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "http-error",
          status: response.status,
          durationMs,
        };
        args.observe?.(observation);
        vaApiLogger.warn("va request http error", {
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "http-error",
          status: response.status,
          durationMs,
          environment,
        });
        recordVaApiLatency(durationMs, { service: args.service, outcome: "http-error", environment });
        recordVaApiError({ service: args.service, outcome: "http-error", environment, status: response.status });

        // Do not retry a 429: failing over immediately reduces pressure on the
        // upstream rate limit. The 429 also opens the circuit for the clamped
        // Retry-After window (see `recordVaOutboundCircuitOutcome`), so the
        // whole consumer — not just this request — backs off. Transient
        // 503/504 responses are retried with exponential backoff (100ms, 200ms)
        // plus bounded jitter up to VA_API_MAX_RETRIES attempts.
        if (
          attempt <= VA_API_MAX_RETRIES &&
          RETRYABLE_STATUS.has(response.status)
        ) {
          const delayMs = vaApiRetryDelayMs(attempt);
          vaApiLogger.info("va request retrying after transient error", {
            requestId,
            service: args.service,
            path: endpoint.pathname,
            attempt,
            status: response.status,
            delayMs,
          });
          await sleep(delayMs);
          continue;
        }
        const rateLimited = response.status === 429;
        await recordVaOutboundCircuitOutcome({
          service: args.service,
          distributed,
          success: false,
          rateLimited,
          retryAfterMs: rateLimited
            ? parseRetryAfterMs(response.headers.get("retry-after"))
            : undefined,
          probeAdmitted,
          admission: circuit,
        });
        return fallback(
          `VA ${environment} request failed with status ${response.status}.`,
          environment,
          requestId,
        );
      }

      const payload = await readBoundedJson(response, VA_API_MAX_RESPONSE_BYTES);
      const parsed = args.schema.safeParse(payload);
      if (!parsed.success) {
        const durationMs = Date.now() - startedAt;
        const observation: VaApiObservation = {
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "invalid-payload",
          status: response.status,
          durationMs,
        };
        args.observe?.(observation);
        vaApiLogger.warn("va request invalid payload", {
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "invalid-payload",
          status: response.status,
          durationMs,
          environment,
        });
        recordVaApiLatency(durationMs, { service: args.service, outcome: "invalid-payload", environment });
        recordVaApiError({ service: args.service, outcome: "invalid-payload", environment });
        await recordVaOutboundCircuitOutcome({
          service: args.service,
          distributed,
          success: false,
          probeAdmitted,
          admission: circuit,
        });
        return fallback("VA API returned an invalid response payload.", environment, requestId);
      }

      const durationMs = Date.now() - startedAt;
      const observation: VaApiObservation = {
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome: "success",
        status: response.status,
        durationMs,
      };
      args.observe?.(observation);
      vaApiLogger.info("va request success", {
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome: "success",
        status: response.status,
        durationMs,
        environment,
      });
      recordVaApiLatency(durationMs, { service: args.service, outcome: "success", environment });
      await recordVaOutboundCircuitOutcome({
        service: args.service,
        distributed,
        success: true,
        probeAdmitted,
        admission: circuit,
      });
      return {
        success: true,
        data: parsed.data,
        source: liveSource(environment),
        environment,
        requestId,
      };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      const durationMs = Date.now() - startedAt;
      const outcome = timedOut ? "timeout" : "network-error";
      const observation: VaApiObservation = {
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome,
        durationMs,
      };
      args.observe?.(observation);
      vaApiLogger.warn(`va request ${outcome}`, {
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome,
        durationMs,
        environment,
      });
      recordVaApiLatency(durationMs, { service: args.service, outcome, environment });
      recordVaApiError({ service: args.service, outcome, environment });

      if (attempt <= VA_API_MAX_RETRIES) {
        const delayMs = vaApiRetryDelayMs(attempt);
        vaApiLogger.info("va request retrying after network/timeout", {
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome,
          delayMs,
        });
        await sleep(delayMs);
        continue;
      }
      await recordVaOutboundCircuitOutcome({
        service: args.service,
        distributed,
        success: false,
        probeAdmitted,
        admission: circuit,
      });
      return fallback(
        timedOut
          ? `VA ${environment} request timed out.`
          : `VA ${environment} request failed before a valid response was received.`,
        environment,
        requestId,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return fallback(`VA ${environment} request failed.`, environment, requestId);
}

export async function fetchVaForms(
  query?: string,
  options: VaApiRequestOptions = {},
): Promise<VaApiResult<VaFormIndex>> {
  const config = options.config ?? loadVaApiConfig();
  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();
  if (normalizedQuery) params.set("query", normalizedQuery);

  return requestVaJson({
    service: "va-forms",
    apiKey: config.formsApiKey,
    baseUrl: config.formsBaseUrl,
    path: "/forms",
    schema: formsIndexSchema,
    config,
    observe: options.observe,
    query: params,
  });
}

export async function fetchVaDisabilityReference(
  options: VaApiRequestOptions = {},
): Promise<VaApiResult<VaDisabilityReference>> {
  const config = options.config ?? loadVaApiConfig();

  return requestVaJson({
    service: "benefits-reference-data",
    apiKey: config.benefitsReferenceDataApiKey,
    baseUrl: config.benefitsReferenceDataBaseUrl,
    path: "/disabilities",
    schema: disabilityReferenceSchema,
    config,
    observe: options.observe,
  });
}

export async function fetchVaServiceBranches(
  options: VaApiRequestOptions = {},
): Promise<VaApiResult<VaServiceBranchReference>> {
  const config = options.config ?? loadVaApiConfig();

  return requestVaJson({
    service: "benefits-reference-data",
    apiKey: config.benefitsReferenceDataApiKey,
    baseUrl: config.benefitsReferenceDataBaseUrl,
    path: "/service-branches",
    schema: serviceBranchReferenceSchema,
    config,
    observe: options.observe,
  });
}

export interface AccreditedRepresentativeSearchParams {
  zip: string;
  radiusMiles?: number;
  type?: "VSO" | "agent" | "attorney";
}

const accreditedRepItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  organization: z.string().min(1).nullable().optional(),
  accreditationType: z.enum(["VSO", "agent", "attorney"]),
  // Optional, free-form directory data (e.g. "PTSD claims", "Aid & Attendance").
  // Rendered only when present — never fabricated locally.
  specializations: z.array(z.string().min(1)).nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  website: trustedHttpsUrlSchema.nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  zip: z.string().regex(/^\d{5}$/),
  distanceMiles: z.number().nonnegative().nullable().optional(),
}).passthrough();

const accreditedRepIndexSchema = z.object({
  data: z.array(accreditedRepItemSchema),
}).passthrough();

export type VaAccreditedRepIndex = z.infer<typeof accreditedRepIndexSchema>;
export type VaAccreditedRepresentative = z.infer<typeof accreditedRepItemSchema>;

export function normalizeAccreditedRepSearchParams(
  params: AccreditedRepresentativeSearchParams,
): Required<AccreditedRepresentativeSearchParams> | null {
  const zip = params.zip.trim();
  if (!/^\d{5}$/.test(zip)) return null;
  const radius = params.radiusMiles ?? 50;
  const allowedRadii = [25, 50, 100] as const;
  const radiusMiles = (allowedRadii as readonly number[]).includes(radius) ? radius : 50;
  const allowedTypes = new Set(["VSO", "agent", "attorney"]);
  const type = params.type && allowedTypes.has(params.type) ? params.type : undefined;
  return { zip, radiusMiles, type: type as "VSO" | "agent" | "attorney" | undefined } as Required<AccreditedRepresentativeSearchParams>;
}

export async function fetchVaAccreditedRepresentatives(
  params: AccreditedRepresentativeSearchParams,
  options: VaApiRequestOptions = {},
): Promise<VaApiResult<VaAccreditedRepIndex>> {
  const config = options.config ?? loadVaApiConfig();
  const normalized = normalizeAccreditedRepSearchParams(params);
  if (!normalized) {
    return fallback<VaAccreditedRepIndex>("Zip must be 5 digits.", config.environment ?? "sandbox");
  }
  const query = new URLSearchParams();
  query.set("zip", normalized.zip);
  query.set("radius", String(normalized.radiusMiles));
  if (normalized.type) query.set("type", normalized.type);

  // Per-service flag in addition to generic VA_API_ENABLED — lets the locator
  // roll independently of forms/reference during credential gating.
  if (!config.accreditedRepEnabled) {
    return fallback<VaAccreditedRepIndex>(
      "VA accredited-representative lookup is disabled by feature flag.",
      config.environment ?? "sandbox",
    );
  }

  return requestVaJson({
    service: "accredited-representatives",
    apiKey: config.accreditedRepApiKey,
    baseUrl: (config.accreditedRepBaseUrl as string) ?? DEFAULT_ACCREDITED_REP_BASE_URLS[config.environment === "production" ? "production" : "sandbox"],
    path: "/representatives",
    schema: accreditedRepIndexSchema,
    config,
    observe: options.observe,
    query,
  });
}
