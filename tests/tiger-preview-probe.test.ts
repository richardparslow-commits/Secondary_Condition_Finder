import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCatalogReference,
  exactRowsMatch,
  parseTigerPreviewConnection,
} from "@/lib/tiger/preview-catalog-probe";

const baseUrl =
  "postgres://preview_catalog_reader:example-placeholder@m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com:30902/tsdb?sslmode=require";

describe("Tiger DEV Preview connection safety", () => {
  it("pins the non-production service, dedicated reader and TLS", () => {
    const config = parseTigerPreviewConnection(baseUrl);
    expect(config.user).toBe("preview_catalog_reader");
    expect(config.database).toBe("tsdb");
    expect(config.host.startsWith("m8vrpmo6ec.")).toBe(true);
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.query_timeout).toBeLessThanOrEqual(8000);
  });

  it.each([
    baseUrl.replace("preview_catalog_reader", "tsdbadmin"),
    baseUrl.replace("m8vrpmo6ec.", "yc5kzxwazj."),
    baseUrl.replace("m8vrpmo6ec.", "untrusted01."),
    baseUrl.replace("30902", "5432"),
    baseUrl.replace("sslmode=require", "sslmode=disable"),
    baseUrl.replace("example-placeholder", ""),
  ])("rejects unsafe Preview connection settings", (url) => {
    expect(() => parseTigerPreviewConnection(url)).toThrow();
  });
});

describe("Tiger Cloud exact catalog parity", () => {
  it("generates the already validated immutable Tiger Cloud snapshot", () => {
    const data = buildCatalogReference();
    expect(data.conditions).toHaveLength(819);
    expect(data.terms).toHaveLength(2165);
    expect(data.edges).toHaveLength(875);
    expect(data.conditions.filter((row) => row[2])).toHaveLength(140);
    expect(data.snapshot).toBe(
      "b24de5cf62e227e20e7da79b0c9acd3855413e30309638a55c474b1093bc2d21",
    );
  });

  it("matches complete rows regardless of order", () => {
    expect(exactRowsMatch([["ptsd", "PTSD", true], ["migraine", "Migraine", false]],
      [["migraine", "Migraine", false], ["ptsd", "PTSD", true]])).toBe(true);
  });

  it("rejects changed condition names or publication states", () => {
    const expected = [["ptsd", "PTSD", true]] as const;
    expect(exactRowsMatch(expected, [["ptsd", "Wrong", true]])).toBe(false);
    expect(exactRowsMatch(expected, [["ptsd", "PTSD", false]])).toBe(false);
  });

  it("rejects alias differences even with identical term counts", () => {
    const expected = [["post traumatic stress disorder", "ptsd"]] as const;
    expect(exactRowsMatch(expected, [["post traumatic stress disorder", "migraine"]])).toBe(false);
    expect(exactRowsMatch(expected, [["ptsd", "ptsd"]])).toBe(false);
  });

  it("rejects ranked pathway differences and altered directions", () => {
    const expected = [["ptsd", "migraine", 1]] as const;
    expect(exactRowsMatch(expected, [["ptsd", "migraine", 2]])).toBe(false);
    expect(exactRowsMatch(expected, [["migraine", "ptsd", 1]])).toBe(false);
  });

  it("rejects omitted and duplicate rows", () => {
    expect(exactRowsMatch([["a", "b"], ["c", "d"]], [["a", "b"]])).toBe(false);
    expect(exactRowsMatch([["a", "b"], ["c", "d"]], [["a", "b"], ["a", "b"]])).toBe(false);
    expect(exactRowsMatch([["a", "b"]], [["a", "b"], ["x", "y"]])).toBe(false);
  });
});

const probe = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/tiger/preview-catalog-probe", async (original) => {
  const other = await original<typeof import("@/lib/tiger/preview-catalog-probe")>();
  return { ...other, probePreviewCatalog: probe.run };
});

import { POST } from "@/app/api/internal/tiger-catalog-compare/route";

const key = "very-long-standalone-probe-token-for-test-only";
const makeRequest = (authorized: boolean) =>
  new Request("https://preview.example.test/api/internal/tiger-catalog-compare", {
    method: "POST",
    headers: authorized ? { Authorization: "Bearer " + key } : {},
  });

describe("Preview-only Tiger parity endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    probe.run.mockReset();
  });

  it.each(["production", "development", ""])("refuses non-Preview Vercel environment %s", async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    expect((await POST(makeRequest(true))).status).toBe(404);
    expect(probe.run).not.toHaveBeenCalled();
  });

  it("refuses unauthenticated callers", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    expect((await POST(makeRequest(false))).status).toBe(404);
    expect(probe.run).not.toHaveBeenCalled();
  });

  it("fails closed without the database connection secret", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", "");
    expect((await POST(makeRequest(true))).status).toBe(503);
  });

  it.each(["missing_tables", "snapshot_missing", "parity_mismatch"])(
    "does not claim success when catalog status is %s",
    async (catalog) => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
      vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
      probe.run.mockResolvedValue({
        connection: "ok", catalog, referenceConditions: 819, referenceTerms: 2165, referenceEdges: 875,
        remoteConditions: null, remoteTerms: null, remoteEdges: null, orphanEdges: null,
      });
      const result = await POST(makeRequest(true));
      expect(result.status).toBe(409);
      expect((await result.json()).catalog).toBe(catalog);
      expect(result.headers.get("cache-control")).toContain("no-store");
    },
  );

  it("returns HTTP 200 only for complete condition/term/pathway parity", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    probe.run.mockResolvedValue({
      connection: "ok", catalog: "parity_verified",
      referenceConditions: 819, referenceTerms: 2165, referenceEdges: 875,
      remoteConditions: 819, remoteTerms: 2165, remoteEdges: 875, orphanEdges: 0,
    });
    const result = await POST(makeRequest(true));
    expect(result.status).toBe(200);
    expect((await result.json()).catalog).toBe("parity_verified");
  });

  it("returns a generic failure without leaking database details", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    probe.run.mockRejectedValue(new Error("sensitive internal database diagnostics"));
    const result = await POST(makeRequest(true));
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain("sensitive");
  });
});
