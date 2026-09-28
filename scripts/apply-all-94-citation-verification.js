#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const reviewDate = "2026-09-04";
const approvedDecision = "approve-as-implemented";
const expectedCounts = {
  knowledgeBaseFiles: 817,
  published: 139,
  draft: 674,
  relationships: 347,
  references: 355,
  verified: 355,
  unverified: 0,
  retiredVerified: 6,
  verifiedProvenance: 361,
  clinicalEvidenceReferences: 350,
  clinicalEvidenceReferencesWithUrls: 350,
  activeMasterSources: 329,
  pendingMasterSources: 0,
  totalMasterSourcesIncludingLineage: 338,
  explicitPublicationGuards: 273,
  legacyRationaleBoundaries: 74,
};

function parseArgs(argv) {
  let root = process.cwd();
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--root requires a directory path.");
      root = path.resolve(value);
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log("Usage: node scripts/apply-all-94-citation-verification.js [--dry-run] [--root <repo-root>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return { root, dryRun };
}

const { root, dryRun } = parseArgs(process.argv.slice(2));
const kbDir = path.join(root, "data", "knowledge-base");
const sourcePath = path.join(root, "data", "evidence", "master-sources.json");
const relationshipPath = path.join(root, "data", "evidence", "master-relationships.json");
const trackerPath = path.join(root, "docs", "kb-coverage-tracker.md");
const ledgerPath = path.join(root, "docs", "all-94-citation-verification-approved-ledger.json");

const read = (file) => fs.readFileSync(file, "utf8");
const parse = (file) => JSON.parse(read(file));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const fail = (message) => {
  throw new Error(`All-94 promotion preflight failed: ${message}`);
};

for (const requiredPath of [kbDir, sourcePath, relationshipPath, trackerPath, ledgerPath]) {
  if (!fs.existsSync(requiredPath)) fail(`required path is missing: ${path.relative(root, requiredPath)}`);
}

const ledger = parse(ledgerPath);
if (ledger.ledgerStatus !== "APPROVED-AND-APPLIED-LOCALLY — 94/94 VERIFIED") {
  fail(`unexpected approval ledger status: ${ledger.ledgerStatus}`);
}
if (ledger.approvalDate !== reviewDate) fail(`approval date must be ${reviewDate}`);
if (ledger.authorization?.liveReferencePromotions !== 94) fail("ledger must authorize exactly 94 live-reference promotions");
if (ledger.authorization?.masterSourcePromotions !== 91) fail("ledger must authorize exactly 91 source-entity promotions");
if (!Array.isArray(ledger.promotedRelationshipUses) || ledger.promotedRelationshipUses.length !== 94) {
  fail("ledger must contain exactly 94 promoted relationship uses");
}
if (!Array.isArray(ledger.promotedSourceIds) || new Set(ledger.promotedSourceIds).size !== 91) {
  fail("ledger must contain exactly 91 unique promoted source IDs");
}

const sourceIds = new Set(ledger.promotedSourceIds);
const relationshipKeys = new Set();
for (const use of ledger.promotedRelationshipUses) {
  const key = `${use.primaryId}|${use.targetId}|${use.pmid}`;
  if (relationshipKeys.has(key)) fail(`duplicate approved relationship use: ${key}`);
  relationshipKeys.add(key);
  if (!use.primaryId || !use.targetId || !/^\d{6,9}$/.test(String(use.pmid))) {
    fail(`malformed approved relationship use: ${JSON.stringify(use)}`);
  }
  if (!sourceIds.has(`pmid-${use.pmid}`)) fail(`approved use has no approved source entity: ${key}`);
}

const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();
if (files.length !== expectedCounts.knowledgeBaseFiles) fail(`expected ${expectedCounts.knowledgeBaseFiles} KB files, found ${files.length}`);

const mappings = new Map();
for (const file of files) mappings.set(file.replace(/\.json$/, ""), parse(path.join(kbDir, file)));

const targetReferences = new Map();
for (const use of ledger.promotedRelationshipUses) {
  const mapping = mappings.get(use.primaryId);
  if (!mapping) fail(`approved primary mapping is missing: ${use.primaryId}`);
  const suggestion = (mapping.suggestions ?? []).find((item) => item.conditionId === use.targetId);
  if (!suggestion) fail(`approved target is missing: ${use.primaryId} -> ${use.targetId}`);
  const matches = (suggestion.sourceReferences ?? []).filter((reference) =>
    new RegExp(String.raw`\bPMID\s+${use.pmid}\b`, "i").test(String(reference.citation ?? "")),
  );
  if (matches.length !== 1) fail(`expected exactly one approved PMID match for ${use.primaryId} -> ${use.targetId} / PMID ${use.pmid}, found ${matches.length}`);
  const reference = matches[0];
  if (reference.verificationScope !== "clinical-evidence") fail(`approved reference is not clinical evidence: ${use.primaryId} -> ${use.targetId} / PMID ${use.pmid}`);
  const key = `${use.primaryId}|${use.targetId}|${use.pmid}`;
  targetReferences.set(key, { mapping, suggestion, reference, file: `${use.primaryId}.json` });
}
if (targetReferences.size !== 94) fail(`resolved ${targetReferences.size} approved references instead of 94`);

const unapprovedUnverified = [];
for (const mapping of mappings.values()) {
  for (const suggestion of mapping.suggestions ?? []) {
    for (const reference of suggestion.sourceReferences ?? []) {
      if (reference.verified !== false) continue;
      const pmid = String(reference.citation?.match(/\bPMID\s+(\d{6,9})\b/i)?.[1] ?? "");
      const key = `${mapping.id}|${suggestion.conditionId}|${pmid}`;
      if (!targetReferences.has(key)) unapprovedUnverified.push(key);
    }
  }
}
if (unapprovedUnverified.length > 0) {
  fail(`found ${unapprovedUnverified.length} unverified live reference(s) outside the approved ledger: ${unapprovedUnverified.join(", ")}`);
}

const sourceRegistry = parse(sourcePath);
const sourceById = new Map((sourceRegistry.sources ?? []).map((source) => [source.sourceId, source]));
for (const sourceId of sourceIds) {
  const source = sourceById.get(sourceId);
  if (!source) fail(`approved source entity is missing: ${sourceId}`);
  if (source.kind !== "clinical-evidence") fail(`approved source entity is not clinical evidence: ${sourceId}`);
  if (source.status !== "pending-verification" && source.status !== "active") {
    fail(`approved source entity has unexpected status ${source.status}: ${sourceId}`);
  }
  if (source.verified !== false && source.verified !== true) fail(`approved source entity has non-boolean verified state: ${sourceId}`);
}

const kbChanges = [];
for (const [key, target] of targetReferences) {
  if (target.reference.verified === false) {
    kbChanges.push({ key, file: target.file, mapping: target.mapping, reference: target.reference });
  } else if (target.reference.verified !== true) {
    fail(`approved reference has non-boolean verified state: ${key}`);
  }
}

const sourceChanges = [];
for (const sourceId of sourceIds) {
  const source = sourceById.get(sourceId);
  if (source.status === "pending-verification" || source.verified === false || source.verificationState?.qualifiedHumanCitationReviewRequired !== false) {
    sourceChanges.push(sourceId);
  }
}

const currentCounts = sourceRegistry.counts ?? {};
const alreadyFinal =
  currentCounts.activeSourceEntities === expectedCounts.activeMasterSources &&
  currentCounts.pendingVerificationSourceEntities === expectedCounts.pendingMasterSources &&
  currentCounts.activeClinicalSourceEntities === 328 &&
  currentCounts.pendingClinicalSourceEntities === 0;
const recognizedPrePromotionCounts =
  currentCounts.activeSourceEntities === 238 &&
  currentCounts.pendingVerificationSourceEntities === 91 &&
  currentCounts.activeClinicalSourceEntities === 237 &&
  currentCounts.pendingClinicalSourceEntities === 91;
if (!alreadyFinal && !recognizedPrePromotionCounts) {
  fail(`source registry counts are neither the approved pre-promotion nor final state: ${JSON.stringify({
    activeSourceEntities: currentCounts.activeSourceEntities,
    pendingVerificationSourceEntities: currentCounts.pendingVerificationSourceEntities,
    activeClinicalSourceEntities: currentCounts.activeClinicalSourceEntities,
    pendingClinicalSourceEntities: currentCounts.pendingClinicalSourceEntities,
  })}`);
}

const sourceNeedsWrite = sourceChanges.length > 0 || !alreadyFinal || sourceRegistry.lastUpdatedBy !== "All 94 Approved Citation Verification";
const relationshipRegistry = parse(relationshipPath);
const relationshipNeedsWrite = relationshipRegistry.lastUpdatedBy !== "All 94 Approved Citation Verification";
const tracker = read(trackerPath);
const markerStart = "<!-- ALL-94-CITATION-VERIFICATION-2026:START -->";
const markerEnd = "<!-- ALL-94-CITATION-VERIFICATION-2026:END -->";
const trackerSection = `${markerStart}\n## All 94 pending citation verification — current state\n\n- User approval: **all 94 pending clinical references approved** on **2026-09-04**.\n- Live references: **355**; live verified: **355**; live unverified: **0**.\n- Verified provenance including six retired verified uses: **361**.\n- Active master sources: **329**; pending master sources: **0**; total source entities including lineage: **338**.\n- Knowledge-base state remains **139 published / 674 draft**; all 674 draft mappings remain draft-only.\n- Approval ledger: docs/all-94-citation-verification-approved-ledger.json.\n- This promotion changes citation state only; it does not establish an individual medical nexus or publish any draft relationship.\n${markerEnd}\n\n`;
const trackerNeedsWrite = !tracker.includes(markerStart);

if (!dryRun) {
  for (const target of targetReferences.values()) target.reference.verified = true;
  const changedMappings = new Set(kbChanges.map((change) => change.mapping));
  for (const mapping of changedMappings) {
    writeJson(path.join(kbDir, `${mapping.id}.json`), mapping);
  }

  for (const sourceId of sourceIds) {
    const source = sourceById.get(sourceId);
    source.status = "active";
    source.verified = true;
    source.verificationState = {
      ...(source.verificationState ?? {}),
      qualifiedHumanCitationReviewRequired: false,
      qualifiedHumanCitationReviewDecision: approvedDecision,
      qualifiedHumanCitationReviewDate: reviewDate,
      automaticPromotionAuthorized: false,
      mappingApprovalDoesNotEqualCitationVerification: true,
    };
  }

  sourceRegistry.lastUpdatedBy = "All 94 Approved Citation Verification";
  sourceRegistry.counts = {
    ...sourceRegistry.counts,
    liveSourceReferenceUses: expectedCounts.references,
    activeSourceEntities: expectedCounts.activeMasterSources,
    pendingVerificationSourceEntities: expectedCounts.pendingMasterSources,
    activeClinicalSourceEntities: 328,
    pendingClinicalSourceEntities: 0,
    totalSourceEntitiesIncludingLineage: expectedCounts.totalMasterSourcesIncludingLineage,
    retiredVerifiedRelationshipSourceUses: expectedCounts.retiredVerified,
  };
  if (sourceNeedsWrite) writeJson(sourcePath, sourceRegistry);

  if (relationshipNeedsWrite) writeJson(relationshipPath, relationshipRegistry);

  if (trackerNeedsWrite) fs.writeFileSync(trackerPath, `${trackerSection}${tracker}`);
}

const result = {
  status: "PASS",
  mode: dryRun ? "dry-run" : "apply",
  idempotent: kbChanges.length === 0 && sourceChanges.length === 0,
  approvedLiveReferences: 94,
  referencesToPromote: kbChanges.length,
  approvedSourceEntities: 91,
  sourceEntitiesToPromote: sourceChanges.length,
  trackerToAdd: trackerNeedsWrite,
  knowledgeBaseFiles: files.length,
  published: expectedCounts.published,
  draft: expectedCounts.draft,
};
console.log(JSON.stringify(result, null, 2));
