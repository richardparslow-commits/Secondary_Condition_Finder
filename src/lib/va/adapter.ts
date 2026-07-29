import type {
  VaAdapterConfig,
  VaAdapterOptions,
  VaAdapterResponse,
  VaDisabilityRating,
  VABitsPayload,
  VASandboxConfig,
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;

export function isVASandboxEnabled(): boolean {
  return process.env.ENABLE_VA_SANDBOX === "true";
}

export class VaAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly enableSandbox: boolean;

  constructor(config: VaAdapterConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.VA_API_BASE_URL ??
      "https://sandbox-api.va.gov/services/disabilities/v1";
    this.apiKey = config.apiKey ?? process.env.VA_API_KEY ?? "";
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.enableSandbox =
      config.enableSandbox ??
      (isVASandboxEnabled() && Boolean(this.apiKey));
  }

  async getDisabilityRating(
    userId: string,
    options: VaAdapterOptions = {},
  ): Promise<VaAdapterResponse<VaDisabilityRating>> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const shouldUseFallback =
      options.forceFallback === true ||
      process.env.NODE_ENV === "test" ||
      !this.enableSandbox;

    const fallbackData: VaDisabilityRating = {
      ratingPercentage: 70,
      effectiveDate: "2024-01-01",
      conditionsConnected: [
        { name: "Post-traumatic stress disorder (PTSD)", diagnosticCode: "9411" },
        { name: "Tinnitus", diagnosticCode: "6260" },
      ],
    };

    if (shouldUseFallback) {
      return {
        success: true,
        data: fallbackData,
        source: "local-fallback",
        error: "VA sandbox is disabled or unavailable; using local fallback profile.",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/ratings/${userId}`, {
        headers: {
          ApiKey: this.apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`VA API returned status ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as VaDisabilityRating;
      return {
        success: true,
        data: json,
        source: "va-sandbox-api",
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `VA API request timed out after ${timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "Unknown VA API error";

      return {
        success: true,
        data: fallbackData,
        source: "local-fallback",
        error: `VA API error (${message}); cleanly falling back to local data.`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getSandboxBits(
    userId: string,
    config: VASandboxConfig = {},
  ): Promise<VaAdapterResponse<VABitsPayload>> {
    const timeoutMs = config.timeoutMs ?? this.timeoutMs;
    const enabled = config.enabled ?? false;

    if (!enabled && !isVASandboxEnabled()) {
      return {
        success: false,
        data: { source: "local-fallback" },
        source: "local-fallback",
        error: "VA Sandbox integration is disabled via feature flag.",
      };
    }

    if (config.mockFailureMode === "error") {
      return {
        success: false,
        data: { source: "local-fallback" },
        source: "local-fallback",
        error: "VA Sandbox Internal Server Error (500)",
      };
    }

    if (config.mockFailureMode === "timeout") {
      await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
      return {
        success: false,
        data: { source: "local-fallback" },
        source: "local-fallback",
        error: `VA API request timed out after ${timeoutMs}ms`,
      };
    }

    const rating = await this.getDisabilityRating(userId, {
      timeoutMs,
      forceFallback: !enabled,
    });

    return {
      success: true,
      source: rating.source,
      data: {
        disabilityRating: rating.data.ratingPercentage,
        serviceConnectedConditions: rating.data.conditionsConnected.map((condition) =>
          condition.name.toLowerCase(),
        ),
        source: rating.source,
      },
      error: rating.error,
    };
  }
}

export const vaAdapter = new VaAdapter();

export async function fetchSandboxVABits(
  userId: string,
  config: VASandboxConfig = { enabled: false, timeoutMs: DEFAULT_TIMEOUT_MS, mockFailureMode: "none" },
): Promise<VaAdapterResponse<VABitsPayload>> {
  return vaAdapter.getSandboxBits(userId, config);
}
