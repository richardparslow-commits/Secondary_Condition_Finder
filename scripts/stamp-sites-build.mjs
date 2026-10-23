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
 * resolved, 2 the stamp could not be written (the artifact is left untouched in
 * every failure case, and the gate will refuse it).
 *
 * A manifest quarantined by an earlier failed gate run is restored only after
 * the stamp has been written. Restoring it first would make a failed stamp — no
 * git, no HEAD, an unwritable directory — leave an uploader-visible manifest
 * behind, undoing the quarantine that was there to stop an upload.
 *
 * The release itself is atomic: the rejected manifest is copied to a sibling
 * temporary file and renamed into place. A direct copy that failed halfway would
 * leave a truncated `manifest.json` that an uploader could read while this
 * command exits non-zero; the rename means the manifest is either the complete
 * quarantined copy or absent (and still refused), and the temporary file is
 * removed on failure.
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
  // "no build identity" refusal is: stamp, then re-run the gate. Whether the
  // quarantine can be released depends on the stamp succeeding, so note both
  // paths here and restore only after the stamp is written.
  const manifestPresent = fs.existsSync(manifestPath);
  if (!manifestPresent && !fs.existsSync(rejectedPath)) {
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
        `without a commit the artifact cannot be identified, so nothing was stamped` +
        (manifestPresent
          ? ""
          : ` and the quarantined manifest is left at ${rejectedPath} — fix the checkout, ` +
            `then stamp and re-run the publish gate`),
    );
    process.exitCode = 1;
    return;
  }

  const file = writeBuildIdentity(directory, identity);
  console.log(
    `[sites-stamp] ${path.relative(process.cwd(), file) || file}: ` +
      `${describeIdentity(identity)}, fingerprint ${identity.fingerprint.slice(0, 12)}`,
  );

  // Only now that the stamp exists does releasing the quarantine help: an
  // uploader cannot start without `manifest.json`, and a failure above must not
  // hand it back. Copy beside the manifest and rename, so a failed restore
  // leaves no partial `manifest.json` for an uploader to read: within one
  // directory the rename is atomic, while a direct copy can stop halfway.
  if (!manifestPresent) {
    const restorePath = path.join(directory, `.manifest.json.${process.pid}.restore`);
    try {
      fs.copyFileSync(rejectedPath, restorePath);
      fs.renameSync(restorePath, manifestPath);
    } catch (error) {
      fs.rmSync(restorePath, { force: true });
      throw new Error(
        `could not restore the quarantined manifest from ${rejectedPath} to ${manifestPath} ` +
          `(${error instanceof Error ? error.message : String(error)}); the quarantine is left in ` +
          `place, so the publish gate still refuses the artifact`,
      );
    }
    console.log(`[sites-stamp] restored the quarantined manifest so it can be re-audited`);
  }
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
