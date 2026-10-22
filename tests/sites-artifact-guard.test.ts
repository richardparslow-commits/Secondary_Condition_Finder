import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SITES_UPLOAD_BUDGET_BYTES,
  auditSitesArtifact,
} from "../scripts/audit-sites-artifact.mjs";

/**
 * The Sites uploader reads `manifest.json`: listed modules, every file under
 * `assets/`, and the private cache entries. This guard counts exactly that set,
 * so it must not be fooled by files beside it (source maps, build logs) — and it
 * must catch the folder-sync copies that made the real artifact 6.4 MiB larger
 * than its files.
 */

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeArtifact({
  moduleBytes = 100,
  assetBytes = 200,
  cacheBytes = 50,
  extraAssets = {},
}: {
  moduleBytes?: number;
  assetBytes?: number;
  cacheBytes?: number;
  extraAssets?: Record<string, number>;
} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-artifact-"));
  tempDirectories.push(directory);

  fs.mkdirSync(path.join(directory, "worker"), { recursive: true });
  fs.mkdirSync(path.join(directory, "assets"), { recursive: true });
  fs.mkdirSync(path.join(directory, "cache"), { recursive: true });

  fs.writeFileSync(path.join(directory, "worker", "deploy-entry.js"), Buffer.alloc(moduleBytes));
  fs.writeFileSync(path.join(directory, "assets", "app.js"), Buffer.alloc(assetBytes));
  fs.writeFileSync(path.join(directory, "cache", "0.json"), Buffer.alloc(cacheBytes));
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

describe("Sites artifact guard", () => {
  it("counts exactly the manifest's upload set and passes a clean artifact", () => {
    const directory = makeArtifact();
    // Not uploaded: neither source maps nor build logs may affect the total.
    fs.writeFileSync(path.join(directory, "worker", "deploy-entry.js.map"), Buffer.alloc(10_000));
    fs.writeFileSync(path.join(directory, "build.log"), Buffer.alloc(10_000));

    const report = auditSitesArtifact({ directory, budgetBytes: 1_000 });

    expect(report.status).toBe("audited");
    expect(report.totals).toEqual({ modules: 100, assets: 200, cache: 50, total: 350 });
    expect(report.forked).toEqual([]);
    expect(report.problems).toEqual([]);
    expect(report.assets.map((file: { relative: string }) => file.relative)).toEqual([
      "assets/app.js",
    ]);
  });

  it("rejects a folder-sync copy in the assets directory and reports its bytes", () => {
    const directory = makeArtifact({ extraAssets: { "favicon 2.ico": 75 } });

    const report = auditSitesArtifact({ directory, budgetBytes: 1_000 });

    expect(report.forked).toEqual([{ path: "assets/favicon 2.ico", bytes: 75 }]);
    expect(report.totals.assets).toBe(275);
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain("assets/favicon 2.ico");
    expect(report.problems[0]).toContain("delete it before upload");
  });

  it("rejects a forked directory and counts the whole subtree once", () => {
    const directory = makeArtifact();
    const forked = path.join(directory, "assets", "_next 2");
    fs.mkdirSync(forked, { recursive: true });
    fs.writeFileSync(path.join(forked, "chunk.js"), Buffer.alloc(120));
    fs.writeFileSync(path.join(forked, "nested.js"), Buffer.alloc(30));

    const report = auditSitesArtifact({ directory, budgetBytes: 1_000 });

    expect(report.forkedDirectories).toEqual([
      { path: "assets/_next 2", bytes: 150, files: 2 },
    ]);
    expect(report.totals.assets).toBe(350);
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain("assets/_next 2");
    expect(report.problems[0]).toContain("forked directory name");
    expect(report.problems[0]).toContain("150 bytes across 2 file(s)");
  });

  it("fails an over-budget upload and names the overage", () => {
    const directory = makeArtifact();

    const report = auditSitesArtifact({ directory, budgetBytes: 300 });

    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain("exceeding the budget of 300 bytes");
    expect(report.problems[0]).toContain("by 50 bytes");
  });

  it("skips an absent artifact instead of failing a fresh checkout", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sites-artifact-empty-"));
    tempDirectories.push(directory);

    const report = auditSitesArtifact({ directory });

    expect(report.status).toBe("absent");
    expect(report.problems).toEqual([]);
  });

  it("refuses a manifest that names a module which is not on disk", () => {
    const directory = makeArtifact();
    fs.rmSync(path.join(directory, "worker", "deploy-entry.js"));

    expect(() => auditSitesArtifact({ directory })).toThrow(/module worker\/deploy-entry\.js does not exist/);
  });

  it("exposes the CLI's non-zero exit for a forked upload set", () => {
    const directory = makeArtifact({ extraAssets: { "client-corpus 2.json": 40 } });
    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "audit-sites-artifact.mjs"), `--dir=${directory}`],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("client-corpus 2.json");
  });

  it("exposes the CLI's non-zero exit for a forked directory", () => {
    const directory = makeArtifact();
    fs.mkdirSync(path.join(directory, "assets", "_next 2"), { recursive: true });
    fs.writeFileSync(path.join(directory, "assets", "_next 2", "chunk.js"), Buffer.alloc(40));

    const result = spawnSync(
      process.execPath,
      [path.join(process.cwd(), "scripts", "audit-sites-artifact.mjs"), `--dir=${directory}`],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("assets/_next 2");
    expect(result.stderr).toContain("forked directory name");
  });

  it("pins the documented 32 MiB Sites budget", () => {
    expect(SITES_UPLOAD_BUDGET_BYTES).toBe(33_554_432);
  });
});
