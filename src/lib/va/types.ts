export interface VaApiCondition {
  id: string;
  name: string;
  icdCode?: string;
  diagnosticCode?: string;
}

export interface VaAdapterConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  enableSandbox?: boolean;
}

export interface VaAdapterResult<T> {
  data: T | null;
  source: 'va-api' | 'local-fallback';
  error?: string;
}
