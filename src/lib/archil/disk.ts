/**
 * Archil disk storage boundary — durable files for server-side runs.
 *
 * A serverless invocation has no filesystem that outlives it: anything written
 * under `/tmp` (or `os.tmpdir()`, as `src/lib/regulatory/preflight/cache.ts`
 * does for its local snapshot cache) is gone once the instance is recycled, and
 * a Cloudflare Worker has no writable disk at all. An Archil disk is storage
 * that survives that boundary, read and written either through the S3-style
 * object API (`putObject` / `getObject`) or by running a command in a fresh
 * container that mounts the disk at `/mnt/data`.
 *
 * This module is the only place the `disk` SDK is imported, so the credential
 * rules are enforced in one spot:
 *
 *   - `ARCHIL_API_KEY` is a plain server-side variable. It is never
 *     `NEXT_PUBLIC_`-prefixed, and nothing here may be imported from a client
 *     component (the SDK pulls in `node:tls`, so an accidental client import
 *     fails the build rather than leaking the key).
 *   - API keys start with `key-`. A disk/mount token (`adt_…`, the one-time
 *     value `createDisk` returns) authenticates a mount, not the API, and gets
 *     HTTP 401 here — so that mistake is rejected with an explanation instead
 *     of a bare 401.
 *   - The one-time mount token is never returned from this module. Exec does
 *     not need it, so no caller has a reason to hold it.
 *
 * Deliberately no `import "server-only"`: `scripts/verify-archil-persistence.mjs`
 * is a plain-Node check that imports this module, and that marker package
 * throws outside a React Server Component graph (the same constraint documented
 * in `src/lib/kb/graph-layout.ts`).
 */

import * as archil from "disk";
import type { Disk, ExecResult } from "disk";

/** Region used when `ARCHIL_REGION` is unset or blank. */
export const DEFAULT_ARCHIL_REGION = "aws-us-east-1";

/**
 * Regions in which exec (serverless commands) is available. Object-style
 * reads/writes work in every region, so a disk outside this list is still
 * usable — commands against it are not.
 */
export const ARCHIL_EXEC_REGIONS = ["aws-us-east-1", "aws-us-west-2", "aws-eu-west-1"] as const;

/** Default name for the disk this app creates when none is configured. */
export const DEFAULT_ARCHIL_DISK_NAME = "secondary-condition-finder";

/** Where exec mounts the disk, and the working directory of every command. */
export const ARCHIL_MOUNT_PATH = "/mnt/data";

export type ArchilEnv = Record<string, string | undefined>;

/**
 * A configuration mistake, not an API failure. Callers can report the message
 * to a human as-is: it names the variable and the fix.
 */
export class ArchilConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchilConfigError";
  }
}

export interface ArchilConfig {
  apiKey: string;
  region: string;
  /** `dsk-…` from `ARCHIL_DISK_ID`, or null when nothing is configured yet. */
  diskId: string | null;
}

/**
 * Resolve the SDK credentials from the environment.
 *
 * `region` falls back to `DEFAULT_ARCHIL_REGION`. `diskId` stays null when the
 * variable is unset — `resolveArchilDisk` then creates a disk once, and the
 * caller records its id, so a check run is the only time a disk is made.
 */
export function loadArchilConfig(env: ArchilEnv = process.env): ArchilConfig {
  const apiKey = env.ARCHIL_API_KEY?.trim() ?? "";
  const region = env.ARCHIL_REGION?.trim() || DEFAULT_ARCHIL_REGION;
  const diskId = env.ARCHIL_DISK_ID?.trim() || null;
  if (!apiKey) {
    throw new ArchilConfigError(
      "ARCHIL_API_KEY is not set. Create an API key at https://console.archil.com/api-keys " +
        "(it starts with key-, not adt_) and set it in .env.local.",
    );
  }
  if (!apiKey.startsWith("key-")) {
    throw new ArchilConfigError(
      "ARCHIL_API_KEY does not look like an Archil API key (expected a value starting with key-). " +
        "Disk and mount tokens (adt_…) get HTTP 401 from the API; use an API key from " +
        "https://console.archil.com/api-keys instead.",
    );
  }
  if (diskId !== null && !diskId.startsWith("dsk-")) {
    throw new ArchilConfigError(`ARCHIL_DISK_ID must be a disk id (dsk-…), got "${diskId}".`);
  }
  return { apiKey, region, diskId };
}

/**
 * Point the SDK's module-level client at this environment's key and region.
 *
 * Called by every helper below rather than once at import time, so a missing
 * key fails the call that needs it instead of crashing module evaluation (and
 * with it the bundle that merely imports this module).
 */
export function configureArchil(config: ArchilConfig = loadArchilConfig()): void {
  archil.configure({ apiKey: config.apiKey, region: config.region });
}

/** The disk named by `ARCHIL_DISK_ID`. Throws when the id is not configured. */
export async function getArchilDisk(
  config: ArchilConfig = loadArchilConfig(),
): Promise<Disk> {
  if (!config.diskId) {
    throw new ArchilConfigError("ARCHIL_DISK_ID is not set, so there is no configured disk to open.");
  }
  configureArchil(config);
  return archil.getDisk(config.diskId);
}

export interface ResolvedArchilDisk {
  disk: Disk;
  /** True when this call created the disk (no `ARCHIL_DISK_ID` was configured). */
  created: boolean;
}

/**
 * The disk this environment works with: the one named by `ARCHIL_DISK_ID`, or —
 * when no id is configured — an existing disk with the default name, or a new
 * one.
 *
 * The mount token `createDisk` returns is discarded on purpose: exec and the
 * object API do not use it, and printing it would put a live mount credential
 * in a terminal transcript or log.
 */
export async function resolveArchilDisk(
  config: ArchilConfig = loadArchilConfig(),
  options: { createName?: string } = {},
): Promise<ResolvedArchilDisk> {
  configureArchil(config);
  if (config.diskId) return { disk: await archil.getDisk(config.diskId), created: false };
  const name = options.createName ?? DEFAULT_ARCHIL_DISK_NAME;
  // Reuse a disk from an earlier unconfigured run instead of creating one per run.
  const existing = (await archil.listDisks({ name })).find((candidate) => candidate.name === name);
  if (existing) return { disk: existing, created: false };
  const { disk } = await archil.createDisk({ name });
  return { disk, created: true };
}

/**
 * Run one command in a fresh container with the disk mounted at
 * `/mnt/data` (also the working directory).
 *
 * Each exec is a new container: files on the disk persist between them,
 * container state does not. The mount is shared, so a write belongs in a fresh
 * per-job subdirectory (dynamic ownership claims it) unless the command runs
 * `archil checkout <path>` first. Deadline is five minutes; stdout and stderr
 * are each capped at 128 KiB.
 *
 * The result is returned as-is — including a non-zero exit code — because a
 * command's failure is data the caller interprets, not an exception here.
 */
export async function runArchilCommand(disk: Disk, command: string): Promise<ExecResult> {
  return disk.exec(command);
}

/** Write a file on the disk through the object API; `key` is disk-relative. */
export async function writeArchilFile(disk: Disk, key: string, contents: string): Promise<void> {
  await disk.putObject(key, contents);
}

/**
 * Read a file back through the object API. Throws `ArchilS3Error` (`NoSuchKey`,
 * status 404) when the key is absent — use `objectExists` to probe instead.
 */
export async function readArchilFile(disk: Disk, key: string): Promise<string> {
  return new TextDecoder().decode(await disk.getObject(key));
}
