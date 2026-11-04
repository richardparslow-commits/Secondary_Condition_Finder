import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readRegulatorySnapshotById,
  writeRegulatoryPreflightCache,
} from "@/lib/regulatory/preflight/cache";
import type { RegulatoryPreflightCache } from "@/lib/regulatory/preflight/types";

/**
 * Heal `s1-locked-snapshot-evicted-1`: snapshot files are review locks, so a
 * write must not prune them by a newest-N ranking. Twenty unrelated visitors
 * used to evict the first visitor's lock and drop their review to medical-only.
 * The cache now keeps locks for a bounded age (72 hours by default).
 */
let cacheDir: string;

beforeEach(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "regulatory-snapshot-retention-"));
});

afterEach(() => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

const cacheFor = (index: number): RegulatoryPreflightCache => {
  const snapshotId = `reg-test-${String(index).padStart(8, "0")}`;
  const at = new Date().toISOString();
  return {
    schemaVersion: 1,
    writtenAt: at,
    snapshot: {
      schemaVersion: 1,
      snapshotId,
      startedAt: at,
      finishedAt: at,
      asOfDate: at.slice(0, 10),
      registryDigest: "digest",
      sourceResults: [],
      changes: [],
      relevantChangeIds: [],
      freshness: "current",
      reviewMode: "full",
      legalRegulatoryConclusionsAllowed: true,
      officialEditionVerificationComplete: true,
      usedCachedRegistry: false,
      warnings: [],
    },
    registry: [],
    sourceValidators: {},
  };
};

const snapshotFile = (snapshotId: string): string =>
  path.join(cacheDir, "snapshots", `${snapshotId}.json`);

describe("regulatory snapshot retention", () => {
  it("keeps a review lock after twenty unrelated snapshot writes", () => {
    const first = cacheFor(0);
    writeRegulatoryPreflightCache(first, cacheDir);

    for (let index = 1; index <= 20; index += 1) {
      writeRegulatoryPreflightCache(cacheFor(index), cacheDir);
    }

    expect(readRegulatorySnapshotById(first.snapshot.snapshotId, cacheDir)).toEqual(first.snapshot);
    expect(fs.readdirSync(path.join(cacheDir, "snapshots"))).toHaveLength(21);
  });

  it("prunes snapshots older than the retention window", () => {
    const expired = cacheFor(100);
    writeRegulatoryPreflightCache(expired, cacheDir);
    const seventyThreeHoursAgo = new Date(Date.now() - 73 * 3_600_000);
    fs.utimesSync(snapshotFile(expired.snapshot.snapshotId), seventyThreeHoursAgo, seventyThreeHoursAgo);

    const fresh = cacheFor(101);
    writeRegulatoryPreflightCache(fresh, cacheDir);

    expect(readRegulatorySnapshotById(expired.snapshot.snapshotId, cacheDir)).toBeNull();
    expect(readRegulatorySnapshotById(fresh.snapshot.snapshotId, cacheDir)).toEqual(fresh.snapshot);
  });

  it("retains a snapshot still inside the retention window", () => {
    const retained = cacheFor(200);
    writeRegulatoryPreflightCache(retained, cacheDir);
    const seventyOneHoursAgo = new Date(Date.now() - 71 * 3_600_000);
    fs.utimesSync(snapshotFile(retained.snapshot.snapshotId), seventyOneHoursAgo, seventyOneHoursAgo);

    writeRegulatoryPreflightCache(cacheFor(201), cacheDir);

    expect(readRegulatorySnapshotById(retained.snapshot.snapshotId, cacheDir)).toEqual(retained.snapshot);
  });
});
