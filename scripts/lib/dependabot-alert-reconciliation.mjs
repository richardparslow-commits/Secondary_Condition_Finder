/**
 * Reconcile GitHub Dependabot alerts with the dependency disposition register.
 *
 * Dependabot is a discovery surface, not a second risk record: the enforced
 * dependency gate is `npm audit` plus `docs/dependency-advisory-disposition.json`.
 * But an open Dependabot alert can stop describing the installed tree in two
 * ways that `npm audit` will never report:
 *
 *   - the lockfile moved past the alert's vulnerable range after the alert was
 *     opened (vite 8.3.5 against a `>= 8.0.0, <= 8.1.5` alert, first patched
 *     8.1.6), so the alert is stale rather than accepted debt;
 *   - the advisory was withdrawn upstream, which the register records as
 *     `withdrawn-upstream` but Dependabot may keep showing as open.
 *
 * Both are noise that hides the alert that is actually live. This module
 * answers the question per alert — does it still affect an installed version,
 * and does the register classify it? — without reading the network, so the
 * answer is testable. The executable that fetches the alerts and optionally
 * dismisses the non-live ones is `scripts/reconcile-dependabot-alerts.mjs`.
 *
 * Version ranges are parsed rather than delegated to `semver`: the repository
 * does not declare it directly, and the shapes Dependabot emits here are the
 * simple comparator forms. An unreadable range, a prerelease version or an
 * incomplete alert is a named failure, never a silent dismissal.
 */

export const DEPENDABOT_CLASSIFICATION = Object.freeze({
  REGISTERED_LIVE: "registered-live",
  REGISTERED_WITHDRAWN: "registered-withdrawn",
  RESOLVED_INSTALLED: "resolved-installed",
  PACKAGE_NOT_INSTALLED: "package-not-installed",
  WITHDRAWN_UNREGISTERED: "withdrawn-unregistered",
  UNREGISTERED_LIVE: "unregistered-live",
  REGISTER_STALE: "register-stale",
  RANGE_UNREADABLE: "range-unreadable",
  ALERT_INCOMPLETE: "alert-incomplete",
});

const DISMISSIBLE = new Set([
  DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN,
  DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED,
  DEPENDABOT_CLASSIFICATION.PACKAGE_NOT_INSTALLED,
  DEPENDABOT_CLASSIFICATION.WITHDRAWN_UNREGISTERED,
]);

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const COMPARATOR = /^(>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

function parseVersion(value) {
  if (typeof value !== "string") return null;
  const match = VERSION.exec(value.trim());
  if (!match) return null;
  return {
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

function compareParsed(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] !== right.parts[index]) return left.parts[index] - right.parts[index];
  }
  // A prerelease sorts before the release with the same numeric version. Two
  // prereleases compare lexically, which is enough for ordering here; callers
  // reject prerelease inputs before this point.
  if (left.prerelease && !right.prerelease) return -1;
  if (!left.prerelease && right.prerelease) return 1;
  if (left.prerelease && right.prerelease) return left.prerelease.localeCompare(right.prerelease);
  return 0;
}

/**
 * Compare two plain semver versions.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number | null} negative, zero or positive; null when unreadable
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  return compareParsed(a, b);
}

/**
 * Does `version` fall inside a Dependabot `vulnerable_version_range`?
 *
 * Supports the comparator forms Dependabot emits (`>= 8.0.0, <= 8.1.5`,
 * `<= 3.0.3`, `8.1.5`, and `||` alternatives). Prereleases and any shape this
 * parser cannot read return null — the caller reports an unreadable range and
 * refuses to dismiss, because "could not evaluate" is not "not affected".
 *
 * @param {string} version
 * @param {string} range
 * @returns {boolean | null}
 */
export function satisfiesVulnerableRange(version, range) {
  const installed = parseVersion(version);
  if (!installed || installed.prerelease || typeof range !== "string") return null;

  const alternatives = range
    .split("||")
    .map((alternative) => alternative.trim())
    .filter(Boolean);
  if (alternatives.length === 0) return null;

  for (const alternative of alternatives) {
    const comparators = alternative
      .split(",")
      .map((comparator) => comparator.trim())
      .filter(Boolean);
    if (comparators.length === 0) return null;

    let matches = true;
    for (const comparator of comparators) {
      const match = COMPARATOR.exec(comparator);
      if (!match) return null;
      const bound = parseVersion(
        `${match[2]}.${match[3] ?? "0"}.${match[4] ?? "0"}${match[5] ? `-${match[5]}` : ""}`,
      );
      if (!bound || bound.prerelease) return null;

      const order = compareParsed(installed, bound);
      const operator = match[1] ?? "=";
      const passes =
        operator === ">="
          ? order >= 0
          : operator === "<="
            ? order <= 0
            : operator === ">"
              ? order > 0
              : operator === "<"
                ? order < 0
                : order === 0;
      if (!passes) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Every installed instance of a package in the lockfile.
 *
 * @param {{ packages?: Record<string, { version?: string, dev?: boolean }> }} lockfile
 * @param {string} packageName
 * @returns {Array<{ lockPath: string, version: string, dev: boolean }>}
 */
export function installedVersions(lockfile, packageName) {
  const packages = lockfile?.packages ?? {};
  const suffix = `node_modules/${packageName}`;
  return Object.entries(packages)
    .filter(
      ([lockPath, entry]) =>
        (lockPath === suffix || lockPath.endsWith(`/${suffix}`)) &&
        typeof entry?.version === "string",
    )
    .map(([lockPath, entry]) => ({
      lockPath,
      version: entry.version,
      dev: entry.dev === true,
    }))
    .sort((left, right) => left.lockPath.localeCompare(right.lockPath));
}

/**
 * Classify every open alert against the installed tree and the register.
 *
 * @param {{
 *   alerts: Array<Record<string, any>>,
 *   register: { entries?: Array<Record<string, any>> },
 *   lockfile: { packages?: Record<string, any> },
 *   registerPath?: string,
 * }} options
 * @returns {{
 *   rows: Array<Record<string, any>>,
 *   failures: Array<{ code: string, detail: string }>,
 *   dismissible: Array<Record<string, any>>,
 * }}
 */
export function classifyDependabotAlerts({
  alerts,
  register,
  lockfile,
  registerPath = "docs/dependency-advisory-disposition.json",
}) {
  const entries = Array.isArray(register?.entries) ? register.entries : [];
  const rows = [];
  const failures = [];

  for (const alert of Array.isArray(alerts) ? alerts : []) {
    const number = alert?.number ?? null;
    const advisory = alert?.security_advisory ?? {};
    const vulnerability = alert?.security_vulnerability ?? {};
    const ghsa = advisory.ghsa_id ?? null;
    const packageName = alert?.dependency?.package?.name ?? vulnerability?.package?.name ?? null;
    const range = vulnerability?.vulnerable_version_range ?? null;
    const patchedVersion = vulnerability?.first_patched_version?.identifier ?? null;
    const withdrawnAt = advisory.withdrawn_at ?? null;
    const severity = advisory.severity ?? vulnerability.severity ?? null;
    const entry = ghsa ? (entries.find((candidate) => candidate?.advisory === ghsa) ?? null) : null;
    const installed = packageName ? installedVersions(lockfile, packageName) : [];
    const installedLabel = installed.length
      ? installed.map((candidate) => `${candidate.version} (${candidate.lockPath})`).join(", ")
      : "none";

    let classification;
    let failure = null;

    if (!ghsa || !packageName || !range) {
      classification = DEPENDABOT_CLASSIFICATION.ALERT_INCOMPLETE;
      failure = `alert ${number ?? "(no number)"} is missing its advisory id, package name or vulnerable range`;
    } else if (withdrawnAt) {
      if (entry?.disposition === "withdrawn-upstream") {
        classification = DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN;
      } else if (entry) {
        classification = DEPENDABOT_CLASSIFICATION.REGISTER_STALE;
        failure =
          `${ghsa} was withdrawn upstream on ${withdrawnAt}, but ${registerPath} ` +
          `still records it as ${entry.disposition}; reclassify it as withdrawn-upstream`;
      } else {
        classification = DEPENDABOT_CLASSIFICATION.WITHDRAWN_UNREGISTERED;
      }
    } else if (entry?.disposition === "withdrawn-upstream") {
      // The GitHub payload does not always carry `withdrawn_at`; the register
      // already records the withdrawal, so this is the same non-live state.
      classification = DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN;
    } else if (installed.length === 0) {
      if (entry) {
        classification = DEPENDABOT_CLASSIFICATION.REGISTER_STALE;
        failure =
          `${ghsa} is classified in ${registerPath}, but ${packageName} is not ` +
          "installed in package-lock.json; the register entry no longer matches the tree";
      } else {
        classification = DEPENDABOT_CLASSIFICATION.PACKAGE_NOT_INSTALLED;
      }
    } else {
      const affected = [];
      let readable = true;
      for (const candidate of installed) {
        const result = satisfiesVulnerableRange(candidate.version, range);
        if (result === null) {
          readable = false;
          break;
        }
        if (result) affected.push(candidate);
      }

      if (!readable) {
        classification = DEPENDABOT_CLASSIFICATION.RANGE_UNREADABLE;
        failure = `${ghsa} (${packageName}) has an unreadable vulnerable range ${JSON.stringify(range)} for installed ${installedLabel}`;
      } else if (affected.length > 0) {
        classification = entry
          ? DEPENDABOT_CLASSIFICATION.REGISTERED_LIVE
          : DEPENDABOT_CLASSIFICATION.UNREGISTERED_LIVE;
        if (!entry) {
          failure =
            `${ghsa} (${packageName}) affects installed ` +
            `${affected.map((candidate) => `${candidate.version} (${candidate.lockPath})`).join(", ")} ` +
            `within ${range}, but it is not classified in ${registerPath}`;
        }
      } else if (entry) {
        classification = DEPENDABOT_CLASSIFICATION.REGISTER_STALE;
        failure =
          `${ghsa} is classified in ${registerPath}, but installed ${installedLabel} ` +
          `is outside the vulnerable range ${range}; the register entry no longer matches the tree`;
      } else {
        classification = DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED;
      }
    }

    const row = {
      number,
      advisory: ghsa,
      package: packageName,
      severity,
      range,
      patchedVersion,
      withdrawnAt,
      installed,
      installedLabel,
      registerDisposition: entry?.disposition ?? null,
      classification,
      dismissible: DISMISSIBLE.has(classification),
    };
    rows.push(row);
    if (failure) failures.push({ code: classification, detail: failure });
  }

  return {
    rows,
    failures,
    dismissible: rows.filter((row) => row.dismissible),
  };
}

/**
 * The comment attached to a dismissal, so the alert's history explains why it
 * was closed and where the surviving record lives.
 *
 * @param {Record<string, any>} row
 * @param {{ registerPath?: string, today?: string }} [options]
 * @returns {string}
 */
export function dismissalComment(
  row,
  { registerPath = "docs/dependency-advisory-disposition.json", today = new Date().toISOString().slice(0, 10) } = {},
) {
  const advisory = row.advisory ?? "this advisory";
  const pkg = row.package ?? "the package";
  const range = row.range ?? "its vulnerable range";
  const patched = row.patchedVersion ? ` (first patched ${row.patchedVersion})` : "";

  switch (row.classification) {
    case DEPENDABOT_CLASSIFICATION.RESOLVED_INSTALLED:
      return (
        `Reconciled against ${registerPath} on ${today}: installed ${pkg}@` +
        `${row.installed.map((candidate) => candidate.version).join(", ")} is outside ` +
        `the vulnerable range ${range}${patched}, so this alert no longer describes ` +
        "the installed tree."
      );
    case DEPENDABOT_CLASSIFICATION.REGISTERED_WITHDRAWN:
      return (
        `${advisory} was withdrawn upstream${row.withdrawnAt ? ` on ${row.withdrawnAt}` : ""}. ` +
        `${registerPath} keeps it as a dated withdrawn-upstream record, so this alert ` +
        "is no longer an active finding."
      );
    case DEPENDABOT_CLASSIFICATION.WITHDRAWN_UNREGISTERED:
      return (
        `${advisory} was withdrawn upstream${row.withdrawnAt ? ` on ${row.withdrawnAt}` : ""}; ` +
        "it is not a live advisory and no register entry is needed."
      );
    case DEPENDABOT_CLASSIFICATION.PACKAGE_NOT_INSTALLED:
      return (
        `${pkg} is not present in package-lock.json, so ${advisory} does not describe ` +
        "the installed tree. Reconciled against " +
        `${registerPath} on ${today}.`
      );
    default:
      return `Reconciled against ${registerPath} on ${today}.`;
  }
}

/**
 * A stable, human-readable summary count for the CLI and its evidence.
 *
 * @param {Array<Record<string, any>>} rows
 * @returns {Record<string, number>}
 */
export function countByClassification(rows) {
  const counts = {};
  for (const row of rows) {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1;
  }
  return counts;
}
