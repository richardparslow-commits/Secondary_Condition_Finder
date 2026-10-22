import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_REVIEW_WINDOW_DAYS,
  DISPOSITION_FAILURE,
  advisoriesFromAuditReport,
  evaluateDependencyDisposition,
  patchedVersionFromOsv,
  resolveRegistryPatches,
  validateDispositionRegister,
} from "../scripts/lib/dependency-advisory-disposition.mjs";

/**
 * A10 (audit issue list, item 25): "track a compatible patched dependency path
 * or an explicit evidence-based tooling risk disposition."
 *
 * No patched path exists to track for `braces`, which is affected across its
 * entire published range (`introduced: 0` … `last_affected: 3.0.3`, and 3.0.3
 * *is* the newest release). The second entry is different as of 2026-10-22: the
 * `sprintf-js` advisory (`GHSA-hp3w-g68c-fv3c`) was **withdrawn upstream**, so
 * the register keeps it as a dated `withdrawn-upstream` record whose claim is
 * that the audit does *not* report it. That state is checked in the opposite
 * direction from live debt — reported again means the withdrawal did not hold —
 * so a withdrawal cannot be used as a way to park an advisory. npm's proposed
 * resolution for the live entry is `npm audit fix --force`, which
 * downgrades `eslint-config-next` from 16.3.8 to 14.2.35 — two major lines back,
 * and exactly what SECURITY.md forbids. So the disposition branch is the one that
 * has to be honest, and honesty that is only prose rots. This suite is what keeps
 * `docs/dependency-advisory-disposition.json` true:
 *
 *   - the policy module is exercised with synthetic reports so every failure code
 *     (new debt, drifted record, an available patch, an expired review) is proven
 *     to fail closed rather than assumed to;
 *   - the real register is checked against a captured `npm audit --json` report
 *     and the committed lockfile, so the record and the tree cannot diverge;
 *   - the reachability claims the register rests on (dev-only chain; the runtime
 *     chain reachable only through a CLI this application never runs) are pinned
 *     to code and lockfile facts instead of trust;
 *   - the gate is pinned as *enforced* CI, because a disposition that cannot fail
 *     is a comment.
 *
 * The fixture is a snapshot; `npm run audit:disposition` in `ci.yml` is what
 * compares the register against the live tree on every change.
 */

const ROOT = process.cwd();
const REGISTER_PATH = "docs/dependency-advisory-disposition.json";
const REPORT_FIXTURE = "tests/fixtures/npm-audit-full-tree.json";
const CLI = "scripts/audit-dependency-disposition.mjs";
const PRIVACY_FREE_REACHABILITY_CLAIM = "tests/dependency-advisory-disposition.test.ts";

type DispositionPath = {
  package: string;
  version: string;
  lockPath: string;
  dependencyPath: string[];
};

type DispositionEntry = {
  advisory: string;
  url: string;
  title: string;
  severity: string;
  advisoryRange: string;
  patchedVersion: string | null;
  disposition: string;
  withdrawnAt?: string;
  withdrawnEvidence?: string;
  ships: string;
  affectedPackages: string[];
  paths: DispositionPath[];
  reachability: string;
  compensatingControls: string[];
  reproduction: string[];
  reviewedAt: string;
};

type DispositionRegister = {
  schemaVersion: number;
  policy: string;
  reviewWindowDays: number;
  owner: string;
  authority: string;
  entries: DispositionEntry[];
};

/** One entry in an `npm audit --json` (report version 2) vulnerability map. */
type AuditVulnerability = {
  name?: string;
  severity: string;
  via: Array<AuditVia | string>;
  effects?: string[];
  range?: string;
  isDirect?: boolean;
  nodes?: unknown[];
  fixAvailable?: boolean;
};

type AuditVia = {
  source?: number;
  name?: string;
  dependency?: string;
  url?: string;
  title?: string;
  severity?: string;
  range?: string;
};

type AuditReport = {
  auditReportVersion: number;
  vulnerabilities: Record<string, AuditVulnerability>;
  metadata: { vulnerabilities: Record<string, number> };
};

type LockfileEntry = {
  version?: string;
  dev?: boolean;
  bin?: unknown;
  dependencies?: Record<string, string>;
};

type Lockfile = { lockfileVersion: number; packages: Record<string, LockfileEntry> };

function readJson<T = unknown>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type ChainSpec = {
  id: string;
  severity: string;
  range: string;
  chain: string[];
};

/**
 * Build a report shaped like `npm audit --json` (report version 2) for a linear
 * dependency chain: the advisory object sits on the first package, and each
 * dependent names its vulnerable dependency as a string `via` and lists its own
 * dependents in `effects` — which is how npm reports one advisory counted N
 * times.
 */
function linearChainReport(specs: ChainSpec[]) {
  const vulnerabilities: Record<string, unknown> = {};
  for (const spec of specs) {
    spec.chain.forEach((name, index) => {
      const isAdvisoryCarrier = index === 0;
      vulnerabilities[name] = {
        name,
        severity: spec.severity,
        isDirect: false,
        via: isAdvisoryCarrier
          ? [
              {
                source: 1,
                name,
                dependency: name,
                title: "synthetic advisory",
                url: `https://github.com/advisories/${spec.id}`,
                severity: spec.severity,
                range: spec.range,
              },
            ]
          : [spec.chain[index - 1]],
        effects: index === spec.chain.length - 1 ? [] : [spec.chain[index + 1]],
        range: isAdvisoryCarrier ? spec.range : "*",
        nodes: [],
        fixAvailable: false,
      };
    });
  }
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1 } },
  };
}

const BASELINE: ChainSpec = {
  id: "GHSA-abcd-efgh-ijkl",
  severity: "high",
  range: "<=1.2.3",
  chain: ["alpha", "beta"],
};

function baselineReport() {
  return linearChainReport([BASELINE]);
}

function baselineLockfile(): Lockfile {
  return {
    lockfileVersion: 3,
    packages: {
      "": { version: "0.0.0" },
      "node_modules/alpha": { version: "1.2.3", dev: true },
      "node_modules/beta": { version: "4.5.6", dev: true },
    },
  };
}

function baselineEntry(overrides: Partial<DispositionEntry> = {}): DispositionEntry {
  return {
    advisory: BASELINE.id,
    url: `https://github.com/advisories/${BASELINE.id}`,
    title: "Synthetic high-severity advisory",
    severity: "high",
    advisoryRange: "<=1.2.3",
    patchedVersion: null,
    disposition: "tracked-no-fix",
    ships: "dev-tooling",
    affectedPackages: ["alpha", "beta"],
    paths: [
      {
        package: "alpha",
        version: "1.2.3",
        lockPath: "node_modules/alpha",
        dependencyPath: ["tooling", "alpha@1.2.3"],
      },
      {
        package: "beta",
        version: "4.5.6",
        lockPath: "node_modules/beta",
        dependencyPath: ["tooling", "beta@4.5.6"],
      },
    ],
    reachability: "Synthetic: reached only by a developer running the lint configuration.",
    compensatingControls: ["Synthetic: dev-only, absent from the runtime tree."],
    reproduction: ["npm run audit:high:all"],
    reviewedAt: today(),
    ...overrides,
  };
}

function baselineRegister(
  overrides: Partial<DispositionEntry> & {
    entries?: DispositionEntry[];
    reviewWindowDays?: number;
  } = {},
): DispositionRegister {
  const { entries, reviewWindowDays, ...entryOverrides } = overrides;
  return {
    schemaVersion: 1,
    policy: "Synthetic policy text.",
    owner: "Test owner",
    authority: "Synthetic authority.",
    entries: entries ?? [baselineEntry(entryOverrides)],
    reviewWindowDays: reviewWindowDays ?? DEFAULT_REVIEW_WINDOW_DAYS,
  };
}

/** The lockfile's declared dependency map for one installed package. */
function lockDependencies(lockfile: Lockfile, lockPath: string): Record<string, string> {
  const dependencies = lockfile.packages[lockPath]?.dependencies;
  if (!dependencies) {
    throw new Error(`${lockPath} has no declared dependencies in package-lock.json`);
  }
  return dependencies;
}

function evaluate(overrides: {
  report?: unknown;
  register?: unknown;
  lockfile?: unknown;
  registry?: Map<string, string | null> | null;
  now?: number;
} = {}) {
  // `in` rather than `??` because an explicit null is the case under test:
  // "no report at all" must not silently fall back to the baseline report.
  return evaluateDependencyDisposition({
    report: "report" in overrides ? overrides.report : baselineReport(),
    register: "register" in overrides ? overrides.register : baselineRegister(),
    lockfile: "lockfile" in overrides ? overrides.lockfile : baselineLockfile(),
    registry: overrides.registry ?? null,
    now: overrides.now ?? Date.now(),
  });
}

function codes(result: { failures: Array<{ code: string }> }): string[] {
  return result.failures.map((failure) => failure.code);
}

describe("A10 dependency advisory disposition — the policy fails closed", () => {
  it("passes a coherent register, report and lockfile", () => {
    const result = evaluate();
    expect(result.failures).toEqual([]);
    expect(result.notes.join(" ")).toContain("classified 1 reported advisory");
  });

  it("ignores advisories whose via entry is not a registry advisory", () => {
    // npm reports a package that is vulnerable only because a dependency is as
    // a string `via`; those are attributed through `effects`, not re-counted as
    // separate advisories.
    const parsed = advisoriesFromAuditReport(baselineReport());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].packages).toEqual(["alpha", "beta"]);
    expect(parsed[0].directPackages).toEqual(["alpha"]);
  });

  it("closes the affected set over the whole effects chain", () => {
    const report = linearChainReport([
      { id: BASELINE.id, severity: "high", range: "<=1.2.3", chain: ["braces", "micromatch", "fast-glob", "next-plugin", "eslint-config-next"] },
    ]);
    const parsed = advisoriesFromAuditReport(report);
    expect(parsed[0].packages).toEqual([
      "braces",
      "eslint-config-next",
      "fast-glob",
      "micromatch",
      "next-plugin",
    ]);
  });

  it("fails on an advisory the register does not classify", () => {
    const report = linearChainReport([
      BASELINE,
      { id: "GHSA-mnop-qrst-uvwx", severity: "critical", range: "<1.0.0", chain: ["omega"] },
    ]);
    const result = evaluate({ report });
    expect(codes(result)).toEqual([DISPOSITION_FAILURE.UNREGISTERED]);
    expect(result.failures[0].detail).toContain("GHSA-mnop-qrst-uvwx");
    expect(result.failures[0].detail).toContain("omega");
  });

  it("fails when a classified advisory is no longer reported", () => {
    const register = baselineRegister({
      entries: [baselineEntry(), baselineEntry({ advisory: "GHSA-mnop-qrst-uvwx" })],
    });
    const result = evaluate({ register });
    expect(codes(result)).toContain(DISPOSITION_FAILURE.NOT_REPORTED);
    expect(codes(result)).not.toContain(DISPOSITION_FAILURE.UNREGISTERED);
  });

  it("passes an advisory the registry withdrew and the audit no longer reports", () => {
    // The claim a withdrawn entry makes is an absence. It is accepted only when
    // that absence is real, and it is not chased by the active-risk checks: an
    // old review date on a risk that no longer exists is not staleness.
    const register = baselineRegister({
      entries: [
        baselineEntry({
          disposition: "withdrawn-upstream",
          withdrawnAt: "2026-10-22",
          withdrawnEvidence: "curl -s https://api.github.com/advisories/GHSA-abcd-efgh-ijkl | grep withdrawn_at",
          reviewedAt: daysAgo(400),
        }),
      ],
    });
    const result = evaluate({ register, report: linearChainReport([]) });
    expect(result.failures).toEqual([]);
    expect(result.notes.join(" ")).toContain("recorded as withdrawn upstream (2026-10-22)");
  });

  it("fails when a withdrawn advisory is reported again", () => {
    // A withdrawal that stopped holding is live debt, and the entry cannot sit
    // in the withdrawn state to avoid the checks a live entry would face.
    const register = baselineRegister({
      entries: [
        baselineEntry({
          disposition: "withdrawn-upstream",
          withdrawnAt: "2026-10-22",
          withdrawnEvidence: "curl -s https://api.github.com/advisories/GHSA-abcd-efgh-ijkl | grep withdrawn_at",
        }),
      ],
    });
    const result = evaluate({ register });
    expect(codes(result)).toEqual([DISPOSITION_FAILURE.WITHDRAWN_REPORTED]);
    expect(result.failures[0].detail).toContain("withdrawn upstream on 2026-10-22");
    expect(result.failures[0].detail).toContain("reports it again");
  });

  it("fails when the reported severity changes", () => {
    const report = linearChainReport([{ ...BASELINE, severity: "critical" }]);
    expect(codes(evaluate({ report }))).toEqual([DISPOSITION_FAILURE.SEVERITY_DRIFT]);
  });

  it("fails when the affected package set changes", () => {
    const grown = linearChainReport([{ ...BASELINE, chain: ["alpha", "beta", "gamma"] }]);
    expect(codes(evaluate({ report: grown }))).toEqual([DISPOSITION_FAILURE.PACKAGE_DRIFT]);

    const shrunken = linearChainReport([{ ...BASELINE, chain: ["alpha"] }]);
    const register = baselineRegister({
      entries: [baselineEntry({ affectedPackages: ["alpha"], paths: [baselineEntry().paths[0]] })],
    });
    expect(codes(evaluate({ report: shrunken, register }))).toEqual([]);
    expect(codes(evaluate({ report: shrunken }))).toEqual([DISPOSITION_FAILURE.PACKAGE_DRIFT]);
  });

  it("fails when an installed version moves", () => {
    const lockfile = baselineLockfile();
    lockfile.packages["node_modules/beta"] = { version: "4.5.7", dev: true };
    expect(codes(evaluate({ lockfile }))).toEqual([DISPOSITION_FAILURE.VERSION_DRIFT]);
  });

  it("fails when a recorded dependency path no longer exists", () => {
    const lockfile = baselineLockfile();
    delete (lockfile.packages as Record<string, unknown>)["node_modules/beta"];
    const result = evaluate({ lockfile });
    expect(codes(result)).toEqual([DISPOSITION_FAILURE.VERSION_DRIFT]);
    expect(result.failures[0].detail).toContain("no longer exists");
  });

  it("fails when ships disagrees with the lockfile's dev flags", () => {
    const lockfile = baselineLockfile();
    lockfile.packages["node_modules/alpha"] = { version: "1.2.3", dev: false };
    const result = evaluate({ lockfile });
    expect(codes(result)).toEqual([DISPOSITION_FAILURE.SHIP_CLASS_DRIFT]);
    expect(result.failures[0].detail).toContain("recorded as dev-tooling");
  });

  it("fails when a patched release now exists", () => {
    const viaEntry = evaluate({ register: baselineRegister({ patchedVersion: "1.2.4" }) });
    expect(codes(viaEntry)).toEqual([DISPOSITION_FAILURE.PATCH_AVAILABLE]);

    const viaRegistry = evaluate({ registry: new Map([[BASELINE.id, "1.2.4"]]) });
    expect(codes(viaRegistry)).toEqual([DISPOSITION_FAILURE.PATCH_AVAILABLE]);
    expect(viaRegistry.failures[0].detail).toContain("1.2.4");
  });

  it("treats a registry answer of 'no patch' as still trackable", () => {
    expect(codes(evaluate({ registry: new Map([[BASELINE.id, null]]) }))).toEqual([]);
  });

  it("fails when an entry is marked upgrade-required", () => {
    expect(codes(evaluate({ register: baselineRegister({ disposition: "upgrade-required" }) }))).toEqual([
      DISPOSITION_FAILURE.UPGRADE_PENDING,
    ]);
  });

  it("fails when the review window expires, and passes on its last day", () => {
    const register = baselineRegister({ reviewedAt: daysAgo(181) });
    expect(codes(evaluate({ register }))).toEqual([DISPOSITION_FAILURE.STALE_REVIEW]);

    const boundary = evaluate({ register: baselineRegister({ reviewedAt: daysAgo(179) }) });
    expect(codes(boundary)).toEqual([]);

    // The window is the register's own knob, so tightening it must tighten the
    // gate rather than being ignored.
    const tightened = evaluate({
      register: baselineRegister({ reviewedAt: daysAgo(10), reviewWindowDays: 5 }),
    });
    expect(codes(tightened)).toEqual([DISPOSITION_FAILURE.STALE_REVIEW]);
    expect(DEFAULT_REVIEW_WINDOW_DAYS).toBe(180);
  });

  it("fails when the audit report cannot be read at all", () => {
    const result = evaluate({ report: null });
    expect(codes(result)).toEqual([DISPOSITION_FAILURE.REPORT_UNAVAILABLE]);
  });

  it("fails when the lockfile cannot be read", () => {
    expect(codes(evaluate({ lockfile: null }))).toContain(DISPOSITION_FAILURE.SCHEMA);
  });
});

describe("A10 dependency advisory disposition — register shape is validated", () => {
  const malformed: Array<[string, (register: DispositionRegister) => void, string]> = [
    ["a wrong schema version", (register) => (register.schemaVersion = 2), "schemaVersion"],
    ["a missing review window", (register) => (register.reviewWindowDays = 0), "reviewWindowDays"],
    [
      "an unknown severity",
      (register) => (register.entries[0].severity = "severe"),
      "severity must be one of",
    ],
    [
      "an unknown ship class",
      (register) => (register.entries[0].ships = "sometimes"),
      "ships must be one of",
    ],
    [
      "an unknown disposition",
      (register) => (register.entries[0].disposition = "accept"),
      "disposition must be one of",
    ],
    [
      "a url that names a different advisory",
      (register) => (register.entries[0].url = "https://github.com/advisories/GHSA-zzzz-yyyy-xxxx"),
      "must end in the entry's advisory id",
    ],
    [
      "an affected package that is not a recorded path",
      (register) => (register.entries[0].affectedPackages = ["alpha", "omitted"]),
      "outside affectedPackages",
    ],
    ["an unparsable review date", (register) => (register.entries[0].reviewedAt = "yesterday"), "reviewedAt"],
    [
      "no compensating controls",
      (register) => (register.entries[0].compensatingControls = []),
      "compensatingControls",
    ],
    [
      "a duplicated advisory",
      (register) => register.entries.push(baselineEntry()),
      "is duplicated",
    ],
    [
      "a withdrawn entry with no withdrawal date",
      (register) => {
        register.entries[0].disposition = "withdrawn-upstream";
        register.entries[0].withdrawnEvidence = "checked against the advisory API";
      },
      "withdrawnAt must be an ISO date",
    ],
    [
      "a withdrawn entry with no evidence",
      (register) => {
        register.entries[0].disposition = "withdrawn-upstream";
        register.entries[0].withdrawnAt = "2026-10-22";
      },
      "withdrawnEvidence must record how the withdrawal was checked",
    ],
    [
      "a live entry claiming a withdrawal",
      (register) => {
        register.entries[0].withdrawnAt = "2026-10-22";
      },
      "only apply to a withdrawn-upstream entry",
    ],
  ];

  for (const [label, mutate, expected] of malformed) {
    it(`rejects ${label}`, () => {
      const register = baselineRegister();
      mutate(register);
      const result = evaluate({ register });
      expect(codes(result)).toContain(DISPOSITION_FAILURE.SCHEMA);
      expect(result.failures.map((failure) => failure.detail).join(" ")).toContain(expected);
    });
  }

  it("reports the real register as well formed", () => {
    expect(validateDispositionRegister(readJson(REGISTER_PATH))).toEqual([]);
  });

  it("names the register it validates in its policy statement", () => {
    expect((readJson<DispositionRegister>(REGISTER_PATH)).policy).toContain("npm run audit:disposition");
  });
});

describe("A10 dependency advisory disposition — registry lookups fail closed", () => {
  it("reads the repair version out of an OSV document", () => {
    expect(
      patchedVersionFromOsv({
        affected: [
          {
            package: { name: "alpha" },
            ranges: [{ events: [{ introduced: "0" }, { last_affected: "1.2.3" }] }],
          },
        ],
      }),
    ).toBeNull();

    expect(
      patchedVersionFromOsv({
        affected: [
          {
            package: { name: "alpha" },
            ranges: [{ events: [{ introduced: "0" }, { fixed: "1.2.4" }] }],
          },
        ],
      }),
    ).toBe("1.2.4");
  });

  it("turns a failed lookup into a gate failure instead of 'no patch exists'", async () => {
    const resolved = await resolveRegistryPatches(["GHSA-abcd-efgh-ijkl"], () => {
      throw new Error("network down");
    });
    expect(resolved.failures).toEqual([
      {
        code: DISPOSITION_FAILURE.REGISTRY_UNAVAILABLE,
        detail: expect.stringContaining("fails closed"),
      },
    ]);
    const result = evaluate({ registry: resolved.patches });
    // An unavailable lookup contributes its own failure; it must not silently
    // read as a clean "still no patch" answer.
    expect(resolved.failures.length).toBeGreaterThan(0);
    expect(codes(result)).toEqual([]);
  });

  it("keeps a lookup that answers with nothing trackable", async () => {
    const resolved = await resolveRegistryPatches(["GHSA-abcd-efgh-ijkl"], () => ({
      patchedVersion: null,
    }));
    expect(resolved.failures).toEqual([]);
    expect(resolved.patches.get("GHSA-abcd-efgh-ijkl")).toBeNull();
  });
});

describe("A10 dependency advisory disposition — the real register matches the tree", () => {
  const register = readJson<DispositionRegister>(REGISTER_PATH);
  const lockfile = readJson<Lockfile>("package-lock.json");
  const report = readJson<AuditReport>(REPORT_FIXTURE);

  it("classifies exactly the advisories npm reports for this tree", () => {
    const result = evaluateDependencyDisposition({ report, register, lockfile });
    expect(result.failures).toEqual([]);
    const reportedIds = advisoriesFromAuditReport(report)
      .map((advisory) => advisory.id)
      .sort();
    // One live chain is reported; the second entry is the withdrawn record,
    // and it is exactly the advisory the refreshed capture no longer contains.
    expect(reportedIds).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
    const activeIds = register.entries
      .filter((entry) => entry.disposition !== "withdrawn-upstream")
      .map((entry) => entry.advisory)
      .sort();
    expect(activeIds).toEqual(reportedIds);
    expect(
      register.entries
        .filter((entry) => entry.disposition === "withdrawn-upstream")
        .map((entry) => entry.advisory),
    ).toEqual(["GHSA-hp3w-g68c-fv3c"]);
  });

  it("keeps the captured report's own counts consistent with its entries", () => {
    const entries = Object.values(report.vulnerabilities);
    const counted = entries.reduce<Record<string, number>>((totals, entry) => {
      totals[entry.severity] = (totals[entry.severity] ?? 0) + 1;
      return totals;
    }, {});
    expect(report.auditReportVersion).toBe(2);
    expect(report.metadata.vulnerabilities.high).toBe(counted.high);
    expect(report.metadata.vulnerabilities.moderate ?? 0).toBe(counted.moderate ?? 0);
    // Five high entries are one advisory chain (braces → … → eslint-config-next).
    // The three moderate entries that formed the sprintf-js chain are absent:
    // that advisory was withdrawn upstream on 2026-10-22, and a captured report
    // taken after the withdrawal must not keep asserting it.
    expect(counted.high).toBe(5);
    expect(counted.moderate ?? 0).toBe(0);
    expect(Object.values(counted).reduce((total, value) => total + value, 0)).toBe(5);
    expect(report.metadata.vulnerabilities.total).toBe(5);
  });

  it("records a dated state and no patched version on every entry", () => {
    for (const entry of register.entries) {
      expect(entry.patchedVersion, entry.advisory).toBeNull();
      expect(entry.reviewedAt, entry.advisory).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.compensatingControls.length, entry.advisory).toBeGreaterThan(0);
      expect(entry.reproduction.length, entry.advisory).toBeGreaterThan(0);
      if (entry.disposition === "withdrawn-upstream") {
        // The withdrawal is a checked fact with a date and a way to re-check it,
        // not a label that can be applied to silence a live advisory.
        expect(entry.withdrawnAt, entry.advisory).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.withdrawnEvidence, entry.advisory).toContain("withdrawn_at");
      } else {
        expect(entry.disposition, entry.advisory).toBe("tracked-no-fix");
      }
    }
  });

  it("names the package each advisory was filed against as its first path", () => {
    for (const advisory of advisoriesFromAuditReport(report)) {
      const entry = register.entries.find((candidate) => candidate.advisory === advisory.id)!;
      expect(entry, advisory.id).toBeDefined();
      expect(advisory.directPackages).toEqual([entry.paths[0].package]);
      expect(advisory.packages).toEqual([...entry.affectedPackages].sort());
    }
  });

  it("matches every recorded version and ship class against the lockfile", () => {
    for (const entry of register.entries) {
      const observed = new Set<string>();
      for (const path of entry.paths) {
        const installed = lockfile.packages[path.lockPath];
        expect(installed, `${entry.advisory}: ${path.lockPath}`).toBeDefined();
        expect(installed.version, `${entry.advisory}: ${path.lockPath}`).toBe(path.version);
        observed.add(installed.dev === true ? "dev-tooling" : "runtime");
      }
      expect([...observed], entry.advisory).toEqual([entry.ships]);
    }
  });

  it("keeps the dev-tooling chain out of the production tree entirely", () => {
    const entry = register.entries.find(
      (candidate) => candidate.advisory === "GHSA-vfj7-8cjw-p6xm",
    )!;
    expect(entry.ships).toBe("dev-tooling");
    for (const name of entry.affectedPackages) {
      const installed = lockfile.packages[`node_modules/${name}`];
      expect(installed, name).toBeDefined();
      expect(installed.dev, `${name} must be absent from the production tree`).toBe(true);
    }
    // The enforced production gate therefore never sees it.
    expect(read("package.json")).toContain('"audit:high": "npm audit --audit-level=high --omit=dev"');
  });

  it("pins the runtime chain to a CLI entry this application never executes", () => {
    const entry = register.entries.find(
      (candidate) => candidate.advisory === "GHSA-hp3w-g68c-fv3c",
    )!;
    expect(entry.ships).toBe("runtime");
    // The production tree still contains the chain; what changed is the
    // advisory's status upstream, which is why this is a dated record rather
    // than live debt.
    expect(entry.disposition).toBe("withdrawn-upstream");
    expect(
      advisoriesFromAuditReport(report).map((advisory) => advisory.id),
    ).not.toContain("GHSA-hp3w-g68c-fv3c");
    // mammoth is a runtime dependency that ships a CLI; its `bin` is what pulls
    // argparse (and thus sprintf-js) into the tree the library path never loads.
    expect(lockfile.packages["node_modules/mammoth"].bin).toEqual({ mammoth: "bin/mammoth" });
    expect(lockDependencies(lockfile, "node_modules/mammoth").argparse).toBe("~1.0.3");
    expect(lockfile.packages["node_modules/mammoth/node_modules/argparse"].version).toBe("1.0.10");
    expect(lockDependencies(lockfile, "node_modules/mammoth/node_modules/argparse")).toEqual({
      "sprintf-js": "~1.0.2",
    });
    expect(lockfile.packages["node_modules/sprintf-js"].version).toBe("1.0.3");
    expect(entry.paths.map((p) => p.lockPath)).toEqual([
      "node_modules/sprintf-js",
      "node_modules/mammoth/node_modules/argparse",
    ]);
  });

  it("keeps the application unable to run that CLI", () => {
    // No process spawn anywhere in src/, so no code path can execute
    // `node_modules/mammoth/bin/mammoth`, the only requirer of argparse.
    const spawns: string[] = [];
    const importers: string[] = [];
    const walk = (relativeDirectory: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, relativeDirectory), { withFileTypes: true })) {
        const relative = path.join(relativeDirectory, entry.name);
        if (entry.isDirectory()) {
          walk(relative);
          continue;
        }
        if (!/\.(?:ts|tsx|mts|js|mjs|jsx)$/.test(entry.name)) continue;
        const source = read(relative);
        if (/child_process|\bexecFileSync?\b|\bspawnSync?\b|\bexecSync\b/.test(source)) spawns.push(relative);
        if (/\bmammoth\b/.test(source) && !relative.endsWith(".test.ts")) importers.push(relative);
      }
    };
    walk("src");
    expect(spawns, "no file under src/ may spawn a process").toEqual([]);
    // The one mammoth consumer imports the library entry, never the CLI.
    expect(importers).toEqual([path.join("src/lib/evidence/document-extract.ts")]);
    expect(read(importers[0])).toContain('await import("mammoth")');
    expect(read(importers[0])).not.toContain("mammoth/bin");
  });

  it("keeps the register's stated authority and pinned evidence real", () => {
    expect(register.authority).toContain("SECURITY.md");
    const security = read("SECURITY.md");
    expect(security).toContain("npm audit fix --force");
    expect(security).toContain("GHSA-vfj7-8cjw-p6xm");
    // The register points at this file as the thing that pins its reachability
    // claims, so that pointer must not rot.
    expect(
      register.entries.some((entry) =>
        entry.compensatingControls.some((control) => control.includes(PRIVACY_FREE_REACHABILITY_CLAIM)),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(ROOT, PRIVACY_FREE_REACHABILITY_CLAIM))).toBe(true);
  });
});

describe("A10 dependency advisory disposition — the CLI behaves as the gate", () => {
  function runCli(...arguments_: string[]): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...arguments_], {
        cwd: ROOT,
        encoding: "utf8",
      });
      return { status: 0, stdout, stderr: "" };
    } catch (error: unknown) {
      const failure = error as { status?: unknown; stdout?: unknown; stderr?: unknown };
      return {
        status: typeof failure?.status === "number" ? failure.status : 1,
        stdout: String(failure?.stdout ?? ""),
        stderr: String(failure?.stderr ?? ""),
      };
    }
  }

  it("does not ask the advisory database about a withdrawn entry", () => {
    // OSV has no document for a withdrawn advisory, so looking it up would fail
    // closed on a record that is correct. The scheduled registry re-check must
    // skip it; live entries are still looked up.
    const cli = read(CLI);
    expect(cli).toContain('entry?.disposition !== "withdrawn-upstream"');
    const skip = cli.indexOf('entry?.disposition !== "withdrawn-upstream"');
    expect(skip).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(cli.indexOf("resolveRegistryPatches(ids, lookupOsv)"));
  });

  it("passes on the real register and reports machine-readable output", () => {
    const result = runCli(`--report=${REPORT_FIXTURE}`, "--json");
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      failures: unknown[];
      registryChecked: boolean;
      reported: Array<{ id: string }>;
    };
    expect(parsed.failures).toEqual([]);
    expect(parsed.reported.map((advisory) => advisory.id)).toContain("GHSA-vfj7-8cjw-p6xm");
    expect(parsed.registryChecked).toBe(false);
  });

  it("fails with a named code when the tree gains an unclassified advisory", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "a10-disposition-"));
    const mutated = path.join(directory, "npm-audit-mutated.json");
    try {
      const report = readJson<AuditReport>(REPORT_FIXTURE);
      report.vulnerabilities["brand-new-package"] = {
        name: "brand-new-package",
        severity: "high",
        isDirect: false,
        via: [
          {
            source: 1,
            name: "brand-new-package",
            dependency: "brand-new-package",
            title: "Newly published advisory",
            url: "https://github.com/advisories/GHSA-nnnn-nnnn-nnnn",
            severity: "high",
            range: "<2.0.0",
          },
        ],
        effects: [],
        range: "<2.0.0",
        nodes: [],
        fixAvailable: false,
      };
      fs.writeFileSync(mutated, JSON.stringify(report));

      const result = runCli(`--report=${mutated}`, "--json");
      expect(result.status).toBe(1);
      const parsed = JSON.parse(result.stdout) as {
        failures: Array<{ code: string; detail: string }>;
      };
      expect(parsed.failures.map((failure) => failure.code)).toContain(
        DISPOSITION_FAILURE.UNREGISTERED,
      );
      expect(parsed.failures[0].detail).toContain("GHSA-nnnn-nnnn-nnnn");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("explains itself in the human-readable failure path", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "a10-disposition-human-"));
    try {
      const mutated = path.join(directory, "npm-audit-empty.json");
      fs.writeFileSync(mutated, JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }));
      const result = runCli(`--report=${mutated}`);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(DISPOSITION_FAILURE.NOT_REPORTED);
      expect(result.stderr).toContain("npm audit fix --force");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is the wired npm entrypoint", () => {
    const packageJson = readJson<{ scripts: Record<string, string> }>("package.json");
    expect(packageJson.scripts["audit:disposition"]).toBe(
      "node scripts/audit-dependency-disposition.mjs",
    );
    expect(packageJson.scripts["audit:disposition:registry"]).toBe(
      "node scripts/audit-dependency-disposition.mjs --check-registry",
    );
  });
});

describe("A10 dependency advisory disposition — the gate is enforced, not advisory", () => {
  const ci = read(".github/workflows/ci.yml");
  const scheduled = read(".github/workflows/dependency-scheduled-audit.yml");

  it("runs in ci.yml and re-fails the job through the aggregator", () => {
    expect(ci).toContain("npm run audit:disposition 2>&1 | tee ci-audit-disposition.log");
    const aggregator = ci.split(/\n(?= {6}- )/).find((block) => block.includes("Fail the job if any gate failed"));
    expect(aggregator, "ci.yml lost its aggregator").toBeDefined();
    expect(aggregator).toContain('"${{ steps.audit_disposition.outcome }}" = "failure"');
  });

  it("collects the disposition log in the diagnostic summary and artifact", () => {
    expect(ci).toContain("ci-audit-disposition.log");
    expect(ci).toContain("- audit-disposition (A10): ${{ steps.audit_disposition.outcome }}");
    expect(ci).toContain("ci-*.log");
  });

  it("leaves the production severity gate untouched", () => {
    expect(ci).toContain("npm run audit:high 2>&1 | tee ci-audit.log");
    expect(ci).toContain("Inventory full-tree dependency advisories (non-blocking)");
  });

  it("re-checks the advisory database weekly, where a patch can actually appear", () => {
    expect(scheduled).toContain("npm run audit:disposition:registry");
    const step = scheduled
      .split(/\n(?= {6}- )/)
      .find((block) => block.includes("Re-check advisory dispositions"));
    expect(step, "the scheduled disposition step is missing").toBeDefined();
    expect(step).not.toContain("continue-on-error");
    expect(scheduled).toContain(
      "if: steps.audit.outcome == 'failure' || steps.disposition.outcome == 'failure'",
    );
    expect(scheduled).toContain(
      "if: steps.audit.outcome == 'success' && steps.disposition.outcome == 'success'",
    );
  });
});
