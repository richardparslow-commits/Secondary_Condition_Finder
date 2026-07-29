import { VaAdapterConfig, VaAdapterResult, VaApiCondition } from './types';

const DEFAULT_TIMEOUT_MS = 3000;

export class VaSandboxAdapter {
  private config: VaAdapterConfig;

  constructor(config: VaAdapterConfig = {}) {
    this.config = {
      baseUrl: process.env.VA_API_BASE_URL || 'https://sandbox-api.va.gov/services/disabilities/v1',
      apiKey: process.env.VA_API_KEY || '',
      timeoutMs: config.timeoutMs || DEFAULT_TIMEOUT_MS,
      enableSandbox: config.enableSandbox ?? (process.env.NODE_ENV !== 'production' || Boolean(process.env.VA_API_KEY)),
    };
  }

  /**
   * Safe fetch helper with timeout and graceful fallback flag
   */
  async fetchWithFallback<T>(
    endpoint: string,
    fallbackData: T
  ): Promise<VaAdapterResult<T>> {
    // Fallback immediately if sandbox/API is disabled or API key is missing
    if (!this.config.enableSandbox || !this.config.apiKey) {
      return {
        data: fallbackData,
        source: 'local-fallback',
        error: 'VA API key not configured or sandbox disabled; using local fallback.',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        headers: {
          'ApiKey': this.config.apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`VA API returned status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return {
        data: json as T,
        source: 'va-api',
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errorMessage = err.name === 'AbortError' 
        ? `VA API request timed out after ${this.config.timeoutMs}ms`
        : err.message || 'Unknown VA API error';

      return {
        data: fallbackData,
        source: 'local-fallback',
        error: `VA API error (${errorMessage}); cleanly falling back to local data.`,
      };
    }
  }
}

export const vaSandboxAdapter = new VaSandboxAdapter();
