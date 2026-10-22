/**
 * Source identity for the Sites publish path.
 *
 * The publish gate has to answer one question the artifact cannot answer for
 * itself: *which checkout produced these bytes?* Without an answer, a gate that
 * runs the Worker smoke check can pass on today's `main` while the upload set in
 * `freebuff-sites-build/` was built from an older commit — the smoke proves the
 * current source works, not that the artifact came from it.
 *
 * The identity is therefore stamped into the artifact when it is generated
 * (`scripts/stamp-sites-build.mjs`) and compared, at publish time, with the
 * checkout the smoke will run against. Two fields make the comparison:
 *
 *   - `commit` — `git rev-parse HEAD`. This is the binding that matters: a
 *     different commit is a different program.
 *   - `fingerprint` — a SHA-256 over `git status --porcelain`, `git diff HEAD
 *     --binary`, the contents of untracked (non-ignored) files — streamed in
 *     chunks, so a large untracked file is identified by what it contains, not
 *     by its length — and the contents of the gitignored build configs named in
 *     `BUILD_CONFIG_FILES`.
 *     A dirty worktree is common during development and must not be treated as
 *     a different commit, but an artifact built from *other* uncommitted
 *     content than the `main` state is not described by a smoke run over that
 *     state either. The fingerprint is what distinguishes "same commit, same
 *     worktree" from "same commit, different worktree".
 *
 * Ignored files are excluded in general: the artifact itself and its generated
 * output are rewritten on every publish and would otherwise change the
 * fingerprint of an otherwise identical source tree. The exception is explicitly
 * build-affecting Sites configuration (`BUILD_CONFIG_FILES`):
 * `freebuff.open-next.config.ts` is read by the Sites smoke build and
 * `freebuff.wrangler.jsonc` names the bindings the platform upload uses. Both
 * are gitignored because the platform regenerates them, which is exactly why
 * they cannot be left out of a fingerprint that attests "this checkout built
 * this Worker": a config rewritten after the stamp would otherwise leave a
 * matching identity for a different build.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Feed a file's bytes into `hash` in fixed chunks, without buffering it whole. */
function hashFileContents(hash, absolute) {
  const descriptor = fs.openSync(absolute, "r");
  try {
    const buffer = Buffer.allocUnsafe(UNTRACKED_READ_CHUNK_BYTES);
    let bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
    while (bytesRead > 0) {
      hash.update(buffer.subarray(0, bytesRead));
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

/** Name of the stamp inside the artifact directory. Ignored by git with the artifact. */
export const BUILD_IDENTITY_FILE = "build-identity.json";

/**
 * Untracked files are read in chunks of this size, so a large one is hashed by
 * content without holding it in memory. A size-only stub would let a build
 * input be edited to a same-length different body without moving the
 * fingerprint — exactly the drift the fingerprint exists to catch.
 */
const UNTRACKED_READ_CHUNK_BYTES = 1024 * 1024;

/**
 * Gitignored files that still decide what the Sites build and upload are.
 * `scripts/smoke-worker.mjs --sites` passes the first to
 * `opennextjs-cloudflare build`, and the platform reads the second for the
 * upload's bindings. Their contents are hashed explicitly, and their absence is
 * recorded as its own marker so "not generated yet" and "generated empty" are
 * different identities.
 */
export const BUILD_CONFIG_FILES = ["freebuff.open-next.config.ts", "freebuff.wrangler.jsonc"];

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`git ${args.join(" ")} could not run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr ?? "").trim() || `exit ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed (${detail})`);
  }
  return result.stdout;
}

/**
 * Identity of the checkout at `cwd`. Throws rather than returning a partial
 * identity: a publish that cannot name its commit must not proceed.
 */
export function resolveSourceIdentity({ cwd = process.cwd() } = {}) {
  const commit = git(cwd, ["rev-parse", "HEAD"]).trim();
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`HEAD resolved to "${commit}", which is not a full commit SHA`);
  }

  const status = git(cwd, ["status", "--porcelain"]);
  const diff = git(cwd, ["diff", "HEAD", "--binary"]);
  const untracked = git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .sort();

  const hash = createHash("sha256");
  hash.update(status);
  hash.update("\0");
  hash.update(diff);

  // Explicitly included despite being ignored: see BUILD_CONFIG_FILES.
  const buildConfigs = BUILD_CONFIG_FILES.map((relative) => {
    hash.update("\0build-config\0");
    hash.update(relative);
    const absolute = path.join(cwd, relative);
    try {
      if (!fs.statSync(absolute).isFile()) throw new Error("not a regular file");
      const content = fs.readFileSync(absolute);
      hash.update("\0content\0");
      hash.update(content);
      return {
        path: relative,
        present: true,
        digest: createHash("sha256").update(content).digest("hex"),
      };
    } catch {
      hash.update("\0absent\0");
      return { path: relative, present: false, digest: null };
    }
  });
  for (const relative of untracked) {
    hash.update("\0untracked\0");
    hash.update(relative);
    const absolute = path.join(cwd, relative);
    try {
      const stats = fs.statSync(absolute);
      if (!stats.isFile()) {
        // A directory is covered by the files git lists inside it; anything else
        // is recorded by type and size so it still contributes to the identity.
        hash.update(`\0stat\0other\0${stats.size}`);
        continue;
      }
      hash.update("\0content\0");
      hashFileContents(hash, absolute);
    } catch {
      hash.update("\0unreadable\0");
    }
  }

  const dirtyLines = status.split("\n").filter((line) => line.trim().length > 0);
  return {
    commit,
    dirty: dirtyLines.length > 0,
    dirtyFiles: dirtyLines.length,
    untrackedFiles: untracked.length,
    buildConfigs,
    fingerprint: hash.digest("hex"),
  };
}

/** Write the stamp an artifact carries until it is regenerated. */
export function writeBuildIdentity(directory, identity, { stampedAt = new Date().toISOString() } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, BUILD_IDENTITY_FILE);
  const record = {
    kind: "sites-build-identity",
    // 2: the fingerprint also covers the ignored Sites build configuration.
    version: 2,
    commit: identity.commit,
    dirty: Boolean(identity.dirty),
    dirtyFiles: identity.dirtyFiles ?? 0,
    untrackedFiles: identity.untrackedFiles ?? 0,
    buildConfigs: Array.isArray(identity.buildConfigs) ? identity.buildConfigs : [],
    fingerprint: identity.fingerprint,
    stampedAt,
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return file;
}

/**
 * The stamp an artifact carries, or null when it has none or it is not a
 * readable identity. A malformed stamp is treated exactly like a missing one:
 * the caller must refuse either way, never guess.
 */
export function readBuildIdentity(directory) {
  const file = path.join(directory, BUILD_IDENTITY_FILE);
  if (!fs.existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.commit !== "string" || !COMMIT_PATTERN.test(parsed.commit)) return null;
  if (typeof parsed.fingerprint !== "string" || parsed.fingerprint.length === 0) return null;
  return {
    commit: parsed.commit,
    dirty: Boolean(parsed.dirty),
    dirtyFiles: Number(parsed.dirtyFiles ?? 0),
    untrackedFiles: Number(parsed.untrackedFiles ?? 0),
    buildConfigs: Array.isArray(parsed.buildConfigs) ? parsed.buildConfigs : [],
    fingerprint: parsed.fingerprint,
    stampedAt: typeof parsed.stampedAt === "string" ? parsed.stampedAt : null,
    file,
  };
}

/**
 * Compare the artifact's stamp with the checkout the smoke is about to run
 * against. `reason` names which field disagreed, so the refusal can say *why*
 * instead of only that it refused.
 */
export function compareIdentities(artifact, current) {
  if (artifact.commit !== current.commit) {
    return { ok: false, reason: "commit" };
  }
  if (artifact.fingerprint !== current.fingerprint) {
    return { ok: false, reason: "worktree" };
  }
  return { ok: true, reason: null };
}

/**
 * Name the build configs that differ between a stamp and a checkout, so a
 * worktree refusal can point at the gitignored cause instead of only at two
 * fingerprints. Returns an empty list when nothing differs, and when either side
 * recorded no configs at all (a stamp from before version 2): a missing record
 * is not evidence that a file was absent.
 */
export function differingBuildConfigs(artifact, current) {
  const artifactConfigs = artifact.buildConfigs ?? [];
  const currentConfigs = current.buildConfigs ?? [];
  if (artifactConfigs.length === 0 || currentConfigs.length === 0) return [];
  const byPath = new Map(currentConfigs.map((config) => [config.path, config]));
  const changed = [];
  for (const before of artifactConfigs) {
    const after = byPath.get(before.path);
    if (!after) continue;
    if (before.present !== after.present) {
      changed.push(
        `${before.path} (${after.present ? "not generated when the artifact was stamped" : "absent from the checkout"})`,
      );
    } else if (before.present && before.digest !== after.digest) {
      changed.push(`${before.path} (content changed since the stamp)`);
    }
  }
  return changed;
}

/** Short form for log lines: 7-character commit plus a dirty marker. */
export function describeIdentity(identity) {
  return `${identity.commit.slice(0, 7)}${identity.dirty ? " (dirty worktree)" : ""}`;
}
