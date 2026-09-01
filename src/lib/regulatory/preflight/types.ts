import type {
  FederalRegisterDocument,
  OiraMeeting,
  OiraReview,
  RegulatoryAction,
  UnifiedAgendaStatus,
} from "../schema";

export type RegulatoryPreflightSourceName =
  | "federal-register"
  | "oira-pending"
  | "oira-completed"
  | "unified-agenda"
  | "oira-meetings"
  | "regulations-gov";

export type RegulatoryPreflightSourceStatus = "success" | "not-modified" | "skipped" | "failed";

export interface RegulatorySourceValidator {
  etag?: string;
  lastModified?: string;
}

export interface RegulatoryPreflightSourceResult extends RegulatorySourceValidator {
  source: RegulatoryPreflightSourceName;
  status: RegulatoryPreflightSourceStatus;
  checkedAt: string;
  recordCount: number;
  changedCount?: number;
  durationMs?: number;
  message?: string;
}

export type RegulatoryChangeClassification =
  | "current-law-change"
  | "pending-regulatory-change"
  | "regulatory-development-signal";

export interface RegulatoryChangeImpact {
  affectedConditionIds: string[];
  affectedClaimTheories: string[];
  affectedDiagnosticCodes: string[];
  affectedPresumptions: string[];
  affectedEffectiveDateRules: string[];
}

export interface RegulatoryPreflightChange {
  id: string;
  rin?: string;
  title: string;
  classification: RegulatoryChangeClassification;
  source: RegulatoryPreflightSourceName;
  detectedAt: string;
  reason: string;
  documentNumbers: string[];
  requiresOfficialEditionVerification: boolean;
  officialEditionVerified: boolean;
  impact: RegulatoryChangeImpact;
}

export type RegulatoryFreshness = "current" | "degraded" | "stale";
export type RegulatoryReviewMode = "full" | "full-with-warning" | "medical-only";

export interface RegulatoryPreflightSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  startedAt: string;
  finishedAt: string;
  asOfDate: string;
  registryDigest: string;
  previousSnapshotId?: string;
  sourceResults: RegulatoryPreflightSourceResult[];
  changes: RegulatoryPreflightChange[];
  relevantChangeIds: string[];
  freshness: RegulatoryFreshness;
  reviewMode: RegulatoryReviewMode;
  legalRegulatoryConclusionsAllowed: boolean;
  officialEditionVerificationComplete: boolean;
  usedCachedRegistry: boolean;
  cacheAgeHours?: number;
  warnings: string[];
}

export interface FederalRegisterDiscovery {
  documentNumber: string;
  title: string;
  rin?: string;
  relatedRins: string[];
  type: FederalRegisterDocument["type"];
  publicationDate: string;
  effectiveDate?: string;
  rawAction?: string;
  abstract?: string;
  signals: string[];
  normalizedDocument?: FederalRegisterDocument;
  officialEditionVerificationRequired: boolean;
  officialEditionVerified: boolean;
  verificationMessage?: string;
}

export interface AgendaDiscovery {
  rin: string;
  title: string;
  agencyDepartment: string;
  agencySubagency?: string;
  status: UnifiedAgendaStatus;
}

export interface OiraReviewDiscovery {
  rin: string;
  title: string;
  agencyDepartment: string;
  agencySubagency?: string;
  review: OiraReview;
}

export interface OiraMeetingDiscovery {
  rin: string;
  title?: string;
  meeting: OiraMeeting;
}

export interface RegulationsGovDocketDiscovery {
  docketId: string;
  title?: string;
  rin?: string;
  lastModifiedAt?: string;
  sourceUrl: string;
}

export interface FederalRegisterFetchResult {
  sourceResult: RegulatoryPreflightSourceResult;
  discoveries: FederalRegisterDiscovery[];
}

export interface AgendaFetchResult {
  sourceResult: RegulatoryPreflightSourceResult;
  discoveries: AgendaDiscovery[];
}

export interface OiraReviewFetchResult {
  sourceResult: RegulatoryPreflightSourceResult;
  discoveries: OiraReviewDiscovery[];
}

export interface OiraMeetingFetchResult {
  sourceResult: RegulatoryPreflightSourceResult;
  discoveries: OiraMeetingDiscovery[];
}

export interface RegulationsGovFetchResult {
  sourceResult: RegulatoryPreflightSourceResult;
  discoveries: RegulationsGovDocketDiscovery[];
}

export interface RegulatoryPreflightCache {
  schemaVersion: 1;
  writtenAt: string;
  snapshot: RegulatoryPreflightSnapshot;
  registry: RegulatoryAction[];
  sourceValidators: Partial<Record<RegulatoryPreflightSourceName, RegulatorySourceValidator>>;
}

export interface ReviewScope {
  conditionIds?: string[];
  claimTheories?: string[];
  diagnosticCodes?: string[];
}

export interface RegulatoryPreflightResult {
  snapshot: RegulatoryPreflightSnapshot;
  registry: RegulatoryAction[];
  sourceValidators: Partial<Record<RegulatoryPreflightSourceName, RegulatorySourceValidator>>;
}
