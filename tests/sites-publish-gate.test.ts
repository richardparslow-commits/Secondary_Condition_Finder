import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BUILD_CONFIG_FILES,
  readBuildIdentity,
  resolveSourceIdentity,
  writeBuildIdentity,
} from "../scripts/lib/sites-build-identity.mjs";

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

function makeArtifact(
  extraAssets: Record<string, number> = {},
  identity: Record<string, unknown> | null = resolveSourceIdentity({ cwd: process.cwd() }),
): string {
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

  // An artifact is only publishable with the identity of the checkout that
  // built it, so the fixture carries the real current identity by default.
  if (identity) writeBuildIdentity(directory, identity);

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

/**
 * A throwaway git repository, for the cases whose subject is the boundary where
 * `git status` and `git diff` are blind (ignored files) or where the checkout
 * changes underneath a running command.
 */
function makeRepository(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-identity-"));
  tempDirectories.push(directory);
  const git = (...arguments_: string[]) => {
    const result = spawnSync("git", arguments_, { cwd: directory, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${arguments_.join(" ")} failed: ${result.stderr}`);
    }
    return result.stdout;
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "identity@example.invalid");
  git("config", "user.name", "Identity Test");
  fs.writeFileSync(path.join(directory, ".gitignore"), "/freebuff.open-next.config.ts\n/freebuff.wrangler.jsonc\n");
  fs.writeFileSync(path.join(directory, "package.json"), "{}\n");
  git("add", ".");
  git("commit", "-q", "-m", "initial");
  return directory;
}

/** A stand-in smoke that edits a tracked file, as an editor would mid-build. */
function makeMutatingSmoke(relativePath: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-smoke-drift-"));
  tempDirectories.push(directory);
  const file = path.join(directory, "mutating-smoke.mjs");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nfs.appendFileSync(${JSON.stringify(relativePath)}, "// edited mid-build\\n");\n`,
    "utf8",
  );
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

  it("refuses an artifact built from a different commit, before the smoke runs", () => {
    const current = resolveSourceIdentity({ cwd: process.cwd() });
    const directory = makeArtifact({}, { ...current, commit: "a".repeat(40) });
    fs.writeFileSync(path.join(directory, "publish-attestation.json"), "{}");

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`built from commit ${"a".repeat(40)}`);
    expect(result.stderr).toContain(current.commit);
    expect(result.stderr).toContain("no upload can start");
    // The smoke builds the Worker; refusing before it runs is the point.
    expect(result.stdout).not.toContain("running the Worker smoke check");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "publish-attestation.json"))).toBe(false);
  });

  it("refuses an artifact with no build identity instead of assuming it matches", () => {
    const directory = makeArtifact({}, null);

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("carries no readable build identity");
    expect(result.stderr).toContain("npm run sites:stamp");
    expect(result.stdout).not.toContain("running the Worker smoke check");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
  });

  it("refuses an artifact built from different uncommitted content at the same commit", () => {
    const current = resolveSourceIdentity({ cwd: process.cwd() });
    const directory = makeArtifact({}, { ...current, fingerprint: "b".repeat(64) });

    const result = runGate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("uncommitted worktree state differs");
    expect(result.stderr).toContain("no upload can start");
    expect(result.stdout).not.toContain("running the Worker smoke check");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
  });

  it("attests the artifact and smoke build identities it compared", () => {
    const directory = makeArtifact();

    expect(runGate(directory).status).toBe(0);

    const attestation = JSON.parse(
      fs.readFileSync(path.join(directory, "publish-attestation.json"), "utf8"),
    );
    const current = resolveSourceIdentity({ cwd: process.cwd() });
    expect(attestation.buildIdentity.matched).toBe(true);
    expect(attestation.buildIdentity.artifact.commit).toBe(current.commit);
    expect(attestation.buildIdentity.smoke.commit).toBe(current.commit);
    expect(attestation.buildIdentity.artifact.fingerprint).toBe(current.fingerprint);
    expect(typeof attestation.buildIdentity.artifact.stampedAt).toBe("string");
    // The identity is resolved again after the smoke, so the recorded pairing
    // is not just the state the command started in.
    expect(typeof attestation.buildIdentity.recheckedAt).toBe("string");
  });

  it("refuses when the checkout changed while the smoke was running", () => {
    const repository = makeRepository();
    const directory = makeArtifact({}, resolveSourceIdentity({ cwd: repository }));

    // The smoke builds the Worker, then edits a tracked file before returning.
    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "gate-sites-publish.mjs"),
        `--dir=${directory}`,
        `--smoke-command=${makeMutatingSmoke("package.json")}`,
      ],
      { cwd: repository, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("changed while the Worker smoke check was running");
    // A run whose source moved underneath it must not leave an attestation or a
    // manifest an uploader could read.
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
    expect(packageJson.scripts?.["sites:stamp"]).toBe("node scripts/stamp-sites-build.mjs");
    expect(packageJson.scripts?.["deploy:guard:sites"]).toBe(
      "node scripts/audit-sites-artifact.mjs",
    );
  });
});

/**
 * The ignored Sites configs are build inputs, not workspace noise. The identity
 * has to move when one of them is regenerated, or the gate can attest that a
 * smoke build ran against the same source as an artifact it did not build from.
 * These cases use a throwaway git repository: the property only exists at the
 * boundary where `git status` and `git diff` are blind by design.
 */
describe("Sites build identity includes the generated build configs", () => {
  it("changes the fingerprint when a gitignored build config changes", () => {
    const repository = makeRepository();
    const absent = resolveSourceIdentity({ cwd: repository });
    expect(absent.buildConfigs.map((config) => config.present)).toEqual([false, false]);

    const configPath = path.join(repository, BUILD_CONFIG_FILES[0]);
    fs.writeFileSync(configPath, "export default { incrementalCache: 'r2' };\n");
    const created = resolveSourceIdentity({ cwd: repository });

    // The point of the fix: git reports a clean tree, so only the explicit
    // content hash can see this change.
    expect(created.dirty).toBe(false);
    expect(created.fingerprint).not.toBe(absent.fingerprint);
    expect(created.buildConfigs[0]).toMatchObject({
      path: BUILD_CONFIG_FILES[0],
      present: true,
    });
    expect(created.buildConfigs[0].digest).toMatch(/^[0-9a-f]{64}$/);

    // Same byte length, different content: a size-only check would miss it.
    fs.writeFileSync(configPath, "export default { incrementalCache: 'kv' };\n");
    const edited = resolveSourceIdentity({ cwd: repository });
    expect(edited.dirty).toBe(false);
    expect(edited.fingerprint).not.toBe(created.fingerprint);
    expect(edited.buildConfigs[0].digest).not.toBe(created.buildConfigs[0].digest);
  });

  it("names the config that changed when a regenerated config is the only difference", () => {
    const repository = makeRepository();
    const configPath = path.join(repository, BUILD_CONFIG_FILES[0]);
    fs.writeFileSync(configPath, "export default { incrementalCache: 'r2' };\n");
    // Stamp describes the artifact as built from this config.
    const directory = makeArtifact({}, resolveSourceIdentity({ cwd: repository }));

    // Regenerated after the stamp, exactly as a publish does. Git still sees a
    // clean tree, so the refusal has to name this file to be actionable.
    fs.writeFileSync(configPath, "export default { incrementalCache: 'kv' };\n");

    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "scripts", "gate-sites-publish.mjs"),
        `--dir=${directory}`,
        `--smoke-command=${makeSmoke(0)}`,
      ],
      { cwd: repository, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `${BUILD_CONFIG_FILES[0]} (content changed since the stamp)`,
    );
    expect(result.stderr).toContain(
      "would build with configuration the upload set was not built with",
    );
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
  });

  it("hashes large untracked files by content instead of by size", () => {
    const repository = makeRepository();
    // Larger than the 8 MiB stub the fingerprint used to record for big files.
    const body = Buffer.alloc(9 * 1024 * 1024, 0x61);
    const generated = path.join(repository, "generated.bin");
    fs.writeFileSync(generated, body);
    const before = resolveSourceIdentity({ cwd: repository });

    // Same byte length, different content: a size-only identity accepts this
    // as unchanged and would attest an artifact built from the old bytes.
    body[body.length - 1] = 0x62;
    fs.writeFileSync(generated, body);
    const after = resolveSourceIdentity({ cwd: repository });

    // The file is untracked, so only its content hash can distinguish the two
    // states: its path and byte length are identical.
    expect(after.untrackedFiles).toBe(before.untrackedFiles);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it("stamps the build-config digests so the comparison is auditable", () => {
    const repository = makeRepository();
    fs.writeFileSync(
      path.join(repository, BUILD_CONFIG_FILES[0]),
      "export default { queue: 'do' };\n",
    );
    const identity = resolveSourceIdentity({ cwd: repository });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-identity-stamp-"));
    tempDirectories.push(directory);

    writeBuildIdentity(directory, identity);
    const record = JSON.parse(
      fs.readFileSync(path.join(directory, "build-identity.json"), "utf8"),
    ) as { version: number; buildConfigs: Array<{ path: string; present: boolean; digest: string | null }> };

    expect(record.version).toBe(2);
    expect(record.buildConfigs).toHaveLength(BUILD_CONFIG_FILES.length);
    expect(record.buildConfigs[0]).toMatchObject({ path: BUILD_CONFIG_FILES[0], present: true });
    expect(record.buildConfigs[0].digest).toBe(identity.buildConfigs[0].digest);
    expect(record.buildConfigs[1]).toMatchObject({ present: false, digest: null });
    expect(readBuildIdentity(directory)?.buildConfigs).toEqual(identity.buildConfigs);
  });
});

/**
 * `npm run sites:stamp` is the recovery step after a gate refusal, so it runs
 * while the manifest is quarantined. Releasing that quarantine is only safe once
 * the stamp exists: an uploader reads `manifest.json`, so a failed stamp that
 * restored it would undo the refusal it was meant to repair.
 */
describe("Sites stamp command", () => {
  function runStamp(directory: string, cwd: string) {
    return spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "stamp-sites-build.mjs"), `--dir=${directory}`],
      { cwd, encoding: "utf8" },
    );
  }

  it("stamps a quarantined artifact, then restores its manifest", () => {
    const repository = makeRepository();
    const directory = makeArtifact({}, null);
    fs.renameSync(
      path.join(directory, "manifest.json"),
      path.join(directory, "manifest.rejected.json"),
    );

    const result = runStamp(directory, repository);

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(directory, "build-identity.json"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(true);
    // The rename publishes the complete copy: identical bytes, no temporary left
    // beside the manifest.
    expect(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")).toBe(
      fs.readFileSync(path.join(directory, "manifest.rejected.json"), "utf8"),
    );
    expect(
      fs.readdirSync(directory).filter((name) => name.startsWith(".manifest.json")),
    ).toEqual([]);
    // The stamp is written before the quarantine is released.
    expect(result.stdout.indexOf("build-identity.json")).toBeGreaterThan(-1);
    expect(result.stdout.indexOf("build-identity.json")).toBeLessThan(
      result.stdout.indexOf("restored the quarantined manifest"),
    );
  });

  it("leaves the quarantine in place when the identity cannot be resolved", () => {
    const directory = makeArtifact({}, null);
    fs.renameSync(
      path.join(directory, "manifest.json"),
      path.join(directory, "manifest.rejected.json"),
    );
    // A checkout with no git: resolving the identity throws before any write.
    const notARepository = fs.mkdtempSync(path.join(os.tmpdir(), "sites-stamp-nogit-"));
    tempDirectories.push(notARepository);

    const result = runStamp(directory, notARepository);

    expect(result.status).toBe(1);
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "build-identity.json"))).toBe(false);
    expect(result.stderr).toContain("quarantined manifest is left at");
  });

  it("keeps the quarantine when the stamp itself cannot be written", () => {
    const repository = makeRepository();
    const directory = makeArtifact({}, null);
    fs.renameSync(
      path.join(directory, "manifest.json"),
      path.join(directory, "manifest.rejected.json"),
    );
    // The identity resolves, then the stamp write fails: a directory occupies
    // the stamp path. This is the case the old order got wrong — it restored
    // the manifest first, so an unwritable stamp still handed the uploader a
    // manifest and undid the refusal.
    fs.mkdirSync(path.join(directory, "build-identity.json"));

    const result = runStamp(directory, repository);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("build-identity.json");
    expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(directory, "manifest.rejected.json"))).toBe(true);
    // The failed restore path never ran, and left no temporary beside it.
    expect(
      fs.readdirSync(directory).filter((name) => name.startsWith(".manifest.json")),
    ).toEqual([]);
  });

  it("leaves no manifest when the quarantine release fails", () => {
    const repository = makeRepository();
    const directory = makeArtifact({}, null);
    const rejectedPath = path.join(directory, "manifest.rejected.json");
    fs.renameSync(path.join(directory, "manifest.json"), rejectedPath);
    // The stamp succeeds; the restore cannot read its source. A direct copy
    // could leave a truncated `manifest.json` here, which an uploader would read
    // while this command exits 2. The temporary-then-rename release must leave
    // no manifest at all and clean up after itself.
    fs.chmodSync(rejectedPath, 0o000);

    try {
      const result = runStamp(directory, repository);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("could not restore the quarantined manifest");
      expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
      expect(fs.existsSync(rejectedPath)).toBe(true);
      expect(fs.existsSync(path.join(directory, "build-identity.json"))).toBe(true);
      expect(
        fs.readdirSync(directory).filter((name) => name.startsWith(".manifest.json")),
      ).toEqual([]);
    } finally {
      fs.chmodSync(rejectedPath, 0o600);
    }
  });

  it("releases the quarantine through a sibling rename, not a direct copy", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts", "stamp-sites-build.mjs"),
      "utf8",
    );
    const copyToTemporary = source.indexOf("fs.copyFileSync(rejectedPath, restorePath)");
    const rename = source.indexOf("fs.renameSync(restorePath, manifestPath)");

    expect(copyToTemporary).toBeGreaterThan(-1);
    expect(rename).toBeGreaterThan(copyToTemporary);
    // The defect this pins: releasing the quarantine with a direct copy could
    // stop halfway and leave a publishable, truncated manifest.
    expect(source).not.toContain("fs.copyFileSync(rejectedPath, manifestPath)");
  });
});
