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
 * hash the uploaded bytes.
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
 * Exit codes: 0 clean, smoked and ready to upload, 1 rejected, absent or failed
 * the Worker smoke check (nothing to publish), 2 the manifest could not be
 * read.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { auditSitesArtifact, SITES_UPLOAD_BUDGET_BYTES } from "./audit-sites-artifact.mjs";

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

  // The upload set is sound; now prove the Worker it carries still behaves.
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
  console.log(`[sites-publish] ready to upload: ${manifestPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[sites-publish] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
