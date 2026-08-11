import { randomUUID } from "node:crypto";

import { z } from "zod";

const DEFAULT_FORMS_SANDBOX_BASE_URL =
  "https://sandbox-api.va.gov/services/va_forms/v0";
const DEFAULT_REFERENCE_SANDBOX_BASE_URL =
  "https://sandbox-api.va.gov/services/benefits-reference-data/v1";
const DEFAULT_TIMEOUT_MS = 4_000;
const RETRYABLE_STATUS = new Set([429, 503, 504]);

export interface VaSandboxConfig {
  enabled: boolean;
  apiKey?: string;
  formsBaseUrl: string;
  benefitsReferenceDataBaseUrl: string;
  timeoutMs: number;
}

export interface VaSandboxObservation {
  requestId: string;
  service: "va-forms" | "benefits-reference-data";
  path: string;
  attempt: number;
  outcome: "success" | "http-error" | "timeout" | "network-error" | "invalid-payload";
  status?: number;
  durationMs: number;
}

export interface VaSandboxResult<T> {
  success: boolean;
  data: T | null;
  source: "va-sandbox-api" | "local-fallback";
  requestId?: string;
  error?: string;
}

export interface VaSandboxRequestOptions {
  config?: VaSandboxConfig;
  observe?: (observation: VaSandboxObservation) => void;
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

export type VaFormIndex = z.infer<typeof formsIndexSchema>;
export type VaDisabilityReference = z.infer<typeof disabilityReferenceSchema>;

export function loadVaSandboxConfig(
  env: NodeJS.ProcessEnv = process.env,
): VaSandboxConfig {
  const timeout = Number(env.VA_SANDBOX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    enabled: env.VA_SANDBOX_ENABLED === "true",
    apiKey: env.VA_SANDBOX_API_KEY?.trim() || undefined,
    formsBaseUrl:
      env.VA_FORMS_SANDBOX_BASE_URL?.trim() || DEFAULT_FORMS_SANDBOX_BASE_URL,
    benefitsReferenceDataBaseUrl:
      env.VA_BENEFITS_REFERENCE_SANDBOX_BASE_URL?.trim() ||
      DEFAULT_REFERENCE_SANDBOX_BASE_URL,
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0 ? Math.floor(timeout) : DEFAULT_TIMEOUT_MS,
  };
}

function fallback<T>(error: string, requestId?: string): VaSandboxResult<T> {
  return {
    success: false,
    data: null,
    source: "local-fallback",
    requestId,
    error,
  };
}

function validatedBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

async function requestSandboxJson<T>(args: {
  service: VaSandboxObservation["service"];
  baseUrl: string;
  path: string;
  schema: z.ZodType<T>;
  config: VaSandboxConfig;
  observe?: VaSandboxRequestOptions["observe"];
  query?: URLSearchParams;
}): Promise<VaSandboxResult<T>> {
  if (!args.config.enabled) {
    return fallback("VA sandbox integration is disabled by feature flag.");
  }
  if (!args.config.apiKey) {
    return fallback("VA sandbox API key is required when integration is enabled.");
  }

  const baseUrl = validatedBaseUrl(args.baseUrl);
  if (!baseUrl) {
    return fallback("VA sandbox base URL must be a valid HTTPS URL.");
  }

  const endpoint = new URL(args.path.replace(/^\//, ""), `${baseUrl.toString().replace(/\/$/, "")}/`);
  if (args.query) endpoint.search = args.query.toString();
  const requestId = randomUUID();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeoutId = setTimeout(() => controller.abort(), args.config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: args.config.apiKey,
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

        if (attempt === 1 && RETRYABLE_STATUS.has(response.status)) continue;
        return fallback(
          `VA sandbox request failed with status ${response.status}.`,
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
        return fallback("VA sandbox returned an invalid response payload.", requestId);
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
        source: "va-sandbox-api",
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

      if (attempt === 1) continue;
      return fallback(
        timedOut
          ? "VA sandbox request timed out."
          : "VA sandbox request failed before a valid response was received.",
        requestId,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return fallback("VA sandbox request failed.", requestId);
}

export async function fetchVaForms(
  query?: string,
  options: VaSandboxRequestOptions = {},
): Promise<VaSandboxResult<VaFormIndex>> {
  const config = options.config ?? loadVaSandboxConfig();
  const params = new URLSearchParams();
  const normalizedQuery = query?.trim();
  if (normalizedQuery) params.set("query", normalizedQuery);

  return requestSandboxJson({
    service: "va-forms",
    baseUrl: config.formsBaseUrl,
    path: "/forms",
    schema: formsIndexSchema,
    config,
    observe: options.observe,
    query: params,
  });
}

export async function fetchVaDisabilityReference(
  options: VaSandboxRequestOptions = {},
): Promise<VaSandboxResult<VaDisabilityReference>> {
  const config = options.config ?? loadVaSandboxConfig();

  return requestSandboxJson({
    service: "benefits-reference-data",
    baseUrl: config.benefitsReferenceDataBaseUrl,
    path: "/disabilities",
    schema: disabilityReferenceSchema,
    config,
    observe: options.observe,
  });
}
