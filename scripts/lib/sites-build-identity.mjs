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
 *     --binary`, and the contents of untracked (non-ignored) files. A dirty
 *     worktree is common during development and must not be treated as a
 *     different commit, but an artifact built from *other* uncommitted content
 *     than the `main` state is not described by a smoke run over that state
 *     either. The fingerprint is what distinguishes "same commit, same
 *     worktree" from "same commit, different worktree".
 *
 * Ignored files are deliberately excluded: the generated `freebuff.*` configs
 * and the artifact itself are rewritten on every publish and would otherwise
 * change the fingerprint of an otherwise identical source tree.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Name of the stamp inside the artifact directory. Ignored by git with the artifact. */
export const BUILD_IDENTITY_FILE = "build-identity.json";

/** Untracked files larger than this are identified by size instead of content. */
const MAX_HASHED_UNTRACKED_BYTES = 8 * 1024 * 1024;

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
  for (const relative of untracked) {
    hash.update("\0untracked\0");
    hash.update(relative);
    const absolute = path.join(cwd, relative);
    try {
      const stats = fs.statSync(absolute);
      if (stats.isFile() && stats.size <= MAX_HASHED_UNTRACKED_BYTES) {
        hash.update("\0content\0");
        hash.update(fs.readFileSync(absolute));
      } else {
        hash.update(`\0stat\0${stats.isFile() ? "file" : "other"}\0${stats.size}`);
      }
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
    fingerprint: hash.digest("hex"),
  };
}

/** Write the stamp an artifact carries until it is regenerated. */
export function writeBuildIdentity(directory, identity, { stampedAt = new Date().toISOString() } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, BUILD_IDENTITY_FILE);
  const record = {
    kind: "sites-build-identity",
    version: 1,
    commit: identity.commit,
    dirty: Boolean(identity.dirty),
    dirtyFiles: identity.dirtyFiles ?? 0,
    untrackedFiles: identity.untrackedFiles ?? 0,
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

/** Short form for log lines: 7-character commit plus a dirty marker. */
export function describeIdentity(identity) {
  return `${identity.commit.slice(0, 7)}${identity.dirty ? " (dirty worktree)" : ""}`;
}
