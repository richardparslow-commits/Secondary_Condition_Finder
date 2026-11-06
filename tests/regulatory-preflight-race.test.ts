import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readLatestRegulatoryPreflightCache,
  readRegulatorySnapshotById,
  writeRegulatoryPreflightCache,
} from "@/lib/regulatory/preflight/cache";
import { prepareRegulatoryReview } from "@/lib/regulatory/preflight/review";
import type {
  RegulatoryPreflightCache,
  RegulatoryPreflightResult,
  RegulatoryPreflightSnapshot,
  RegulatoryPreflightSourceName,
  RegulatoryPreflightSourceResult,
} from "@/lib/regulatory/preflight/types";

const mocks = vi.hoisted(() => ({ runRegulatoryPreflight: vi.fn() }));

vi.mock("@/lib/regulatory/preflight/run-preflight", () => ({
  runRegulatoryPreflight: mocks.runRegulatoryPreflight,
}));

const source = (
  name: RegulatoryPreflightSourceName,
  status: RegulatoryPreflightSourceResult["status"] = "success",
): RegulatoryPreflightSourceResult => ({
  source: name,
  status,
  checkedAt: "2026-08-19T06:00:00.000Z",
  recordCount: 0,
});

const snapshotFor = (
  overrides: Partial<RegulatoryPreflightSnapshot> = {},
): RegulatoryPreflightSnapshot => ({
  schemaVersion: 1,
  snapshotId: "reg-verified-b-00000001",
  startedAt: "2026-08-19T06:00:00.000Z",
  finishedAt: "2026-08-19T06:00:00.000Z",
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
});

const verifiedT0 = (): RegulatoryPreflightSnapshot => snapshotFor({
  snapshotId: "reg-verified-t0-00000001",
  startedAt: "2026-08-18T10:00:00.000Z",
  finishedAt: "2026-08-18T10:00:00.000Z",
  asOfDate: "2026-08-18",
});

const cacheFor = (
  snapshot: RegulatoryPreflightSnapshot,
): RegulatoryPreflightCache => ({
  schemaVersion: 1,
  writtenAt: snapshot.finishedAt,
  snapshot,
  registry: [],
  sourceValidators: {},
});

const resultFor = (
  snapshot: RegulatoryPreflightSnapshot,
): RegulatoryPreflightResult => ({
  snapshot,
  registry: [],
  sourceValidators: {},
});

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

let cacheDir: string;
let previousCacheDir: string | undefined;

beforeEach(() => {
  previousCacheDir = process.env.REGULATORY_PREFLIGHT_CACHE_DIR;
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "regulatory-preflight-race-"));
  process.env.REGULATORY_PREFLIGHT_CACHE_DIR = cacheDir;
  mocks.runRegulatoryPreflight.mockReset();
});

afterEach(() => {
  if (previousCacheDir === undefined) delete process.env.REGULATORY_PREFLIGHT_CACHE_DIR;
  else process.env.REGULATORY_PREFLIGHT_CACHE_DIR = previousCacheDir;
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe("regulatory preflight overlap", () => {
  it("keeps the last verified latest when a slow source-failure run finishes later", async () => {
    const t0 = verifiedT0();
    writeRegulatoryPreflightCache(cacheFor(t0), cacheDir);

    const pending = deferred<RegulatoryPreflightResult>();
    mocks.runRegulatoryPreflight.mockReturnValueOnce(pending.promise);
    const slowReview = prepareRegulatoryReview({ now: "2026-08-19T06:00:00.000Z" });

    const verifiedB = snapshotFor();
    writeRegulatoryPreflightCache(cacheFor(verifiedB), cacheDir);

    const failedA = snapshotFor({
      snapshotId: "reg-failed-a-00000001",
      previousSnapshotId: t0.snapshotId,
      startedAt: "2026-08-19T06:00:00.000Z",
      finishedAt: "2026-08-19T06:00:05.000Z",
      sourceResults: [
        source("federal-register", "failed"),
        source("oira-pending"),
        source("oira-completed"),
        source("unified-agenda"),
      ],
      freshness: "degraded",
      reviewMode: "full-with-warning",
      legalRegulatoryConclusionsAllowed: true,
      cacheAgeHours: 20,
    });
    pending.resolve(resultFor(failedA));

    const prepared = await slowReview;
    expect(prepared.snapshot.snapshotId).toBe(failedA.snapshotId);
    expect(readLatestRegulatoryPreflightCache(cacheDir)?.snapshot.snapshotId).toBe(
      verifiedB.snapshotId,
    );
    expect(readRegulatorySnapshotById(failedA.snapshotId, cacheDir)).toEqual(failedA);
  });

  it("leaves latest verified when a slow run hits an internal error", async () => {
    const t0 = verifiedT0();
    writeRegulatoryPreflightCache(cacheFor(t0), cacheDir);

    const pending = deferred<RegulatoryPreflightResult>();
    mocks.runRegulatoryPreflight.mockReturnValueOnce(pending.promise);
    const slowReview = prepareRegulatoryReview({ now: "2026-08-19T06:00:00.000Z" });

    const verifiedB = snapshotFor();
    writeRegulatoryPreflightCache(cacheFor(verifiedB), cacheDir);

    pending.reject(new Error("synthetic preflight failure"));

    const prepared = await slowReview;
    expect(prepared.snapshot).toMatchObject({
      freshness: "stale",
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
    });
    expect(readLatestRegulatoryPreflightCache(cacheDir)?.snapshot.snapshotId).toBe(
      verifiedB.snapshotId,
    );
    expect(
      readRegulatorySnapshotById(prepared.snapshot.snapshotId, cacheDir),
    ).toEqual(prepared.snapshot);
  });

  it("keeps latest anchored to the last verified check across repeated outages", async () => {
    const t0 = verifiedT0();
    writeRegulatoryPreflightCache(cacheFor(t0), cacheDir);

    const failures = [
      { snapshotId: "reg-failed-a-00000001", finishedAt: "2026-08-19T06:00:05.000Z", cacheAgeHours: 20 },
      { snapshotId: "reg-failed-b-00000001", finishedAt: "2026-08-20T02:00:00.000Z", cacheAgeHours: 40 },
    ];

    for (const failure of failures) {
      const failed = snapshotFor({
        snapshotId: failure.snapshotId,
        previousSnapshotId: t0.snapshotId,
        startedAt: failure.finishedAt,
        finishedAt: failure.finishedAt,
        sourceResults: [
          source("federal-register", "failed"),
          source("oira-pending"),
          source("oira-completed"),
          source("unified-agenda"),
        ],
        freshness: "degraded",
        reviewMode: "full-with-warning",
        legalRegulatoryConclusionsAllowed: true,
        cacheAgeHours: failure.cacheAgeHours,
      });
      mocks.runRegulatoryPreflight.mockResolvedValueOnce(resultFor(failed));

      await prepareRegulatoryReview({ now: failure.finishedAt });
      expect(readLatestRegulatoryPreflightCache(cacheDir)?.snapshot.snapshotId).toBe(
        t0.snapshotId,
      );
    }
  });

  it("still advances latest for a verified run that disables legal conclusions", async () => {
    const t0 = verifiedT0();
    writeRegulatoryPreflightCache(cacheFor(t0), cacheDir);

    const verifiedButDisabled = snapshotFor({
      snapshotId: "reg-verified-c-00000001",
      finishedAt: "2026-08-19T06:00:05.000Z",
      freshness: "degraded",
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
      officialEditionVerificationComplete: false,
    });
    mocks.runRegulatoryPreflight.mockResolvedValueOnce(resultFor(verifiedButDisabled));

    const prepared = await prepareRegulatoryReview({ now: "2026-08-19T06:00:00.000Z" });
    expect(prepared.snapshot.snapshotId).toBe(verifiedButDisabled.snapshotId);
    expect(readLatestRegulatoryPreflightCache(cacheDir)?.snapshot.snapshotId).toBe(
      verifiedButDisabled.snapshotId,
    );
  });
});
