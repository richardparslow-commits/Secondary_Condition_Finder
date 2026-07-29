export interface VaDisabilityRating {
  ratingPercentage: number;
  effectiveDate: string;
  conditionsConnected: { name: string; diagnosticCode: string }[];
}

export interface VaAdapterOptions {
  timeoutMs?: number;
  forceFallback?: boolean;
}

export interface VaAdapterResponse<T> {
  success: boolean;
  data: T | null;
  source: "va-sandbox-api" | "local-fallback";
  error?: string;
}
