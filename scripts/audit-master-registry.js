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
// D1 batch 19 (2026-09-23): cyclic-vomiting-syndrome -> migraine-headaches/depressive-disorder/
// esophagitis (association with reverse-direction/acute-tear guards); cystitis-or-neurogenic-bladder
// -> hydronephrosis (second obstruction-mechanical DIRECT_CAUSATION, urethral-stricture precedent)
// and -> kidney-stones (SCI-specific risk, catheter confound); dandy-walker-syndrome -> hydrocephalus
// (CSF-flow obstruction, penetrance guard); de-quervain-s-tenosynovitis -> carpal-tunnel-syndrome
// (single cross-sectional co-occurrence cohort); decubitus-ulcers -> osteomyelitis (biopsy-denominator
// guard) over 19 sources; zero deferrals this batch.
// D1 batch 17 (2026-09-22): aphonia -> depressive-disorder and anxiety-disorder
// (dysphonia-population cross-sectional co-occurrence, R49.0 exposure guard); bacterial-rhinitis ->
// sinusitis (rhinosinusitis continuum with the viral-majority guard); chronic-laryngitis ->
// vocal-cord-nodules-polyps-cysts-paralysis (edematous-polypoid spectrum only, 8.5% form share);
// complex-regional-pain-syndrome -> osteoporosis (DXA-quantified regional deficit with the
// reverse-direction and disuse guards) and -> contractures (review-class sequelae, no denominators)
// over 15 sources; common-peroneal-neuropathy deferred on the ME-41 phenotype-identity barrier
// (foot drop IS the identity).
// D1 batch 20 (2026-09-23): dermatitis -> insomnia/cellulitis/impetigo/depressive-disorder/
// anxiety-disorder (adult-AD-anchored sleep/burden/infection pathways, all cross-sectional with
// bidirectionality guards); delayed-ejaculation -> depressive-disorder (psychotropic-confound
// reverse direction); dental-abrasion-erosion-abfraction -> dentin-hypersensitivity
// (hydrodynamic substrate, cross-sectional co-occurrence); dentin-hypersensitivity and
// dermatitis-herpetiformis deferred on direction/identity grounds; 13 new pending sources.
// D1 batch 21 (2026-09-23): dermatomyositis -> interstitial-lung-disease and -> dysphagia
// (scleroderma->ILD precedent; paraneoplastic-weighting guards from the IIM meta-analysis);
// deviated-nasal-septum -> sinusitis (CT-referral OR 2.74, normal-variant guard) and ->
// sleep-apnea (PSG cohort with the craniofacial shared-driver confound);
// diabetes-insipidus -> hydronephrosis (volume-overload dilatation, the third
// obstruction/dilatation-family edge, adherence guard); dermatofibroma and
// dermatofibrosarcoma-protuberans deferred on identity grounds; 14 new pending sources.
// D1 batch 22 (2026-09-23): diaphragm-paralysis -> sleep-apnea (REM-hypoventilation
// phenotype, PSG-anchored with referred-population and phenotype-scope guards) and
// diffuse-axonal-injury -> cognitive-disorder (DIRECT_CAUSATION per the
// cerebral-contusion structural-lesion precedent; connectivity-disruption mechanism);
// diabetes-mellitus deferred on duplicate-scope against the published typed identities,
// diabetic-amyotrophy on the manifestation barrier, diabetic-dermopathy on the
// shared-cause confound; 6 new pending sources.
// Batch 23 (2026-09-23): +4 relationships (diffuse-esophageal-spasm->gerd,
// diverticulosis->diverticulitis, diverticulitis->irritable-bowel-syndrome,
// dizziness->anxiety-disorder) and +12 pending-verification sources.
// diplopia deferred (symptom-identity; no quantified downstream cohort).
const srcById = new Map(srcRegistry.sources.map((s) => [s.sourceId, s]));
// Batch 34 (2026-09-23): +3 pending-verification relationships across 3 authored
// identities (femoral-neuropathy->unexplained-chronic-pain case-matching edge,
// fitz-hugh-curtis-syndrome->female-infertility shared-driver edge,
// flatfoot->osteoarthritis biomechanical edge) over +9 new pending-verification
// clinical sources; every citation was NCBI-verified via efetch before file
// authoring (batch-30 lesson institutionalized); female-sexual-arousal-disorder
// deferred on evidence-gap and nosology-stability grounds and fissured-tongue
// deferred on zero-record and directionality grounds.
// Batch 33 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (farmer-s-lung->pulmonary-fibrosis, fasciitis->amputation-or-loss-of-use,
// fecal-impaction->fecal-incontinence DIRECT_CAUSATION,
// female-infertility->depressive-disorder) over +12 new pending-verification
// clinical sources; every citation was NCBI-verified via efetch before file
// authoring (batch-30 lesson institutionalized); female-reproductive-disorders
// deferred on duplicate-scope class-identity grounds (diabetes-mellitus and
// eczema precedents).
// Batch 32 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (excoriation-disorder->scars, factitious-disorder->scars,
// exophthalmos->keratitis, exploding-head-syndrome->insomnia) over +11 new
// pending-verification clinical sources; every citation was NCBI-verified via
// efetch before file authoring (batch-30 lesson institutionalized);
// extensor-digitorum-brevis-strain deferred on evidence-ground zero-record
// screening (camptodactyly precedent).
// Batch 31 (2026-09-23): +5 pending-verification relationships across 4 authored
// identities (erythroplasia-of-queyrat->squamous-cell-carcinoma,
// erythropoietic-protoporphyria->cholelithiasis and ->chronic-liver-disease,
// esophageal-stricture->dysphagia DIRECT_CAUSATION and esophagitis->esophageal-stricture
// DIRECT_CAUSATION) over +9 new pending-verification clinical sources (the Levy 2025
// registry shared across both EPP edges, so live uses rose by 14); every citation was
// NCBI-verified via efetch before file authoring (batch-30 lesson institutionalized);
// euthyroid-sick-syndrome deferred on manifestation-identity grounds.
if (srcById.size !== 682) fail(`Expected 682 source entities including lineage, found ${srcById.size}.`);

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

if (published !== 140 || draft !== 673) fail(`Publication-state drift: published=${published}, draft=${draft}`);
if (relationshipCount !== 500) fail(`Relationship count drift: ${relationshipCount}`);
// D1 batch 5 (2026-09-22): 4 draft-quarantined edges (blindness -> depressive-disorder,
// bone-cysts and bone-tumors -> malunion-nonunion-of-fractures, brain-cancer -> seizure-disorder
// as the batches' first DIRECT_CAUSATION draft), 7 new pending-verification clinical sources.
if (referenceUses !== 746 || verifiedTrue !== 380 || verifiedFalse !== 366  /* batch 34 (2026-09-23): +9 unverified clinical reference uses (3 new edges over 9 new sources) */  /* batch 32 (2026-09-23): +11 unverified clinical reference uses (4 new edges over 11 new sources) */  /* batch 31 (2026-09-23): +14 unverified clinical reference uses (5 new edges over 9 new sources, the Levy registry shared across both EPP edges) */) fail(`Reference state drift: uses=${referenceUses}, verified=${verifiedTrue}, unverified=${verifiedFalse}`);
if (clinicalUses !== 741 || legalUses !== 5) fail(`Reference scope drift: clinical=${clinicalUses}, legal=${legalUses}`);

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
  active: 346,
  "pending-verification": 327,  /* batch 34 (2026-09-23): +9 pending-verification sources */
  "superseded-unverified": 7,
  "bibliographic-correction-only": 1,
  "retired-only": 1,
};
if (Object.entries(expectedStatuses).some(([key, value]) => (statusCounts[key] || 0) !== value) ||
    Object.keys(statusCounts).some((key) => !(key in expectedStatuses))) {
  fail(`Source status counts mismatch: ${JSON.stringify(statusCounts)}`);
}
if (activeClinical !== 345 || pendingClinical !== 327 || activeLegal !== 1) {
  fail(`Source kind counts mismatch: activeClinical=${activeClinical}, pendingClinical=${pendingClinical}, activeLegal=${activeLegal}`);
}
if (retiredVerifiedUses !== 6) fail(`Retired verified relationship-source uses mismatch: ${retiredVerifiedUses}`);

const legacyCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "legacy-rationale-boundary").length;
const explicitCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "explicit").length;
if (legacyCount !== 74 || explicitCount !== 426) fail(`Publication guard counts mismatch: legacy=${legacyCount}, explicit=${explicitCount}`);

const expectedRelCounts = { relationships: 500, explicitPublicationGuards: 426, legacyRationaleBoundaries: 74 }  /* batch 34 (2026-09-23): +3 relationships (femoral-neuropathy->unexplained-chronic-pain, fitz-hugh-curtis-syndrome->female-infertility, flatfoot->osteoarthritis) */  /* batch 32 (2026-09-23): +4 relationships (excoriation-disorder->scars, factitious-disorder->scars, exophthalmos->keratitis, exploding-head-syndrome->insomnia) */  /* batch 31 (2026-09-23): +5 relationships (erythroplasia-of-queyrat->squamous-cell-carcinoma, erythropoietic-protoporphyria->cholelithiasis, erythropoietic-protoporphyria->chronic-liver-disease, esophageal-stricture->dysphagia, esophagitis->esophageal-stricture) */  /* batch 30 (2026-09-23): +4 relationships (episcleritis->insomnia, episcleritis->unexplained-chronic-pain, erythromelalgia->insomnia, erythromelalgia->unexplained-chronic-pain) */;
if (JSON.stringify(relRegistry.counts) !== JSON.stringify(expectedRelCounts)) fail(`Relationship registry count metadata mismatch: ${JSON.stringify(relRegistry.counts)}`);

const expectedSourceCounts = {  /* batch 34 (2026-09-23): +3 relationships, +9 pending-verification sources, +9 live uses */  /* batch 32 (2026-09-23): +4 relationships, +11 pending-verification sources, +11 live uses */  /* batch 31 (2026-09-23): +5 relationships, +9 pending-verification sources, +14 live uses (registry shared across EPP edges) */
  liveSourceReferenceUses: 746,
  activeSourceEntities: 346,    pendingVerificationSourceEntities: 327,
  activeClinicalSourceEntities: 345,
  pendingClinicalSourceEntities: 327,
  activeLegalAuthorityEntities: 1,
  retiredOnlySourceEntities: 1,
  supersededUnverifiedSourceEntities: 7,
  bibliographicCorrectionOnlyEntities: 1,
  totalSourceEntitiesIncludingLineage: 682,
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
