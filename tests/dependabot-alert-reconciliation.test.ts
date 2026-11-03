import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEPENDABOT_CLASSIFICATION,
  classifyDependabotAlerts,
  compareVersions,
  countByClassification,
  dismissalComment,
  installedVersions,
  satisfiesVulnerableRange,
} from "../scripts/lib/dependabot-alert-reconciliation.mjs";

const REGISTER_PATH = "docs/dependency-advisory-disposition.json";

type Alert = {
  number: number;
  dependency: { package: { name: string } };
  security_advisory: {
    ghsa_id: string;
    severity: string;
    withdrawn_at: string | null;
  };
  security_vulnerability: {
    vulnerable_version_range: string;
    first_patched_version: { identifier: string } | null;
  };
};

function alert(
  number: number,
  ghsa: string,
  packageName: string,
  range: string,
  { patched = null, withdrawn = null, severity = "high" }: {
    patched?: string | null;
    withdrawn?: string | null;
    severity?: string;
  } = {},
): Alert {
  return {
    number,
    dependency: { package: { name: packageName } },
    security_advisory: { ghsa_id: ghsa, severity, withdrawn_at: withdrawn },
    security_vulnerability: {
      vulnerable_version_range: range,
      first_patched_version: patched ? { identifier: patched } : null,
    },
  };
}

const lockfile = {
  packages: {
    "node_modules/braces": { version: "3.0.3", dev: true },
    "node_modules/sprintf-js": { version: "1.0.3", dev: false },
    "node_modules/vite": { version: "8.3.5", dev: true },
    "node_modules/example/node_modules/braces": { version: "2.3.2", dev: true },
  },
};

const register = {
  entries: [
    { advisory: "GHSA-vfj7-8cjw-p6xm", disposition: "tracked-no-fix" },
    { advisory: "GHSA-hp3w-g68c-fv3c", disposition: "withdrawn-upstream" },
  ],
};

describe("Dependabot alert reconciliation", () => {
  it("evaluates Dependabot's comparator ranges without treating an unreadable one as safe", () => {
    expect(satisfiesVulnerableRange("8.3.5", ">= 8.0.0, <= 8.1.5")).toBe(false);
    expect(satisfiesVulnerableRange("8.1.5", ">= 8.0.0, <= 8.1.5")).toBe(true);
    expect(satisfiesVulnerableRange("8.1.6", ">= 8.0.0, <= 8.1.5")).toBe(false);
    expect(satisfiesVulnerableRange("3.0.3", "<= 3.0.3")).toBe(true);
    expect(satisfiesVulnerableRange("3.0.4", "<= 3.0.3")).toBe(false);
    expect(satisfiesVulnerableRange("8.0.0", "8.0.0")).toBe(true);
    expect(satisfiesVulnerableRange("8.0.0", "< 8.0.0 || >= 8.2.0")).toBe(false);
    expect(satisfiesVulnerableRange("8.2.0", "< 8.0.0 || >= 8.2.0")).toBe(true);
    // Unsupported shapes fail closed rather than reading as "not affected".
    expect(satisfiesVulnerableRange("8.3.5", "*")).toBeNull();
    expect(satisfiesVulnerableRange("8.3.5-beta", "<= 8.3.5")).toBeNull();
    expect(satisfiesVulnerableRange("8.3.5", "not a range")).toBeNull();
  });

  it("compares versions and finds every installed instance of a package", () => {
    expect(compareVersions("8.3.5", "8.1.6")).toBeGreaterThan(0);
    expect(compareVersions("8.1.5", "8.1.5")).toBe(0);
    expect(compareVersions("8.1.5", "8.1.6")).toBeLessThan(0);
    expect(compareVersions("8.1", "8.1.0")).toBeNull();

    expect(installedVersions(lockfile, "braces")).toEqual([
      { lockPath: "node_modules/braces", version: "3.0.3", dev: true },
      { lockPath: "node_modules/example/node_modules/braces", version: "2.3.2", dev: true },
    ]);
    expect(installedVersions(lockfile, "left-pad")).toEqual([]);
  });

  it("classifies the four ways an open alert can stand against the tree", () => {
    const alerts = [
      alert(1, "GHSA-vfj7-8cjw-p6xm", "braces", "<= 3.0.3"),
      alert(2, "GHSA-hp3w-g68c-fv3c", "sprintf-js", "<= 1.1.3", {
        withdrawn: "2026-10-22T19:21:04Z",
      }),
      alert(3, "GHSA-r825-w8mm-5pxw", "vite", ">= 8.0.0, <= 8.1.5", {
        patched: "8.1.6",
        severity: "medium",
      }),
      alert(4, "GHSA-unregistered-live", "braces", "<= 3.0.3"),
      alert(5, "GHSA-package-absent", "left-pad", "<= 1.0.0"),
      alert(6, "GHSA-register-stale", "vite", "<= 8.1.5"),
      alert(7, "GHSA-unreadable-range", "vite", "^8.0.0"),
    ];
    const extendedRegister = {
      entries: [
        ...register.entries,
        { advisory: "GHSA-register-stale", disposition: "tracked-no-fix" },
      ],
    };

    const result = classifyDependabotAlerts({
      alerts,
      register: extendedRegister,
      lockfile,
      registerPath: REGISTER_PATH,
    });

    expect(result.rows.map((row) => row.classification)).toEqual([
      DEPENDABOT_CLASSIFICATION.REGISTERED_LIVE,
      DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN,
      DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED,
      DEPENDABOT_CLASSIFICATION.UNREGISTERED_LIVE,
      DEPENDABOT_CLASSIFICATION.PACKAGE_NOT_INSTALLED,
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
      DEPENDABOT_CLASSIFICATION.RANGE_UNREADABLE,
    ]);
    expect(result.dismissible.map((row) => row.number)).toEqual([2, 3, 5]);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      DEPENDABOT_CLASSIFICATION.UNREGISTERED_LIVE,
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
      DEPENDABOT_CLASSIFICATION.RANGE_UNREADABLE,
    ]);
    expect(result.failures[0].detail).toContain("GHSA-unregistered-live");
    expect(result.failures[0].detail).toContain(REGISTER_PATH);
    expect(countByClassification(result.rows)).toMatchObject({
      "registered-live": 1,
      "registered-withdrawn": 1,
      "resolved-installed": 1,
      "unregistered-live": 1,
      "package-not-installed": 1,
      "register-stale": 1,
      "range-unreadable": 1,
    });
  });

  it("fails rather than dismissing when the register and the alert disagree about liveness", () => {
    const result = classifyDependabotAlerts({
      alerts: [
        alert(8, "GHSA-withdrawn-live-register", "vite", "<= 8.1.5", {
          withdrawn: "2026-10-22T19:21:04Z",
        }),
        alert(9, "GHSA-registered-absent", "left-pad", "<= 1.0.0"),
      ],
      register: {
        entries: [
          { advisory: "GHSA-withdrawn-live-register", disposition: "tracked-no-fix" },
          { advisory: "GHSA-registered-absent", disposition: "tracked-no-fix" },
        ],
      },
      lockfile,
      registerPath: REGISTER_PATH,
    });

    expect(result.rows.map((row) => row.classification)).toEqual([
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
    ]);
    expect(result.dismissible).toEqual([]);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
      DEPENDABOT_CLASSIFICATION.REGISTER_STALE,
    ]);
    expect(result.failures[0].detail).toContain("withdrawn upstream");
    expect(result.failures[1].detail).toContain("not installed");
  });

  it("keeps the dismissal comment attributable to the installed version and register", () => {
    const resolved = {
      classification: DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED,
      advisory: "GHSA-r825-w8mm-5pxw",
      package: "vite",
      range: ">= 8.0.0, <= 8.1.5",
      patchedVersion: "8.1.6",
      installed: [{ version: "8.3.5", lockPath: "node_modules/vite" }],
    };
    const comment = dismissalComment(resolved, {
      registerPath: REGISTER_PATH,
      today: "2026-10-23",
    });
    expect(comment).toContain("8.3.5");
    expect(comment).toContain(">= 8.0.0, <= 8.1.5");
    expect(comment).toContain("first patched 8.1.6");
    expect(comment).toContain(REGISTER_PATH);
    expect(comment).toContain("2026-10-23");

    const withdrawn = dismissalComment(
      {
        classification: DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN,
        advisory: "GHSA-hp3w-g68c-fv3c",
        package: "sprintf-js",
        range: "<= 1.1.3",
        patchedVersion: null,
        withdrawnAt: "2026-10-22T19:21:04Z",
        installed: [{ version: "1.0.3", lockPath: "node_modules/sprintf-js" }],
      },
      { registerPath: REGISTER_PATH, today: "2026-10-23" },
    );
    expect(withdrawn).toContain("withdrawn upstream on 2026-10-22T19:21:04Z");
    expect(withdrawn).toContain("withdrawn-upstream");
  });

  it("accounts for the currently open Dependabot alerts against the real register and lockfile", () => {
    const realRegister = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), REGISTER_PATH), "utf8"),
    );
    const realLockfile = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"),
    );
    const alerts = [
      alert(1, "GHSA-vfj7-8cjw-p6xm", "braces", "<= 3.0.3"),
      alert(2, "GHSA-hp3w-g68c-fv3c", "sprintf-js", "<= 1.1.3", {
        withdrawn: "2026-10-22T19:21:04Z",
      }),
      alert(3, "GHSA-698v-4r3x-3vcv", "vite", ">= 8.0.0, <= 8.1.5", {
        patched: "8.1.6",
        severity: "medium",
      }),
      alert(4, "GHSA-587h-7wmj-h5pm", "vite", ">= 8.0.0, <= 8.1.5", {
        patched: "8.1.6",
      }),
      alert(5, "GHSA-r825-w8mm-5pxw", "vite", ">= 8.0.0, <= 8.1.5", {
        patched: "8.1.6",
        severity: "medium",
      }),
    ];

    const result = classifyDependabotAlerts({
      alerts,
      register: realRegister,
      lockfile: realLockfile,
      registerPath: REGISTER_PATH,
    });

    expect(result.failures).toEqual([]);
    // braces was withdrawn upstream on 2026-10-23 and the register now records
    // it as withdrawn-upstream, so its open alert joins the dismissible set.
    expect(result.dismissible.map((row) => row.number).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(
      result.rows.find((row) => row.advisory === "GHSA-vfj7-8cjw-p6xm")?.classification,
    ).toBe(DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN);
    for (const advisory of [
      "GHSA-698v-4r3x-3vcv",
      "GHSA-587h-7wmj-h5pm",
      "GHSA-r825-w8mm-5pxw",
    ]) {
      expect(result.rows.find((row) => row.advisory === advisory)?.classification).toBe(
        DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED,
      );
    }
  });
});
