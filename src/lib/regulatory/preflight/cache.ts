import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RegulatoryPreflightCache, RegulatoryPreflightSnapshot } from "./types";

const defaultCacheDir = (): string => {
  if (process.env.REGULATORY_PREFLIGHT_CACHE_DIR) return process.env.REGULATORY_PREFLIGHT_CACHE_DIR;
  return path.join(os.tmpdir(), "secondary-condition-finder-regulatory");
};

const safeSnapshotName = (snapshotId: string): string => snapshotId.replace(/[^a-zA-Z0-9._-]+/g, "_");

const readJson = <T>(file: string): T | null => {
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (Buffer.byteLength(raw, "utf8") > 20_000_000) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const looksLikeCache = (value: RegulatoryPreflightCache | null): value is RegulatoryPreflightCache => Boolean(
  value
  && value.schemaVersion === 1
  && value.snapshot?.schemaVersion === 1
  && typeof value.snapshot.snapshotId === "string"
  && Array.isArray(value.registry),
);

export function readLatestRegulatoryPreflightCache(cacheDir = defaultCacheDir()): RegulatoryPreflightCache | null {
  const value = readJson<RegulatoryPreflightCache>(path.join(cacheDir, "latest.json"));
  return looksLikeCache(value) ? value : null;
}

export function readRegulatorySnapshotById(
  snapshotId: string,
  cacheDir = defaultCacheDir(),
): RegulatoryPreflightSnapshot | null {
  if (!/^reg-[a-zA-Z0-9._-]{8,120}$/.test(snapshotId)) return null;
  const value = readJson<RegulatoryPreflightCache>(path.join(cacheDir, "snapshots", `${safeSnapshotName(snapshotId)}.json`));
  return looksLikeCache(value) && value.snapshot.snapshotId === snapshotId ? value.snapshot : null;
}

const atomicWriteJson = (file: string, value: unknown): void => {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
};

export function writeRegulatoryPreflightCache(
  cache: RegulatoryPreflightCache,
  cacheDir = defaultCacheDir(),
): void {
  atomicWriteJson(path.join(cacheDir, "latest.json"), cache);
  atomicWriteJson(path.join(cacheDir, "snapshots", `${safeSnapshotName(cache.snapshot.snapshotId)}.json`), cache);

  // Keep the cache bounded. Snapshot files are review locks, not a permanent archive.
  try {
    const snapshotsDir = path.join(cacheDir, "snapshots");
    const files = fs.readdirSync(snapshotsDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({ name, mtime: fs.statSync(path.join(snapshotsDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const stale of files.slice(20)) fs.unlinkSync(path.join(snapshotsDir, stale.name));
  } catch {
    // Cache pruning is best-effort and must never invalidate a completed preflight.
  }
}

export function regulatoryPreflightCacheDirectory(): string {
  return defaultCacheDir();
}
