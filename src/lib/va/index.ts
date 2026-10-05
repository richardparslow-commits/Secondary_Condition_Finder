import { z } from "zod";

export interface VaDisabilityRating {
  ratingPercentage: number;
  effectiveDate: string;
  conditionsConnected: { name: string; diagnosticCode: string; serviceConnected: boolean }[];
}

export interface VaAdapterConfig {
  enabled: boolean;
  timeoutMs?: number;
  mockFailureMode?: "none" | "timeout" | "error";
  baseUrl?: string;
  apiKey?: string;
}

export interface VaAdapterResult<T> {
  success: boolean;
  data: T | null;
  source: "va-sandbox-api" | "local-fallback";
  error?: string;
}

const vaDisabilityRatingSchema = z.object({
  ratingPercentage: z.number().min(0).max(100),
  effectiveDate: z.string().min(1),
  conditionsConnected: z.array(
    z.object({
      name: z.string().min(1),
      diagnosticCode: z.string().min(1),
      serviceConnected: z.boolean(),
    }),
  ),
});

function missingConfigError(message: string): VaAdapterResult<VaDisabilityRating> {
  return {
    success: false,
    data: null,
    source: "local-fallback",
    error: message,
  };
}

export async function fetchSandboxVABits(
  userId: string,
  config: VaAdapterConfig = { enabled: true, timeoutMs: 1000, mockFailureMode: "none" },
): Promise<VaAdapterResult<VaDisabilityRating>> {
  if (!config.enabled) {
    return {
      success: false,
      data: null,
      source: "local-fallback",
      error: "VA API integration is disabled by feature flag.",
    };
  }

  const timeout = config.timeoutMs || 1000;
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return missingConfigError("VA API request requires a non-empty userId.");
  }

  if (!config.baseUrl?.trim()) {
    return missingConfigError("VA API baseUrl is required when integration is enabled.");
  }

  if (!config.apiKey?.trim()) {
    return missingConfigError("VA API apiKey is required when integration is enabled.");
  }

  if (config.mockFailureMode === "timeout") {
    try {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gateway Timeout")), timeout),
      );
    } catch {
      return {
        success: false,
        data: null,
        source: "local-fallback",
        error: "Gateway Timeout: Upstream VA API did not respond within threshold.",
      };
    }
  }

  if (config.mockFailureMode === "error") {
    return {
      success: false,
      data: null,
      source: "local-fallback",
      error: "Internal Server Error (500): VA API backend failure.",
    };
  }

  let endpoint: URL;

  try {
    endpoint = new URL(config.baseUrl);
  } catch {
    return missingConfigError("VA API baseUrl must be a valid absolute URL.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + config.apiKey,
        "X-User-Id": normalizedUserId,
      },
      signal: controller.signal,
      // Never replay the bearer credential to a redirected origin.
      redirect: "error",
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        source: "local-fallback",
        error: `VA API request failed with status ${response.status}.`,
      };
    }

    const parsedPayload = vaDisabilityRatingSchema.safeParse(await response.json());

    if (!parsedPayload.success) {
      return {
        success: false,
        data: null,
        source: "local-fallback",
        error: "VA API returned an invalid disability rating payload.",
      };
    }

    return {
      success: true,
      data: parsedPayload.data,
      source: "va-sandbox-api",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        data: null,
        source: "local-fallback",
        error: "Gateway Timeout: Upstream VA API did not respond within threshold.",
      };
    }

    return {
      success: false,
      data: null,
      source: "local-fallback",
      error: "VA API request failed before a valid response was received.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
