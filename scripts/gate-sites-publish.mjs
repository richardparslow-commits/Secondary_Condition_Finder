/**
 * Publish gate for the Cloudflare Sites artifact.
 *
 * `scripts/audit-sites-artifact.mjs` reports on the generated upload set, but a
 * report only protects a publish if someone acts on it. The Sites uploader
 * cannot start without `freebuff-sites-build/manifest.json` — it is the input
 * that names the Worker modules, the assets directory and the private cache —
 * so this gate controls that file rather than merely printing a verdict:
 *
 *   - clean artifact: `manifest.json` is left in place and a
 *     `publish-attestation.json` recording the measured totals is written;
 *   - rejected artifact: `manifest.json` is moved to `manifest.rejected.json`,
 *     `publish-attestation.json` is removed, and the command exits 1. There is
 *     then no manifest for an upload to read, so the upload cannot start until
 *     the artifact is fixed or regenerated.
 *
 * The quarantine is reversible: re-running the gate restores
 * `manifest.rejected.json` first, audits the artifact again, and only keeps the
 * manifest if the set now passes. A successful run also removes a stale
 * rejected manifest, so the directory does not accumulate old copies.
 *
 * A clean upload set is necessary but not sufficient: the Worker it contains
 * also has to serve the routes, the single-owner security headers, the bundled
 * catalog and the Sites OCR rewrite. `scripts/smoke-worker.mjs --sites` is that
 * check, and it is the only one that exercises the built Worker under workerd.
 * So this gate runs it — against the same Sites OpenNext config and bindings the
 * publish uses — and refuses the publish when it fails, quarantining
 * `manifest.json` exactly as an audit rejection does. A publish that skipped
 * the smoke would be the one case where a header regression or a missing OCR
 * rewrite reached the hosted Worker without any gate having looked at it.
 *
 * The publish therefore builds the Worker once with its own `next build` before
 * uploading. That is deliberate: the claim is "this checkout's Worker passes",
 * not "the platform's artifact bytes are identical". The gate does not claim to
 * hash the uploaded bytes — which is exactly why it has to know that the two
 * refer to the same source. The smoke validates the checkout; it says nothing
 * about an upload set that was built from an older commit and then left on disk.
 * So before running the smoke the gate compares the artifact's
 * `build-identity.json` (written by `scripts/stamp-sites-build.mjs` when the
 * artifact is generated) with the identity of the checkout the smoke is about
 * to run against. The fingerprint covers uncommitted tracked and untracked
 * content and, explicitly, the gitignored `freebuff.open-next.config.ts` and
 * `freebuff.wrangler.jsonc` — the configs that decide what the Sites build
 * produces even though git does not track them. A different commit — or the
 * same commit with a different uncommitted worktree — is refused, before the
 * smoke spends its build, with a message naming both identities. An artifact
 * with no stamp is refused too: "unknown provenance" is not "the same commit".
 * Regenerate and re-stamp, or restamp only if the artifact really was built from
 * the current state.
 *
 * The identity is resolved a second time after the smoke succeeds. The smoke
 * builds and serves the Worker, which takes minutes; without the second check a
 * file edited during that window would be attested as the source the smoke
 * validated, when the smoke may have read the old content, the new content, or a
 * mixture. A checkout that moved is quarantined like any other mismatch and no
 * attestation is written.
 *
 * This gate covers the repository's command path. A fresh platform build writes
 * a new `manifest.json` of its own, so the gate must be run after the artifact
 * is (re)generated and before the upload — it cannot retroactively invalidate a
 * manifest written after it ran.
 *
 * Usage:
 *   node scripts/gate-sites-publish.mjs [--dir=freebuff-sites-build]
 *     [--budget-bytes=33554432] [--smoke-command=scripts/smoke-worker.mjs]
 *
 * `--smoke-command` exists so the gate's own tests can drive the failure and
 * success paths without a full build; leave it unset to run the real Sites
 * smoke, which is the only supported publish path.
 *
 * Exit codes: 0 clean, smoke-matched and ready to upload, 1 rejected, absent,
 * unstamped or built from a different source than the smoke (nothing to
 * publish), 2 the manifest or the checkout's identity could not be read.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { auditSitesArtifact, SITES_UPLOAD_BUDGET_BYTES } from "./audit-sites-artifact.mjs";
import {
  compareIdentities,
  describeIdentity,
  differingBuildConfigs,
  readBuildIdentity,
  resolveSourceIdentity,
} from "./lib/sites-build-identity.mjs";

const MIB = 1024 * 1024;
const DEFAULT_SMOKE_COMMAND = path.join("scripts", "smoke-worker.mjs");
/** `--sites` is the mode that builds with the generated Sites config and bindings. */
const DEFAULT_SMOKE_ARGS = ["--sites"];

function describeBytes(bytes) {
  return bytes >= 1024 ? `${(bytes / MIB).toFixed(2)} MiB` : `${bytes} bytes`;
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument "${argument}"`);
    const separator = argument.indexOf("=");
    if (separator === -1) throw new Error(`Expected --name=value, got "${argument}"`);
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  return values;
}

/** Remove the manifest an uploader would read, keeping one recoverable copy. */
function quarantine(manifestPath) {
  const rejectedPath = path.join(path.dirname(manifestPath), "manifest.rejected.json");
  fs.copyFileSync(manifestPath, rejectedPath);
  fs.unlinkSync(manifestPath);
  return rejectedPath;
}

/**
 * Runs the Worker smoke check in the publish's own process tree and reports
 * whether it passed. Output is inherited so the failing route or header is
 * visible in the publish log, not summarised away.
 */
function runWorkerSmoke(script, args) {
  const absolute = path.resolve(script);
  const command = path.relative(process.cwd(), absolute) || absolute;
  console.log(
    `[sites-publish] running the Worker smoke check before upload: ` +
      `node ${[command, ...args].join(" ")}`,
  );
  const result = spawnSync(process.execPath, [absolute, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    return { ok: false, command, args, reason: result.error.message };
  }
  if (result.signal) {
    return { ok: false, command, args, reason: `terminated by ${result.signal}` };
  }
  return { ok: result.status === 0, command, args, reason: `exited ${result.status}` };
}

function main() {
  const values = parseArguments(process.argv.slice(2));
  const directory = values.get("dir") ?? "freebuff-sites-build";
  const smokeCommand = values.get("smoke-command");
  const smokeScript = smokeCommand ?? DEFAULT_SMOKE_COMMAND;
  // An injected command is a test double, so it is not also handed --sites.
  const smokeArgs = smokeCommand === undefined ? DEFAULT_SMOKE_ARGS : [];
  const budgetValue = values.get("budget-bytes");
  const budgetBytes = budgetValue === undefined ? SITES_UPLOAD_BUDGET_BYTES : Number(budgetValue);
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0) {
    throw new Error(`--budget-bytes must be a positive integer, got ${budgetValue}`);
  }

  const root = path.resolve(directory);
  const manifestPath = path.join(root, "manifest.json");
  const rejectedPath = path.join(root, "manifest.rejected.json");
  const attestationPath = path.join(root, "publish-attestation.json");

  // Restore a manifest quarantined by an earlier failed run, so the gate can be
  // re-run after cleanup instead of reporting a vacuous "absent artifact".
  if (!fs.existsSync(manifestPath) && fs.existsSync(rejectedPath)) {
    fs.copyFileSync(rejectedPath, manifestPath);
    console.log(`[sites-publish] restored the quarantined manifest for re-audit`);
  }

  if (!fs.existsSync(manifestPath)) {
    console.error(
      `[sites-publish] no manifest at ${manifestPath}; build the Sites artifact before publishing`,
    );
    process.exitCode = 1;
    return;
  }

  let report;
  try {
    report = auditSitesArtifact({ directory, budgetBytes });
  } catch (error) {
    // A manifest that cannot be read or names missing files is not publishable,
    // and leaving it in place would let an upload start and fail later.
    const reason = error instanceof Error ? error.message : String(error);
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    console.error(`[sites-publish] ${reason}`);
    console.error(`[sites-publish] manifest quarantined at ${rejected}; refusing the upload set.`);
    process.exitCode = 2;
    return;
  }

  if (report.problems.length > 0) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    for (const problem of report.problems) {
      console.error(`[sites-publish] PROBLEM: ${problem}`);
    }
    console.error(
      `[sites-publish] ${report.problems.length} problem(s); manifest quarantined at ` +
        `${rejected}, so no upload can start. Fix the artifact and re-run this command.`,
    );
    process.exitCode = 1;
    return;
  }

  // Which checkout built this artifact? The smoke only speaks for the checkout
  // it runs against, so an unstamped or differently-built upload set has to be
  // refused before the smoke spends a build proving something about other code.
  const artifactIdentity = readBuildIdentity(root);
  if (!artifactIdentity) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    console.error(
      `[sites-publish] the artifact carries no readable build identity; manifest quarantined ` +
        `at ${rejected}, so no upload can start. An upload set whose commit is unknown cannot be ` +
        `checked against the Worker smoke run, so run \`npm run sites:stamp\` immediately after ` +
        `generating the artifact and re-run this command.`,
    );
    process.exitCode = 1;
    return;
  }

  let sourceIdentity;
  try {
    sourceIdentity = resolveSourceIdentity({ cwd: process.cwd() });
  } catch (error) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    console.error(
      `[sites-publish] ${error instanceof Error ? error.message : String(error)}; the checkout ` +
        `this publish would smoke cannot be identified, so manifest quarantined at ${rejected} ` +
        `and no upload can start.`,
    );
    process.exitCode = 2;
    return;
  }

  const identityCheck = compareIdentities(artifactIdentity, sourceIdentity);
  if (!identityCheck.ok) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    // A regenerated Sites config is invisible to `git status`, so naming the
    // configs that changed is the only clue to why a clean-looking checkout no
    // longer matches its own stamp.
    const changedConfigs = differingBuildConfigs(artifactIdentity, sourceIdentity);
    const configNote =
      changedConfigs.length === 0
        ? ""
        : ` The gitignored build config(s) ${changedConfigs.join(", ")} — the smoke ` +
          `would build with configuration the upload set was not built with.`;
    console.error(
      identityCheck.reason === "commit"
        ? `[sites-publish] the artifact was built from commit ${artifactIdentity.commit} ` +
          `(${describeIdentity(artifactIdentity)}), but the Worker smoke check would run against ` +
          `${sourceIdentity.commit} (${describeIdentity(sourceIdentity)}). The smoke proves the ` +
          `current checkout works, not that this upload set came from it; manifest quarantined ` +
          `at ${rejected}, so no upload can start. Regenerate the artifact from the commit you ` +
          `mean to publish, stamp it, and re-run this command.`
        : `[sites-publish] the artifact and the current checkout are both at commit ` +
          `${sourceIdentity.commit}, but their uncommitted worktree state differs ` +
          `(${artifactIdentity.fingerprint.slice(0, 12)} vs ${sourceIdentity.fingerprint.slice(0, 12)}). ` +
          `The smoke would validate source the artifact was not built from; manifest quarantined ` +
          `at ${rejected}, so no upload can start.${configNote} Regenerate the artifact from the ` +
          `current worktree, stamp it, and re-run this command.`,
    );
    process.exitCode = 1;
    return;
  }

  // The upload set is sound and its source matches this checkout; now prove the
  // Worker it carries still behaves.
  const smoke = runWorkerSmoke(smokeScript, smokeArgs);
  if (!smoke.ok) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    console.error(
      `[sites-publish] the Worker smoke check failed (${smoke.reason}); manifest quarantined ` +
        `at ${rejected}, so no upload can start. Fix the Worker and re-run this command.`,
    );
    console.error(`[sites-publish] failing check: node ${[smoke.command, ...smoke.args].join(" ")}`);
    process.exitCode = 1;
    return;
  }

  // The smoke builds and serves the Worker, which takes minutes. The attestation
  // claims that run validated *this* checkout, so resolve the identity again: a
  // file edited mid-build would otherwise be attested as the source the smoke
  // observed, when the smoke may have read the old content, the new content, or
  // a mixture of both.
  let recheckedIdentity;
  try {
    recheckedIdentity = resolveSourceIdentity({ cwd: process.cwd() });
  } catch (error) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    console.error(
      `[sites-publish] ${error instanceof Error ? error.message : String(error)}; the checkout ` +
        `could not be re-identified after the Worker smoke check, so the pairing cannot be ` +
        `attested; manifest quarantined at ${rejected} and no upload can start.`,
    );
    process.exitCode = 2;
    return;
  }

  const drift = compareIdentities(sourceIdentity, recheckedIdentity);
  if (!drift.ok) {
    const rejected = quarantine(manifestPath);
    fs.rmSync(attestationPath, { force: true });
    const movedConfigs = differingBuildConfigs(sourceIdentity, recheckedIdentity);
    const configNote =
      movedConfigs.length === 0
        ? ""
        : ` The gitignored build config(s) ${movedConfigs.join(", ")} moved during the build.`;
    console.error(
      `[sites-publish] the checkout changed while the Worker smoke check was running: ` +
        `${describeIdentity(sourceIdentity)} (${sourceIdentity.fingerprint.slice(0, 12)}) before ` +
        `the smoke, ${describeIdentity(recheckedIdentity)} (${recheckedIdentity.fingerprint.slice(0, 12)}) ` +
        `after it. The smoke may have built a mixture of both, so it cannot be attested as ` +
        `having validated one checkout; manifest quarantined at ${rejected}, so no upload can ` +
        `start.${configNote} Re-run this command on a checkout that is not being edited.`,
    );
    process.exitCode = 1;
    return;
  }

  fs.rmSync(rejectedPath, { force: true });
  fs.writeFileSync(
    attestationPath,
    JSON.stringify(
      {
        manifest: path.relative(root, manifestPath).split(path.sep).join("/"),
        budgetBytes,
        totals: report.totals,
        forked: report.forked.length,
        assets: report.assets.length,
        // Record what actually ran: an injected test double must not be
        // attested as the Sites smoke.
        smoke: { command: smoke.command, args: smoke.args, checkedAt: new Date().toISOString() },
        // Both sides of the comparison this gate just made, so a later reader can
        // see the artifact and the smoke ran against the same source.
        buildIdentity: {
          artifact: {
            commit: artifactIdentity.commit,
            dirty: artifactIdentity.dirty,
            dirtyFiles: artifactIdentity.dirtyFiles,
            fingerprint: artifactIdentity.fingerprint,
            stampedAt: artifactIdentity.stampedAt,
          },
          smoke: {
            commit: sourceIdentity.commit,
            dirty: sourceIdentity.dirty,
            dirtyFiles: sourceIdentity.dirtyFiles,
            fingerprint: sourceIdentity.fingerprint,
          },
          matched: true,
          // The identity was resolved again after the smoke, so the claim is not
          // only about the state the command started in.
          recheckedAt: new Date().toISOString(),
        },
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(
    `[sites-publish] ${describeBytes(report.totals.total)} / ${describeBytes(budgetBytes)} ` +
      `(modules ${describeBytes(report.totals.modules)}, assets ${describeBytes(report.totals.assets)}, ` +
      `cache ${describeBytes(report.totals.cache)}), ${report.assets.length} asset file(s), ` +
      `${report.forked.length} forked`,
  );
  console.log(
    `[sites-publish] build identity ${describeIdentity(artifactIdentity)} matches the ` +
      `checkout the Worker smoke check ran against`,
  );
  console.log(`[sites-publish] ready to upload: ${manifestPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[sites-publish] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
