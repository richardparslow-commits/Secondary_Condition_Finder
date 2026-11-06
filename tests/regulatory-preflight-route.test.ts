import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/regulatory/preflight/route";
import type {
  RegulatoryPreflightSnapshot,
  RegulatoryPreflightSourceResult,
} from "@/lib/regulatory/preflight/types";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/lib/regulatory/preflight", () => ({
  refreshRegulatoryPreflightCache: mocks.refresh,
}));

const SECRET = "s".repeat(32);
const previousSecret = process.env.REGULATORY_SYNC_SECRET;

function source(
  name: RegulatoryPreflightSourceResult["source"],
  status: RegulatoryPreflightSourceResult["status"] = "success",
): RegulatoryPreflightSourceResult {
  return {
    source: name,
    status,
    checkedAt: "2026-08-19T06:00:00.000Z",
    recordCount: 0,
  };
}

function snapshot(
  overrides: Partial<RegulatoryPreflightSnapshot> = {},
): RegulatoryPreflightSnapshot {
  return {
    schemaVersion: 1,
    snapshotId: "reg-route-test-00000001",
    startedAt: "2026-08-19T06:00:00.000Z",
    finishedAt: "2026-08-19T06:00:05.000Z",
    asOfDate: "2026-08-19",
    registryDigest: "digest",
    sourceResults: [
      source("federal-register"),
      source("oira-pending"),
      source("oira-completed"),
      source("unified-agenda"),
    ],
    changes: [],
    relevantChangeIds: [],
    freshness: "current",
    reviewMode: "full",
    legalRegulatoryConclusionsAllowed: true,
    officialEditionVerificationComplete: true,
    usedCachedRegistry: false,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  process.env.REGULATORY_SYNC_SECRET = SECRET;
  mocks.refresh.mockReset();
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.REGULATORY_SYNC_SECRET;
  else process.env.REGULATORY_SYNC_SECRET = previousSecret;
});

function request(): Request {
  return new Request("http://localhost/api/regulatory/preflight", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

describe("GET /api/regulatory/preflight", () => {
  it("reports a failed refresh when a required source did not update", async () => {
    mocks.refresh.mockResolvedValue(
      snapshot({
        freshness: "degraded",
        reviewMode: "full-with-warning",
        sourceResults: [
          source("federal-register", "failed"),
          source("oira-pending"),
          source("oira-completed"),
          source("unified-agenda"),
        ],
      }),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.freshness).toBe("degraded");
    expect(body.error).toContain("did not complete");
  });

  it("reports success when all required sources refreshed", async () => {
    mocks.refresh.mockResolvedValue(snapshot());

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body).not.toHaveProperty("error");
  });
});
