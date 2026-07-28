/**
 * Phase 2 VA Sandbox Adapter Boundary
 * Keeps core matching engines pure and isolated from external integration states.
 */

export interface VASandboxConfig {
  enabled: boolean;
  timeoutMs: number;
  mockFailureMode?: 'timeout' | 'error' | 'none';
}

export interface VABitsPayload {
  disabilityRating?: number;
  serviceConnectedConditions?: string[];
  source: string;
}

// Global or environment-backed feature toggle for Phase 2 sandbox integration
export function isVASandboxEnabled(): boolean {
  return process.env.ENABLE_VA_SANDBOX === 'true';
}

export async function fetchSandboxVABits(
  userId: string, 
  config: VASandboxConfig = { enabled: false, timeoutMs: 3000, mockFailureMode: 'none' }
): Promise<{ success: boolean; data?: VABitsPayload; error?: string }> {
  if (!config.enabled && !isVASandboxEnabled()) {
    return { success: false, error: 'VA Sandbox integration is disabled via feature flag.' };
  }

  try {
    // Simulate failure modes for testing resilience
    if (config.mockFailureMode === 'timeout') {
      await new Promise((_, reject) => setTimeout(() => reject(new Error('VA Sandbox Gateway Timeout')), 100));
      return { success: false, error: 'Gateway Timeout' };
    }
    if (config.mockFailureMode === 'error') {
      return { success: false, error: 'VA Sandbox Internal Server Error (500)' };
    }

    // Default mock sandbox payload
    return {
      success: true,
      data: {
        disabilityRating: 70,
        serviceConnectedConditions: ['ptsd', 'tinnitus'],
        source: 'va-sandbox-mock-api'
      }
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
