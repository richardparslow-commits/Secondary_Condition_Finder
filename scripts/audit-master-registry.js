#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const relPath = path.join(root, "data", "evidence", "master-relationships.json");
const srcPath = path.join(root, "data", "evidence", "master-sources.json");
const retirementPath = path.join(root, "data", "citation-retirements.json");
const expectedBaseline = "ea005e50ccbc30800dd46f3872f764f98e977c1f";

const fail = (message) => {
  console.error(JSON.stringify({ status: "FAIL", message }, null, 2));
  process.exit(1);
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const shaBytes = (b) => crypto.createHash("sha256").update(b).digest("hex");
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const shaObject = (value) => shaBytes(Buffer.from(canonicalJson(value), "utf8"));

const canonicalSourceId = (ref) => {
  const citation = String(ref.citation || "");
  const url = String(ref.sourceUrl || "");
  if (/38\s*CFR\s*3\.310/i.test(citation)) return "legal-38-cfr-3.310";
  const um = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{6,9})/i);
  if (um) return `pmid-${um[1]}`;
  const pm = citation.match(/\bPMID[\s:#-]*(\d{6,9})\b/i);
  if (pm) return `pmid-${pm[1]}`;
  const dm = `${citation} ${url}`.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (dm) return `doi-${dm[0].replace(/[.,;\)\]\}]+$/g, "").toLowerCase()}`;
  fail(`Unable to normalize live source reference: ${citation}`);
};

if (!fs.existsSync(relPath) || !fs.existsSync(srcPath)) fail("Master registry files are missing.");
const relRegistry = readJson(relPath);
const srcRegistry = readJson(srcPath);
if (relRegistry.status !== "AUTHORITATIVE-CURRENT-STATE") fail("Relationship registry is not authoritative.");
if (srcRegistry.status !== "AUTHORITATIVE-CURRENT-STATE") fail("Source registry is not authoritative.");
if (relRegistry.baselineCommit !== expectedBaseline || srcRegistry.baselineCommit !== expectedBaseline) fail("Registry baseline mismatch.");

const relById = new Map(relRegistry.relationships.map((r) => [r.relationshipId, r]));
if (relById.size !== 342) fail(`Expected 342 master relationships, found ${relById.size}.`);
const srcById = new Map(srcRegistry.sources.map((s) => [s.sourceId, s]));
if (srcById.size !== 333) fail(`Expected 333 source entities including lineage, found ${srcById.size}.`);

const isApprovedVerificationOnlyPromotion = (source, ref) => {
  const state = source?.verificationState;
  return (
    ref?.verified === true &&
    source?.status === "active" &&
    source?.verified === true &&
    state?.qualifiedHumanCitationReviewRequired === false &&
    ["approve-as-implemented", "approve-with-narrowing", "approve-with-narrowing-and-bibliographic-correction"].includes(state?.qualifiedHumanCitationReviewDecision) &&
    state?.automaticPromotionAuthorized === false &&
    state?.mappingApprovalDoesNotEqualCitationVerification === true
  );
};

const suggestionMatchesRelationshipSnapshot = (suggestion, master) => {
  if (master.suggestionObjectHash === shaObject(suggestion)) return true;

  const refs = suggestion.sourceReferences || [];
  if (refs.length !== master.sourceIds.length) return false;

  const snapshot = structuredClone(suggestion);
  let normalizedVerificationOnly = false;

  snapshot.sourceReferences.forEach((ref, index) => {
    const source = srcById.get(master.sourceIds[index]);
    if (isApprovedVerificationOnlyPromotion(source, ref)) {
      ref.verified = false;
      normalizedVerificationOnly = true;
    }
  });

  return normalizedVerificationOnly && master.suggestionObjectHash === shaObject(snapshot);
};

const sourceReferenceMatchesRegistrySnapshot = (ref, source) => {
  const hashes = source.rawReferenceHashes || [];
  if (hashes.includes(shaObject(ref))) return true;

  if (!isApprovedVerificationOnlyPromotion(source, ref)) return false;

  const snapshot = structuredClone(ref);
  snapshot.verified = false;
  return hashes.includes(shaObject(snapshot));
};

let published = 0;
let draft = 0;
let relationshipCount = 0;
let referenceUses = 0;
let verifiedTrue = 0;
let verifiedFalse = 0;
let clinicalUses = 0;
let legalUses = 0;
const observedUses = new Map();

const files = fs.readdirSync(kbDir).filter((n) => n.endsWith(".json")).sort();
if (files.length !== 813) fail(`Expected 813 KB files, found ${files.length}.`);

for (const file of files) {
  const mapping = readJson(path.join(kbDir, file));
  if (mapping.draft === false) published += 1;
  else if (mapping.draft === true) draft += 1;
  else fail(`${file}: draft must be boolean`);

  for (const suggestion of mapping.suggestions || []) {
    relationshipCount += 1;
    const rid = `rel-${mapping.id}-to-${suggestion.conditionId}`;
    const master = relById.get(rid);
    if (!master) fail(`Live relationship missing from registry: ${mapping.id} -> ${suggestion.conditionId}`);
    if (master.direction !== `${mapping.id} -> ${suggestion.conditionId}`) fail(`${rid}: direction mismatch`);
    if (master.rank !== suggestion.rank) fail(`${rid}: rank mismatch`);
    if (master.rationale !== suggestion.rationale) fail(`${rid}: rationale mismatch`);
    if (JSON.stringify(master.evidenceGaps) !== JSON.stringify(suggestion.evidenceGaps || [])) fail(`${rid}: evidenceGaps mismatch`);
    if (!suggestionMatchesRelationshipSnapshot(suggestion, master)) fail(`${rid}: suggestion object drifted beyond an authorized verification-only transition`);
    if (master.clinicalProposition?.text !== suggestion.rationale) fail(`${rid}: clinical proposition text mismatch`);

    const pg = master.publicationGuard;
    if (pg.status === "legacy-rationale-boundary") {
      if (pg.structuredGuardText !== null) fail(`${rid}: legacy row invented a structured guard`);
      if (pg.boundaryText !== suggestion.rationale) fail(`${rid}: legacy boundary is not exact current rationale`);
      if (pg.structuredGuardReviewPending !== true) fail(`${rid}: legacy guard review flag missing`);
    } else if (pg.status === "explicit") {
      if (!pg.structuredGuardText) fail(`${rid}: explicit guard is empty`);
      if (/supersedes unverified PMID/i.test(pg.structuredGuardText)) fail(`${rid}: supersession provenance contaminates publication guard`);
    } else {
      fail(`${rid}: unknown publication guard status ${pg.status}`);
    }

    const refs = suggestion.sourceReferences || [];
    if (refs.length !== master.sourceReferenceCount) fail(`${rid}: source reference count mismatch`);
    if (refs.length !== master.sourceIds.length) fail(`${rid}: master sourceIds length mismatch`);

    refs.forEach((ref, index) => {
      referenceUses += 1;
      if (ref.verificationScope === "clinical-evidence") clinicalUses += 1;
      else if (ref.verificationScope === "legal-framework") legalUses += 1;
      else fail(`${rid}[${index}]: unsupported verificationScope`);

      if (ref.verified === true) verifiedTrue += 1;
      else if (ref.verified === false) verifiedFalse += 1;
      else fail(`${rid}[${index}]: verified must be boolean`);

      const sid = canonicalSourceId(ref);
      if (sid !== master.sourceIds[index]) fail(`${rid}[${index}]: source identity mismatch (${sid} != ${master.sourceIds[index]})`);
      const source = srcById.get(sid);
      if (!source) fail(`${rid}[${index}]: source entity missing: ${sid}`);

      if (ref.verified === true) {
        if (source.status !== "active" || source.verified !== true) fail(`${rid}[${index}]: verified:true source must map to active/verified master source`);
      } else {
        if (source.status !== "pending-verification" || source.verified !== false) fail(`${rid}[${index}]: verified:false source must map to pending-verification master source`);
        if (source.kind !== "clinical-evidence") fail(`${rid}[${index}]: pending-verification is allowed only for clinical evidence`);
      }

      if (!sourceReferenceMatchesRegistrySnapshot(ref, source)) fail(`${rid}[${index}]: live reference hash drifted beyond an authorized verification-only transition`);
      if (!observedUses.has(sid)) observedUses.set(sid, []);
      observedUses.get(sid).push({
        relationshipId: rid,
        primaryId: mapping.id,
        targetId: suggestion.conditionId,
        sourceIndex: index,
      });
    });
  }
}

if (published !== 139 || draft !== 674) fail(`Publication-state drift: published=${published}, draft=${draft}`);
if (relationshipCount !== 342) fail(`Relationship count drift: ${relationshipCount}`);
if (referenceUses !== 350 || verifiedTrue !== 256 || verifiedFalse !== 94) fail(`Reference state drift: uses=${referenceUses}, verified=${verifiedTrue}, unverified=${verifiedFalse}`);
if (clinicalUses !== 345 || legalUses !== 5) fail(`Reference scope drift: clinical=${clinicalUses}, legal=${legalUses}`);

const statusCounts = {};
let activeClinical = 0;
let activeLegal = 0;
let pendingClinical = 0;
let retiredVerifiedUses = 0;

for (const source of srcRegistry.sources) {
  statusCounts[source.status] = (statusCounts[source.status] || 0) + 1;
  retiredVerifiedUses += (source.retiredUses || []).length;

  if (source.status === "active") {
    if (source.verified !== true) fail(`${source.sourceId}: active source must be verified:true`);
    if (source.kind === "clinical-evidence") activeClinical += 1;
    if (source.kind === "legal-framework") activeLegal += 1;
  } else if (source.status === "pending-verification") {
    if (source.verified !== false) fail(`${source.sourceId}: pending-verification source must be verified:false`);
    if (source.kind !== "clinical-evidence") fail(`${source.sourceId}: pending-verification source must be clinical-evidence`);
    pendingClinical += 1;
  }

  if (source.status === "active" || source.status === "pending-verification") {
    const expected = [...(source.liveUses || [])].sort((a,b) =>
      `${a.primaryId}|${a.targetId}|${a.sourceIndex}`.localeCompare(`${b.primaryId}|${b.targetId}|${b.sourceIndex}`)
    );
    const observed = [...(observedUses.get(source.sourceId) || [])].sort((a,b) =>
      `${a.primaryId}|${a.targetId}|${a.sourceIndex}`.localeCompare(`${b.primaryId}|${b.targetId}|${b.sourceIndex}`)
    );
    if (JSON.stringify(expected) !== JSON.stringify(observed)) fail(`${source.sourceId}: live-use set mismatch`);
    if (source.liveUsageCount !== observed.length) fail(`${source.sourceId}: liveUsageCount mismatch`);
  } else if ((source.liveUsageCount || 0) !== 0 || (source.liveUses || []).length !== 0) {
    fail(`${source.sourceId}: lineage/history-only source must have zero live use`);
  }
}

const expectedStatuses = {
  active: 233,
  "pending-verification": 91,
  "superseded-unverified": 7,
  "bibliographic-correction-only": 1,
  "retired-only": 1,
};
if (Object.entries(expectedStatuses).some(([key, value]) => (statusCounts[key] || 0) !== value) ||
    Object.keys(statusCounts).some((key) => !(key in expectedStatuses))) {
  fail(`Source status counts mismatch: ${JSON.stringify(statusCounts)}`);
}
if (activeClinical !== 232 || pendingClinical !== 91 || activeLegal !== 1) {
  fail(`Source kind counts mismatch: activeClinical=${activeClinical}, pendingClinical=${pendingClinical}, activeLegal=${activeLegal}`);
}
if (retiredVerifiedUses !== 6) fail(`Retired verified relationship-source uses mismatch: ${retiredVerifiedUses}`);

const legacyCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "legacy-rationale-boundary").length;
const explicitCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "explicit").length;
if (legacyCount !== 74 || explicitCount !== 268) fail(`Publication guard counts mismatch: legacy=${legacyCount}, explicit=${explicitCount}`);

const expectedRelCounts = { relationships: 342, explicitPublicationGuards: 268, legacyRationaleBoundaries: 74 };
if (JSON.stringify(relRegistry.counts) !== JSON.stringify(expectedRelCounts)) fail(`Relationship registry count metadata mismatch: ${JSON.stringify(relRegistry.counts)}`);

const expectedSourceCounts = {
  liveSourceReferenceUses: 350,
  activeSourceEntities: 233,    pendingVerificationSourceEntities: 91,
  activeClinicalSourceEntities: 232,
  pendingClinicalSourceEntities: 91,
  activeLegalAuthorityEntities: 1,
  retiredOnlySourceEntities: 1,
  supersededUnverifiedSourceEntities: 7,
  bibliographicCorrectionOnlyEntities: 1,
  totalSourceEntitiesIncludingLineage: 333,
  retiredVerifiedRelationshipSourceUses: 6,
};
if (JSON.stringify(srcRegistry.counts) !== JSON.stringify(expectedSourceCounts)) fail(`Source registry count metadata mismatch: ${JSON.stringify(srcRegistry.counts)}`);

const retirementSha = shaBytes(fs.readFileSync(retirementPath));
if (retirementSha !== srcRegistry.retirementLedger.sha256) fail("Retirement ledger drifted from authoritative source registry snapshot.");

console.log(JSON.stringify({
  status: "PASS",
  knowledgeBaseFiles: files.length,
  published,
  draft,
  relationships: relationshipCount,
  liveSourceReferenceUses: referenceUses,
  verifiedLiveSourceUses: verifiedTrue,
  pendingVerificationLiveSourceUses: verifiedFalse,
  liveClinicalUses: clinicalUses,
  liveLegalUses: legalUses,
  activeSourceEntities: statusCounts.active,
  pendingVerificationSourceEntities: statusCounts["pending-verification"] || 0,
  activeClinicalSourceEntities: activeClinical,
  pendingClinicalSourceEntities: pendingClinical,
  activeLegalSourceEntities: activeLegal,
  totalSourceEntities: srcRegistry.sources.length,
  explicitPublicationGuards: explicitCount,
  legacyRationaleBoundaries: legacyCount,
  retiredVerifiedRelationshipSourceUses: retiredVerifiedUses,
}, null, 2));
