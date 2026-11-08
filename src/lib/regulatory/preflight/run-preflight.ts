import "server-only";

import { createHash } from "node:crypto";

import { regulatoryActionRegistrySchema, type RegulatoryAction } from "../schema";
import { diffRegulatoryPreflight } from "./diff";
import { fetchFederalRegisterVaChanges } from "./federal-register";
import { decideRegulatoryFreshness } from "./freshness";
import type { FetchLike } from "./http";
import { mergeCuratedAndCachedRegistry, mergeRegulatoryDiscoveries } from "./merge";
import { fetchCurrentUnifiedAgenda, fetchOiraMeetingSignals, fetchOiraReviews } from "./oira";
import { changeMatchesReviewScope } from "./relevance";
import { fetchRegulationsGovDockets } from "./regulations-gov";
import type {
  RegulatoryPreflightCache,
  RegulatoryPreflightResult,
  RegulatoryPreflightSourceName,
  ReviewScope,
} from "./types";

const dateMinusDays = (isoTimestamp: string, days: number): string => {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const digestRegistry = (registry: RegulatoryAction[]): string => createHash("sha256")
  .update(JSON.stringify(registry))
  .digest("hex");

const snapshotId = (finishedAt: string, digest: string): string =>
  `reg-${finishedAt.replace(/[-:.]/g, "").replace("Z", "Z")}-${digest.slice(0, 12)}`;

const sourceCheckedRecently = (
  cache: RegulatoryPreflightCache | null | undefined,
  source: RegulatoryPreflightSourceName,
  now: string,
  maxAgeHours: number,
): boolean => {
  const result = cache?.snapshot.sourceResults.find((entry) => entry.source === source);
  if (!result || !["success", "not-modified"].includes(result.status)) return false;
  const age = (Date.parse(now) - Date.parse(result.checkedAt)) / 3_600_000;
  return Number.isFinite(age) && age >= 0 && age <= maxAgeHours;
};

const updatedValidators = (
  previous: RegulatoryPreflightCache["sourceValidators"] | undefined,
  sourceResults: Array<{ source: RegulatoryPreflightSourceName; status: string; etag?: string; lastModified?: string }>,
): RegulatoryPreflightCache["sourceValidators"] => {
  const result = { ...(previous ?? {}) };
  for (const source of sourceResults) {
    if (!source.etag && !source.lastModified) continue;
    result[source.source] = {
      etag: source.etag ?? result[source.source]?.etag,
      lastModified: source.lastModified ?? result[source.source]?.lastModified,
    };
  }
  return result;
};

export async function runRegulatoryPreflight(options: {
  curatedRegistry: RegulatoryAction[];
  cache?: RegulatoryPreflightCache | null;
  reviewScope?: ReviewScope;
  fetchImpl?: FetchLike;
  now?: string;
  regulationsGovApiKey?: string;
  maxCacheAgeHours?: number;
  timeoutMs?: number;
}): Promise<RegulatoryPreflightResult> {
  const startedAt = options.now ?? new Date().toISOString();
  const asOfDate = startedAt.slice(0, 10);
  const fetchImpl = options.fetchImpl ?? fetch;
  const previousSnapshot = options.cache?.snapshot;
  const validators = options.cache?.sourceValidators ?? {};
  const baseRegistry = mergeCuratedAndCachedRegistry(
    regulatoryActionRegistrySchema.parse(options.curatedRegistry),
    options.cache?.registry,
  );
  const since = previousSnapshot ? dateMinusDays(previousSnapshot.finishedAt, 2) : dateMinusDays(startedAt, 30);

  const [federalRegister, oiraPending, oiraCompleted, agenda] = await Promise.all([
    fetchFederalRegisterVaChanges({
      fetchImpl,
      since,
      asOfDate,
      checkedAt: startedAt,
      validator: validators["federal-register"],
      timeoutMs: options.timeoutMs,
    }),
    fetchOiraReviews({ kind: "pending", fetchImpl, checkedAt: startedAt, validator: validators["oira-pending"], timeoutMs: options.timeoutMs }),
    fetchOiraReviews({ kind: "completed", fetchImpl, checkedAt: startedAt, validator: validators["oira-completed"], timeoutMs: options.timeoutMs }),
    fetchCurrentUnifiedAgenda({ fetchImpl, checkedAt: startedAt, validator: validators["unified-agenda"], timeoutMs: options.timeoutMs }),
  ]);

  const meetingTargets = new Map<string, { rin: string; title?: string }>();
  for (const discovery of [...oiraPending.discoveries, ...oiraCompleted.discoveries]) {
    meetingTargets.set(discovery.rin, { rin: discovery.rin, title: discovery.title });
  }
  for (const action of baseRegistry) {
    if (action.oiraReviews.some((review) => review.status === "pending")) {
      meetingTargets.set(action.rin, { rin: action.rin, title: action.title });
    }
  }
  const oiraDiscoveries = [...oiraPending.discoveries, ...oiraCompleted.discoveries];
  const hasNewOiraReview = oiraDiscoveries.some((discovery) => {
    const existing = baseRegistry.find((action) => action.rin === discovery.rin);
    return !existing?.oiraReviews.some((review) => review.reviewId === discovery.review.reviewId);
  });
  const meetings = !hasNewOiraReview && sourceCheckedRecently(options.cache, "oira-meetings", startedAt, 24)
    ? {
        sourceResult: {
          source: "oira-meetings" as const, status: "skipped" as const, checkedAt: startedAt, recordCount: 0, durationMs: 0,
          message: "Recent non-authoritative OIRA meeting context is retained from the cached registry; no new OIRA review required another meeting search.",
        },
        discoveries: [],
      }
    : await fetchOiraMeetingSignals({
        rins: [...meetingTargets.values()],
        fetchImpl,
        checkedAt: startedAt,
        timeoutMs: options.timeoutMs,
      });

  const knownDocketIds = new Set(baseRegistry.flatMap((action) =>
    action.federalRegisterDocuments.flatMap((document) =>
      document.publicParticipation?.regulationsGovUrl ? document.docketIds : [],
    ),
  ));
  const docketIds = federalRegister.discoveries.flatMap((discovery) =>
    (discovery.normalizedDocument?.docketIds ?? []).filter((id) => !knownDocketIds.has(id)),
  );
  const dockets = await fetchRegulationsGovDockets({
    docketIds,
    apiKey: options.regulationsGovApiKey,
    fetchImpl,
    checkedAt: startedAt,
    timeoutMs: options.timeoutMs,
  });

  const nextRegistry = mergeRegulatoryDiscoveries({
    baseRegistry,
    federalRegister: federalRegister.discoveries,
    agenda: agenda.discoveries,
    oiraReviews: oiraDiscoveries,
    oiraMeetings: meetings.discoveries,
    dockets: dockets.discoveries,
    checkedOn: asOfDate,
  });

  const finishedAt = new Date().toISOString();
  const discoveredChanges = diffRegulatoryPreflight({
    previousRegistry: baseRegistry,
    nextRegistry,
    federalRegisterDiscoveries: federalRegister.discoveries,
    detectedAt: finishedAt,
    asOfDate,
  });
  // Neither a no-change refresh nor an unverified reclassification resolves a
  // prior operative-document blocker.
  const resolvedNumbers = new Set([
    ...nextRegistry.flatMap((action) =>
      action.federalRegisterDocuments.filter((document) => document.authenticity.officialEditionVerified)
        .map((document) => document.documentNumber),
    ),
    ...discoveredChanges.filter((change) => change.officialEditionVerified)
      .flatMap((change) => change.documentNumbers),
  ]);
  const unresolved = (previousSnapshot?.changes ?? []).filter((change) =>
    change.classification === "current-law-change"
    && change.requiresOfficialEditionVerification && !change.officialEditionVerified
    && (change.documentNumbers.length === 0
      || !change.documentNumbers.every((number) => resolvedNumbers.has(number))),
  );
  const unresolvedById = new Map(unresolved.map((change) => [change.id, change]));
  const changes = discoveredChanges.map((change) =>
    unresolvedById.get(change.id) ?? change,
  );
  const currentIds = new Set(discoveredChanges.map((change) => change.id));
  changes.push(...unresolved.filter((change) => !currentIds.has(change.id)));
  const sourceResults = [
    federalRegister.sourceResult,
    oiraPending.sourceResult,
    oiraCompleted.sourceResult,
    agenda.sourceResult,
    meetings.sourceResult,
    dockets.sourceResult,
  ].map((source) => ({
    ...source,
    changedCount: changes.filter((change) => change.source === source.source).length,
  }));

  const freshness = decideRegulatoryFreshness({
    sourceResults,
    changes,
    finishedAt,
    previousSnapshot,
    maxCacheAgeHours: options.maxCacheAgeHours,
  });
  const digest = digestRegistry(nextRegistry);
  const relevantChangeIds = changes
    .filter((change) => changeMatchesReviewScope(change, options.reviewScope))
    .map((change) => change.id);
  const snapshot = {
    schemaVersion: 1 as const,
    snapshotId: snapshotId(finishedAt, digest),
    startedAt,
    finishedAt,
    asOfDate,
    registryDigest: digest,
    previousSnapshotId: previousSnapshot?.snapshotId,
    sourceResults,
    changes,
    relevantChangeIds,
    freshness: freshness.freshness,
    reviewMode: freshness.reviewMode,
    legalRegulatoryConclusionsAllowed: freshness.legalRegulatoryConclusionsAllowed,
    officialEditionVerificationComplete: freshness.officialEditionVerificationComplete,
    usedCachedRegistry: Boolean(options.cache?.registry?.length),
    cacheAgeHours: freshness.cacheAgeHours,
    warnings: freshness.warnings,
  };

  return {
    snapshot,
    registry: nextRegistry,
    sourceValidators: updatedValidators(validators, sourceResults),
  };
}
