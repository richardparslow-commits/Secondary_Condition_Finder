import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  VA_SHARED_STATE_REQUIRED_ERROR,
  vaProcessLocalStateAllowed,
} from "./runtime-state";

const DEFAULT_FORMS_BASE_URLS = {
  sandbox: "https://sandbox-api.va.gov/services/va_forms/v0",
  production: "https://api.va.gov/services/va_forms/v0",
} as const;
const DEFAULT_REFERENCE_BASE_URLS = {
  sandbox: "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  production: "https://api.va.gov/services/benefits-reference-data/v1",
} as const;
const TRUSTED_API_ORIGINS = {
  sandbox: "https://sandbox-api.va.gov",
  production: "https://api.va.gov",
} as const;
const DEFAULT_TIMEOUT_MS = 4_000;
const RETRYABLE_STATUS = new Set([503, 504]);
export const VA_API_OUTBOUND_WINDOW_MS = 60_000;
export const VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE = 60;
export const VA_API_RETRY_DELAY_MS = 100;

type VaApiEnvironmentVariables = Record<string, string | undefined>;

export type VaApiEnvironment = "sandbox" | "production";
export type VaApiSource = "va-sandbox-api" | "va-production-api" | "local-fallback";

export interface VaApiConfig {
  enabled: boolean;
  environment?: VaApiEnvironment;
  formsApiKey?: string;
  benefitsReferenceDataApiKey?: string;
  formsBaseUrl: string;
  benefitsReferenceDataBaseUrl: string;
  timeoutMs: number;
}

/** Backward-compatible name retained for existing tests and callers. */
export type VaSandboxConfig = VaApiConfig;

export interface VaApiObservation {
  requestId: string;
  service: "va-forms" | "benefits-reference-data";
  path: string;
  attempt: number;
  outcome: "success" | "http-error" | "timeout" | "network-error" | "invalid-payload" | "rate-limited";
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

const formIndexItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  attributes: z.object({
    form_name: z.string().min(1),
    url: z.string().url(),
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

function requestedEnvironment(env: VaApiEnvironmentVariables): VaApiEnvironment {
  return env.VA_API_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

function apiEnabled(
  env: VaApiEnvironmentVariables,
  environment: VaApiEnvironment,
): boolean {
  if (env.VA_API_ENABLED !== undefined) {
    return env.VA_API_ENABLED === "true";
  }
  return environment === "sandbox" && env.VA_SANDBOX_ENABLED === "true";
}

export function loadVaApiConfig(
  env: VaApiEnvironmentVariables = process.env,
): VaApiConfig {
  const environment = requestedEnvironment(env);
  const timeout = Number(env.VA_API_TIMEOUT_MS ?? env.VA_SANDBOX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const production = environment === "production";

  return {
    enabled: apiEnabled(env, environment),
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
    formsBaseUrl:
      (production
        ? env.VA_FORMS_PRODUCTION_BASE_URL
        : env.VA_FORMS_SANDBOX_BASE_URL)?.trim() ||
      DEFAULT_FORMS_BASE_URLS[environment],
    benefitsReferenceDataBaseUrl:
      (production
        ? env.VA_BENEFITS_REFERENCE_PRODUCTION_BASE_URL
        : env.VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL)?.trim() ||
      DEFAULT_REFERENCE_BASE_URLS[environment],
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : DEFAULT_TIMEOUT_MS,
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

function liveSource(environment: VaApiEnvironment): VaApiSource {
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
  if (!vaProcessLocalStateAllowed()) {
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

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (!claimOutboundRequestSlot(args.service)) {
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
        signal: controller.signal,
      });

      if (!response.ok) {
        args.observe?.({
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "http-error",
          status: response.status,
          durationMs: Date.now() - startedAt,
        });

        // Do not immediately retry a 429; falling back reduces pressure on the
        // upstream rate limit. Only transient 503/504 responses get one delayed retry.
        if (attempt === 1 && RETRYABLE_STATUS.has(response.status)) {
          await sleep(VA_API_RETRY_DELAY_MS);
          continue;
        }
        return fallback(
          `VA ${environment} request failed with status ${response.status}.`,
          environment,
          requestId,
        );
      }

      const parsed = args.schema.safeParse(await response.json());
      if (!parsed.success) {
        args.observe?.({
          requestId,
          service: args.service,
          path: endpoint.pathname,
          attempt,
          outcome: "invalid-payload",
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
        return fallback("VA API returned an invalid response payload.", environment, requestId);
      }

      args.observe?.({
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome: "success",
        status: response.status,
        durationMs: Date.now() - startedAt,
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
      args.observe?.({
        requestId,
        service: args.service,
        path: endpoint.pathname,
        attempt,
        outcome: timedOut ? "timeout" : "network-error",
        durationMs: Date.now() - startedAt,
      });

      if (attempt === 1) {
        await sleep(VA_API_RETRY_DELAY_MS);
        continue;
      }
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
