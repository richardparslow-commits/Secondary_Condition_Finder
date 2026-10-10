import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Contracts for scripts/audit-artifact-traces.mjs — the deployment-artifact gate.
 *
 * The gate reads Next.js output-file traces (`.next/server/**\/*.nft.json`) and
 * the standalone bundle, and it must fail on two things a green `next build`
 * cannot see:
 *
 *   1. unrelated project files (source, tests, docs, scratch) traced into the
 *      artifact by a dynamic filesystem read — REL-03 shipped the whole project
 *      in three traces this way;
 *   2. required runtime data missing from a trace, which builds fine and then
 *      fails at the first production request.
 *
 * Everything here runs the real script against synthetic artifacts, so the
 * detection logic is pinned without needing an actual Next build. The gate must
 * also fail *closed*: an artifact it cannot read, or a profile with no traces
 * and no data, is a failure — never a vacuous pass.
 */

const SCRIPT = path.join(process.cwd(), "scripts", "audit-artifact-traces.mjs");
const tempDirs: string[] = [];

/** Every trace entry is relative to the trace's own directory. */
const PAGE_TRACE = ".next/server/app/page.js.nft.json";
const ROUTE_TRACE = ".next/server/app/api/health/route.js.nft.json";
const TRACE_DIRECTORY = "../../../";

const PACKAGE_JSON = `${TRACE_DIRECTORY}package.json`;
const DEPENDENCY = `${TRACE_DIRECTORY}node_modules/dep/index.js`;
const ALPHA = `${TRACE_DIRECTORY}data/knowledge-base/alpha.json`;
const BETA = `${TRACE_DIRECTORY}data/knowledge-base/beta.json`;
const QUARANTINED = `${TRACE_DIRECTORY}data/knowledge-base-quarantine/retired.json`;

function writeFiles(root: string, files: Record<string, string | object>): void {
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  }
}

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** An artifact directory: the traced runtime files plus the project around them. */
function artifactDir(overrides: Record<string, string | object> = {}): string {
  const root = tempDir("audit-traces-");
  writeFiles(root, {
    "package.json": { name: "fixture", version: "0.0.0" },
    "data/knowledge-base/alpha.json": { id: "alpha" },
    "data/knowledge-base/beta.json": { id: "beta" },
    "data/knowledge-base-quarantine/retired.json": { id: "retired" },
    "src/lib/thing.ts": "export const thing = 1;\n",
    "tests/thing.test.ts": "// test\n",
    "docs/notes.md": "# notes\n",
    "README.md": "# readme\n",
    "node_modules/dep/index.js": "module.exports = {};\n",
    [PAGE_TRACE]: { version: 1, files: [PACKAGE_JSON, DEPENDENCY, ALPHA, BETA] },
    ...overrides,
  });
  return root;
}

function nft(files: string[]): { version: number; files: string[] } {
  return { version: 1, files };
}

type GateResult = {
  status: number;
  stdout: string;
  stderr: string;
  report: {
    root: string;
    requiredDataFiles: number;
    failures: string[];
    traces: Array<{ route: string; unrelated: number; missingData: number; missingDependencies: number }>;
    standalone: { built: boolean; appRoots?: number; unrelated?: number; missingData?: number };
  };
};

function run(root: string): GateResult {
  const reportPath = path.join(tempDir("audit-traces-report-"), "report.json");
  const result = spawnSync(
    process.execPath,
    ["--no-warnings", SCRIPT, `--root=${root}`, `--json=${reportPath}`],
    { encoding: "utf8" },
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as GateResult["report"];
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    report,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("deployment artifact trace gate — healthy artifact", () => {
  it("passes a complete artifact of runtime files only", () => {
    const result = run(artifactDir());

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
    expect(result.report.failures).toEqual([]);
    expect(result.report.requiredDataFiles).toBe(2);
    expect(result.report.traces).toHaveLength(1);
    // The plain `npm run build` profile has no standalone bundle, and the gate
    // says so rather than implying it audited one.
    expect(result.report.standalone.built).toBe(false);
  });

  it("excludes the quarantine directory from the required runtime data", () => {
    // RETIRED_DATA_DIRS exists so unreviewed clinical drafts are not shipped;
    // the same exclusion has to hold for the required-data contract, or every
    // trace would be "missing" data that must not be there in the first place.
    const root = artifactDir({
      [PAGE_TRACE]: nft([PACKAGE_JSON, DEPENDENCY, ALPHA, BETA]),
    });

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.report.requiredDataFiles).toBe(2);
  });

  it("reports a finding when a retired data file is traced after all", () => {
    const root = artifactDir({
      [PAGE_TRACE]: nft([PACKAGE_JSON, ALPHA, BETA, QUARANTINED]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unrelated project file(s) traced");
    expect(result.stderr).toContain("data/knowledge-base-quarantine/retired.json");
  });
});

describe("deployment artifact trace gate — unrelated project files", () => {
  it("fails when source, tests, docs or scratch files are traced", () => {
    const root = artifactDir({
      [PAGE_TRACE]: nft([
        PACKAGE_JSON,
        DEPENDENCY,
        ALPHA,
        BETA,
        `${TRACE_DIRECTORY}src/lib/thing.ts`,
        `${TRACE_DIRECTORY}tests/thing.test.ts`,
        `${TRACE_DIRECTORY}docs/notes.md`,
        `${TRACE_DIRECTORY}README.md`,
      ]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("4 unrelated project file(s) traced");
    for (const leaked of ["src/lib/thing.ts", "tests/thing.test.ts", "docs/notes.md", "README.md"]) {
      expect(result.stderr).toContain(leaked);
    }
    expect(result.report.traces[0]!.unrelated).toBe(4);
  });

  it("does not misread a package's own src directory as project source", () => {
    // `node_modules/<pkg>/src/**` is package content, not this project's source;
    // flagging it would make the gate permanently red and therefore ignored.
    const root = artifactDir({
      "node_modules/dep/src/internal.ts": "export {};\n",
      [PAGE_TRACE]: nft([PACKAGE_JSON, DEPENDENCY, ALPHA, BETA, `${TRACE_DIRECTORY}node_modules/dep/src/internal.ts`]),
    });

    const result = run(root);
    expect(result.status).toBe(0);
  });
});

describe("deployment artifact trace gate — missing runtime data", () => {
  it("fails when an App Router trace omits required data", () => {
    const root = artifactDir({
      [PAGE_TRACE]: nft([PACKAGE_JSON, DEPENDENCY, ALPHA]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("1 of 2 required runtime data file(s) missing from this trace");
    expect(result.stderr).toContain("data/knowledge-base/beta.json");
    expect(result.report.traces[0]!.missingData).toBe(1);
  });

  it("holds every App Router trace to the app-wide include", () => {
    const root = artifactDir({
      [ROUTE_TRACE]: nft([DEPENDENCY]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("api/health/route.js.nft.json: 2 of 2 required runtime data file(s) missing");
  });

  it("exempts non-App-Router traces from the data contract", () => {
    // instrumentation.js and the minimal server do not render or run the
    // loaders, so requiring the data include there would be a false positive.
    // Trace entries are relative to the trace's own directory, so an
    // instrumentation trace (one directory shallower) uses a shorter prefix.
    const root = artifactDir({
      ".next/server/instrumentation.js.nft.json": nft(["../../node_modules/dep/index.js"]),
    });

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.report.traces).toHaveLength(2);
  });

  it("fails when a traced dependency is not on disk", () => {
    const root = artifactDir({
      [PAGE_TRACE]: nft([PACKAGE_JSON, DEPENDENCY, ALPHA, BETA, `${TRACE_DIRECTORY}node_modules/dep/missing.js`]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("do not exist on disk");
    expect(result.stderr).toContain("node_modules/dep/missing.js");
  });

  it("fails when a trace depends on a path outside the project", () => {
    const outside = tempDir("audit-traces-outside-");
    const root = path.join(tempDir("audit-traces-base-"), "project");
    fs.mkdirSync(root, { recursive: true });
    writeFiles(root, {
      "package.json": { name: "fixture", version: "0.0.0" },
      "data/knowledge-base/alpha.json": { id: "alpha" },
      [PAGE_TRACE]: nft([PACKAGE_JSON, ALPHA, "../../../../../outside/shared.json"]),
    });
    fs.writeFileSync(path.join(outside, "shared.json"), "{}\n");

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("outside the project and outside node_modules");
  });
});

describe("deployment artifact trace gate — fail closed", () => {
  it("fails when the build produced no traces at all", () => {
    const root = tempDir("audit-traces-empty-");
    writeFiles(root, { "data/knowledge-base/alpha.json": { id: "alpha" } });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no .nft.json traces");
    expect(result.stderr).toContain("a vacuous pass is not accepted");
  });

  it("fails when there is no required runtime data to validate", () => {
    const root = tempDir("audit-traces-nodata-");
    writeFiles(root, {
      "package.json": { name: "fixture", version: "0.0.0" },
      [PAGE_TRACE]: nft([PACKAGE_JSON]),
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fails closed");
  });

  it("fails on an unreadable trace instead of skipping it", () => {
    const root = artifactDir({ [PAGE_TRACE]: "{not-json" });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unreadable trace");
  });

  it("fails on a trace with no files array", () => {
    const root = artifactDir({ [PAGE_TRACE]: { version: 1 } });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('trace has no "files" array');
  });
});

describe("deployment artifact trace gate — standalone bundle", () => {
  function standaloneDir(overrides: Record<string, string | object> = {}): string {
    const root = tempDir("audit-traces-standalone-");
    writeFiles(root, {
      "package.json": { name: "fixture", version: "0.0.0" },
      "data/knowledge-base/alpha.json": { id: "alpha" },
      "data/knowledge-base/beta.json": { id: "beta" },
      "node_modules/dep/index.js": "module.exports = {};\n",
      [PAGE_TRACE]: nft([PACKAGE_JSON, DEPENDENCY, ALPHA, BETA]),
      ".next/standalone/server.js": "// entrypoint\n",
      ".next/standalone/.next/BUILD_ID": "test-build\n",
      ".next/standalone/node_modules/dep/index.js": "module.exports = {};\n",
      ".next/standalone/public/asset.txt": "asset\n",
      ".next/standalone/data/knowledge-base/alpha.json": { id: "alpha" },
      ".next/standalone/data/knowledge-base/beta.json": { id: "beta" },
      ...overrides,
    });
    return root;
  }

  it("audits a standalone bundle and accepts the generated entrypoint", () => {
    // Regression contract: the app root is the directory holding server.js, not
    // the server.js file itself. Treating the file as the root made the gate
    // crash (ENOTDIR) or report the entrypoint as an unrelated project file.
    const result = run(standaloneDir());

    expect(result.status).toBe(0);
    expect(result.report.standalone).toMatchObject({ built: true, appRoots: 1, unrelated: 0, missingData: 0 });
  });

  it("finds a nested standalone app root", () => {
    const nested = path.join(".next", "standalone", "workspace", "project");
    const root = tempDir("audit-traces-nested-");
    writeFiles(root, {
      "package.json": { name: "fixture", version: "0.0.0" },
      "data/knowledge-base/alpha.json": { id: "alpha" },
      [PAGE_TRACE]: nft([PACKAGE_JSON, ALPHA]),
      [path.join(nested, "server.js")]: "// entrypoint\n",
      [path.join(nested, ".next/BUILD_ID")]: "test-build\n",
      [path.join(nested, "data/knowledge-base/alpha.json")]: { id: "alpha" },
    });

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.report.standalone).toMatchObject({ built: true, appRoots: 1 });
  });

  it("fails when the standalone bundle ships project files", () => {
    const root = standaloneDir({
      ".next/standalone/docs/notes.md": "# notes\n",
      ".next/standalone/README.md": "# readme\n",
    });

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("standalone bundle: 2 unrelated project file(s) shipped");
    expect(result.report.standalone.unrelated).toBe(2);
  });

  it("fails when the standalone bundle is missing runtime data", () => {
    const root = standaloneDir({ ".next/standalone/data/knowledge-base/beta.json": "" });
    fs.rmSync(path.join(root, ".next/standalone/data/knowledge-base/beta.json"));

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("standalone bundle: 1 of 2 required runtime data file(s) missing");
  });

  it("fails when a standalone bundle has no auditable entrypoint", () => {
    const root = standaloneDir({ ".next/standalone/.next/BUILD_ID": "" });
    fs.rmSync(path.join(root, ".next/standalone/.next/BUILD_ID"));

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("has no entry point alongside a .next/BUILD_ID");
  });

  it.skipIf(process.platform === "win32")("does not follow symlinks out of the bundle", () => {
    const root = standaloneDir();
    const link = path.join(root, ".next/standalone/public/linked-docs");
    try {
      fs.symlinkSync(path.join(root, "docs"), link, "dir");
    } catch {
      return; // No symlink support in this environment; the walker skips them anyway.
    }

    const result = run(root);
    expect(result.status).toBe(0);
    expect(result.report.standalone.unrelated).toBe(0);
  });
});

describe("deployment artifact trace gate — CI wiring", () => {
  const ci = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const scripts = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).scripts;

  it("exposes the gate as an npm script", () => {
    expect(scripts["audit:traces"]).toBe("node scripts/audit-artifact-traces.mjs");
  });

  it("runs the gate on the build output, after the build", () => {
    expect(ci).toContain("npm run audit:traces -- --json=ci-artifact-traces.json 2>&1 | tee ci-artifact-traces.log");
    expect(ci.indexOf("id: build")).toBeLessThan(ci.indexOf("id: artifact_traces"));
    // Without an artifact there is nothing to audit; the build gate already
    // fails the job in that case.
    expect(ci).toContain("if: steps.build.outcome == 'success'");
  });

  it("cannot silently degrade into an advisory check", () => {
    // Every gate here is continue-on-error + re-failed by the aggregator step.
    const aggregator = ci.slice(ci.indexOf("Fail the job if any gate failed"));
    expect(aggregator).toContain("steps.artifact_traces.outcome");
    expect(ci).toContain("echo \"- artifact-traces: ${{ steps.artifact_traces.outcome }}\"");
  });

  it("collects the gate log and report for diagnosis", () => {
    const diagnostics = ci.slice(ci.indexOf("Collect diagnostic summary"), ci.indexOf("Upload diagnostic logs"));
    expect(diagnostics).toContain("ci-artifact-traces.log");
    expect(ci).toContain("ci-artifact-traces.json");
  });
});
