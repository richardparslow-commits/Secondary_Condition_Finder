import "server-only";

import { createHash } from "node:crypto";

import { loadRegulatoryActionRegistry } from "../load";
import type { RegulatoryAction } from "../schema";
import {
  readLatestRegulatoryPreflightCache,
  readRegulatorySnapshotById,
  writeRegulatoryPreflightCacheIfLatest,
  writeRegulatorySnapshot,
} from "./cache";
import { requiredSourcesFailed } from "./freshness";
import { runRegulatoryPreflight } from "./run-preflight";
import type {
  RegulatoryPreflightCache,
  RegulatoryPreflightChange,
  RegulatoryPreflightSnapshot,
  ReviewScope,
} from "./types";

export interface PreparedRegulatoryReview {
  snapshot: RegulatoryPreflightSnapshot;
  registry: RegulatoryAction[];
  relevantChanges: RegulatoryPreflightChange[];
}

export function relevantChangesForSnapshot(snapshot: RegulatoryPreflightSnapshot): RegulatoryPreflightChange[] {
  const relevantIds = new Set(snapshot.relevantChangeIds);
  return snapshot.changes.filter((change) => relevantIds.has(change.id));
}

const emergencySnapshot = (
  previous: RegulatoryPreflightCache | null,
  error: unknown,
  now: string,
): PreparedRegulatoryReview => {
  const message = error instanceof Error ? error.message : String(error);
  const registry = previous?.registry ?? [];
  const digest = createHash("sha256").update(JSON.stringify(registry)).digest("hex");
  const snapshot: RegulatoryPreflightSnapshot = {
    schemaVersion: 1,
    snapshotId: `reg-${now.replace(/[-:.]/g, "")}-${digest.slice(0, 12)}`,
    startedAt: now,
    finishedAt: now,
    asOfDate: now.slice(0, 10),
    registryDigest: digest,
    previousSnapshotId: previous?.snapshot.snapshotId,
    sourceResults: [],
    changes: [],
    relevantChangeIds: [],
    freshness: "stale",
    reviewMode: "medical-only",
    legalRegulatoryConclusionsAllowed: false,
    officialEditionVerificationComplete: false,
    usedCachedRegistry: Boolean(previous?.registry?.length),
    cacheAgeHours: previous ? Math.max(0, (Date.parse(now) - Date.parse(previous.snapshot.finishedAt)) / 3_600_000) : undefined,
    warnings: [
      `Regulatory preflight encountered an internal validation error: ${message}`,
      "The medical relationship review may continue, but the app must not present current-law/regulatory conclusions from this run.",
    ],
  };
  return { snapshot, registry, relevantChanges: [] };
};

export async function prepareRegulatoryReview(options: {
  reviewScope?: ReviewScope;
  now?: string;
  maxCacheAgeHours?: number;
} = {}): Promise<PreparedRegulatoryReview> {
  const now = options.now ?? new Date().toISOString();
  const previous = readLatestRegulatoryPreflightCache();
  try {
    const result = await runRegulatoryPreflight({
      curatedRegistry: loadRegulatoryActionRegistry(),
      cache: previous,
      reviewScope: options.reviewScope,
      now,
      regulationsGovApiKey: process.env.REGULATIONS_GOV_API_KEY,
      maxCacheAgeHours: options.maxCacheAgeHours ?? Number(process.env.REGULATORY_PREFLIGHT_MAX_AGE_HOURS ?? "24"),
      timeoutMs: Number(process.env.REGULATORY_PREFLIGHT_SOURCE_TIMEOUT_MS ?? "8000"),
    });
    const cache: RegulatoryPreflightCache = {
      schemaVersion: 1,
      writtenAt: result.snapshot.finishedAt,
      snapshot: result.snapshot,
      registry: result.registry,
      sourceValidators: result.sourceValidators,
    };
    try {
      // A failed check still needs its snapshot for this review's lock, but it
      // must never replace the last verified anchor as latest.
      if (requiredSourcesFailed(result.snapshot.sourceResults)) {
        writeRegulatorySnapshot(cache);
      } else {
        writeRegulatoryPreflightCacheIfLatest(cache, previous?.snapshot.snapshotId ?? null);
      }
    } catch { /* best-effort cache; snapshot remains valid in this request */ }
    return {
      snapshot: result.snapshot,
      registry: result.registry,
      relevantChanges: relevantChangesForSnapshot(result.snapshot),
    };
  } catch (error) {
    const fallback = emergencySnapshot(previous, error, now);
    try {
      // Keep the fallback loadable by this review, but do not let an internal
      // failure advance latest over a verified run that finished meanwhile.
      writeRegulatorySnapshot({
        schemaVersion: 1,
        writtenAt: now,
        snapshot: fallback.snapshot,
        registry: fallback.registry,
        sourceValidators: previous?.sourceValidators ?? {},
      });
    } catch { /* fail closed to medical-only without crashing the workflow */ }
    return fallback;
  }
}

export async function refreshRegulatoryPreflightCache(options: {
  now?: string;
  maxCacheAgeHours?: number;
} = {}): Promise<RegulatoryPreflightSnapshot> {
  return (await prepareRegulatoryReview(options)).snapshot;
}


export function missingLockedRegulatorySnapshot(
  snapshotId: string,
  now = new Date().toISOString(),
): RegulatoryPreflightSnapshot {
  return {
    schemaVersion: 1,
    snapshotId,
    startedAt: now,
    finishedAt: now,
    asOfDate: now.slice(0, 10),
    registryDigest: "unavailable",
    sourceResults: [],
    changes: [],
    relevantChangeIds: [],
    freshness: "stale",
    reviewMode: "medical-only",
    legalRegulatoryConclusionsAllowed: false,
    officialEditionVerificationComplete: false,
    usedCachedRegistry: false,
    warnings: [
      "The regulatory snapshot locked at the start of this review is no longer available in the bounded server cache.",
      "The app will not silently replace it with a newer legal snapshot mid-review. Medical relationship review may continue, but current-law/regulatory conclusions are disabled.",
    ],
  };
}

export function loadLockedRegulatorySnapshot(snapshotId: string | undefined): RegulatoryPreflightSnapshot | null {
  if (!snapshotId) return null;
  return readRegulatorySnapshotById(snapshotId);
}
