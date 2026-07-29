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

/**
  * Canonical unified VA Adapter client function.
  * Handles feature flags, simulated timeouts, upstream server errors (500),
  * and graceful fallback to local data models.
  */
export async function fetchSandboxVABits(
  userId: string,
  config: VaAdapterConfig = { enabled: true, timeoutMs: 1000, mockFailureMode: "none" }
): Promise<VaAdapterResult<VaDisabilityRating>> {
  if (!config.enabled) {
    return {
      success: false,
      data: null,
      source: "local-fallback",
      error: "VA API integration is disabled by feature flag."
    };
  }

  const timeout = config.timeoutMs || 1000;

  // Handle simulated failure modes for resilience testing
  if (config.mockFailureMode === "timeout") {
    try {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("Gateway Timeout")), timeout));
    } catch (err) {
      return {
        success: false,
        data: null,
        source: "local-fallback",
        error: "Gateway Timeout: Upstream VA API did not respond within threshold."
      };
    }
  }

  if (config.mockFailureMode === "error") {
    return {
      success: false,
      data: null,
      source: "local-fallback",
      error: "Internal Server Error (500): VA API backend failure."
    };
  }

  // Simulate successful normal operation
  return {
    success: true,
    data: {
      ratingPercentage: 70,
      effectiveDate: "2024-01-01",
      conditionsConnected: [
        { name: "Post-Traumatic Stress Disorder (PTSD)", diagnosticCode: "9411", serviceConnected: true },
        { name: "Tinnitus", diagnosticCode: "6260", serviceConnected: true }
      ]
    },
    source: "va-sandbox-api"
  };
}
