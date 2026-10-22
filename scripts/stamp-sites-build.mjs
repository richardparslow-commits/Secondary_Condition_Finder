/**
 * Stamp a generated Sites artifact with the checkout that produced it.
 *
 * Run this immediately after the artifact is (re)generated and before
 * `npm run publish:sites`. The publish gate refuses an artifact with no stamp,
 * or one whose stamp does not describe the checkout the Worker smoke check will
 * run against — otherwise the smoke could pass on today's `main` while the
 * upload set in `freebuff-sites-build/` came from an older commit.
 *
 * Usage:
 *   node scripts/stamp-sites-build.mjs [--dir=freebuff-sites-build]
 *
 * Exit codes: 0 stamped, 1 no artifact to stamp or the identity could not be
 * resolved (the artifact is left untouched, and the gate will refuse it).
 */

import fs from "node:fs";
import path from "node:path";

import {
  describeIdentity,
  resolveSourceIdentity,
  writeBuildIdentity,
} from "./lib/sites-build-identity.mjs";

function parseDirectory(argv) {
  let directory = "freebuff-sites-build";
  for (const argument of argv) {
    if (!argument.startsWith("--dir=")) {
      throw new Error(`Unexpected argument "${argument}"; expected --dir=<path>`);
    }
    directory = argument.slice("--dir=".length);
    if (directory === "") throw new Error("--dir needs a path");
  }
  return directory;
}

function main() {
  const directory = path.resolve(parseDirectory(process.argv.slice(2)));
  const manifestPath = path.join(directory, "manifest.json");
  const rejectedPath = path.join(directory, "manifest.rejected.json");
  // A refused publish quarantines the manifest, so the usual sequence after a
  // "no build identity" refusal is: stamp, then re-run the gate. Restore the
  // quarantined manifest here for the same reason the gate does — the artifact
  // is still on disk and the stamp describes it, not the quarantine.
  if (!fs.existsSync(manifestPath) && fs.existsSync(rejectedPath)) {
    fs.copyFileSync(rejectedPath, manifestPath);
    console.log(`[sites-stamp] restored the quarantined manifest so it can be stamped`);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `[sites-stamp] no manifest at ${manifestPath}; generate the Sites artifact ` +
        `before stamping it — a stamp describes an artifact, so there is nothing to describe yet`,
    );
    process.exitCode = 1;
    return;
  }

  let identity;
  try {
    identity = resolveSourceIdentity({ cwd: process.cwd() });
  } catch (error) {
    console.error(
      `[sites-stamp] ${error instanceof Error ? error.message : String(error)}; ` +
        `without a commit the artifact cannot be identified, so nothing was stamped`,
    );
    process.exitCode = 1;
    return;
  }

  const file = writeBuildIdentity(directory, identity);
  console.log(
    `[sites-stamp] ${path.relative(process.cwd(), file) || file}: ` +
      `${describeIdentity(identity)}, fingerprint ${identity.fingerprint.slice(0, 12)}`,
  );
  if (identity.dirty) {
    console.log(
      `[sites-stamp] the worktree has ${identity.dirtyFiles} uncommitted change(s); ` +
        `the publish gate will refuse this artifact if that state changes before the ` +
        `Worker smoke check runs, so stamp again after regenerating the artifact`,
    );
  }
}

try {
  main();
} catch (error) {
  console.error(`[sites-stamp] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
