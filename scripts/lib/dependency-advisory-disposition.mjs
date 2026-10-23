/**
 * Dependency advisory disposition policy (audit A10).
 *
 * The full-tree audit can never pass while an advisory has no patched release:
 * `braces` is vulnerable in every published version (`<= 3.0.3`, the newest
 * release is installed) and `sprintf-js` likewise (`<= 1.1.3`), so npm's only
 * "fix" is a forced downgrade of `eslint-config-next` two major lines back —
 * which SECURITY.md forbids. The repository therefore cannot resolve these by
 * upgrading, and it must not resolve them by lowering the audit threshold
 * either. What it can do is be explicit: record every reported advisory, why it
 * is tolerable, what would make it reachable, and fail when that record stops
 * being true.
 *
 * This module is the policy half of that. It is pure — no filesystem, no
 * network, no `npm` — so the decision table can be exercised with synthetic
 * reports, and the CLI plus the scheduled workflow share exactly one rule set.
 *
 * Two failure modes are covered, and both must fail closed:
 *
 *   - **New debt.** An advisory the register does not classify fails CI. Before
 *     this gate, a newly published dev-tooling advisory was a line in a
 *     non-blocking log step, which is indistinguishable from no advisory at all.
 *   - **A record that stopped being true.** A registered advisory that the audit
 *     no longer reports (it was fixed or the package left the tree), a changed
 *     advisory severity, a changed set of affected packages, a moved installed
 *     version, a ship classification that no longer matches the lockfile, a
 *     patched release that now exists, or an expired review window all fail —
 *     so the register cannot drift away from the tree it describes. The one
 *     state that inverts that direction is `withdrawn-upstream`: an advisory
 *     the advisory database has withdrawn is expected to be **absent** from the
 *     audit, so the gate fails if it is reported again rather than waiting for
 *     a human to notice that the claim stopped holding.
 *
 * Severity enforcement for production dependencies deliberately stays with
 * `npm run audit:high` (`--omit=dev --audit-level=high`). This module governs
 * inventory completeness, classification and freshness; it does not duplicate,
 * weaken, or outvote the severity gate.
 */

export const DISPOSITION_SCHEMA_VERSION = 1;
export const DEFAULT_REVIEW_WINDOW_DAYS = 180;

/** Failure codes. Each one is asserted individually by the regression suite. */
export const DISPOSITION_FAILURE = Object.freeze({
  /** The register itself is malformed: missing fields, bad types, duplicates. */
  SCHEMA: "register-schema",
  /** The audit reports an advisory the register does not classify. */
  UNREGISTERED: "unregistered-advisory",
  /** The register classifies an advisory the audit no longer reports. */
  NOT_REPORTED: "registered-advisory-not-reported",
  /**
   * The register records an advisory as withdrawn upstream, but the audit
   * reports it again — the withdrawal either did not stick or was reverted, so
   * the entry must be re-classified as live debt instead of staying withdrawn.
   */
  WITHDRAWN_REPORTED: "withdrawn-advisory-reported",
  /** The advisory's severity in the register is not the reported severity. */
  SEVERITY_DRIFT: "advisory-severity-drift",
  /** The affected package set in the register is not the reported set. */
  PACKAGE_DRIFT: "affected-package-drift",
  /** An installed version recorded for a path is not the lockfile's version. */
  VERSION_DRIFT: "installed-version-drift",
  /** `ships` in the register disagrees with the lockfile's dev/runtime flags. */
  SHIP_CLASS_DRIFT: "ship-class-drift",
  /** A patched release exists, so the upgrade — not a tracking record — is owed. */
  PATCH_AVAILABLE: "patched-release-available",
  /** The entry is explicitly marked as owing an upgrade. */
  UPGRADE_PENDING: "upgrade-pending",
  /** The review window for the recorded reachability claim has expired. */
  STALE_REVIEW: "review-window-expired",
  /** `--check-registry` could not reach the advisory registry (fail closed). */
  REGISTRY_UNAVAILABLE: "advisory-registry-unavailable",
  /**
   * `--check-registry` found that the registry withdrew a live classification.
   * The audit will stop reporting it, so the entry must be reclassified as
   * `withdrawn-upstream` with the observed date instead of failing later as
   * drift under a code that does not name the cause.
   */
  REGISTRY_WITHDRAWN: "advisory-withdrawn-upstream",
  /** The audit report could not be read at all. */
  REPORT_UNAVAILABLE: "audit-report-unavailable",
});

const ADVISORY_ID = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEVERITIES = ["low", "moderate", "high", "critical"];
const SHIP_CLASSES = ["runtime", "dev-tooling"];
/**
 * `withdrawn-upstream` is the state for an advisory the advisory database has
 * withdrawn: it is no longer a reported vulnerability, while the package and the
 * register's historical reachability evidence remain in the tree. The state is
 * not a waiver — the gate requires such an entry to be **absent** from the audit
 * and fails if it is reported again.
 */
const DISPOSITIONS = ["tracked-no-fix", "upgrade-required", "withdrawn-upstream"];
const WITHDRAWN = "withdrawn-upstream";
const REQUIRED_ENTRY_FIELDS = [
  "advisory",
  "url",
  "title",
  "severity",
  "advisoryRange",
  "disposition",
  "ships",
  "affectedPackages",
  "paths",
  "reachability",
  "compensatingControls",
  "reproduction",
  "reviewedAt",
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/**
 * Validate the register's own shape. Returns human-readable issues; an empty
 * array means the register is well formed. Kept separate from the tree
 * comparison so a malformed register cannot be mistaken for a passing one.
 *
 * @param {unknown} register
 * @returns {string[]}
 */
export function validateDispositionRegister(register) {
  const issues = [];
  if (!isPlainObject(register)) return ["register is not an object"];
  if (register.schemaVersion !== DISPOSITION_SCHEMA_VERSION) {
    issues.push(`schemaVersion must be ${DISPOSITION_SCHEMA_VERSION}`);
  }
  if (!Number.isInteger(register.reviewWindowDays) || register.reviewWindowDays < 1) {
    issues.push("reviewWindowDays must be a positive integer");
  }
  for (const field of ["policy", "owner", "authority"]) {
    if (!isNonEmptyString(register[field])) issues.push(`${field} must be a non-empty string`);
  }
  if (!Array.isArray(register.entries) || register.entries.length === 0) {
    issues.push("entries must be a non-empty array");
    return issues;
  }

  const seen = new Set();
  register.entries.forEach((entry, index) => {
    const at = `entries[${index}]`;
    if (!isPlainObject(entry)) {
      issues.push(`${at} is not an object`);
      return;
    }
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (entry[field] === undefined) issues.push(`${at}.${field} is required`);
    }
    if (!ADVISORY_ID.test(String(entry.advisory ?? ""))) {
      issues.push(`${at}.advisory must be a GHSA identifier`);
    }
    if (!/^https:\/\/github\.com\/advisories\/GHSA-/.test(String(entry.url ?? ""))) {
      issues.push(`${at}.url must be the advisory's github.com/advisories URL`);
    }
    const idFromUrl = String(entry.url ?? "").split("/").pop();
    if (ADVISORY_ID.test(String(entry.advisory ?? "")) && idFromUrl !== entry.advisory) {
      issues.push(`${at}.url must end in the entry's advisory id`);
    }
    if (!SEVERITIES.includes(entry.severity)) {
      issues.push(`${at}.severity must be one of ${SEVERITIES.join(", ")}`);
    }
    if (!SHIP_CLASSES.includes(entry.ships)) {
      issues.push(`${at}.ships must be one of ${SHIP_CLASSES.join(", ")}`);
    }
    if (!DISPOSITIONS.includes(entry.disposition)) {
      issues.push(`${at}.disposition must be one of ${DISPOSITIONS.join(", ")}`);
    }
    if (entry.disposition === WITHDRAWN) {
      if (!ISO_DATE.test(String(entry.withdrawnAt ?? ""))) {
        issues.push(`${at}.withdrawnAt must be an ISO date on a withdrawn-upstream entry`);
      }
      if (!isNonEmptyString(entry.withdrawnEvidence)) {
        issues.push(
          `${at}.withdrawnEvidence must record how the withdrawal was checked on a withdrawn-upstream entry`,
        );
      }
    } else if (entry.withdrawnAt !== undefined || entry.withdrawnEvidence !== undefined) {
      issues.push(
        `${at}.withdrawnAt/withdrawnEvidence only apply to a withdrawn-upstream entry — a live classification cannot claim a withdrawal`,
      );
    }
    if (entry.patchedVersion !== null && !isNonEmptyString(entry.patchedVersion)) {
      issues.push(`${at}.patchedVersion must be null or a version string`);
    }
    if (!isStringArray(entry.affectedPackages)) {
      issues.push(`${at}.affectedPackages must be a non-empty string array`);
    }
    if (!isStringArray(entry.compensatingControls)) {
      issues.push(`${at}.compensatingControls must be a non-empty string array`);
    }
    if (!isStringArray(entry.reproduction)) {
      issues.push(`${at}.reproduction must be a non-empty string array`);
    }
    if (!isNonEmptyString(entry.reachability)) {
      issues.push(`${at}.reachability must be a non-empty string`);
    }
    if (!ISO_DATE.test(String(entry.reviewedAt ?? ""))) {
      issues.push(`${at}.reviewedAt must be an ISO date`);
    }
    if (!Array.isArray(entry.paths) || entry.paths.length === 0) {
      issues.push(`${at}.paths must be a non-empty array`);
    } else {
      entry.paths.forEach((path, pathIndex) => {
        const pathAt = `${at}.paths[${pathIndex}]`;
        if (!isPlainObject(path)) {
          issues.push(`${pathAt} is not an object`);
          return;
        }
        for (const field of ["package", "version", "lockPath", "dependencyPath"]) {
          if (path[field] === undefined) issues.push(`${pathAt}.${field} is required`);
        }
        if (!isNonEmptyString(path.package)) issues.push(`${pathAt}.package must be a string`);
        if (!isNonEmptyString(path.version)) issues.push(`${pathAt}.version must be a string`);
        if (!/^node_modules\//.test(String(path.lockPath ?? ""))) {
          issues.push(`${pathAt}.lockPath must be a package-lock.json package path`);
        }
        if (!isStringArray(path.dependencyPath)) {
          issues.push(`${pathAt}.dependencyPath must be a non-empty string array`);
        }
      });
    }
    if (
      isStringArray(entry.affectedPackages) &&
      isPlainObject(entry.paths) === false &&
      Array.isArray(entry.paths)
    ) {
      const pathPackages = new Set(entry.paths.map((path) => path?.package).filter(Boolean));
      const affected = new Set(entry.affectedPackages);
      const unrelated = [...pathPackages].filter((name) => !affected.has(name));
      if (unrelated.length > 0) {
        issues.push(`${at}.paths names packages outside affectedPackages: ${unrelated.join(", ")}`);
      }
    }
    if (seen.has(entry.advisory)) issues.push(`${at}.advisory is duplicated`);
    seen.add(entry.advisory);
  });
  return issues;
}

/**
 * Normalize `npm audit --json` (report version 2) into one record per advisory:
 * the identifier, its severity and range, every package npm reports the advisory
 * through, and the package that carries the advisory itself.
 *
 * npm reports the advisory object once, on the package the advisory was filed
 * against; each package that pulls it in instead names its vulnerable dependency
 * as a string in `via` and lists its own dependents in `effects`. So the full
 * affected set is the closure of `effects` from the originating package —
 * braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next
 * is one advisory counted five times, and the register must say so rather than
 * treating the entries as independent findings.
 *
 * @typedef {{ id: string, url: string, title: string, severity: string, advisoryRange: string, directPackages: string[], packages: string[] }} AuditAdvisory
 *
 * @param {unknown} report
 * @returns {AuditAdvisory[]}
 */
export function advisoriesFromAuditReport(report) {
  const vulnerabilities = isPlainObject(report?.vulnerabilities) ? report.vulnerabilities : {};
  const advisories = new Map();

  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    if (!isPlainObject(entry)) continue;
    for (const via of Array.isArray(entry.via) ? entry.via : []) {
      if (!isPlainObject(via) || !isNonEmptyString(via.url)) continue;
      const id = String(via.url).split("/").pop();
      const record = advisories.get(id) ?? {
        id,
        url: via.url,
        title: isNonEmptyString(via.title) ? via.title : "(untitled advisory)",
        severity: isNonEmptyString(via.severity) ? via.severity : String(entry.severity ?? "unknown"),
        advisoryRange: isNonEmptyString(via.range) ? via.range : "(unspecified)",
        directPackages: new Set(),
      };
      record.directPackages.add(packageName);
      advisories.set(id, record);
    }
  }

  return [...advisories.values()].map((advisory) => {
    const packages = new Set(advisory.directPackages);
    const queue = [...packages];
    while (queue.length > 0) {
      const current = queue.pop();
      for (const dependent of vulnerabilities[current]?.effects ?? []) {
        if (packages.has(dependent)) continue;
        packages.add(dependent);
        queue.push(dependent);
      }
    }
    return {
      ...advisory,
      directPackages: [...advisory.directPackages].sort(),
      packages: [...packages].sort(),
    };
  });
}

/**
 * Lockfile package metadata by path, or null when absent.
 *
 * @param {unknown} lockfile
 * @param {string} lockPath
 * @returns {Record<string, unknown> | null}
 */
export function lockfilePackage(lockfile, lockPath) {
  const packages = isPlainObject(lockfile?.packages) ? lockfile.packages : {};
  const entry = packages[lockPath];
  return isPlainObject(entry) ? entry : null;
}

function reviewDeadline(entry, windowDays) {
  const reviewed = Date.parse(`${entry.reviewedAt}T00:00:00Z`);
  if (Number.isNaN(reviewed)) return null;
  return reviewed + windowDays * 24 * 60 * 60 * 1000;
}

/**
 * Compare the register against the tree. `registry` is optional: a map from
 * advisory id to the repaired version the advisory database now reports (null
 * when none exists). It is supplied by the scheduled workflow, which is allowed
 * to use the network; the per-merge gate runs without it.
 *
 * @param {{ report: unknown, register: unknown, lockfile: unknown, registry?: Map<string, string | null> | null, now?: number }} params
 * @returns {{ failures: { code: string, detail: string }[], notes: string[] }}
 */
export function evaluateDependencyDisposition({
  report,
  register,
  lockfile,
  registry = null,
  now = Date.now(),
}) {
  const failures = [];
  const notes = [];
  const fail = (code, detail) => failures.push({ code, detail });

  for (const issue of validateDispositionRegister(register)) {
    fail(DISPOSITION_FAILURE.SCHEMA, issue);
  }
  if (!isPlainObject(report)) {
    fail(DISPOSITION_FAILURE.REPORT_UNAVAILABLE, "no audit report was supplied");
    return { failures, notes };
  }
  if (!isPlainObject(lockfile)) {
    fail(DISPOSITION_FAILURE.SCHEMA, "package-lock.json could not be read");
  }

  const entries = Array.isArray(register?.entries) ? register.entries : [];
  const windowDays = Number.isInteger(register?.reviewWindowDays)
    ? register.reviewWindowDays
    : DEFAULT_REVIEW_WINDOW_DAYS;
  const reported = advisoriesFromAuditReport(report);
  const byId = new Map(reported.map((advisory) => [advisory.id, advisory]));
  const registeredIds = new Set(entries.map((entry) => entry?.advisory));

  for (const advisory of reported) {
    if (registeredIds.has(advisory.id)) continue;
    fail(
      DISPOSITION_FAILURE.UNREGISTERED,
      `${advisory.id} (${advisory.severity}) affects ${advisory.packages.join(", ")} and is not classified in the disposition register — classify it, upgrade it, or remove the dependency`,
    );
  }

  for (const entry of entries) {
    if (!isPlainObject(entry)) continue;
    const at = entry.advisory ?? "(unnamed advisory)";
    const advisory = byId.get(entry.advisory);

    // A withdrawn advisory is expected to be absent from the audit. That is the
    // claim the entry makes, so it is checked in the opposite direction from a
    // live classification: reported again means the withdrawal did not hold.
    if (entry.disposition === WITHDRAWN) {
      if (advisory) {
        fail(
          DISPOSITION_FAILURE.WITHDRAWN_REPORTED,
          `${at} is recorded as withdrawn upstream on ${entry.withdrawnAt}, but the audit reports it again (${advisory.severity}) — re-classify it as live debt or remove the dependency`,
        );
      } else {
        notes.push(
          `${at} is recorded as withdrawn upstream (${entry.withdrawnAt}) and the audit does not report it`,
        );
      }
      continue;
    }

    if (!advisory) {
      fail(
        DISPOSITION_FAILURE.NOT_REPORTED,
        `${at} is classified in the register but the audit no longer reports it — the advisory was resolved or the package left the tree, so refresh this entry`,
      );
      continue;
    }
    if (advisory.severity !== entry.severity) {
      fail(
        DISPOSITION_FAILURE.SEVERITY_DRIFT,
        `${at} is recorded as ${entry.severity} but is now reported as ${advisory.severity}`,
      );
    }
    const reportedPackages = new Set(advisory.packages);
    const registeredPackages = new Set(Array.isArray(entry.affectedPackages) ? entry.affectedPackages : []);
    const missing = [...registeredPackages].filter((name) => !reportedPackages.has(name));
    const added = [...reportedPackages].filter((name) => !registeredPackages.has(name));
    if (missing.length > 0 || added.length > 0) {
      fail(
        DISPOSITION_FAILURE.PACKAGE_DRIFT,
        `${at} affected packages changed — the audit no longer reports ${missing.join(", ") || "-"} and now reports ${added.join(", ") || "-"}`,
      );
    }

    const paths = Array.isArray(entry.paths) ? entry.paths : [];
    const shipClasses = new Set();
    for (const path of paths) {
      if (!isPlainObject(path)) continue;
      const meta = lockfilePackage(lockfile, path.lockPath);
      if (!meta) {
        fail(
          DISPOSITION_FAILURE.VERSION_DRIFT,
          `${at}: ${path.lockPath} is not present in package-lock.json — the recorded dependency path no longer exists`,
        );
        continue;
      }
      if (meta.version !== path.version) {
        fail(
          DISPOSITION_FAILURE.VERSION_DRIFT,
          `${at}: ${path.package} is ${meta.version} at ${path.lockPath}, but the register records ${path.version}`,
        );
      }
      shipClasses.add(meta.dev === true ? "dev-tooling" : "runtime");
    }
    if (shipClasses.size > 0) {
      const derived = shipClasses.has("runtime") ? "runtime" : "dev-tooling";
      if (derived !== entry.ships) {
        fail(
          DISPOSITION_FAILURE.SHIP_CLASS_DRIFT,
          `${at} is recorded as ${entry.ships} but its recorded paths resolve as ${derived} in package-lock.json`,
        );
      }
    }

    if (entry.disposition === "upgrade-required") {
      fail(
        DISPOSITION_FAILURE.UPGRADE_PENDING,
        `${at} is marked upgrade-required: land the upgrade instead of tracking it`,
      );
    }
    if (isNonEmptyString(entry.patchedVersion)) {
      fail(
        DISPOSITION_FAILURE.PATCH_AVAILABLE,
        `${at} records patchedVersion ${entry.patchedVersion} — a tracked-no-fix entry must stop being tracked once a patched release exists`,
      );
    }
    const registryPatch = registry instanceof Map ? registry.get(entry.advisory) : undefined;
    if (isNonEmptyString(registryPatch)) {
      fail(
        DISPOSITION_FAILURE.PATCH_AVAILABLE,
        `${at} now has a patched release (${registryPatch}) — take the upgrade and delete this entry instead of tracking the advisory`,
      );
    }

    const deadline = reviewDeadline(entry, windowDays);
    if (deadline === null) {
      fail(DISPOSITION_FAILURE.SCHEMA, `${at}.reviewedAt is not a parsable date`);
    } else if (now > deadline) {
      const days = Math.floor((now - deadline) / (24 * 60 * 60 * 1000));
      fail(
        DISPOSITION_FAILURE.STALE_REVIEW,
        `${at} was last reviewed ${entry.reviewedAt} and its ${windowDays}-day window expired ${days} day(s) ago — re-check the reachability claim, the patched-release status, and the installed version`,
      );
    }
  }

  if (reported.length === 0) {
    notes.push(
      "the full-tree audit reports no advisories — every entry not marked withdrawn-upstream is now stale, and this gate fails until those are refreshed",
    );
  }
  notes.push(
    `classified ${reported.length} reported advisor${reported.length === 1 ? "y" : "ies"} against ${entries.length} register entr${entries.length === 1 ? "y" : "ies"}`,
  );
  return { failures, notes };
}

/**
 * Read the version that repairs an advisory out of an OSV document. OSV states
 * the affected interval as events: `introduced` opens it and `fixed` closes it,
 * so a range that opens at `introduced: 0` and closes with only `last_affected`
 * has no repair at all — every published release is affected, which is exactly
 * the situation the register records. Returns null when no `fixed` event exists.
 *
 * @param {unknown} document
 * @returns {string | null}
 */
export function patchedVersionFromOsv(document) {
  const affected = Array.isArray(document?.affected) ? document.affected : [];
  const fixed = [];
  for (const entry of affected) {
    for (const range of Array.isArray(entry?.ranges) ? entry.ranges : []) {
      for (const event of Array.isArray(range?.events) ? range.events : []) {
        if (isNonEmptyString(event?.fixed)) fixed.push(event.fixed);
      }
    }
  }
  return fixed.length > 0 ? fixed.join(", ") : null;
}

/**
 * Read the withdrawal timestamp out of an OSV document. OSV keeps serving the
 * document for a withdrawn advisory — with `withdrawn` set — rather than
 * returning 404, so a successful lookup is not evidence that the advisory is
 * live. `patchedVersionFromOsv` alone reads a withdrawal as "no `fixed` event,
 * therefore no patch", which passes the weekly check and only surfaces later as
 * `registered-advisory-not-reported` once `npm audit` stops reporting it.
 *
 * @param {unknown} document
 * @returns {string | null}
 */
export function withdrawnAtFromOsv(document) {
  return isNonEmptyString(document?.withdrawn) ? document.withdrawn : null;
}

/**
 * Turn advisory-registry lookups into the map `evaluateDependencyDisposition`
 * expects. `lookup` resolves an advisory id to a repaired version (or to an
 * object carrying `patchedVersion` and `withdrawnAt`); a lookup that throws is
 * reported as REGISTRY_UNAVAILABLE rather than silently read as "no patch
 * exists", because detecting a newly published patch is the entire purpose of
 * the check. A lookup that reports a withdrawal is a named failure for the same
 * reason: it is the one state where "no patch" is not a clean answer.
 *
 * @param {string[]} advisoryIds
 * @param {(id: string) => unknown} lookup
 * @returns {Promise<{ patches: Map<string, string | null>, failures: { code: string, detail: string }[] }>}
 */
export async function resolveRegistryPatches(advisoryIds, lookup) {
  const patches = new Map();
  const failures = [];
  for (const id of advisoryIds) {
    try {
      const result = await lookup(id);
      const withdrawnAt = isPlainObject(result) ? result.withdrawnAt : null;
      if (isNonEmptyString(withdrawnAt)) {
        failures.push({
          code: DISPOSITION_FAILURE.REGISTRY_WITHDRAWN,
          detail: `${id}: the advisory database withdrew this advisory at ${withdrawnAt} — \`npm audit\` will stop reporting it, so reclassify the entry as withdrawn-upstream with withdrawnAt and this evidence; leaving it live fails the next gate run as drift under a code that does not name the cause`,
        });
        continue;
      }
      const patched = isPlainObject(result) ? result.patchedVersion : result;
      patches.set(id, isNonEmptyString(patched) ? patched : null);
    } catch (error) {
      failures.push({
        code: DISPOSITION_FAILURE.REGISTRY_UNAVAILABLE,
        detail: `${id}: the advisory registry could not be read (${error instanceof Error ? error.message : String(error)}) — a patch may exist, so this check fails closed`,
      });
    }
  }
  return { patches, failures };
}
