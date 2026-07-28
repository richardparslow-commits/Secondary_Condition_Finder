import { describe, it, expect } from 'vitest';
import { fetchSandboxVABits } from '../src/lib/va/adapter';

describe('Phase 2 VA Adapter Failure-Mode & Resilience Suite', () => {
  it('handles feature flag disabled state gracefully', async () => {
    const result = await fetchSandboxVABits('user-123', { enabled: false, timeoutMs: 1000 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('recovers gracefully from simulated API timeouts', async () => {
    const result = await fetchSandboxVABits('user-123', { enabled: true, timeoutMs: 50, mockFailureMode: 'timeout' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('recovers gracefully from simulated upstream server errors (500)', async () => {
    const result = await fetchSandboxVABits('user-123', { enabled: true, timeoutMs: 1000, mockFailureMode: 'error' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Internal Server Error');
  });

  it('successfully retrieves mock sandbox payload when operating normally', async () => {
    const result = await fetchSandboxVABits('user-123', { enabled: true, timeoutMs: 1000, mockFailureMode: 'none' });
    expect(result.success).toBe(true);
    expect(result.data?.disabilityRating).toBe(70);
  });
});
