#!/usr/bin/env node
/**
 * Archil persistence check — writes in one exec, reads back in another.
 *
 *   npm run verify:archil-persistence            # reads .env.local
 *   ARCHIL_API_KEY=… node scripts/verify-archil-persistence.mjs
 *
 * Two separate execs are the whole point. Each exec gets a fresh container, so
 * a line that survives from the writing container to the reading container was
 * persisted on the disk rather than in container state — which is exactly the
 * promise a durable store has to keep.
 *
 * The run directory is unique per invocation because the exec mount is shared:
 * writing into a fresh subdirectory is what dynamic ownership claims it, and it
 * also keeps two concurrent runs from reading each other's probe. Nothing is
 * deleted afterwards — the probe is the evidence that the write landed.
 *
 * The disk is `ARCHIL_DISK_ID` when configured, otherwise an existing disk with
 * the default name, otherwise a new one; either way its id is recorded in
 * `.env.local` (or printed for manual entry when that file cannot be written)
 * so later runs and the app reuse it instead of creating another. The one-time
 * mount token `createDisk` returns is never printed or stored.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ARCHIL_EXEC_REGIONS,
  loadArchilConfig,
  resolveArchilDisk,
} from "../src/lib/archil/disk.ts";

/** Next.js reads `.env.local` at runtime; `--env-file-if-exists` reads it here. */
const ENV_FILE = path.join(process.cwd(), ".env.local");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * Record the disk id in `.env.local`, replacing any earlier line rather than
 * appending a second one. Every other line (including the API key) is kept
 * byte-for-byte: this file also holds the user's local secrets.
 *
 * Best-effort by design: a sandboxed shell may not be allowed to write env
 * files, and that must not fail a check whose persistence proof has not run
 * yet. The caller prints the id for manual entry when this returns false.
 */
function rememberDiskId(diskId) {
  try {
    const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    const kept = existing.split("\n").filter((line) => !/^\s*ARCHIL_DISK_ID\s*=/.test(line));
    while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
    const next = kept.length === 0
      ? `ARCHIL_DISK_ID=${diskId}\n`
      : `${kept.join("\n")}\nARCHIL_DISK_ID=${diskId}\n`;
    writeFileSync(ENV_FILE, next, { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const config = loadArchilConfig();
  if (!ARCHIL_EXEC_REGIONS.includes(config.region)) {
    fail(
      `exec runs only in ${ARCHIL_EXEC_REGIONS.join(", ")}; ARCHIL_REGION is "${config.region}". ` +
        "Use a key from an exec-capable region (the default is aws-us-east-1).",
    );
  }

  const { disk, created } = await resolveArchilDisk(config);
  process.stdout.write(
    `disk:    ${disk.name} (${disk.id}${created ? ", created" : ""}) in ${config.region}\n`,
  );
  if (config.diskId !== disk.id) {
    process.stdout.write(
      rememberDiskId(disk.id)
        ? `saved:   ARCHIL_DISK_ID=${disk.id} in .env.local\n`
        : `add to .env.local (could not write it here): ARCHIL_DISK_ID=${disk.id}\n`,
    );
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDirectory = `persistence-checks/${runId}`;
  const probePath = `${runDirectory}/probe.txt`;
  const line = `archil-persistence ${runId} ${randomUUID()}`;

  // Exec 1: create this run's subdirectory and write the probe. Exec runs on
  // the disk the module resolved (the SDK is only imported inside the module).
  const write = await disk.exec(
    `mkdir -p '${runDirectory}' && printf '%s\n' '${line}' > '${probePath}'`,
  );
  if (write.exitCode !== 0) {
    fail(`write exec exited ${write.exitCode}:\n${write.stderr.trim() || "(no stderr)"}`);
  }
  process.stdout.write(`wrote:   ${probePath}\n`);

  // Exec 2: a different container. Only the disk carries the line across.
  const read = await disk.exec(`cat '${probePath}'`);
  if (read.exitCode !== 0) {
    fail(
      `read-back exec exited ${read.exitCode} — the file written by the first exec is gone:\n` +
        `${read.stderr.trim() || "(no stderr)"}`,
    );
  }
  if (!read.stdout.includes(line)) {
    fail(
      "read-back exec did not return what the write exec stored:\n" +
        `  wrote: ${line}\n  read:  ${read.stdout.trim() || "(empty)"}`,
    );
  }

  process.stdout.write(`read:    ${read.stdout.trim()}\n`);
  process.stdout.write("✓ persisted: the line written by exec 1 came back from exec 2\n");
}

main().catch((error) => {
  if (error?.status === 401) {
    fail(
      "Archil rejected the credential (HTTP 401). ARCHIL_API_KEY is probably a disk/mount token " +
        "(adt_…) or a key from a different region: use an API key starting with key- from " +
        "https://console.archil.com/api-keys in an AWS region.",
    );
  }
  fail(error?.message ?? String(error));
});
