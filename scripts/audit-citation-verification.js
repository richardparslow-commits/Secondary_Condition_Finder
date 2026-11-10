/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const {
  loadDigestExemptions,
  classifyDigestPosition,
  exemptionAssessmentStale,
} = require("./lib/citation-digest-exemptions");
// One definition of the pin, shared with the weekly network probe. Importing is
// safe: audit-citation-decay.js only runs its probe when it is the entrypoint.
const { MAX_UNDIGESTED_VERIFIED_REFS } = require("./audit-citation-decay");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const retirementPath = path.join(process.cwd(), "data/citation-retirements.json");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();
const retirementLedger = fs.existsSync(retirementPath)
  ? JSON.parse(fs.readFileSync(retirementPath, "utf8"))
  : { version: 1, retirements: [] };
const retirements = Array.isArray(retirementLedger.retirements) ? retirementLedger.retirements : [];
const digestExemptions = loadDigestExemptions(process.cwd());
const todayIso = new Date().toISOString().slice(0, 10);

// Debt ceilings and provenance floors advance only when a reviewed batch improves them.
// Raw live clinical-URL counts are observations, not monotonic floors: withdrawing an
// unsupported unverified source is an evidence-quality improvement and may lower them.
// M1 bounded source-intake ceiling authorized by qualified-human approval; all four new sources remain verified:false.
// Clinical Mapping Master Batch 2026 citation verification was qualified-human approved on 2026-08-19.
// All 68 Master relationship source rows are verified after 8 approved narrowings and 5 one-for-one replacements.
// The remaining 5 unverified/review rows are outside this Master citation-verification set.
// Residual M1 citation closure qualified-human approved 2026-08-19.
// All 94 pending references are now verified, so no live citation debt remains.
// Adrenal Histoplasmosis Taxonomy Amendment 2026 qualified-human approved 2026-08-19.
// PMID 30656706 enters the new site-specific published edge as verified:false; one review row is intentionally reopened pending separate citation approval.
// Adrenal Histoplasmosis Citation Verification 2026 qualified-human approved 2026-08-19.
// PMID 30656706 is proposition-matched to adrenal-histoplasmosis -> addisons-disease; live citation debt is now zero.
// ME-14 Qualified-Human Citation Verification promotes all 5 ME-14 sources exactly as implemented.
// Final ME-14 citation state: 251 live verified / 0 unverified / 0 review; 257 verified provenance including 6 retired verified.
// ME-15 Qualified-Human Citation Verification promotes all 5 ME-15 sources exactly as implemented.
// Final ME-15 citation state: 256 live verified / 0 unverified / 0 review; 262 verified provenance including 6 retired verified.
// ME-16 mapping adds 5 bounded mental-disorder sources as verified:false; qualified-human citation verification is separately gated.
// ME-17 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-18 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-19 mapping adds 5 more bounded sources as verified:false over the new Wave-8 framework-only identities; qualified-human citation verification is separately gated.
// ME-20 mapping adds 5 more bounded sources as verified:false over the Wave-8 framework-only identities; qualified-human citation verification is separately gated.
// ME-21 mapping adds 5 more bounded sources as verified:false over the Wave-8 framework-only identities; qualified-human citation verification is separately gated.
// ME-22 mapping adds 5 more bounded sources as verified:false over the Wave-8 framework-only identities; qualified-human citation verification is separately gated.
// ME-25 mapping adds 5 more bounded sources as verified:false over the Wave-8 framework-only identities; qualified-human citation verification is separately gated.
// ME-26 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-27 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-28 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-29 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-30 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// ME-33 mapping adds 5 more bounded sources as verified:false; qualified-human citation verification is separately gated.
// All 94 pending clinical references were approved by the user on 2026-09-04 and promoted atomically.
// ME-36 adds 6 published PTSD relationships; ME-37 adds 9 more (metabolic-syndrome, systemic-lupus-erythematosus,
// rheumatoid-arthritis, inflammatory-bowel-disease, multiple-sclerosis, thyroiditis, irritable-bowel-syndrome,
// gerd, copd) over 8 distinct qualified-human-verified clinical sources (15 citation uses, autoimmune sources reused).
// Final ME-37 citation state: 376 live verified / 0 unverified / 0 review; 382 verified provenance including 6 retired verified.
// ME-38 adds ptsd -> rem-sleep-disorder over 3 qualified-human-verified clinical sources approved in-session on
// 2026-09-06 (Elliott PMID 31587047, Baldini 2026 systematic review PMID 41616415, Barone PMID 32804070).
// Final ME-38 citation state: 379 live verified / 0 unverified / 0 review; 385 verified provenance including 6 retired verified.
// D1 draft-authoring batches (2026-09-22): batch 1 authored 5 draft-quarantined ASSOCIATION_ONLY
// suggestions (apathy, aphasia-dysphasia, arteriosclerosis, arteriovenous-fistula, astigmatism) over 8
// sources; batch 2 authored 4 more over 6 sources with baker-s-cyst deferred per the ME-35 exclusion;
// batch 3 authored 3 more (bankart-lesion -> post-traumatic-osteoarthritis, benign-migratory-glossitis ->
// psoriasis, benign-paroxysmal-positional-vertigo -> anxiety-disorder) over 5 sources, with
// balint-s-syndrome deferred (no honest catalog target) and basal-cell-carcinoma deferred per the ME-35
// exclusion. All are bibliography-confirmed and pending qualified-human verification; per the
// citation-purity quarantine they remain draft: true and verified: false; the unverified ratchet holds
// that debt visible until the human SOP closes it. Batch 4 authored 5 more (bicipital-tendinitis ->
// rotator-cuff-injury, bile-reflux-gastritis -> esophagitis, biliary-tract-cancer -> malnutrition-residuals,
// bladder-contracture -> urinary-frequency-retention, bladder-pain-syndrome-interstitial-cystitis ->
// depressive-disorder) over 10 sources. Batch 5 authored 4 more (blindness ->
// depressive-disorder, bone-cysts and bone-tumors -> malunion-nonunion-of-fractures, and the
// batches' first DIRECT_CAUSATION draft, brain-cancer -> seizure-disorder) over 8 sources, with
// boutonniere-deformity deferred (no target-specific literature; the documented RA direction is upstream).
// Batch 6 authored 2 more (bronchitis -> copd early-life-infection trajectory, broncho-alveolar-carcinoma
// -> pleural-effusion) over 5 sources; a drafted bruxism edge was withdrawn to honor the ME-34 rejection,
// and bronchomalacia and bullosis-diabeticorum were deferred with governance records. Batch 7 authored 2
// more (bundle-branch-block -> implantable-cardiac-pacemaker spontaneous-progression association with the
// post-TAVI procedural literature deliberately excluded from scope, and burning-mouth-syndrome ->
// depressive-disorder with the reverse-direction cohort dominance recorded) over 5 sources;
// bullous-pemphigoid (ME-35 directionality exclusion), byssinosis (ME-35 evidence-condition exclusion),
// and bursitis (promotion-batch-24 safe-draft disposition) were deferred honoring prior dispositions.
// D1 batch 16 (2026-09-22): corneal-scarring -> visual-impairment; cracked-tooth-syndrome ->
// loss-of-teeth and abscesses; cryptogenic-organizing-pneumonia -> pulmonary-fibrosis; and
// cotard-s-syndrome -> depressive-disorder (capgras-precedent co-occurrence modeling) over
// 13 sources; cubital-tunnel-syndrome deferred on the ME-41 phenotype-identity barrier
// (ulnar neuropathy IS the identity) and catalog-gap grounds.
// D1 batch 19 (2026-09-23): cyclic-vomiting-syndrome -> migraine-headaches/depressive-disorder/
// esophagitis (comorbidity/complication association with reverse-direction and acute-tear guards);
// cystitis-or-neurogenic-bladder -> hydronephrosis (second obstruction-mechanical DIRECT_CAUSATION
// after urethral stricture, urethral-stricture precedent) and -> kidney-stones (SCI-specific
// excess risk, catheter confound); dandy-walker-syndrome -> hydrocephalus (CSF-flow obstruction,
// penetrance guard); de-quervain-s-tenosynovitis -> carpal-tunnel-syndrome (single cross-sectional
// co-occurrence cohort); decubitus-ulcers -> osteomyelitis (biopsy-denominator guard) over 19 sources.
// D1 batch 18 (2026-09-22): conductive-hearing-loss -> tinnitus (otosclerosis-specific cohorts,
// severity decoupled from hearing degree); conjunctivitis -> corneal-scarring (adenoviral-EKC-specific
// SEI pathway); coronary-bypass-residuals -> cardiac-arrhythmia/cognitive-disorder (treatment-mediated
// POAF/POCD per the iatrogenic convention) over 13 sources; contralateral-knee-condition and
// cranial-nerve-palsy deferred on identity/directionality and manifestation-identity barriers.
// D1 batch 17 (2026-09-22): aphonia -> depressive-disorder/anxiety-disorder;
// bacterial-rhinitis -> sinusitis; chronic-laryngitis -> vocal-cord-nodules-polyps-cysts-paralysis
// (edematous-polypoid spectrum only); complex-regional-pain-syndrome -> osteoporosis/contractures
// over 15 sources; common-peroneal-neuropathy deferred on the ME-41 phenotype-identity barrier.
// Batch 34 (2026-09-23): +3 pending-verification relationships across 3 authored
// identities (femoral-neuropathy->unexplained-chronic-pain,
// fitz-hugh-curtis-syndrome->female-infertility, flatfoot->osteoarthritis);
// female-sexual-arousal-disorder deferred on evidence-gap and nosology-stability
// grounds (zero TiAb FSAD-specific mood quantification) and fissured-tongue
// deferred on zero-record and directionality grounds. Every citation NCBI-verified
// via efetch before file authoring (batch-30 lesson institutionalized). Debt
// ratchet advances per the SOP: the 9 new sources (9 reference uses, no sharing)
// stay pending-verification pending qualified-human review.
// Batch 33 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (farmer-s-lung->pulmonary-fibrosis,
// fasciitis->amputation-or-loss-of-use, fecal-impaction->fecal-incontinence
// DIRECT_CAUSATION, female-infertility->depressive-disorder);
// female-reproductive-disorders deferred on duplicate-scope class-identity
// grounds (diabetes-mellitus and eczema precedents). Every citation NCBI-verified
// via efetch before file authoring (batch-30 lesson institutionalized). Debt
// ratchet advances per the SOP: the 12 new sources (12 reference uses, no
// sharing) stay pending-verification pending qualified-human review.
// Batch 32 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (excoriation-disorder->scars, factitious-disorder->scars,
// exophthalmos->keratitis, exploding-head-syndrome->insomnia);
// extensor-digitorum-brevis-strain deferred on evidence-ground zero-record screening
// (camptodactyly precedent). Every citation NCBI-verified via efetch before file
// authoring (batch-30 lesson institutionalized). Debt ratchet advances per the SOP:
// the 11 new sources (11 reference uses, no sharing) stay pending-verification
// pending qualified-human review.
// Batch 31 (2026-09-23): +5 pending-verification relationships across 4 authored
// identities (erythroplasia-of-queyrat->squamous-cell-carcinoma,
// erythropoietic-protoporphyria->cholelithiasis and ->chronic-liver-disease,
// esophageal-stricture->dysphagia and esophagitis->esophageal-stricture, both
// DIRECT_CAUSATION); euthyroid-sick-syndrome deferred on manifestation-identity
// grounds. Every citation NCBI-verified via efetch before file authoring (batch-30
// lesson institutionalized). Debt ratchet advances per the SOP: the 9 new sources
// (14 reference uses, the Levy registry shared across both EPP edges) stay
// pending-verification pending qualified-human review.
// Batch 30 (2026-09-23): +4 pending-verification relationships across 2 authored
// identities (episcleritis and erythromelalgia, each -> insomnia and
// -> unexplained-chronic-pain); erythema-nodosum and erythema-induratum deferred on
// manifestation-identity grounds, erythema-multiforme deferred after its candidate
// edge failed citation verification in self-audit (incident recorded in-file). Debt
// ratchet advances per the SOP: the 4 new sources (12 reference uses, each source
// shared across both sibling edges of its identity) stay pending-verification
// pending qualified-human review.
// Batch 29 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (eosinophilic-myocarditis->congestive-heart-failure DIRECT_CAUSATION,
// epicondylitis->ulnar-neuropathy, epidermolysis-bullosa-acquired->esophageal-stricture,
// epididymitis-orchitis->testicular-atrophy); epididymal-cyst deferred (benign
// incidental finding, no outcome association evidence). Debt ratchet advances per
// the SOP: the 12 new sources (12 reference uses, no sharing) stay pending-verification
// pending qualified-human review.
// Batch 28 (2026-09-23): +6 pending-verification relationships across 4 authored
// identities (encephalitis->seizure-disorder DIRECT_CAUSATION and ->cognitive-disorder,
// enophthalmos->diplopia, eosinophilic-bronchitis->asthma,
// eosinophilic-gastroenteritis->malnutrition-residuals and ->anemia); encopresis
// deferred on duplicate-scope and manifestation-identity grounds. Debt ratchet
// advances per the SOP: the 12 new sources (17 reference uses, 5 sources shared
// across sibling edges) stay pending-verification pending qualified-human review.
// Batch 27 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (dysplastic-nevus-syndrome->skin-cancer, early-onset-peripheral-neuropathy->pes-cavus,
// elbow-disarticulation->phantom-limb-pain, empty-nose-syndrome->depressive-disorder);
// eczema deferred on duplicate-scope (the atopic-dermatitis evidence base is already carried by
// the batch-20 dermatitis edges and the atopic-march edge). Debt ratchet advances per the SOP:
// the 8 new sources (9 reference uses, including the reused verified Diers 2022 on the elbow
// edge) stay pending-verification pending qualified-human review.
// Batch 26 (2026-09-23): +4 pending-verification relationships across 4 authored
// identities (dumping-syndrome->malnutrition-residuals,
// dupuytren-s-contracture->trigger-finger, dwarfism->sleep-apnea,
// dwarfism->spinal-stenosis); carpal-tunnel-syndrome reaffirmed as a safe draft,
// dyspareunia deferred (DSM-5 GPPPD merger defeats directionality). Debt ratchet
// advances per the SOP: the 8 new sources (10 reference uses) stay
// pending-verification pending qualified-human review.
// Batch 25 (2026-09-23): +5 pending-verification relationships across 4 authored
// identities (cystitis->overactive-bladder, dementia->anxiety-disorder,
// dementia->urinary-incontinence, dry-eye-syndrome->insomnia,
// dry-eye-syndrome->depressive-disorder); contractures deferred (wrong-identity
// evidence for the bladder-neck-contracture literature). Debt ratchet advances per
// the SOP: the 13 new refs stay pending-verification pending qualified-human review.
// Batch 23 (2026-09-23): +12 pending-verification sources across 4 authored
// edges (diffuse-esophageal-spasm->gerd, diverticulosis->diverticulitis,
// diverticulitis->irritable-bowel-syndrome, dizziness->anxiety-disorder);
// diplopia deferred (symptom-identity). Debt ratchet advances per the SOP:
// the 12 new refs stay pending-verification pending qualified-human review.
// Batch 93 (2026-10-03): Stage 3b - the signed liver-cancer to sarcopenia route
// registered in the authored corpus (+1 relationship, +3 pending-verification
// clinical source entities over 3 reference uses across 3 new PMIDs: 37274463,
// 36590214, 26266324, all confirmed absent from master-sources.json and cleared
// by source-status preflight on 2026-10-03). Debt ratchet advances per the SOP:
// the 3 new refs stay pending-verification pending qualified-human review, so
// unverified 1295->1298, references 1690->1693, and both with-URLs counts move
// by the same 3; verified counts are unchanged.
// Batch 93 (2026-10-04): Stage 3a - the signed alcohol-use-disorder to
// chronic-liver-disease route registered in the authored corpus (+1
// relationship, +3 pending-verification clinical source entities over 3
// reference uses across 3 new PMIDs: 30080255, 36926309, 20636661, all
// confirmed absent from master-sources.json and cleared by source-status
// preflight on 2026-10-04; the preserved batch-91 anchor PMID 30080255
// attaches under ME-29 discipline). Debt ratchet advances per the SOP: the 3
// new refs stay pending-verification pending qualified-human review, so
// unverified 1298->1301, references 1693->1696, and both with-URLs counts
// move by the same 3; verified counts are unchanged. The
// ptsd->alcohol-use-disorder window is HELD as
// docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json (ptsd is published),
// so no reference use is registered for it.
// Batch 93 (2026-10-04): row-504 qualified-human verification pass: the three
// liver-cancer->sarcopenia anchors (37274463, 36590214, 26266324) LANDED verified:true,
// with PMIDs 37274463 and 36590214 approved WITH NARROWING (the "CT-defined" pooled-prevalence
// description narrowed to the full texts' assessment-method composition) and PMID 26266324
// approved as written; liveVerified 395->398, verifiedProvenance 401->404, unverified 1304->1301,
// references 1699 and the clinical-URL counts unchanged; contentDigest omitted on all three
// because PubMed record pages are dynamic per fetch.
const CITATION_DEBT_BASELINE = Object.freeze({
  references: 1709,
  liveVerified: 398,
  retiredVerified: 0,
  verifiedProvenance: 398,
  unverified: 1311,
  reviewFindings: 0,
  liveClinicalEvidenceWithUrls: 1699,
  retiredClinicalEvidenceWithUrls: 0,
  clinicalEvidenceProvenanceWithUrls: 1699
});
// Batch 50 (2026-09-24): +13 pending-verification clinical references across 5 screened
// identities and 6 new edges (keratitis->corneal-scarring, kienbock-s-disease->osteoarthritis,
// kaposi-s-sarcoma->lymphedema and ->cellulitis, keloids->depressive-disorder,
// katayama-fever->urticaria); 13 unique PMIDs with no reuse and no sharing, so every new use adds
// a source; all refs stay verified:false pending qualified-human review and no primary publication
// state changed. Every identity in the batch was retained with at least one window, so unlike
// batches 48 and 49 there were no deferrals: screened-out propositions were recorded on the edges
// and in the batch ledger instead of being deferred identities (keratitis->visual-impairment
// reassertion refused under the existing FINAL-CLOSE-PROPOSITION-MISMATCH; keloids->scars refused
// as constitutive; keloids->anxiety-disorder, ->contractures, and ->squamous-cell-carcinoma refused
// on mediator and zero-record grounds; kienbock-s-disease->avascular-necrosis refused as
// constitutive; kaposi-s-sarcoma->pulmonary and ->anemia refused for zero-record; katayama-fever->
// pulmonary-hypertension and ->anemia refused on disease-stage grounds and
// ->tropical-pulmonary-eosinophilia and ->eosinophilic-gastroenteritis refused as distinct
// identities).
// Batch 49 (2026-09-24): +8 pending-verification clinical references across 5 screened
// identities and 4 new edges (intracranial-injury-without-skull-fracture->epilepsy and
// ->hypopituitarism as the batch's two DIRECT_CAUSATION edges, joint-replacement-residuals->
// deep-vein-thrombosis and ->contractures); 8 unique PMIDs with no reuse and no sharing, so every
// new use adds a source; all refs stay verified:false pending qualified-human review and no primary
// publication state changed. Three deferrals were recorded without relationships and are not
// packeted: intervertebral-disc-syndrome (FINAL-CLOSE-NO-SUPPORTED-SECONDARY honoured, plus the
// degenerative-disc-disease synonym/parallel-pathway screen), iritis (synonym of anterior uveitis,
// whose glaucoma and cataract windows the uveitis identity already carries), and jersey-finger
// (zero-record: the located literature reports total active motion, QuickDASH, and Buck-Gramcko
// grades without a catalog-fit secondary diagnosis).
// Batch 48 (2026-09-24): +8 pending-verification clinical references across 5 screened
// identities and 4 new edges (iliohypogastric-ilioinguinal-nerve-neuralgia->unexplained-chronic-pain,
// impetigo->nephritis and insulinoma->hyperinsulinism as the batch's two DIRECT_CAUSATION edges,
// inappropriate-sinus-tachycardia->dizziness); 8 unique PMIDs with no reuse and no sharing, so every
// new use adds a source; all refs stay verified:false pending qualified-human review and no primary
// publication state changed. interosseous-muscle-atrophy was deferred on manifestation-identity
// grounds (site-specific denervating finding whose located literature documents upward nerve-lesion
// causes) and is not packeted; the Hsu 2012 randomized meta-analysis and the Shabtaie 2020 IST cohort
// are recorded as screened counter-evidence rather than as sources on their respective edges.
// Batch 47 (2026-09-24): +12 pending-verification clinical references across 5 screened
// identities and 6 new edges (hypoglycemia->dementia, hypoglycemia->seizure-disorder,
// hypopituitarism->osteopenia, hypopituitarism->anemia, hypotension->visual-impairment,
// ichthyosis->dry-eye-syndrome); 12 unique PMIDs with no reuse and no sharing, so every new
// use adds a source; all six edges are authored at ASSOCIATION_ONLY / NOT_ESTABLISHED /
// hypothesizedOnly:true and stay verified:false pending qualified-human review. hypopigmentation
// was deferred on manifestation-identity grounds (generic cutaneous sign; located literature is
// vitiligo-, drug-, and disease-site-specific) and is not packeted, and no primary publication
// state changed.
// Batch 46 (2026-09-24): +8 pending-verification clinical references across 5 screened
// identities and 4 new edges (hyperinsulinism->hypoglycemia as the batch's DIRECT_CAUSATION
// edge, hypertensive-retinopathy->visual-impairment, hyperopia->glaucoma,
// hyperhidrosis->anxiety-disorder); 8 unique PMIDs, no reuse or sharing; hyperpigmentation
// deferred (manifestation identity) and not packeted; all refs stay verified:false pending
// qualified-human review and no primary publication state changed. The harvested
// hyperhidrosis-to-depressive-disorder proposition stays FINAL-CLOSED and is not reasserted.
// Batch 45 (2026-09-24): +6 clinical reference uses across 5 screened identities and 3 new
// edges (hip-disarticulation->phantom-limb-pain, hip-labral-tear->post-traumatic-osteoarthritis,
// hydrocephalus->visual-impairment); one use is a verified-source reuse (PMID 28242264, the
// Kelle 2017 level-stratified phantom-limb study already human-verified and carried verified:true
// from the ankle-disarticulation edge per the family precedent), so the debt ratchet advances by
// 5 pending-verification uses; hip-strain deferred (zero-record) and pulmonary histoplasmosis
// deferred (RESOLVED-PRIOR-SITE-SPECIFIC-TAXONOMY; adrenal window owned by adrenal-histoplasmosis),
// neither packeted, and no primary publication state changed.
// Batch 44 (2026-09-24): +12 pending-verification clinical references across 5 authored
// identities and 6 new edges (hemorrhoids->anemia, hemothorax->anemia,
// hepatic-steatosis->cirrhosis-of-the-liver as the batch's DIRECT_CAUSATION edge,
// hepatic-steatosis->liver-cancer, heterotopic-ossification->peripheral-neuropathy,
// hill-sachs-lesion->post-traumatic-osteoarthritis); 12 unique PMIDs, no reuse and no
// sharing; all refs stay verified:false pending qualified-human review and no primary
// publication state changed. FINAL-CLOSE-PROPOSITION-MISMATCH screens honoured for
// hemorrhoids (harvested epicondylitis) and heterotopic-ossification (harvested
// osteoarthritis).
// Batch 43 (2026-09-24): +15 pending-verification clinical references plus one verified-source
// reuse (PMID 34583023, already human-verified and carried verified:true per the
// elbow-disarticulation family precedent) across 5 authored
// identities and 8 new edges (hearing-loss->cognitive-disorder, hearing-loss->depressive-disorder,
// heart-block->cardiomyopathy, heart-valve-disorders->congestive-heart-failure as the batch's
// DIRECT_CAUSATION edge, heart-valve-disorders->cardiac-inflammatory-disease,
// hemangioma->congestive-heart-failure, hemangioma->hypothyroidism,
// hemipelvectomy->phantom-limb-pain); 16 unique PMIDs, PMID 34583023 reused from the existing
// per-site phantom-limb-pain edges (added use, no new source entity); all refs stay
// verified:false pending qualified-human review and no primary publication state changed.
// Batch 42 (2026-09-24): +21 pending-verification clinical references across 4 new
// relationships (hallux-valgus x2, hammertoe, halo-nevus, hashimoto-s-encephalopathy
// x3); 17 unique PMIDs, three reused across edge pairs. head-and-neck-cancers deferred
// (class scope) with no citations added.
// Batch 41 (2026-09-24): +9 pending-verification clinical references across 3 new
// edges (hairy-cell-leukemia->anemia, guyon-s-canal-syndrome->muscle-atrophy
// DIRECT_CAUSATION, halitosis->depressive-disorder); hairy-tongue and hallux-rigidus
// deferred. Debt ratchet advances per the SOP: the 9 new refs stay pending-verification
// pending qualified-human review.
// Batch 40 (2026-09-23): +15 pending-verification clinical references across 5 new
// edges (granulomatosis-with-polyangiitis->chronic-kidney-disease DIRECT_CAUSATION
// and ->hearing-loss, guillain-barre-syndrome->unexplained-chronic-pain and
// ->depressive-disorder, greater-trochanteric-pain-syndrome->unexplained-chronic-pain);
// granulomatous-disease and granulomatous-rhinitis deferred. Debt ratchet advances
// per the SOP: the 15 new refs stay pending-verification pending qualified-human review
// (PMID 39687605 is shared across both GBS edges; 14 unique new sources).
// Batch 39 (2026-09-23): +9 pending-verification clinical references across 3 new
// edges (glucagonoma->diabetes-mellitus DIRECT_CAUSATION,
// glucagonoma->malnutrition-residuals, goodpasture-syndrome->chronic-kidney-disease
// DIRECT_CAUSATION); glossitis, goiter, and granuloma-annulare deferred. Debt
// ratchet advances per the SOP: the 9 new refs stay pending-verification pending
// qualified-human review.
// Batch 38 (2026-09-23): +15 pending-verification clinical references across 5 new
// draft-quarantined edges (giant-cell-myocarditis congestive-heart-failure DIRECT
// and cardiac-arrhythmia, gingivitis periodontitis, glaucoma visual-impairment,
// glomus-tumor case-matching unexplained-chronic-pain); the debt ratchet advances
// per the SOP - all 15 refs stay verified:false pending qualified-human review, and
// no primary publication state changed (1 deferral carries no references).
// Batch 37 (2026-09-23): +12 pending-verification clinical references across 4 new
// draft-quarantined edges (gastrointestinal-stromal-tumors anemia,
// malnutrition-residuals, and depressive-disorder; genitofemoral-nerve-neuralgia
// case-matching unexplained-chronic-pain); the debt ratchet advances per the SOP -
// all 12 refs stay verified:false pending qualified-human review, and no primary
// publication state changed (3 deferrals in this batch carry no references).
// Batch 36 (2026-09-23): +18 pending-verification clinical references across 6 new
// draft-quarantined edges (fungal cellulitis, gamekeeper's-thumb OA, ganglion CTS,
// gastrinoma and gastritis peptic-ulcer DIRECT edges, gastritis anemia); the debt
// ratchet advances per the SOP - all 18 refs stay verified:false pending
// qualified-human review, and no primary publication state changed.

const hardFindings = [];
const reviewFindings = [];
const unverifiedByCitation = new Map();
const liveReferenceKeys = new Set();
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;
// Content-digest position of the verified population, computed offline so the
// PR that creates digest debt is the PR that fails. The weekly network probe
// cannot do this: by the time it runs, the verifier who could have captured the
// digest at verification time is gone and the SOP forbids backfilling one.
let verifiedWithDigest = 0;
let verifiedDigestExempt = 0;
let verifiedUndigestedActionable = 0;
let verifiedDigestExemptionPending = 0;
const actionableUndigestedRefs = [];

function addHard(message) { hardFindings.push(message); }
function addReview(message) { reviewFindings.push(message); }
function liveKey(mappingId, conditionId, citation, sourceUrl) {
  return [mappingId || "", conditionId || "", citation || "", sourceUrl || ""].join("|");
}

const causalLanguage = /\b(caus(?:e|es|ed|ing)|causal|cause-and-effect|aggravat(?:e|es|ed|ing)|worsen(?:s|ed|ing)?|leads? to|result(?:s|ed|ing) in|due to|secondary (?:to|from)|proximately due)\b/i;
const medicationLanguage = /\b(medication|medications|drug|drugs|NSAID|SSRI|antidepressant|treatment side effect|side effect|pharmacologic)\b/i;
const legalCitation = /^(38 CFR|38 C\.F\.R\.|M21-1|VAOPGCPREC|Allen v\.|Walsh v\.)/i;

for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  for (const [suggestionIndex, suggestion] of (mapping.suggestions || []).entries()) {
    const refs = suggestion.sourceReferences || [];
    const hasClinicalEvidence = refs.some((reference) => reference.verificationScope === "clinical-evidence");
    const hasOnlyLegalReferences = refs.length > 0 && refs.every((reference) => legalCitation.test(reference.citation || ""));
    const rationale = suggestion.rationale || "";

    if (causalLanguage.test(rationale) && !hasClinicalEvidence) addHard(`${file}: suggestions[${suggestionIndex}]: causal/aggravation language has no clinical-evidence reference`);
    if (medicationLanguage.test(rationale) && !hasClinicalEvidence) addHard(`${file}: suggestions[${suggestionIndex}]: medication/treatment claim has no clinical-evidence reference`);
    if (hasOnlyLegalReferences && (causalLanguage.test(rationale) || medicationLanguage.test(rationale))) addHard(`${file}: suggestions[${suggestionIndex}]: medical proposition is supported only by legal/administrative authority`);

    for (const [referenceIndex, reference] of refs.entries()) {
      references += 1;
      liveReferenceKeys.add(liveKey(mapping.id, suggestion.conditionId, reference.citation, reference.sourceUrl));
      if (reference.verified === true) verified += 1;
      else {
        const citation = String(reference.citation || "(missing citation)");
        unverifiedByCitation.set(citation, (unverifiedByCitation.get(citation) || 0) + 1);
      }
      if (reference.verificationScope === "clinical-evidence") {
        clinical += 1;
        if (reference.sourceUrl) clinicalWithUrls += 1;
        if (!reference.sourceUrl) addHard(`${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]: clinical-evidence reference is missing sourceUrl`);
      }
      const prefix = `${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]`;
      if (reference.verified === true && reference.sourceUrl) {
        const position = classifyDigestPosition(reference, digestExemptions.compiled, todayIso);
        if (position.state === "digested") verifiedWithDigest += 1;
        else if (position.state === "exempt") verifiedDigestExempt += 1;
        else {
          verifiedUndigestedActionable += 1;
          if (position.pendingExemption) verifiedDigestExemptionPending += 1;
          actionableUndigestedRefs.push({ file, primary: mapping.id, target: suggestion.conditionId,
            citation: reference.citation, sourceUrl: reference.sourceUrl,
            sourceCheckedOn: reference.sourceCheckedOn, pendingExemptionId: position.pendingExemption?.id ?? null });
        }
        if (reference.contentDigest && position.state !== "digested") addHard(`${prefix}: malformed contentDigest`);
      }
      if (reference.verified === true) {
        for (const field of ["sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope"]) if (!reference[field]) addHard(`${prefix}: verified reference is missing ${field}`);
      }
      if (reference.citation === "38 CFR 3.310" && /cause|caused|aggravat|medication/i.test(reference.note || "")) addHard(`${prefix}: 38 CFR 3.310 is legal authority and must not be used as clinical evidence for the medical proposition in its note`);
      if (mapping.draft === false && reference.verified !== true) addReview(`${prefix}: published mapping still contains an unverified source`);
    }
  }
}

const retirementIds = new Set();
let retiredVerified = 0;
let retiredClinicalWithUrls = 0;
for (const [index, retirement] of retirements.entries()) {
  const prefix = `citation-retirements.json: retirements[${index}]`;
  if (!retirement.id) addHard(`${prefix}: missing id`);
  else if (retirementIds.has(retirement.id)) addHard(`${prefix}: duplicate id ${retirement.id}`);
  else retirementIds.add(retirement.id);

  for (const field of ["citation", "sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope", "retiredOn", "retirementReason"]) {
    if (!retirement[field]) addHard(`${prefix}: missing ${field}`);
  }
  if (!retirement.retiredFrom?.mappingId) addHard(`${prefix}: missing retiredFrom.mappingId`);
  if (!retirement.retiredFrom?.conditionId) addHard(`${prefix}: missing retiredFrom.conditionId`);
  if (retirement.previouslyVerified !== true) addHard(`${prefix}: retirement ledger is reserved for previously verified references`);
  if (!Array.isArray(retirement.withdrawalEvidence) || retirement.withdrawalEvidence.length === 0) addHard(`${prefix}: missing withdrawalEvidence`);

  const key = liveKey(retirement.retiredFrom?.mappingId, retirement.retiredFrom?.conditionId, retirement.citation, retirement.sourceUrl);
  if (liveReferenceKeys.has(key)) addHard(`${prefix}: retired reference is still live on the same relationship`);

  if (retirement.previouslyVerified === true) retiredVerified += 1;
  if (retirement.verificationScope === "clinical-evidence" && retirement.sourceUrl) retiredClinicalWithUrls += 1;
}

const unverified = references - verified;
const verifiedProvenance = verified + retiredVerified;
const clinicalEvidenceProvenanceWithUrls = clinicalWithUrls + retiredClinicalWithUrls;
const clinicalEvidenceUrlCoverageComplete = clinicalWithUrls === clinical;

// A live verified source may be legitimately retired, so protect total verified provenance
// rather than requiring the live verified subset itself never to decrease.
if (retiredVerified < CITATION_DEBT_BASELINE.retiredVerified) addHard(`citation debt ratchet: retired verified provenance regressed (${retiredVerified} < ${CITATION_DEBT_BASELINE.retiredVerified})`);
if (verifiedProvenance < CITATION_DEBT_BASELINE.verifiedProvenance) addHard(`citation debt ratchet: verified provenance regressed (${verifiedProvenance} < ${CITATION_DEBT_BASELINE.verifiedProvenance})`);
if (unverified > CITATION_DEBT_BASELINE.unverified) addHard(`citation debt ratchet: unverified reference count increased (${unverified} > ${CITATION_DEBT_BASELINE.unverified})`);
if (reviewFindings.length > CITATION_DEBT_BASELINE.reviewFindings) addHard(`citation debt ratchet: published unverified review findings increased (${reviewFindings.length} > ${CITATION_DEBT_BASELINE.reviewFindings})`);
if (!clinicalEvidenceUrlCoverageComplete) addHard(`citation provenance: not every live clinical-evidence reference has a canonical URL (${clinicalWithUrls}/${clinical})`);
if (retiredClinicalWithUrls < CITATION_DEBT_BASELINE.retiredClinicalEvidenceWithUrls) addHard(`citation debt ratchet: retired clinical URL provenance regressed (${retiredClinicalWithUrls} < ${CITATION_DEBT_BASELINE.retiredClinicalEvidenceWithUrls})`);

for (const problem of digestExemptions.problems) addHard(`digest-exemption register is invalid: ${problem}`);
for (const entry of digestExemptions.entries) {
  if (exemptionAssessmentStale(entry, todayIso)) addHard(`digest exemption ${entry?.id ?? "(no id)"}: assessment invalid, future-dated, or older than 365 days; re-measure before relying on it`);
}
if (verifiedDigestExemptionPending > 0) addHard(`${verifiedDigestExemptionPending} verified references match proposed digest exemptions awaiting qualified-human approval; no debt has been waived`);
if (verifiedUndigestedActionable > MAX_UNDIGESTED_VERIFIED_REFS) addHard(`content-drift observability regressed: ${verifiedUndigestedActionable} verified references lack an approved exemption or contentDigest (ratchet baseline ${MAX_UNDIGESTED_VERIFIED_REFS}); see docs/citation-verification-sop.md`);

const digestReport = { verifiedWithDigestCount: verifiedWithDigest, verifiedDigestExemptCount: verifiedDigestExempt,
  verifiedDigestExemptionPendingCount: verifiedDigestExemptionPending,
  verifiedUndigestedActionableCount: verifiedUndigestedActionable, maxUndigestedVerifiedRefs: MAX_UNDIGESTED_VERIFIED_REFS,
  actionableUndigested: actionableUndigestedRefs, digestExemptionProblemCount: digestExemptions.problems.length };
const unverifiedCitationCounts = [...unverifiedByCitation.entries()].map(([citation, count]) => ({ citation, count })).sort((a, b) => b.count - a.count || a.citation.localeCompare(b.citation));
const report = { ...digestReport, knowledgeBaseFiles: files.length, references, verified, retiredVerified, verifiedProvenance, unverified, citationDebtBaseline: CITATION_DEBT_BASELINE, clinicalEvidenceReferences: clinical, clinicalEvidenceReferencesWithUrls: clinicalWithUrls, clinicalEvidenceUrlCoverageComplete, retiredClinicalEvidenceReferencesWithUrls: retiredClinicalWithUrls, clinicalEvidenceProvenanceWithUrls, hardFindingCount: hardFindings.length, reviewFindingCount: reviewFindings.length, hardFindings, reviewFindings, unverifiedCitationCounts };
console.log(JSON.stringify(report, null, 2));
process.exitCode = hardFindings.length > 0 ? 1 : 0;
