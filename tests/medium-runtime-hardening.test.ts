import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertSafeDocxArchive,
  extractTextEvidence,
  MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES,
  MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES,
} from "@/lib/evidence/document-extract";
import {
  clearPresumptiveHistory,
  readPresumptiveHistory,
  writePresumptiveHistory,
} from "@/lib/presumptive/browser-history";
import {
  clearVaReferenceCache,
  readVaReferenceCache,
  VA_REFERENCE_CACHE_MAX_ENTRIES,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";
import { clearCircuitBreakerState } from "@/lib/va/circuit-breaker";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import { clearVaFormsFinderCache, loadVaFormsFinder } from "@/lib/va/forms-finder";

const config: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-test-key",
  benefitsReferenceDataApiKey: "reference-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

function oneEntryZipDirectory(uncompressedBytes: number): ArrayBuffer {
  const centralDirectoryBytes = 46;
  const eocdBytes = 22;
  const buffer = new ArrayBuffer(centralDirectoryBytes + eocdBytes);
  const view = new DataView(buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint32(24, uncompressedBytes, true);
  view.setUint16(28, 0, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);

  const eocd = centralDirectoryBytes;
  view.setUint32(eocd, 0x06054b50, true);
  view.setUint16(eocd + 4, 0, true);
  view.setUint16(eocd + 6, 0, true);
  view.setUint16(eocd + 8, 1, true);
  view.setUint16(eocd + 10, 1, true);
  view.setUint32(eocd + 12, centralDirectoryBytes, true);
  view.setUint32(eocd + 16, 0, true);
  view.setUint16(eocd + 20, 0, true);
  return buffer;
}

afterEach(() => {
  clearVaReferenceCache();
  clearVaApiOutboundRateLimitState();
  // A 429 now opens the circuit for its Retry-After window, so the breaker is
  // per-test state just like the single-process outbound budget.
  clearCircuitBreakerState();
  clearVaFormsFinderCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("medium-severity runtime hardening", () => {
  it("keeps the presumptive browser-local history wrapper in the executable test surface", () => {
    expect(typeof readPresumptiveHistory).toBe("function");
    expect(typeof writePresumptiveHistory).toBe("function");
    expect(typeof clearPresumptiveHistory).toBe("function");
  });

  it("bounds the process-local VA reference cache and evicts the least-recently-used entry", () => {
    for (let index = 0; index < VA_REFERENCE_CACHE_MAX_ENTRIES; index += 1) {
      writeVaReferenceCache(`key-${index}`, { index }, 1_000);
    }
    expect(readVaReferenceCache<{ index: number }>("key-0", 1_001)).toEqual({ index: 0 });

    writeVaReferenceCache("new-key", { index: 999 }, 1_002);

    expect(readVaReferenceCache("key-1", 1_003)).toBeNull();
    expect(readVaReferenceCache("key-0", 1_003)).toEqual({ index: 0 });
    expect(readVaReferenceCache("new-key", 1_003)).toEqual({ index: 999 });
  });

  it("rejects declared DOCX expansion before Mammoth extraction", () => {
    expect(() =>
      assertSafeDocxArchive(
        oneEntryZipDirectory(MAX_LOCAL_EVIDENCE_DOCX_UNCOMPRESSED_BYTES + 1),
        "oversized.docx",
      ),
    ).toThrow(/declares more than/i);
  });

  it("rejects oversized raw text before reading its body", async () => {
    const text = vi.fn().mockRejectedValue(new Error("body should not be read"));
    const fakeFile = {
      name: "oversized.txt",
      type: "text/plain",
      size: MAX_LOCAL_EVIDENCE_TEXT_FILE_BYTES + 1,
      text,
    } as unknown as File;

    await expect(extractTextEvidence(fakeFile)).rejects.toThrow(/raw text preflight limit/i);
    expect(text).not.toHaveBeenCalled();
  });

  it("does not retry an upstream 429 response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchVaForms("21-526EZ", { config });

    expect(result.success).toBe(false);
    expect(result.error).toContain("status 429");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops outbound VA requests when the per-process request budget is exhausted", async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    for (let index = 0; index < VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE; index += 1) {
      const result = await fetchVaForms(`form-${index}`, { config });
      expect(result.success).toBe(true);
    }
    const blocked = await fetchVaForms("one-too-many", { config });

    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain("outbound request budget");
    expect(fetchSpy).toHaveBeenCalledTimes(VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE);
  });

  it("keeps Forms Finder fallback behavior available when VA integration is disabled", async () => {
    vi.stubEnv("VA_API_ENABLED", "false");
    const view = await loadVaFormsFinder("21-526EZ");

    expect(view.live).toBe(false);
    expect(view.source).toBe("local-fallback");
    expect(view.items[0]?.formName).toBe("21-526EZ");
  });
});
