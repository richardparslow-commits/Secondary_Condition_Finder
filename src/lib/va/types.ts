export interface VaDisabilityRating {
  ratingPercentage: number;
  effectiveDate: string;
  conditionsConnected: { name: string; diagnosticCode: string }[];
}

export interface VABitsPayload {
  disabilityRating?: number;
  serviceConnectedConditions?: string[];
  source: "va-sandbox-api" | "local-fallback";
}

export interface VaAdapterOptions {
  timeoutMs?: number;
  forceFallback?: boolean;
}

export interface VASandboxConfig {
  enabled?: boolean;
  timeoutMs?: number;
  mockFailureMode?: "timeout" | "error" | "none";
}

export interface VaAdapterConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  enableSandbox?: boolean;
}

export interface VaAdapterResponse<T> {
  success: boolean;
  data: T;
  source: "va-sandbox-api" | "local-fallback";
  error?: string;
}

export type VaAdapterResult<T> = VaAdapterResponse<T>;
