import { afterEach, describe, expect, it, vi } from "vitest";

import {
  identitiesMatch,
  parseTigerPreviewConnection,
} from "@/lib/tiger/preview-catalog-probe";

const baseUrl = "postgres://preview_catalog_reader:example-placeholder@yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com:37615/tsdb?sslmode=require";

describe("Tiger Cloud Preview configuration", () => {
  it("accepts only the designated reader, service and verified TLS", () => {
    const config = parseTigerPreviewConnection(baseUrl);
    expect(config.user).toBe("preview_catalog_reader");
    expect(config.database).toBe("tsdb");
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.query_timeout).toBeLessThanOrEqual(8000);
  });

  it.each([
    baseUrl.replace("preview_catalog_reader", "tsdbadmin"),
    baseUrl.replace("yc5kzxwazj.", "untrusted01."),
    baseUrl.replace("37615", "5432"),
    baseUrl.replace("sslmode=require", "sslmode=disable"),
    baseUrl.replace("example-placeholder", ""),
  ])("refuses an unsafe database connection", (url) => {
    expect(() => parseTigerPreviewConnection(url)).toThrow();
  });
});

describe("Tiger catalog identity comparison", () => {
  const reference = [
    { id: "ptsd", name: "PTSD" },
    { id: "migraine", name: "Migraine" },
  ];

  it("checks exact IDs and names, regardless of row order", () => {
    expect(identitiesMatch(reference, [...reference].reverse())).toBe(true);
  });

  it("rejects count-only matches and duplicate IDs", () => {
    expect(identitiesMatch(reference, [
      { id: "ptsd", name: "PTSD" },
      { id: "migraine", name: "Different Name" },
    ])).toBe(false);
    expect(identitiesMatch(reference, [reference[0], reference[0]])).toBe(false);
    expect(identitiesMatch(reference, [reference[0]])).toBe(false);
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

describe("Preview-only Tiger probe route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    probe.run.mockReset();
  });

  it("is absent outside Vercel Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    expect((await POST(makeRequest(true))).status).toBe(404);
    expect(probe.run).not.toHaveBeenCalled();
  });

  it("refuses unauthenticated requests", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    expect((await POST(makeRequest(false))).status).toBe(404);
    expect(probe.run).not.toHaveBeenCalled();
  });

  it("does not run without a Preview connection secret", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", "");
    expect((await POST(makeRequest(true))).status).toBe(503);
  });

  it("distinguishes a successful connection from an absent catalog", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    probe.run.mockResolvedValue({
      connection: "ok", catalog: "missing_tables", referenceConditions: 819,
      remoteConditions: null, remoteTerms: null, remoteEdges: null,
    });
    const result = await POST(makeRequest(true));
    expect(result.status).toBe(409);
    expect((await result.json()).catalog).toBe("missing_tables");
    expect(result.headers.get("cache-control")).toContain("no-store");
  });

  it("returns success only for exact catalog identity parity", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    probe.run.mockResolvedValue({
      connection: "ok", catalog: "identities_match", referenceConditions: 819,
      remoteConditions: 819, remoteTerms: 2165, remoteEdges: 875,
    });
    const result = await POST(makeRequest(true));
    expect(result.status).toBe(200);
  });

  it("withholds database error details on failures", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TIGER_CATALOG_PROBE_TOKEN", key);
    vi.stubEnv("TIGER_DATABASE_URL", baseUrl);
    probe.run.mockRejectedValue(new Error("sensitive internal database diagnostics"));
    const result = await POST(makeRequest(true));
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain("sensitive");
  });
});
