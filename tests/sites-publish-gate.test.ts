import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * The publish gate has to be more than an advisory report: the Sites uploader
 * cannot start without `manifest.json`, so a rejected artifact must leave no
 * manifest to read. These cases pin the quarantine, the restore-and-re-audit
 * path, the attestation written on success, and the fact that an absent artifact
 * fails the publish step instead of skipping it as a fresh checkout may.
 *
 * They also pin that a clean upload set is not enough to publish: the gate runs
 * the Sites Worker smoke check and quarantines the manifest when it fails, so a
 * header regression or a missing OCR rewrite cannot ride an otherwise tidy
 * artifact into the hosted Worker. The smoke is injected here (a throwaway
 * script) because the real one builds the Worker; the default is pinned in
 * source instead of being run.
 */

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeArtifact(extraAssets: Record<string, number> = {}): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-publish-"));
  tempDirectories.push(directory);

  fs.mkdirSync(path.join(directory, "worker"), { recursive: true });
  fs.mkdirSync(path.join(directory, "assets"), { recursive: true });
  fs.mkdirSync(path.join(directory, "cache"), { recursive: true });

  fs.writeFileSync(path.join(directory, "worker", "deploy-entry.js"), Buffer.alloc(100));
  fs.writeFileSync(path.join(directory, "assets", "app.js"), Buffer.alloc(200));
  fs.writeFileSync(path.join(directory, "cache", "0.json"), Buffer.alloc(50));
  for (const [name, bytes] of Object.entries(extraAssets)) {
    fs.writeFileSync(path.join(directory, "assets", name), Buffer.alloc(bytes));
  }

  fs.writeFileSync(
    path.join(directory, "manifest.json"),
    JSON.stringify({
      runtime: "opennext",
      entrypoint: "deploy-entry.js",
      modules: [{ name: "deploy-entry.js", type: "esm", path: "worker/deploy-entry.js" }],
      assetsDirectory: "assets",
      cache: [{ key: "incremental-cache/example.cache", path: "cache/0.json" }],
      spa: false,
    }),
  );

  return directory;
}

/** A stand-in for `scripts/smoke-worker.mjs --sites` with a chosen exit code. */
function makeSmoke(exitCode: number): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-smoke-"));
  tempDirectories.push(directory);
  const file = path.join(directory, "fake-smoke.mjs");
  fs.writeFileSync(file, `process.exitCode = ${exitCode};\n`, "utf8");
  return file;
}

function runGate(directory: string, extraArgs: string[] = []) {
  const args = [...extraArgs];
  // Never let a unit test start the real build; each case opts into the
  // smoke outcome it is about.
  if (!args.some((argument) => argument.startsWith("--smoke-command="))) {
    args.push(`--smoke-command=${makeSmoke(0)}`);
  }
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), "scripts", "gate-sites-publish.mjs"),
      `--dir=${directory}`,
      ...args,
    ],
    { encoding: "utf8" },
  );
}

describe("Sites publish gate", () => {
  it("passes a clean artifact and attests the measured upload set", () => {
    const directory = makeArtifact();

    const result = runGate(directory);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ready to upload:");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(false);

    const attestation = JSON.parse(
      fs.readFileSync(path.join(directory, "publish-attestation.json"), "utf8"),
    );
    expect(attestation).toMatchObject({
      manifest: "manifest.json",
      budgetBytes: 33_554_432,
      totals: { modules: 100, assets: 200, cache: 50, total: 350 },
      assets: 1,
      forked: 0,
    });
    expect(Number.isNaN(Date.parse(attestation.checkedAt))).toBe(false);
  });

  it("attests the Worker smoke check that ran before the upload", () => {
    const directory = makeArtifact();
    const smoke = makeSmoke(0);

    const result = runGate(directory, [`--smoke-command=${smoke}`]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("running the Worker smoke check before upload");
    const attestation = JSON.parse(
      fs.readFileSync(path.join(directory, "publish-attestation.json"), "utf8"),
    );
    // An injected double is recorded as itself, not as the Sites smoke.
    expect(attestation.smoke.command).toContain("fake-smoke.mjs");
    expect(attestation.smoke.args).toEqual([]);
    expect(Number.isNaN(Date.parse(attestation.smoke.checkedAt))).toBe(false);
  });

  it("refuses the publish when the Worker smoke check fails, even on a clean artifact", () => {
    const directory = makeArtifact();
    // A stale attestation must not survive a smoke failure either.
    fs.writeFileSync(path.join(directory, "publish-attestation.json"), "{}");

    const result = runGate(directory, [`--smoke-command=${makeSmoke(1)}`]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Worker smoke check failed (exited 1)");
    expect(result.stderr).toContain("no upload can start");
    expect(result.stderr).toContain("failing check: node");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "publish-attestation.json"))).toBe(false);
  });

  it("runs the Sites smoke by default, before it attests the upload", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts", "gate-sites-publish.mjs"),
      "utf8",
    );
    // The default has to be the check that builds with the generated Sites
    // config; a plain `smoke:worker` build would not exercise those bindings.
    expect(source).toContain('const DEFAULT_SMOKE_COMMAND = path.join("scripts", "smoke-worker.mjs")');
    expect(source).toContain('const DEFAULT_SMOKE_ARGS = ["--sites"]');
    // The smoke result must decide before the attestation declares success.
    const smokeCall = source.indexOf("const smoke = runWorkerSmoke(");
    const attest = source.indexOf("publish-attestation.json");
    expect(smokeCall).toBeGreaterThan(-1);
    expect(source.indexOf("fs.rmSync(rejectedPath, { force: true })")).toBeGreaterThan(smokeCall);
    expect(attest).toBeGreaterThan(-1);
  });

  it("quarantines the uploader's manifest on a forked asset, so no upload can start", () => {
    const directory = makeArtifact({ "client-corpus 2.json": 40 });
    const originalManifest = fs.readFileSync(path.join(directory, "manifest.json"), "utf8");
    // A stale attestation must not survive a rejection.
    fs.writeFileSync(path.join(directory, "publish-attestation.json"), "{}");

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("client-corpus 2.json");
    expect(result.stderr).toContain("no upload can start");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.readFileSync(path.join(directory, "manifest.rejected.json"), "utf8")).toBe(
      originalManifest,
    );
    expect(fs.existsSync(path.join(directory, "publish-attestation.json"))).toBe(false);
  });

  it("quarantines a forked asset directory, not only a forked filename", () => {
    const directory = makeArtifact();
    fs.mkdirSync(path.join(directory, "assets", "_next 2"), { recursive: true });
    fs.writeFileSync(path.join(directory, "assets", "_next 2", "chunk.js"), Buffer.alloc(40));

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("assets/_next 2");
    expect(result.stderr).toContain("forked directory name");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
  });

  it("restores the quarantined manifest so a fixed artifact can be re-audited", () => {
    const directory = makeArtifact({ "favicon 2.ico": 75 });
    const originalManifest = fs.readFileSync(path.join(directory, "manifest.json"), "utf8");

    expect(runGate(directory).status).toBe(1);
    fs.rmSync(path.join(directory, "assets", "favicon 2.ico"));

    const second = runGate(directory);

    expect(second.status).toBe(0);
    expect(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")).toBe(originalManifest);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "publish-attestation.json"))).toBe(true);
  });

  it("quarantines an over-budget artifact and names the overage", () => {
    const directory = makeArtifact();

    const result = runGate(directory, ["--budget-bytes=300"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("exceeding the budget of 300 bytes");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
  });

  it("fails the publish step when there is no artifact instead of skipping it", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-publish-empty-"));
    tempDirectories.push(directory);

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("build the Sites artifact before publishing");
    expect(fs.existsSync(path.join(directory, "publish-attestation.json"))).toBe(false);
  });

  it("quarantines an unreadable manifest instead of leaving a publishable file", () => {
    const directory = makeArtifact();
    fs.writeFileSync(path.join(directory, "manifest.json"), "{ not json");

    const result = runGate(directory);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("manifest quarantined");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
  });

  it("is exposed as the repository publish command", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["publish:sites"]).toBe("node scripts/gate-sites-publish.mjs");
    expect(packageJson.scripts?.["deploy:guard:sites"]).toBe(
      "node scripts/audit-sites-artifact.mjs",
    );
  });
});
