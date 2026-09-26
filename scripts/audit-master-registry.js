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
// Batch 42 (2026-09-24): +7 pending-verification relationships across 4 authored
// identities (hallux-valgus->metatarsalgia, hallux-valgus->unexplained-chronic-pain,
// hammertoe->unexplained-chronic-pain, halo-nevus->vitiligo,
// hashimoto-s-encephalopathy->seizure-disorder, ->cognitive-disorder,
// ->depressive-disorder), 17 new pending-verification clinical sources.
// Batch 41 (2026-09-24): +3 pending-verification relationships across 3 authored
// identities (hairy-cell-leukemia->anemia, guyon-s-canal-syndrome->muscle-atrophy
// DIRECT_CAUSATION, halitosis->depressive-disorder) over +9 new pending-verification
// clinical sources; every citation was NCBI-verified via efetch before file authoring
// (13/13, eleventh consecutive clean cycle); 2 deferrals (hairy-tongue - benign finding
// zero-record with smoking shared-driver, hallux-rigidus - constitutive site-specific
// OA identity with wrong-target gait outcomes and gait counter-evidence).
// Batch 40 (2026-09-23): +5 pending-verification relationships across 3 authored
// identities (granulomatosis-with-polyangiitis->chronic-kidney-disease
// DIRECT_CAUSATION and ->hearing-loss, guillain-barre-syndrome->unexplained-chronic-pain
// and ->depressive-disorder, greater-trochanteric-pain-syndrome->unexplained-chronic-pain)
// over +14 new pending-verification clinical sources (PMID 39687605 shared across both
// GBS edges and deduped by lockstep); every citation was NCBI-verified via efetch
// before file authoring (14/14, tenth consecutive clean cycle); 2 deferrals
// (granulomatous-disease - class umbrella, granulomatous-rhinitis - finding-level
// direction-reversed with chronic-rhinitis duplicate scope).
// Batch 39 (2026-09-23): +3 pending-verification relationships across 2 authored
// identities (glucagonoma->diabetes-mellitus DIRECT_CAUSATION and
// ->malnutrition-residuals, goodpasture-syndrome->chronic-kidney-disease
// DIRECT_CAUSATION) over +7 new pending-verification clinical sources; every
// citation was NCBI-verified via efetch before file authoring (7/7, ninth
// consecutive clean cycle); 3 deferrals (glossitis - oral-candidiasis/subtype
// identity ownership, goiter - nontoxic-thyroid-enlargement synonym scope,
// granuloma-annulare - direction-inverted diabetes/hyperlipidemia association).
// Batch 38 (2026-09-23): +5 pending-verification relationships across 4 authored
// identities (giant-cell-myocarditis->congestive-heart-failure DIRECT_CAUSATION and
// ->cardiac-arrhythmia, gingivitis->periodontitis, glaucoma->visual-impairment,
// glomus-tumor->unexplained-chronic-pain) over +15 new pending-verification clinical
// sources; every citation was NCBI-verified via efetch before file authoring (15/15,
// eighth consecutive clean cycle); 1 deferral (gigantism - zero-record outcome
// quantification with acromegaly pathway ownership).
// Batch 37 (2026-09-23): +4 pending-verification relationships across 2 authored
// identities (gastrointestinal-stromal-tumors->anemia, ->malnutrition-residuals,
// ->depressive-disorder; genitofemoral-nerve-neuralgia->unexplained-chronic-pain)
// over +12 new pending-verification clinical sources; every citation was
// NCBI-verified via efetch before file authoring (12/12, seventh consecutive
// clean cycle); 3 deferrals (gastrointestinal-cancers class/duplicate-scope,
// geographic-tongue synonym duplicate of benign-migratory-glossitis,
// gerstmann-s-syndrome direction-reversed/constitutive).
// Batch 36 (2026-09-23): +6 pending-verification relationships across 5 authored
// identities (fungal-skin-infection->cellulitis portal-of-entry edge,
// gamekeeper-s-thumb->osteoarthritis post-traumatic edge,
// ganglion-cysts->carpal-tunnel-syndrome mass-effect edge,
// gastrinoma->peptic-ulcer-disease DIRECT_CAUSATION,
// gastritis->peptic-ulcer-disease DIRECT_CAUSATION and ->anemia association)
// over +18 new pending-verification clinical sources; every citation was
// NCBI-verified via efetch before file authoring (batch-30 lesson institutionalized);
// no deferrals in this batch.
// Batch 35 (2026-09-23): +5 pending-verification relationships across 4 authored
// identities (flexor-hallucis-longus-tendinitis->unexplained-chronic-pain
// case-matching edge, fournier-s-gangrene->scars reconstruction-pathway edge,
// freiberg-s-infraction->osteoarthritis on the avascular-necrosis precedent,
// frontal-fibrosizing-alopecia->loss-of-eyebrow and ->depressive-disorder) over
// +15 new pending-verification clinical sources; every citation was NCBI-verified
// via efetch before file authoring (batch-30 lesson institutionalized); fregoli-syndrome
// deferred on directionality and zero-record outcome grounds.
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
// Batch 50 (2026-09-24): +6 relationships across all 5 screened identities over +13 new
// pending-verification clinical sources (no reuse and no sharing, so every new live use adds a
// source entity); each reference was NCBI-verified via efetch before file authoring, and the
// batch recorded no deferrals because every identity was retained with at least one window.
// Batch 52 (2026-09-24): +5 relationships over +10 new pending-verification clinical sources and
// +10 live uses (no reuse and no sharing, so every new use adds an entity); every reference was
// NCBI-verified via esummary before file authoring, and laryngospasm (direction-inversion,
// procedure-context, magnitude) and leukemia (class/umbrella duplicate-scope) were deferred with
// no edges authored.
// Batch 51 (2026-09-24): +3 relationships over +5 new pending-verification clinical sources and
// +6 live uses (PMID 28242264 reused verified:true at the knee-disarticulation level per the
// amputation-level phantom-limb family precedent, so it adds a use without adding an entity);
// every reference was NCBI-verified via efetch before file authoring, and laryngitis (self-limited
// course, synonym/parallel-pathway) and laryngocele (magnitude, wrong-target, direction) were
// deferred with no edges authored.
if (srcById.size !== 1166) fail(`Expected 1166 source entities including lineage, found ${srcById.size}.`);  /* batch 69 (2026-09-26): +17 source entities (8 new edges over 17 new sources; pmid-34094530 shared across the paraganglioma hearing-loss and cranial-nerve-palsy edges and pmid-42661256 shared across the two patent-ductus-arteriosus edges) */  /* batch 68 (2026-09-26): +6 source entities (2 new edges over 6 new sources, no reuse or sharing) */  /* batch 67 (2026-09-26): +10 source entities (6 new edges over 10 new sources; PMIDs 41174987 and 35878633 each shared across two otosclerosis edges) */  /* batch 66 (2026-09-26): +16 source entities (10 new edges over 16 new sources; PMIDs 41862928 and 41914550 each shared across two oral-cancer edges) */  /* batch 65 (2026-09-26): +11 source entities (8 new edges over 11 new sources; PMIDs 41657358 shared across three normal-pressure-hydrocephalus edges, 26810545 and 41936711 each shared across two, and 27939179 and 17071625 each shared across the two nocturnal-enuresis edges) */  /* batch 64 (2026-09-26): +14 source entities (7 new edges over 14 new sources; PMIDs 28801367 and 34197634 each shared across the two neuroblastoma cytopenia edges) */  /* batch 63 (2026-09-26): +15 source entities (10 new edges over 15 new sources; PMID 27238425 shared across the two necrobiotic-xanthogranuloma edges, 34979093 shared across the four nephrosis thromboembolic edges, 42298988 shared across the nephrosis stroke and myocardial-infarction edges, and 40043694 shared across the nephrosis deep-vein-thrombosis and chronic-kidney-disease edges) */  /* batch 62 (2026-09-26): +21 source entities (11 new edges over 21 new sources; PMID 32347918 shared across all four myopia edges and 35188078 shared across the retinal-detachment and macular-degeneration edges) */  /* batch 61 (2026-09-26): +27 source entities (12 new edges over 27 new sources; PMIDs 42314414, 41834593, 40607214, 28605116, 42272368, and 33649917 each shared across sibling edges) */  /* batch 60 (2026-09-26): +21 source entities (12 new edges over 21 new sources; PMIDs 40887784 and 37868436 each shared across the menetrier-s-disease edges, 32340774 shared across the microscopic-polyangiitis renal/neurologic/pulmonary edges, and 32710780 shared across the microscopic-colitis cancer edges) */  /* batch 59 (2026-09-26): +26 source entities (12 new edges over 26 new sources; PMIDs 42223618 shared across the mastoiditis meningitis and brain-abscess edges, 36620810 shared across the marantic-endocarditis myocardial-infarction and pulmonary-embolism edges) */  /* batch 58 (2026-09-25): +19 source entities (11 new edges over 19 new sources; PMIDs 40283381, 41161993, and 38193299 each shared across sibling edges) */  /* batch 57 (2026-09-25): +22 source entities (8 new edges over 22 new sources, no reuse or sharing) */  /* batch 56 (2026-09-25): +11 source entities (5 new edges over 11 new sources) */  /* batch 55 (2026-09-25): +17 source entities (8 new edges over 17 new sources) */  /* batch 54 (2026-09-25): +10 source entities (6 new edges over 10 new sources) */

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
// D1 batch 43 (2026-09-24): +8 relationships (hearing-loss->cognitive-disorder,
// hearing-loss->depressive-disorder, heart-block->cardiomyopathy,
// heart-valve-disorders->congestive-heart-failure as the batch's DIRECT_CAUSATION edge,
// heart-valve-disorders->cardiac-inflammatory-disease, hemangioma->congestive-heart-failure,
// hemangioma->hypothyroidism, hemipelvectomy->phantom-limb-pain); 2 deferrals screened
// without relationships.
// D1 batch 50 (2026-09-24): +6 relationships (keratitis->corneal-scarring,
// kienbock-s-disease->osteoarthritis, kaposi-s-sarcoma->lymphedema,
// kaposi-s-sarcoma->cellulitis, keloids->depressive-disorder, katayama-fever->urticaria);
// all five identities were retained with at least one window, so no deferrals in this batch.
// D1 batch 51 (2026-09-24): +3 relationships (knee-disarticulation->phantom-limb-pain,
// labyrinthitis->hearing-loss, laryngeal-stenosis->sleep-apnea); laryngitis (self-limited course and
// synonym/parallel-pathway) and laryngocele (magnitude, wrong-target, direction) were deferred
// without relationships.
// D1 batch 52 (2026-09-24): +5 relationships (laryngomalacia->sleep-apnea, laryngomalacia->dysphagia,
// legg-calve-perthes-disease->osteoarthritis, leishmaniasis->anemia, leishmaniasis->thrombocytopenia);
// laryngospasm (direction-inversion, procedure-context, magnitude) and leukemia (class/umbrella
// duplicate-scope) were deferred without relationships.
if (relationshipCount !== 732) fail(`Relationship count drift: ${relationshipCount}`);  /* batch 69 (2026-09-26): +8 relationships (paraganglioma -> hearing-loss, -> tinnitus, -> cranial-nerve-palsy, -> hypertension; patent-ductus-arteriosus -> pulmonary-hypertension, -> congestive-heart-failure; perforated-eardrum -> conductive-hearing-loss; patellar-subluxation -> patellofemoral-pain-syndrome; paraphimosis deferred on zero quantified secondary outcomes plus no-identity complications (gangrene, penile necrosis, urinary obstruction) plus direction-inversion on the phimosis family (phimosis predisposes to paraphimosis; balanitis window owns its evidence) plus case-report/animal-series literature class; withheld: paraganglioma -> conductive-hearing-loss on identity-duplication with the umbrella hearing-loss edge, -> diabetes-mellitus and -> osteoporosis below threshold on PPGL-pooled evidence owned by the pheochromocytoma family (ME-29); patent-ductus-arteriosus -> bronchopulmonary-dysplasia, -> necrotizing-enterocolitis, -> infective-endocarditis withheld propositions with no catalog identities, -> hypertension on prematurity shared-substrate; perforated-eardrum -> hearing-loss and -> tinnitus on CSOM shared-substrate plus chain-triangle duplication of the conductive-hearing-loss-to-tinnitus chain, -> dizziness CSOM-scoped; patellar-subluxation -> osteoarthritis below threshold (StatPearls narrative only) and -> tendinopathy on shared-substrate with the osgood-schlatter window) */  /* batch 68 (2026-09-26): +2 relationships (overactive-bladder->depressive-disorder, papilledema->visual-impairment; overflow-incontinence deferred on shared-substrate with the retention/obstruction/neurogenic families plus zero condition-specific outcome quantification, panner-s-disease deferred on self-limited course with favorable remodeling plus zero located secondary outcomes, paradoxical-vocal-fold-motion deferred on direction-inversion dominance (anxiety/depression predate ILO evaluation) plus diagnostic-mimicry/comorbidity asthma framing plus no-identity voice outcomes; overactive-bladder->urinary-incontinence withheld as constitutive (wet subtype and symptom-domain overlap), ->insomnia withheld below threshold on conflicting surveys, ->anxiety-disorder withheld on reverse-direction (batch-61 mixed-urinary-incontinence family precedent), ->obstructive-sleep-apnea withheld on direction-inversion, and OAB suicidal ideation recorded as a withheld proposition with no catalog identity (third refusal after batches 64 and 65); papilledema->optic-atrophy withheld as intermediate-pathway chain-triangle duplication of the batch-66 optic-atrophy window, ->cranial-nerve-palsy withheld as shared raised-ICP substrate, ->headaches withheld with no generic identity) */  /* batch 67 (2026-09-26): +6 relationships (osgood-schlatter-disease->tendinopathy, otitis-externa->cranial-nerve-palsy, otosclerosis->conductive-hearing-loss, otosclerosis->tinnitus, otosclerosis->hearing-loss, ovarian-cysts->menstrual-disorders; osteopenia deferred on severity-continuum identity-duplication with osteoporosis plus no-identity fragility-fracture outcomes and zero stress-fracture quantification; osgood-schlatter->osteoarthritis and ->patellofemoral-pain-syndrome withheld on zero quantification and parallel-phenotype grounds with persistence features withheld as constitutive; otitis-externa->hearing-loss withheld below threshold (single necrotizing-subtype cohort) and ->tinnitus withheld as skull-base-osteomyelitis manifestation; otosclerosis->dizziness withheld on post-stapedotomy-transient and contested-hydrops grounds with the tinnitus triangle and the conductive-hearing-loss window's otosclerosis-anchored provenance recorded for the CRG semantics follow-up; ovarian-cysts->ovarian-cancer withheld below threshold with endometrioma risk owned by the endometriosis window (ME-29), ->chronic-pelvic-pain-syndrome withheld on shared-substrate grounds, and torsion/rupture/infertility withheld propositions with no catalog identities) */  /* batch 66 (2026-09-26): +10 relationships (optic-atrophy->visual-impairment, oral-cancer->dysphagia, oral-cancer->ageusia, oral-cancer->oral-candidiasis, oral-cancer->hearing-loss, oral-cancer->hypothyroidism, oral-cancer->depressive-disorder, oral-candidiasis->ageusia, orthostatic-hypotension->dizziness, orthostatic-hypotension->cognitive-disorder; oral-hairy-leukoplakia deferred on direction-inversion (HIV->OHL sentinel evidence), shared-substrate (candidiasis coinfection), and no-located-downstream-outcome grounds; oral-cancer->malnutrition-residuals withheld as intermediate-chain duplication of the registered dysphagia and ageusia malnutrition windows (ME-28/ME-29), oral-cancer xerostomia/trismus/speech-disorder/osteoradionecrosis withheld as withheld propositions with no catalog identities, oral-cancer->head-and-neck-cancers withheld on umbrella identity-duplication (batch-42 deferral), optic-atrophy->color-blindness withheld on semantic-mismatch plus constitutive-proximity, optic-atrophy->blindness withheld on identity-duplication, oral-candidiasis->dysphagia withheld on esophageal-extension intermediate with no catalog identity, orthostatic-hypotension->falls and ->syncope withheld as withheld propositions / vasovagal semantic-mismatch, orthostatic-hypotension->visual-impairment withheld on ME-29 sibling-window discipline with the hypotension visual-impairment window) */  /* batch 65 (2026-09-26): +8 relationships (normal-pressure-hydrocephalus->depressive-disorder, normal-pressure-hydrocephalus->apathy, normal-pressure-hydrocephalus->anxiety-disorder, normal-pressure-hydrocephalus->subdural-hematoma, nutcracker-esophagus->dysphagia, nocturnal-enuresis->depressive-disorder, nocturnal-enuresis->anxiety-disorder, occipital-neuralgia->migraine-headaches; nonspecific-interstitial-pneumonia deferred on sibling-window duplication and CTD-confounding; NPH triad features withheld as constitutive with gait and falls recorded as withheld propositions with no catalog identities; nutcracker->gerd withheld on counterweight evidence; occipital-neuralgia->unexplained-chronic-pain withheld on semantic-mismatch) */  /* batch 64 (2026-09-26): +7 relationships (neuroblastoma->anemia, neuroblastoma->thrombocytopenia, neuroblastoma->hypertension, neuroblastoma->hearing-loss, neuroblastoma->cardiomyopathy, neuroblastoma->visual-impairment, nightmare-disorder->depressive-disorder; neurobehavioral-effects, neurocognitive-disorders, and night-blindness deferred on constitutive/umbrella-manifestation identity-duplication grounds; nightmare-disorder->suicidal-ideation refused with no catalog identity and recorded as a withheld proposition, nightmare-disorder->insomnia withheld on direction grounds, neuroblastoma->opsoclonus-myoclonus-ataxia recorded as a withheld proposition with no catalog identity) */  /* batch 63 (2026-09-26): +10 relationships (nasal-valve-collapse->sleep-apnea, necrobiosis-lipoidica->squamous-cell-carcinoma, necrobiotic-xanthogranuloma->multiple-myeloma, necrobiotic-xanthogranuloma->visual-impairment, nephritis->chronic-kidney-disease, nephrosis->deep-vein-thrombosis, nephrosis->pulmonary-embolism, nephrosis->cerebrovascular-accident-stroke-residuals, nephrosis->myocardial-infarction, nephrosis->chronic-kidney-disease; no deferrals this batch - nephritis->hypertension withheld on direction-inversion, nephritis->anemia and nephrosis->anemia withheld on zero quantification, nephrosis->proteinuria and edema withheld as constitutive, nephrobiotic-xanthogranuloma->non-hodgkins-lymphoma withheld on comorbidity-only class, necrobiosis-lipoidica->cellulitis withheld on zero quantification, and nephrosis bleeding recorded as a withheld proposition with no catalog identity) */  /* batch 62 (2026-09-26): +11 relationships (muscular-dystrophy->contractures, muscular-dystrophy->scoliosis, muscular-dystrophy->cardiomyopathy, muscular-dystrophy->sleep-apnea, muscular-dystrophy->dysphagia, muscular-dystrophy->osteoporosis, myopia->retinal-detachment, myopia->macular-degeneration, myopia->glaucoma, myopia->cataracts, muscle-hernias->peripheral-neuropathy; muscle-atrophy and myxedema-coma deferred without edges - manifestation-identity/direction-inversion and constitutive-feature-set/identity-duplication; muscular-dystrophy->congestive-heart-failure and ->cardiac-arrhythmia withheld as intermediate-node, myopia->visual-impairment withheld on constitutive/intermediate dual guard, muscle-hernias->unexplained-chronic-pain withheld on semantic-mismatch) */  /* batch 61 (2026-09-26): +12 relationships (miscarriage->depressive-disorder, miscarriage->anxiety-disorder, miscarriage->female-infertility, mixed-urinary-incontinence->depressive-disorder, morton-s-neuroma->metatarsalgia, mucocele->sialadenitis, multiple-endocrine-neoplasia->hyperparathyroidism, multiple-endocrine-neoplasia->pituitary-neoplasm, multiple-endocrine-neoplasia->pheochromocytoma, multiple-endocrine-neoplasia->thyroid-cancer, multiple-endocrine-neoplasia->gastrinoma, multiple-endocrine-neoplasia->insulinoma; miscarriage->self-harm and miscarriage->postpartum-depression withheld with no catalog identity, mixed-urinary-incontinence->anxiety-disorder withheld on reverse-direction, morton-s-neuroma->unexplained-chronic-pain withheld on semantic-mismatch, mucocele->dysphagia withheld on no condition-specific quantification, and MEN hormone-consequence edges withheld as intermediate-node per ME-29) */  /* batch 60 (2026-09-26): +12 relationships (median-rhomboid-glossitis->squamous-cell-carcinoma, memory-loss->depressive-disorder, menetrier-s-disease->anemia, menetrier-s-disease->malnutrition-residuals, menetrier-s-disease->stomach-cancer, microscopic-colitis->malnutrition-residuals, microscopic-colitis->non-hodgkins-lymphoma, microscopic-colitis->respiratory-cancer, microscopic-polyangiitis->chronic-kidney-disease, microscopic-polyangiitis->interstitial-lung-disease, microscopic-polyangiitis->peripheral-neuropathy, microscopic-polyangiitis->deep-vein-thrombosis; microscopic-colitis->anemia withheld on celiac-comorbidity and microscopic-colitis->colorectal-cancer withheld as direction-inverted (protective), memory-loss->dementia withheld on prodromal-overlap, median-rhomboid-glossitis->oral-candidiasis withheld as constitutive) */  /* batch 59 (2026-09-26): +12 relationships (malocclusion->sleep-apnea, malocclusion->dysphagia, malunion-nonunion-of-fractures->post-traumatic-osteoarthritis, marantic-endocarditis->cerebrovascular-accident-stroke-residuals, marantic-endocarditis->myocardial-infarction, marantic-endocarditis->pulmonary-embolism, mastoiditis->meningitis, mastoiditis->brain-abscess, mastoiditis->labyrinthitis, meatal-stenosis->hydronephrosis, meatal-stenosis->urinary-frequency-retention, meatal-stenosis->cystitis; malocclusion->tmj-disorder, mastoiditis->hearing-loss, and malunion->unexplained-chronic-pain withheld on duplicate-scope, diagnostic-mimic, and semantic-mismatch grounds) */  /* batch 58 (2026-09-25): +11 relationships */  /* batch 57 (2026-09-25): +8 relationships */  /* batch 56 (2026-09-25): +5 relationships */  /* batch 55 (2026-09-25): +8 relationships */  /* batch 54 (2026-09-25): +6 relationships */
// D1 batch 5 (2026-09-22): 4 draft-quarantined edges (blindness -> depressive-disorder,
// bone-cysts and bone-tumors -> malunion-nonunion-of-fractures, brain-cancer -> seizure-disorder
// as the batches' first DIRECT_CAUSATION draft), 7 new pending-verification clinical sources.
// D1 batch 43 (2026-09-24): +16 reference uses across 8 new edges (one verified-source reuse:
// PMID 34583023 is carried verified:true from the existing per-site phantom-limb-pain edges
// and adds a use without adding a source entity; the remaining 15 uses are unverified
// authored-as-false refs over 15 new pending-verification sources).
if (referenceUses !== 1298 || verifiedTrue !== 383 || verifiedFalse !== 915  /* batch 69 (2026-09-26): +19 unverified clinical reference uses (8 new edges over 17 new sources, 2 sources shared within batch) */  /* batch 68 (2026-09-26): +6 unverified clinical reference uses (2 new edges over 6 new sources, no reuse or sharing) */  /* batch 67 (2026-09-26): +12 unverified clinical reference uses (6 new edges over 10 new sources; PMIDs 41174987 and 35878633 each shared across two otosclerosis edges) */  /* batch 66 (2026-09-26): +18 unverified clinical reference uses (10 new edges over 16 new sources; PMIDs 41862928 and 41914550 each shared across two oral-cancer edges) */  /* batch 65 (2026-09-26): +17 unverified clinical reference uses (8 new edges over 11 new sources; PMIDs 41657358, 26810545, 41936711, 27939179, and 17071625 each shared across sibling edges) */  /* batch 64 (2026-09-26): +16 unverified clinical reference uses (7 new edges over 14 new sources; PMIDs 28801367 and 34197634 each shared across the two neuroblastoma cytopenia edges) */  /* batch 63 (2026-09-26): +22 unverified clinical reference uses (10 new edges over 15 new sources; PMIDs 27238425, 34979093, 42298988, and 40043694 each shared across sibling edges) */  /* batch 62 (2026-09-26): +25 unverified clinical reference uses (11 new edges over 21 new sources; PMID 32347918 shared across all four myopia edges and 35188078 shared across the retinal-detachment and macular-degeneration edges) */  /* batch 61 (2026-09-26): +35 unverified clinical reference uses (12 new edges over 27 new sources; PMIDs 42314414 shared across the two miscarriage mood edges, 41834593 and 40607214 each shared across three multiple-endocrine-neoplasia edges, 28605116 and 42272368 each shared across the pheochromocytoma and thyroid-cancer edges, and 33649917 shared across the gastrinoma and insulinoma edges) */  /* batch 60 (2026-09-26): +27 unverified clinical reference uses (12 new edges over 21 new sources; PMIDs 40887784, 37868436, 32340774, and 32710780 each shared within their identity) */  /* batch 59 (2026-09-26): +28 unverified clinical reference uses (12 new edges over 26 new sources; PMIDs 42223618 and 36620810 each shared across sibling edges) */  /* batch 58 (2026-09-25): +22 unverified clinical reference uses (11 new edges over 19 new sources; PMIDs 40283381 shared across the malabsorption neuropathy and anemia edges, 41161993 across the malabsorption and malnutrition neuropathy edges, and 38193299 across the malnutrition anemia and neuropathy edges) */  /* batch 57 (2026-09-25): +22 unverified clinical reference uses (8 new edges over 22 new sources, no reuse or sharing) */  /* batch 56 (2026-09-25): +11 unverified clinical reference uses (5 new edges over 11 new sources, no reuse or sharing) */  /* batch 55 (2026-09-25): +22 unverified clinical reference uses (8 new edges over 17 new sources; PMID 42339155 shared across three liver-abscess edges, 36130707 shared across the lung-abscess and pleural-effusion edges, and 42425179 shared across the two loeffler-s-endocarditis edges) */  /* batch 54 (2026-09-25): +14 unverified clinical reference uses (6 new edges over 10 new sources; PMIDs 42241023 and 21234343 shared across the two linear-iga edges, 32451884 and 7773510 shared across the two lipoid-pneumonia edges) */  /* batch 53 (2026-09-25): +23 unverified clinical reference uses (9 new edges over 18 new sources; PMIDs 38982032 shared across the two lichen-planus edges, 30970367 and 39152785 shared across the two lichen-planopilaris edges, and 33034929 and 39812844 shared across the two lichen-simplex-chronicus edges) */  /* batch 52 (2026-09-24): +10 unverified clinical reference uses (5 new edges over 10 new sources, no reuse or sharing) */  /* batch 51 (2026-09-24): +6 clinical reference uses (3 new edges over 5 new sources; PMID 28242264 carried verified:true from the amputation-level phantom-limb-pain family, so 5 new unverified uses) */  /* batch 49 (2026-09-24): +8 unverified clinical reference uses (4 new edges over 8 new sources, no reuse or sharing) */  /* batch 48 (2026-09-24): +8 unverified clinical reference uses (4 new edges over 8 new sources, no reuse or sharing) */  /* batch 47 (2026-09-24): +12 unverified clinical reference uses (6 new edges over 12 new sources, no reuse or sharing) */  /* batch 46 (2026-09-24): +8 unverified clinical reference uses (4 new edges over 8 new sources) */  /* batch 45 (2026-09-24): +6 clinical reference uses and +1 verified-source reuse (PMID 28242264 carried verified:true from the ankle-disarticulation phantom-limb-pain edge, so 5 new sources and +5 unverified uses) */  /* batch 44 (2026-09-24): +12 unverified clinical reference uses (6 new edges over 12 new sources) */  /* batch 42 (2026-09-24): +21 unverified clinical reference uses (7 new edges over 17 new sources, PMIDs 41093741 and 19052445 shared across hallux-valgus edges and 39154259 and 32173161 shared across hashimoto-s-encephalopathy edges) */  /* batch 41 (2026-09-24): +9 unverified clinical reference uses (3 new edges over 9 new sources) */  /* batch 40 (2026-09-23): +15 unverified clinical reference uses (5 new edges over 14 new sources, PMID 39687605 shared) */  /* batch 39 (2026-09-23): +9 unverified clinical reference uses (3 new edges over 7 new sources) */  /* batch 38 (2026-09-23): +15 unverified clinical reference uses (5 new edges over 15 new sources) */  /* batch 37 (2026-09-23): +12 unverified clinical reference uses (4 new edges over 12 new sources) */  /* batch 36 (2026-09-23): +18 unverified clinical reference uses (6 new edges over 18 new sources) */  /* batch 35 (2026-09-23): +15 unverified clinical reference uses (5 new edges over 15 new sources) */  /* batch 34 (2026-09-23): +9 unverified clinical reference uses (3 new edges over 9 new sources) */  /* batch 32 (2026-09-23): +11 unverified clinical reference uses (4 new edges over 11 new sources) */  /* batch 31 (2026-09-23): +14 unverified clinical reference uses (5 new edges over 9 new sources, the Levy registry shared across both EPP edges) */) fail(`Reference state drift: uses=${referenceUses}, verified=${verifiedTrue}, unverified=${verifiedFalse}`);
if (clinicalUses !== 1293 || legalUses !== 5)  /* batch 69 (2026-09-26): +19 */  /* batch 68 (2026-09-26): +6 */  /* batch 67 (2026-09-26): +12 */  /* batch 66 (2026-09-26): +18 */  /* batch 65 (2026-09-26): +17 */  /* batch 64 (2026-09-26): +16 */  /* batch 63 (2026-09-26): +22 */  /* batch 62 (2026-09-26): +25 */  /* batch 61 (2026-09-26): +35 */  /* batch 60 (2026-09-26): +27 */  /* batch 59 (2026-09-26): +28 */  /* batch 58 (2026-09-25): +22 clinical reference uses */  /* batch 57 (2026-09-25): +22 clinical reference uses */  /* batch 56 (2026-09-25): +11 clinical reference uses */ fail(`Reference scope drift: clinical=${clinicalUses}, legal=${legalUses}`);  /* batch 55 (2026-09-25): +22 clinical reference uses */  /* batch 54 (2026-09-25): +14 clinical reference uses */

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
  "pending-verification": 811,  /* batch 69 (2026-09-26): +17 pending-verification sources */  /* batch 68 (2026-09-26): +6 pending-verification sources */  /* batch 67 (2026-09-26): +10 pending-verification sources */  /* batch 66 (2026-09-26): +16 pending-verification sources */  /* batch 65 (2026-09-26): +11 pending-verification sources */  /* batch 64 (2026-09-26): +14 pending-verification sources */  /* batch 63 (2026-09-26): +15 pending-verification sources */  /* batch 62 (2026-09-26): +21 pending-verification sources */  /* batch 61 (2026-09-26): +27 pending-verification sources */  /* batch 60 (2026-09-26): +21 pending-verification sources */  /* batch 59 (2026-09-26): +26 pending-verification sources */  /* batch 58 (2026-09-25): +19 pending-verification sources */  /* batch 57 (2026-09-25): +22 pending-verification sources */  /* batch 56 (2026-09-25): +11 pending-verification sources */  /* batch 55 (2026-09-25): +17 pending-verification sources */  /* batch 54 (2026-09-25): +10 pending-verification sources */  /* batch 53 (2026-09-25): +18 pending-verification sources */  /* batch 52 (2026-09-24): +10 pending-verification sources */  /* batch 51 (2026-09-24): +5 pending-verification sources */  /* batch 50 (2026-09-24): +13 pending-verification sources */  /* batch 49 (2026-09-24): +8 pending-verification sources */  /* batch 48 (2026-09-24): +8 pending-verification sources */  /* batch 47 (2026-09-24): +12 pending-verification sources */  /* batch 46 (2026-09-24): +8 pending-verification sources */  /* batch 45 (2026-09-24): +5 pending-verification sources */  /* batch 44 (2026-09-24): +12 pending-verification sources */  /* batch 43 (2026-09-24): +15 pending-verification sources */  /* batch 42 (2026-09-24): +17 pending-verification sources */  /* batch 41 (2026-09-24): +9 pending-verification sources */  /* batch 40 (2026-09-23): +14 pending-verification sources */  /* batch 39 (2026-09-23): +7 pending-verification sources */  /* batch 38 (2026-09-23): +15 pending-verification sources */  /* batch 37 (2026-09-23): +12 pending-verification sources */  /* batch 36 (2026-09-23): +18 pending-verification sources */  /* batch 35 (2026-09-23): +15 pending-verification sources */  /* batch 34 (2026-09-23): +9 pending-verification sources */
  "superseded-unverified": 7,
  "bibliographic-correction-only": 1,
  "retired-only": 1,
};
if (Object.entries(expectedStatuses).some(([key, value]) => (statusCounts[key] || 0) !== value) ||
    Object.keys(statusCounts).some((key) => !(key in expectedStatuses))) {
  fail(`Source status counts mismatch: ${JSON.stringify(statusCounts)}`);
}
if (activeClinical !== 345 || pendingClinical !== 811 || activeLegal !== 1) {  /* batch 69 (2026-09-26): +17 pending-verification sources */  /* batch 68 (2026-09-26): +6 pending-verification sources */  /* batch 67 (2026-09-26): +10 pending-verification sources */  /* batch 66 (2026-09-26): +16 pending-verification sources */  /* batch 65 (2026-09-26): +11 pending-verification sources */  /* batch 64 (2026-09-26): +14 pending-verification sources */  /* batch 63 (2026-09-26): +15 pending-verification sources */  /* batch 62 (2026-09-26): +21 pending-verification sources */  /* batch 61 (2026-09-26): +27 pending-verification sources */  /* batch 60 (2026-09-26): +21 pending-verification sources */  /* batch 59 (2026-09-26): +26 pending-verification sources */  /* batch 58 (2026-09-25): +19 pendingClinical */  /* batch 57 (2026-09-25): +22 pendingClinical */  /* batch 56 (2026-09-25): +11 pendingClinical */  /* batch 55 (2026-09-25): +17 pendingClinical */  /* batch 54 (2026-09-25): +10 pendingClinical */
  fail(`Source kind counts mismatch: activeClinical=${activeClinical}, pendingClinical=${pendingClinical}, activeLegal=${activeLegal}`);
}
if (retiredVerifiedUses !== 6) fail(`Retired verified relationship-source uses mismatch: ${retiredVerifiedUses}`);

const legacyCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "legacy-rationale-boundary").length;
const explicitCount = relRegistry.relationships.filter((r) => r.publicationGuard.status === "explicit").length;
if (legacyCount !== 74 || explicitCount !== 658)  /* batch 69 (2026-09-26): +8 explicit guards */  /* batch 68 (2026-09-26): +2 explicit guards */  /* batch 67 (2026-09-26): +6 explicit guards */  /* batch 66 (2026-09-26): +10 explicit guards */  /* batch 65 (2026-09-26): +8 explicit guards */  /* batch 64 (2026-09-26): +7 explicit guards */  /* batch 63 (2026-09-26): +10 explicit guards */  /* batch 62 (2026-09-26): +11 explicit guards */  /* batch 61 (2026-09-26): +12 explicit guards */  /* batch 60 (2026-09-26): +12 explicit guards */  /* batch 59 (2026-09-26): +12 explicit guards */  /* batch 58 (2026-09-25): +11 explicit guards */  /* batch 57 (2026-09-25): +8 explicit guards */  /* batch 56 (2026-09-25): +5 explicit guards */ fail(`Publication guard counts mismatch: legacy=${legacyCount}, explicit=${explicitCount}`);  /* batch 55 (2026-09-25): +8 explicit guards */  /* batch 54 (2026-09-25): +6 explicit guards */

const expectedRelCounts = { relationships: 732, explicitPublicationGuards: 658, legacyRationaleBoundaries: 74 }  /* batch 69 (2026-09-26): +8 relationships */  /* batch 68 (2026-09-26): +2 relationships */  /* batch 67 (2026-09-26): +6 relationships */  /* batch 66 (2026-09-26): +10 relationships */  /* batch 65 (2026-09-26): +8 relationships (normal-pressure-hydrocephalus->depressive-disorder, normal-pressure-hydrocephalus->apathy, normal-pressure-hydrocephalus->anxiety-disorder, normal-pressure-hydrocephalus->subdural-hematoma, nutcracker-esophagus->dysphagia, nocturnal-enuresis->depressive-disorder, nocturnal-enuresis->anxiety-disorder, occipital-neuralgia->migraine-headaches) */  /* batch 64 (2026-09-26): +7 relationships (neuroblastoma->anemia, neuroblastoma->thrombocytopenia, neuroblastoma->hypertension, neuroblastoma->hearing-loss, neuroblastoma->cardiomyopathy, neuroblastoma->visual-impairment, nightmare-disorder->depressive-disorder) */  /* batch 63 (2026-09-26): +10 relationships (nasal-valve-collapse->sleep-apnea, necrobiosis-lipoidica->squamous-cell-carcinoma, necrobiotic-xanthogranuloma->multiple-myeloma, necrobiotic-xanthogranuloma->visual-impairment, nephritis->chronic-kidney-disease, nephrosis->deep-vein-thrombosis, nephrosis->pulmonary-embolism, nephrosis->cerebrovascular-accident-stroke-residuals, nephrosis->myocardial-infarction, nephrosis->chronic-kidney-disease) */  /* batch 62 (2026-09-26): +11 relationships (muscular-dystrophy->contractures, muscular-dystrophy->scoliosis, muscular-dystrophy->cardiomyopathy, muscular-dystrophy->sleep-apnea, muscular-dystrophy->dysphagia, muscular-dystrophy->osteoporosis, myopia->retinal-detachment, myopia->macular-degeneration, myopia->glaucoma, myopia->cataracts, muscle-hernias->peripheral-neuropathy) */  /* batch 61 (2026-09-26): +12 relationships (miscarriage->depressive-disorder, miscarriage->anxiety-disorder, miscarriage->female-infertility, mixed-urinary-incontinence->depressive-disorder, morton-s-neuroma->metatarsalgia, mucocele->sialadenitis, multiple-endocrine-neoplasia->hyperparathyroidism, multiple-endocrine-neoplasia->pituitary-neoplasm, multiple-endocrine-neoplasia->pheochromocytoma, multiple-endocrine-neoplasia->thyroid-cancer, multiple-endocrine-neoplasia->gastrinoma, multiple-endocrine-neoplasia->insulinoma) */  /* batch 60 (2026-09-26): +12 relationships (median-rhomboid-glossitis->squamous-cell-carcinoma, memory-loss->depressive-disorder, menetrier-s-disease->anemia, menetrier-s-disease->malnutrition-residuals, menetrier-s-disease->stomach-cancer, microscopic-colitis->malnutrition-residuals, microscopic-colitis->non-hodgkins-lymphoma, microscopic-colitis->respiratory-cancer, microscopic-polyangiitis->chronic-kidney-disease, microscopic-polyangiitis->interstitial-lung-disease, microscopic-polyangiitis->peripheral-neuropathy, microscopic-polyangiitis->deep-vein-thrombosis; microscopic-colitis->anemia withheld on celiac-comorbidity and microscopic-colitis->colorectal-cancer withheld as direction-inverted (protective), memory-loss->dementia withheld on prodromal-overlap, median-rhomboid-glossitis->oral-candidiasis withheld as constitutive) */  /* batch 59 (2026-09-26): +12 relationships (malocclusion->sleep-apnea, malocclusion->dysphagia, malunion-nonunion-of-fractures->post-traumatic-osteoarthritis, marantic-endocarditis->cerebrovascular-accident-stroke-residuals, marantic-endocarditis->myocardial-infarction, marantic-endocarditis->pulmonary-embolism, mastoiditis->meningitis, mastoiditis->brain-abscess, mastoiditis->labyrinthitis, meatal-stenosis->hydronephrosis, meatal-stenosis->urinary-frequency-retention, meatal-stenosis->cystitis; malocclusion->tmj-disorder, mastoiditis->hearing-loss, and malunion->unexplained-chronic-pain withheld on duplicate-scope, diagnostic-mimic, and semantic-mismatch grounds) */  /* batch 58 (2026-09-25): +11 relationships (macroglossia->dysphagia, macroglossia->sleep-apnea, malabsorption-syndrome->macular-degeneration, malabsorption-syndrome->peripheral-neuropathy, malabsorption-syndrome->anemia, mallet-finger->swan-neck-deformity, mallet-finger->post-traumatic-osteoarthritis, mallet-toes->metatarsalgia, malnutrition-residuals->anemia, malnutrition-residuals->peripheral-neuropathy, malnutrition-residuals->osteoporosis; no deferrals this batch) */  /* batch 57 (2026-09-25): +8 relationships (lung-abscess->pleural-effusion, lung-abscess->pneumothorax, lymphangioleiomyomatosis->pneumothorax, lymphangioleiomyomatosis->pleural-effusion, lymphangioleiomyomatosis->pulmonary-hypertension, lupus-profundus->systemic-lupus-erythematosus, lupus-profundus->scarring-alopecia, lymphangioma->dysphagia; loss-of-use-of-extremities deferred) */  /* batch 56 (2026-09-25): +5 relationships (loss-of-eyelids->keratitis, loss-of-jaw->dysphagia, loss-of-testicle->hypogonadism, loss-of-testicle->depressive-disorder, loss-of-tongue->dysphagia; loss-of-eyelashes deferred) */  /* batch 55 (2026-09-25): +8 relationships (liver-abscess->brain-abscess, liver-abscess->meningitis, liver-abscess->lung-abscess, liver-abscess->visual-impairment, liver-abscess->pleural-effusion, loeffler-s-endocarditis->heart-valve-disorders, loeffler-s-endocarditis->cerebrovascular-accident-stroke-residuals, long-qt-syndrome->cardiac-arrhythmia; loss-of-auricle and loss-of-eyebrow deferred) */  /* batch 54 (2026-09-25): +6 relationships (linear-iga->keratitis, linear-iga->visual-impairment, lingual-neuralgia->unexplained-chronic-pain, lipoid-pneumonia->pulmonary-fibrosis, lipoid-pneumonia->bronchiectasis, livedo-reticularis->cerebrovascular-accident-stroke-residuals; limitation-of-motion deferred on outcome-container/direction-inversion grounds) */  /* batch 53 (2026-09-25): +9 relationships (levator-ani-syndrome->unexplained-chronic-pain, libman-sacks-endocarditis->cerebrovascular-accident-stroke-residuals, libman-sacks-endocarditis->heart-valve-disorders, lichen-planopilaris->depressive-disorder, lichen-planopilaris->anxiety-disorder, lichen-planus->depressive-disorder, lichen-planus->squamous-cell-carcinoma, lichen-simplex-chronicus->depressive-disorder, lichen-simplex-chronicus->anxiety-disorder) */  /* batch 52 (2026-09-24): +5 relationships (laryngomalacia->sleep-apnea, laryngomalacia->dysphagia, legg-calve-perthes-disease->osteoarthritis, leishmaniasis->anemia, leishmaniasis->thrombocytopenia) */  /* batch 51 (2026-09-24): +3 relationships (knee-disarticulation->phantom-limb-pain, labyrinthitis->hearing-loss, laryngeal-stenosis->sleep-apnea) */  /* batch 50 (2026-09-24): +6 relationships (keratitis->corneal-scarring, kienbock-s-disease->osteoarthritis, kaposi-s-sarcoma->lymphedema, kaposi-s-sarcoma->cellulitis, keloids->depressive-disorder, katayama-fever->urticaria) */  /* batch 49 (2026-09-24): +4 relationships (intracranial-injury-without-skull-fracture->epilepsy, intracranial-injury-without-skull-fracture->hypopituitarism, joint-replacement-residuals->deep-vein-thrombosis, joint-replacement-residuals->contractures) */  /* batch 48 (2026-09-24): +4 relationships (iliohypogastric-ilioinguinal-nerve-neuralgia->unexplained-chronic-pain, impetigo->nephritis, inappropriate-sinus-tachycardia->dizziness, insulinoma->hyperinsulinism) */  /* batch 47 (2026-09-24): +6 relationships (hypoglycemia->dementia, hypoglycemia->seizure-disorder, hypopituitarism->osteopenia, hypopituitarism->anemia, hypotension->visual-impairment, ichthyosis->dry-eye-syndrome) */  /* batch 46 (2026-09-24): +4 relationships (hyperinsulinism->hypoglycemia, hypertensive-retinopathy->visual-impairment, hyperopia->glaucoma, hyperhidrosis->anxiety-disorder) */  /* batch 45 (2026-09-24): +3 relationships (hip-disarticulation->phantom-limb-pain, hip-labral-tear->post-traumatic-osteoarthritis, hydrocephalus->visual-impairment) */  /* batch 44 (2026-09-24): +6 relationships (hemorrhoids->anemia, hemothorax->anemia, hepatic-steatosis->cirrhosis-of-the-liver, hepatic-steatosis->liver-cancer, heterotopic-ossification->peripheral-neuropathy, hill-sachs-lesion->post-traumatic-osteoarthritis) */  /* batch 43 (2026-09-24): +8 relationships (hearing-loss x2, heart-block, heart-valve-disorders x2, hemangioma x2, hemipelvectomy) */  /* batch 42 (2026-09-24): +7 relationships (hallux-valgus->metatarsalgia, hallux-valgus->unexplained-chronic-pain, hammertoe->unexplained-chronic-pain, halo-nevus->vitiligo, hashimoto-s-encephalopathy->seizure-disorder, hashimoto-s-encephalopathy->cognitive-disorder, hashimoto-s-encephalopathy->depressive-disorder) */  /* batch 41 (2026-09-24): +3 relationships (hairy-cell-leukemia->anemia, guyon-s-canal-syndrome->muscle-atrophy, halitosis->depressive-disorder) */  /* batch 40 (2026-09-23): +5 relationships (granulomatosis-with-polyangiitis->chronic-kidney-disease, granulomatosis-with-polyangiitis->hearing-loss, guillain-barre-syndrome->unexplained-chronic-pain, guillain-barre-syndrome->depressive-disorder, greater-trochanteric-pain-syndrome->unexplained-chronic-pain) */  /* batch 39 (2026-09-23): +3 relationships (glucagonoma->diabetes-mellitus, glucagonoma->malnutrition-residuals, goodpasture-syndrome->chronic-kidney-disease) */  /* batch 38 (2026-09-23): +5 relationships (giant-cell-myocarditis->congestive-heart-failure, giant-cell-myocarditis->cardiac-arrhythmia, gingivitis->periodontitis, glaucoma->visual-impairment, glomus-tumor->unexplained-chronic-pain) */  /* batch 37 (2026-09-23): +4 relationships (gastrointestinal-stromal-tumors->anemia, gastrointestinal-stromal-tumors->malnutrition-residuals, gastrointestinal-stromal-tumors->depressive-disorder, genitofemoral-nerve-neuralgia->unexplained-chronic-pain) */  /* batch 36 (2026-09-23): +6 relationships (fungal-skin-infection->cellulitis, gamekeeper-s-thumb->osteoarthritis, ganglion-cysts->carpal-tunnel-syndrome, gastrinoma->peptic-ulcer-disease, gastritis->peptic-ulcer-disease, gastritis->anemia) */  /* batch 35 (2026-09-23): +5 relationships (flexor-hallucis-longus-tendinitis->unexplained-chronic-pain, fournier-s-gangrene->scars, freiberg-s-infraction->osteoarthritis, frontal-fibrosizing-alopecia->loss-of-eyebrow, frontal-fibrosizing-alopecia->depressive-disorder) */  /* batch 34 (2026-09-23): +3 relationships (femoral-neuropathy->unexplained-chronic-pain, fitz-hugh-curtis-syndrome->female-infertility, flatfoot->osteoarthritis) */  /* batch 32 (2026-09-23): +4 relationships (excoriation-disorder->scars, factitious-disorder->scars, exophthalmos->keratitis, exploding-head-syndrome->insomnia) */  /* batch 31 (2026-09-23): +5 relationships (erythroplasia-of-queyrat->squamous-cell-carcinoma, erythropoietic-protoporphyria->cholelithiasis, erythropoietic-protoporphyria->chronic-liver-disease, esophageal-stricture->dysphagia, esophagitis->esophageal-stricture) */  /* batch 30 (2026-09-23): +4 relationships (episcleritis->insomnia, episcleritis->unexplained-chronic-pain, erythromelalgia->insomnia, erythromelalgia->unexplained-chronic-pain) */;
if (JSON.stringify(relRegistry.counts) !== JSON.stringify(expectedRelCounts)) fail(`Relationship registry count metadata mismatch: ${JSON.stringify(relRegistry.counts)}`);

const expectedSourceCounts = {  /* batch 53 (2026-09-25): +9 relationships, +18 pending-verification sources, +23 live uses (PMIDs 38982032, 30970367, 39152785, 33034929, 39812844 shared within their files) */  /* batch 52 (2026-09-24): +5 relationships, +10 pending-verification sources, +10 live uses */  /* batch 51 (2026-09-24): +3 relationships, +5 pending-verification sources, +6 live uses (PMID 28242264 reused) */  /* batch 50 (2026-09-24): +6 relationships, +13 pending-verification sources, +13 live uses */  /* batch 49 (2026-09-24): +4 relationships, +8 pending-verification sources, +8 live uses */  /* batch 48 (2026-09-24): +4 relationships, +8 pending-verification sources, +8 live uses */  /* batch 47 (2026-09-24): +6 relationships, +12 pending-verification sources, +12 live uses */  /* batch 46 (2026-09-24): +4 relationships, +8 pending-verification sources, +8 live uses */  /* batch 45 (2026-09-24): +3 relationships, +5 pending-verification sources, +6 live uses (PMID 28242264 reused) */  /* batch 44 (2026-09-24): +6 relationships, +12 pending-verification sources, +12 live uses */  /* batch 41 (2026-09-24): +3 relationships, +9 pending-verification sources, +9 live uses */  /* batch 40 (2026-09-23): +5 relationships, +14 pending-verification sources, +15 live uses (PMID 39687605 shared) */  /* batch 39 (2026-09-23): +3 relationships, +7 pending-verification sources, +9 live uses */  /* batch 38 (2026-09-23): +5 relationships, +15 pending-verification sources, +15 live uses */  /* batch 37 (2026-09-23): +4 relationships, +12 pending-verification sources, +12 live uses */  /* batch 36 (2026-09-23): +6 relationships, +18 pending-verification sources, +18 live uses */  /* batch 35 (2026-09-23): +5 relationships, +15 pending-verification sources, +15 live uses */  /* batch 34 (2026-09-23): +3 relationships, +9 pending-verification sources, +9 live uses */  /* batch 32 (2026-09-23): +4 relationships, +11 pending-verification sources, +11 live uses */  /* batch 31 (2026-09-23): +5 relationships, +9 pending-verification sources, +14 live uses (registry shared across EPP edges) */
  liveSourceReferenceUses: 1298,  /* batch 69 (2026-09-26): +19 */  /* batch 68 (2026-09-26): +6 */  /* batch 67 (2026-09-26): +12 */  /* batch 66 (2026-09-26): +18 */  /* batch 65 (2026-09-26): +17 */  /* batch 64 (2026-09-26): +16 */  /* batch 63 (2026-09-26): +22 */  /* batch 62 (2026-09-26): +25 */  /* batch 61 (2026-09-26): +35 */  /* batch 60 (2026-09-26): +27 */  /* batch 59 (2026-09-26): +28 */  /* batch 58 (2026-09-25): +22 */  /* batch 57 (2026-09-25): +22 */  /* batch 56 (2026-09-25): +11 */  /* batch 55 (2026-09-25): +22 */  /* batch 54 (2026-09-25): +14 */
  activeSourceEntities: 346,    pendingVerificationSourceEntities: 811,  /* batch 69 (2026-09-26): +17 pending-verification sources */  /* batch 68 (2026-09-26): +6 pending-verification sources */  /* batch 67 (2026-09-26): +10 pending-verification sources */  /* batch 66 (2026-09-26): +16 pending-verification sources */  /* batch 65 (2026-09-26): +11 pending-verification sources */  /* batch 64 (2026-09-26): +14 pending-verification sources */  /* batch 63 (2026-09-26): +15 pending-verification sources */  /* batch 62 (2026-09-26): +21 pending-verification sources */  /* batch 61 (2026-09-26): +27 pending-verification sources */  /* batch 60 (2026-09-26): +21 pending-verification sources */  /* batch 59 (2026-09-26): +26 pending-verification sources */  /* batch 58 (2026-09-25): +19 */  /* batch 57 (2026-09-25): +22 */  /* batch 56 (2026-09-25): +11 */  /* batch 55 (2026-09-25): +17 */  /* batch 54 (2026-09-25): +10 */
  activeClinicalSourceEntities: 345,
  pendingClinicalSourceEntities: 811,  /* batch 69 (2026-09-26): +17 pending-verification sources */  /* batch 68 (2026-09-26): +6 pending-verification sources */  /* batch 67 (2026-09-26): +10 pending-verification sources */  /* batch 66 (2026-09-26): +16 pending-verification sources */  /* batch 65 (2026-09-26): +11 pending-verification sources */  /* batch 64 (2026-09-26): +14 pending-verification sources */  /* batch 63 (2026-09-26): +15 pending-verification sources */  /* batch 62 (2026-09-26): +21 pending-verification sources */  /* batch 61 (2026-09-26): +27 pending-verification sources */  /* batch 60 (2026-09-26): +21 pending-verification sources */  /* batch 59 (2026-09-26): +26 pending-verification sources */  /* batch 58 (2026-09-25): +19 */  /* batch 57 (2026-09-25): +22 */  /* batch 56 (2026-09-25): +11 */  /* batch 55 (2026-09-25): +17 */  /* batch 54 (2026-09-25): +10 */
  activeLegalAuthorityEntities: 1,
  retiredOnlySourceEntities: 1,
  supersededUnverifiedSourceEntities: 7,
  bibliographicCorrectionOnlyEntities: 1,
  totalSourceEntitiesIncludingLineage: 1166,  /* batch 69 (2026-09-26): +17 source entities (8 new edges over 17 new sources, 2 sources shared within batch) */  /* batch 68 (2026-09-26): +6 source entities (2 new edges over 6 new sources, no reuse or sharing) */  /* batch 67 (2026-09-26): +10 source entities (6 new edges over 10 new sources; PMIDs 41174987 and 35878633 each shared across two otosclerosis edges) */  /* batch 66 (2026-09-26): +16 source entities (10 new edges over 16 new sources; PMIDs 41862928 and 41914550 each shared across two oral-cancer edges) */  /* batch 65 (2026-09-26): +11 source entities (8 new edges over 11 new sources; PMIDs 41657358, 26810545, 41936711, 27939179, and 17071625 each shared across sibling edges) */  /* batch 64 (2026-09-26): +14 source entities (7 new edges over 14 new sources; PMIDs 28801367 and 34197634 each shared across the two neuroblastoma cytopenia edges) */  /* batch 63 (2026-09-26): +15 source entities (10 new edges over 15 new sources; PMID 27238425 shared across the two necrobiotic-xanthogranuloma edges, 34979093 shared across the four nephrosis thromboembolic edges, 42298988 shared across the nephrosis stroke and myocardial-infarction edges, and 40043694 shared across the nephrosis deep-vein-thrombosis and chronic-kidney-disease edges) */  /* batch 62 (2026-09-26): +21 source entities (11 new edges over 21 new sources; PMID 32347918 shared across all four myopia edges and 35188078 shared across two) */  /* batch 61 (2026-09-26): +27 source entities (12 new edges over 27 new sources; PMIDs 42314414, 41834593, 40607214, 28605116, 42272368, and 33649917 each shared across sibling edges) */  /* batch 60 (2026-09-26): +21 source entities (12 new edges over 21 new sources; PMIDs 40887784 and 37868436 each shared across the menetrier-s-disease edges, 32340774 shared across the microscopic-polyangiitis renal/neurologic/pulmonary edges, and 32710780 shared across the microscopic-colitis cancer edges) */  /* batch 59 (2026-09-26): +26 source entities (12 new edges over 26 new sources; PMIDs 42223618 shared across the mastoiditis meningitis and brain-abscess edges, 36620810 shared across the marantic-endocarditis myocardial-infarction and pulmonary-embolism edges) */  /* batch 58 (2026-09-25): +19 */  /* batch 57 (2026-09-25): +22 */  /* batch 56 (2026-09-25): +11 */  /* batch 55 (2026-09-25): +17 */  /* batch 54 (2026-09-25): +10 */
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
