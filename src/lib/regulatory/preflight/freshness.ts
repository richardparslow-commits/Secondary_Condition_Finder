import type {
  RegulatoryFreshness,
  RegulatoryPreflightChange,
  RegulatoryPreflightSnapshot,
  RegulatoryPreflightSourceResult,
  RegulatoryReviewMode,
} from "./types";

const REQUIRED_SOURCES = ["federal-register", "oira-pending", "oira-completed", "unified-agenda"] as const;

const hoursBetween = (earlier: string, later: string): number =>
  Math.max(0, (Date.parse(later) - Date.parse(earlier)) / 3_600_000);

export interface FreshnessDecision {
  freshness: RegulatoryFreshness;
  reviewMode: RegulatoryReviewMode;
  legalRegulatoryConclusionsAllowed: boolean;
  officialEditionVerificationComplete: boolean;
  cacheAgeHours?: number;
  warnings: string[];
}

export function decideRegulatoryFreshness(options: {
  sourceResults: RegulatoryPreflightSourceResult[];
  changes: RegulatoryPreflightChange[];
  finishedAt: string;
  previousSnapshot?: RegulatoryPreflightSnapshot;
  maxCacheAgeHours?: number;
}): FreshnessDecision {
  const bySource = new Map(options.sourceResults.map((result) => [result.source, result] as const));
  const failedRequired = REQUIRED_SOURCES.filter((source) => {
    const status = bySource.get(source)?.status;
    return status !== "success" && status !== "not-modified";
  });
  const unverifiedCurrent = options.changes.filter((change) =>
    change.classification === "current-law-change"
    && change.requiresOfficialEditionVerification
    && !change.officialEditionVerified,
  );
  const officialEditionVerificationComplete = unverifiedCurrent.length === 0;
  const warnings: string[] = [];

  if (failedRequired.length === 0) {
    if (!officialEditionVerificationComplete) {
      warnings.push("A potentially operative VA regulatory change was detected but could not be verified against an official Federal Register edition. Legal/regulatory conclusions are disabled until verification succeeds.");
      return {
        freshness: "degraded",
        reviewMode: "medical-only",
        legalRegulatoryConclusionsAllowed: false,
        officialEditionVerificationComplete,
        warnings,
      };
    }
    return {
      freshness: "current",
      reviewMode: "full",
      legalRegulatoryConclusionsAllowed: true,
      officialEditionVerificationComplete,
      warnings,
    };
  }

  const previous = options.previousSnapshot;
  const maxAge = options.maxCacheAgeHours ?? 24;
  // A failed attempt writes a fresh finishedAt, so measuring from that alone
  // would restart the window on every outage visit. Carry the age already
  // reported by the previous snapshot forward, then add the time since that
  // attempt. This keeps the fallback anchored to the last verified check.
  const elapsedSincePreviousAttempt = previous
    ? hoursBetween(previous.finishedAt, options.finishedAt)
    : undefined;
  const priorCacheAgeHours = previous
    && typeof previous.cacheAgeHours === "number"
    && Number.isFinite(previous.cacheAgeHours)
    ? previous.cacheAgeHours
    : 0;
  const cacheAgeHours = previous
    && elapsedSincePreviousAttempt !== undefined
    && Number.isFinite(elapsedSincePreviousAttempt)
    ? priorCacheAgeHours + elapsedSincePreviousAttempt
    : undefined;
  const recentCache = Boolean(previous && cacheAgeHours !== undefined && cacheAgeHours <= maxAge && previous.freshness !== "stale");

  warnings.push(`Regulatory preflight could not refresh required source(s): ${failedRequired.join(", ")}.`);
  if (recentCache) {
    warnings.push(`Using the prior verified regulatory snapshot (${cacheAgeHours!.toFixed(1)} hours old) as a bounded fallback.`);
    const legalAllowed = Boolean(previous?.legalRegulatoryConclusionsAllowed && officialEditionVerificationComplete);
    return {
      freshness: "degraded",
      reviewMode: legalAllowed ? "full-with-warning" : "medical-only",
      legalRegulatoryConclusionsAllowed: legalAllowed,
      officialEditionVerificationComplete: officialEditionVerificationComplete && Boolean(previous?.officialEditionVerificationComplete),
      cacheAgeHours,
      warnings,
    };
  }

  warnings.push(`No verified regulatory snapshot within the ${maxAge}-hour freshness window is available. Medical relationship review may continue, but current-law/regulatory conclusions are disabled.`);
  return {
    freshness: "stale",
    reviewMode: "medical-only",
    legalRegulatoryConclusionsAllowed: false,
    officialEditionVerificationComplete: false,
    cacheAgeHours,
    warnings,
  };
}
