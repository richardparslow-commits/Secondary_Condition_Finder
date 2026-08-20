#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const kbDir = path.join(root, "data", "knowledge-base");
const relPath = path.join(root, "data", "evidence", "master-relationships.json");
const srcPath = path.join(root, "data", "evidence", "master-sources.json");
const retirementPath = path.join(root, "data", "citation-retirements.json");

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
if (relRegistry.baselineCommit !== "ffadbe9460bd0dbda327781e20ec6f51e4cd854f" || srcRegistry.baselineCommit !== "ffadbe9460bd0dbda327781e20ec6f51e4cd854f") fail("Registry baseline mismatch.");

const relById = new Map(relRegistry.relationships.map((r) => [r.relationshipId, r]));
if (relById.size !== 183) fail(`Expected 183 master relationships, found ${relById.size}.`);
const srcById = new Map(srcRegistry.sources.map((s) => [s.sourceId, s]));
if (srcById.size !== 177) fail(`Expected 177 source entities including lineage, found ${srcById.size}.`);

let published = 0;
let draft = 0;
let relationshipCount = 0;
let referenceUses = 0;
let verifiedTrue = 0;
let clinicalUses = 0;
let legalUses = 0;
const observedUses = new Map();

const files = fs.readdirSync(kbDir).filter((n) => n.endsWith(".json")).sort();
if (files.length !== 311) fail(`Expected 311 KB files, found ${files.length}.`);

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
    if (master.prevalence !== suggestion.prevalence) fail(`${rid}: prevalence mismatch`);
    if (master.rationale !== suggestion.rationale) fail(`${rid}: rationale mismatch`);
    if (JSON.stringify(master.evidenceGaps) !== JSON.stringify(suggestion.evidenceGaps || [])) fail(`${rid}: evidenceGaps mismatch`);
    if (master.suggestionObjectHash !== shaObject(suggestion)) fail(`${rid}: suggestion object drifted from authoritative baseline`);
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
      if (ref.verified !== true) fail(`${rid}[${index}]: live source is not verified:true`);
      verifiedTrue += 1;
      if (ref.verificationScope === "clinical-evidence") clinicalUses += 1;
      if (ref.verificationScope === "legal-framework") legalUses += 1;
      const sid = canonicalSourceId(ref);
      if (sid !== master.sourceIds[index]) fail(`${rid}[${index}]: source identity mismatch`);
      const source = srcById.get(sid);
      if (!source || source.status !== "active") fail(`${rid}[${index}]: active source entity missing: ${sid}`);
      const refHash = shaObject(ref);
      if (!(source.rawReferenceHashes || []).includes(refHash)) fail(`${rid}[${index}]: live reference hash not represented by source entity`);
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

if (published !== 139 || draft !== 172) fail(`Publication-state drift: published=${published}, draft=${draft}`);
if (relationshipCount !== 183) fail(`Relationship count drift: ${relationshipCount}`);
if (referenceUses !== 191 || verifiedTrue !== 191) fail(`Reference state drift: uses=${referenceUses}, verified=${verifiedTrue}`);
if (clinicalUses !== 186 || legalUses !== 5) fail(`Reference scope drift: clinical=${clinicalUses}, legal=${legalUses}`);

const statusCounts = {};
let activeClinical = 0;
let activeLegal = 0;
let retiredVerifiedUses = 0;
for (const source of srcRegistry.sources) {
  statusCounts[source.status] = (statusCounts[source.status] || 0) + 1;
  retiredVerifiedUses += (source.retiredUses || []).length;
  if (source.status === "active") {
    if (source.kind === "clinical-evidence") activeClinical += 1;
    if (source.kind === "legal-framework") activeLegal += 1;
    const expected = [...(source.liveUses || [])].sort((a,b) =>
      `${a.primaryId}|${a.targetId}|${a.sourceIndex}`.localeCompare(`${b.primaryId}|${b.targetId}|${b.sourceIndex}`)
    );
    const observed = [...(observedUses.get(source.sourceId) || [])].sort((a,b) =>
      `${a.primaryId}|${a.targetId}|${a.sourceIndex}`.localeCompare(`${b.primaryId}|${b.targetId}|${b.sourceIndex}`)
    );
    if (JSON.stringify(expected) !== JSON.stringify(observed)) fail(`${source.sourceId}: live-use set mismatch`);
    if (source.liveUsageCount !== observed.length) fail(`${source.sourceId}: liveUsageCount mismatch`);
  }
}

const expectedStatuses = {
  active: 168,
  "superseded-unverified": 7,
  "bibliographic-correction-only": 1,
  "retired-only": 1,
};
if (Object.keys(statusCounts).sort().join("|") !== Object.keys(expectedStatuses).sort().join("|") || Object.entries(expectedStatuses).some(([key, value]) => statusCounts[key] !== value)) fail(`Source status counts mismatch: ${JSON.stringify(statusCounts)}`);
if (activeClinical !== 167 || activeLegal !== 1) fail(`Active source kind counts mismatch: clinical=${activeClinical}, legal=${activeLegal}`);
if (retiredVerifiedUses !== 6) fail(`Retired verified relationship-source uses mismatch: ${retiredVerifiedUses}`);

const legacyCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "legacy-rationale-boundary").length;
const explicitCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "explicit").length;
if (legacyCount !== 74 || explicitCount !== 109) fail(`Publication guard counts mismatch: legacy=${legacyCount}, explicit=${explicitCount}`);

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
  liveClinicalUses: clinicalUses,
  liveLegalUses: legalUses,
  activeSourceEntities: statusCounts.active,
  activeClinicalSourceEntities: activeClinical,
  activeLegalSourceEntities: activeLegal,
  totalSourceEntities: srcRegistry.sources.length,
  explicitPublicationGuards: explicitCount,
  legacyRationaleBoundaries: legacyCount,
  retiredVerifiedRelationshipSourceUses: retiredVerifiedUses,
}, null, 2));
