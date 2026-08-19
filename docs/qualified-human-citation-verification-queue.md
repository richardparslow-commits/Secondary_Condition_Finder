# Qualified-Human Citation Verification Queue

Repository automation can prepare source-check metadata and identify every live published source that remains `verified: false`; it **cannot** make the qualified-human verification decision itself.

## Generate the queue

Run:

```bash
npm run citations:queue
```

The generated report is authoritative for the exact current human-review row set.

## Current citation-verification baseline

After qualified-human Citation Verification Batches 01 through 13, the repository contains **5 live unverified references** and **5 live unverified published references**.

Batch 31 adds exactly two new bounded clinical source rows, both `verified: false`:

- insomnia→depressive disorder, PMID 38833937; and
- migraine headaches→depressive disorder, PMID 23588795.

Both are prospective incident-depression sources. Their published rationales explicitly distinguish population-level temporal risk from an individual medical nexus and require diagnosis-specific chronology and competing-cause review.

No source is automatically verified. Citation Verification Batches 01 through 13 record explicit qualified-human decisions, reducing the current ceilings to 1 live unverified references and 1 published-unverified review findings without changing the live-reference denominator. Batch 08 intentionally holds one reviewed source unverified because the current knowledge-base target is broader/different than the cited post-traumatic-headache evidence.

The targeted screen also records several nonpublished evidence dispositions without adding live source rows: carpal tunnel syndrome psychiatric association (PMID 37639884); ME/CFS psychiatric temporal/comorbidity literature (including PMIDs 40785390, 15184691, 19566769); hypothyroidism/CTS evidence (PMID 41002938); narcolepsy/depression meta-analysis (PMID 32671534); peripheral-neuropathy/falls-fractures evidence (PMID 36945108); radial mononeuropathy characterization (PMID 41392533); REM sleep behavior disorder prodromal synucleinopathy evidence (PMIDs 39177811 and 28429825); and social-anxiety/depression prospective evidence (PMID 11231832). These are screening notes, not live published citation rows.

## Completed Citation Verification Batch 01

Five sources were reviewed and explicitly approved by the repository owner acting as the qualified human reviewer: achalasia→esophageal cancer (PMID 37975607), ACL injury→osteoarthritis (PMID 33852440), acromegaly→hypertension (PMID 42050227), traumatic limb amputation→depressive disorder (PMID 25294119), and sphincter-cutting anal-fistula treatment→fecal incontinence (PMID 33387100). The reproducible decision record is `docs/citation-verification-batch-01.md`.

## Completed Citation Verification Batch 02

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: asthma→OSA (PMID 40774162; proposition narrowed before verification), Barrett's esophagus→esophageal adenocarcinoma (PMID 41125322), cardiomyopathy→heart failure (PMID 37622657), cauda equina syndrome→erectile dysfunction (PMID 40380123; population/etiology scope narrowed before verification), and chronic liver disease with documented fibrosis progression→cirrhosis (PMID 32108989). The reproducible decision record is `docs/citation-verification-batch-02.md`.

## Completed Citation Verification Batch 03

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: chronic pyelonephritis→CKD (PMID 11110586), documented allergic-rhinitis phenotype→OSA (PMID 40774162), chronic rhinosinusitis→OSA (PMID 41969980), COPD→OSA overlap/coexistence (PMID 36672523; unsupported direct-secondary/aggravation pathway labels removed before verification), and Cushing's syndrome→hypertension (PMID 35950979). The reproducible decision record is `docs/citation-verification-batch-03.md`.

## Completed Citation Verification Batch 04

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: depressive-disorder treatment→weight gain (PMID 31524318), obesity/weight gain→OSA as the second link in the depressive-disorder intermediate chain (PMID 40330547), depressive-disorder psychotropic treatment→erectile dysfunction with agent-specific safeguards (PMID 34247952), type 1 diabetes→CKD (PMID 41358881), and scalp discoid lupus→scarring alopecia (PMID 35817588). All five were verified as written. The reproducible decision record is `docs/citation-verification-batch-04.md`.

## Completed Citation Verification Batch 08

Five additional published clinical-evidence rows were explicitly reviewed by the repository owner. ILD→OSA (PMID 33403599), Paget disease→osteoarthritis (PMID 18504638), and ovarian-cancer paclitaxel treatment→peripheral neuropathy (PMID 24582486) were verified as written. Migraine→depressive disorder (PMID 23588795) was narrowed from `somatopsychic` mechanism metadata to temporal-association-only framing and then verified. Mild TBI→`migraine-headaches` (PMID 38568491) was narrowed to a phenotype-oriented post-traumatic-headache research flag and intentionally remains `verified: false` because the cited review does not independently establish the repository's migraine diagnostic target. The reproducible decision record is `docs/citation-verification-batch-08.md`.

## Completed Citation Verification Batch 07

Five additional live clinical-evidence references were explicitly approved by the repository owner: hypertensive heart disease→congestive heart failure (PMID 36082670), confirmed hypogonadism→osteoporosis (PMID 29499097), chronic hypoparathyroidism→kidney stones (PMID 36375810), and transvenous pacemaker lead→heart-valve disorder (PMID 34389210) as written; insomnia→depressive disorder (PMID 38833937) after removal of directional `direct-secondary` pathway intelligence and conversion to temporal-association framing. The reproducible decision record is `docs/citation-verification-batch-07.md`.

## Completed Citation Verification Batch 06

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: prolactin-secreting pituitary dysfunction→hypogonadism (PMID 40812946) as written; hypertension→CKD, ischemic heart disease, and congestive heart failure using the 2025 multisociety hypertension guideline (PMID 40811497) as written; and hypertension→erectile dysfunction after one-for-one replacement of PMID 27491642 with the current corrected 2025 multisociety guideline (PMID 40811497), retaining association-only and individual-causation safeguards. The reproducible decision record is `docs/citation-verification-batch-06.md`.

## Completed Citation Verification Batch 05

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: erectile dysfunction↔depressive disorder association evidence (PMID 29960891) after removing unsupported directional `somatopsychic` pathway intelligence; femoroacetabular impingement→hip osteoarthritis (PMID 26524551) as written; heart-valve-replacement residuals→hemolytic anemia after one-for-one source replacement with Alkhouli et al. (PMID 31039274); confirmed primary aldosteronism→hypertension as written; and confirmed primary hyperparathyroidism→kidney stones (PMID 36245251) as written. The reproducible decision record is `docs/citation-verification-batch-05.md`.

## Human review procedure

For each live queue row, a qualified reviewer must independently open the canonical source and determine whether the citation accurately supports the exact proposition for which it is being used, including phenotype, direction, treatment/procedure exposure, chronology, limitations, and competing explanations.

## Permitted outcomes

- **VERIFY:** source and proposition are accurate. Update the live source record to `verified: true` and preserve URL/check date/locator/role.
- **REPLACE:** proposition is defensible but the source is weak, outdated, or mismatched. A replacement remains `verified: false` until reviewed.
- **RETIRE:** a previously verified live source no longer belongs on the relationship; preserve provenance in `data/citation-retirements.json`.
- **WITHDRAW/NARROW:** the evidence does not support the live proposition as authored; fix the relationship rather than verifying an inapplicable citation.
- **HOLD:** review is incomplete; leave `verified: false`.

## Non-negotiable boundary

Automated source retrieval or screening is not the qualified-human verification decision required by repository policy.

<!-- citation-verification-master-current:start -->
## Current citation-verification position

Master-approved implementation is complete through **Batch 13**.
- Live verified references: **68**
- Retired verified references: **6**
- Verified provenance: **74**
- Live unverified references: **1**
- Published unverified review findings: **1**
- Hard findings: **0**
- Live clinical source URL coverage: **64/64**

Current unresolved published queue:
- `mild-tbi.json` → `migraine-headaches`: Schwedt TJ. Posttraumatic Headache. Continuum (Minneap Minn). 2024;30(2):411-424. PMID 38568491
<!-- citation-verification-master-current:end -->

<!-- clinical-mapping-m1-current:start -->
## Current clinical-mapping position — M1

Qualified-human Clinical Mapping Batch M1 is approved and implemented locally.

- Catalog identities: **300**
- Knowledge-base mappings: **300**
- Overall published mappings: **55**
- Overall draft mappings: **245**
- Wave 1–7 identities: **107**
- Wave dispositions: **31 published-evidence-led**, **76 safe-draft**, **0 promotion-candidate**
- live references: **73**
- live verified: **68**
- retired verified: **6**
- verified provenance: **74**
- live unverified: **5**
- published-unverified review findings: **5**
- live clinical-evidence references with canonical URLs: **68**
- retired clinical-evidence references with canonical URLs: **4**
- combined clinical-URL provenance observation: **72**
- hard citation findings: **0**

M1 publishes:
- `social-anxiety-disorder` → `depressive-disorder`: prospective temporal-risk/association only; no causal pathway metadata.
- `laryngeal-cancer` → `aphonia`: treatment-complication only; documented total laryngectomy and documented aphonia required.

The 5 live unverified published references are PMID 38568491, PMID 11231832, PMID 17679635, PMID 25630206, and PMID 20189345. No M1 source is auto-verified.
<!-- clinical-mapping-m1-current:end -->

<!-- CLINICAL-MAPPING-MASTER-2026:START -->
## Clinical Mapping Master Batch 2026 — pending citation verification

The 68 new live source rows below represent **60 unique PMIDs**. Mapping publication is approved; these source rows remain `verified:false` until separate qualified-human citation verification.

| PMID | Source | Relationship rows |
|---|---|---|
| 9371291 | Secondary myelodysplastic syndromes and leukemias. | 1: myelodysplastic-syndrome → leukemia |
| 10326187 | Osteoporosis and eating disorders. | 1: anorexia-nervosa → osteoporosis |
| 18038923 | Thrombocytopenia in sarcoidosis. | 1: sarcoidosis → thrombocytopenia |
| 20680529 | Osteoporosis in ankylosing spondylitis. | 1: ankylosing-spondylitis → osteoporosis |
| 20722714 | Risk of incident depression in patients with Parkinson disease in the UK. | 1: parkinsons-disease → depressive-disorder |
| 22694245 | Hiatal hernia and the risk of Barrett's esophagus. | 1: hiatal-hernia → barretts-esophagus |
| 25061487 | Osteoporosis in primary biliary cirrhosis of the liver. | 1: cirrhosis-of-the-liver → osteoporosis |
| 26882216 | Incidence rates of suicidal behaviors and treated depression in patients with and without psoriatic arthritis using the Clinical Practice Research Datalink. | 1: psoriatic-arthritis → depressive-disorder |
| 27666776 | COPD, emphysema and the onset of lung cancer. A systematic review. | 1: emphysema → respiratory-cancer |
| 28342087 | Pelvic inflammatory disease and the risk of ovarian cancer: a meta-analysis. | 1: pelvic-inflammatory-disease → ovarian-cancer |
| 29157021 | Gastroparesis: pharmacotherapy and cardiac risk. | 1: gastroparesis → cardiac-arrhythmia |
| 29280918 | Association between celiac disease and schizophrenia: a meta-analysis. | 1: celiac-disease → schizophrenia |
| 29735408 | Association Between Psoriasis and Erectile Dysfunction: A Meta-Analysis. | 1: psoriasis → erectile-dysfunction |
| 30393090 | Medication-related osteonecrosis of the jaw: definition and best practice for prevention, diagnosis, and treatment. | 1: osteoporosis → osteonecrosis-of-the-jaw |
| 30422277 | Association of Psoriasis With Inflammatory Bowel Disease: A Systematic Review and Meta-analysis. | 1: psoriasis → inflammatory-bowel-disease |
| 30912336 | Graves' Disease: Can It Be Cured? | 1: hyperthyroidism → hypothyroidism |
| 31203833 | Sleep Disorders and Risk of Incident Depression: A Population Case-Control Study. | 1: narcolepsy → depressive-disorder |
| 31782315 | New insights in Coxiella burnetii infection: diagnosis and therapeutic update. | 1: q-fever → gallbladder-disease |
| 31861595 | Animal Models of Post-Traumatic Epilepsy. | 1: penetrating-head-trauma → seizure-disorder |
| 32088651 | Hepatitis C virus infection and risk of pancreatic cancer: A meta-analysis. | 1: hepatitis → pancreatic-cancer |
| 33011316 | Association of psoriasis with colorectal cancer. | 1: psoriasis → colorectal-cancer |
| 33385426 | Prognostic Factors for Advanced Colorectal Neoplasia in Inflammatory Bowel Disease: Systematic Review and Meta-analysis. | 1: inflammatory-bowel-disease → colorectal-cancer |
| 33829302 | Long-term follow-up of conservative treatment of Charcot feet. | 1: charcot-arthropathy → amputation-or-loss-of-use |
| 34049905 | Association between early bronchiolitis and the development of childhood asthma: a meta-analysis. | 1: bronchiolitis → asthma |
| 34406259 | Predictors associated with sickle cell nephropathy: a systematic review. | 1: anemia → chronic-kidney-disease |
| 34447668 | Brucella Prosthetic Valve Endocarditis: A Systematic Review. | 1: brucellosis → cardiac-inflammatory-disease |
| 35233053 | Hypothyroidism and related comorbidities on the risks of developing tinnitus. | 1: hypothyroidism → tinnitus |
| 35334622 | The Risk of Trigeminal Neuralgia Following Osteoporosis. | 1: osteoporosis → trigeminal-neuralgia |
| 35383546 | Infective endocarditis by Actinomyces species: a systematic review. | 1: actinomycosis → cardiac-inflammatory-disease |
| 35605220 | Tuberculous Aortic Aneurysm - A Review. | 1: tuberculosis → aortic-aneurysm |
| 35787151 | Infective endocarditis by Nocardia species: a systematic review. | 1: nocardiosis → cardiac-inflammatory-disease |
| 35906745 | Systemic lupus erythematosus increases risk of incident atrial fibrillation: A systematic review and meta-analysis. | 1: systemic-lupus-erythematosus → cardiac-arrhythmia |
| 36680511 | Primary myelofibrosis: 2023 update on diagnosis, risk-stratification, and management. | 1: primary-myelofibrosis → leukemia |
| 36855430 | Association between coronary artery disease and incident cancer risk: a systematic review and meta-analysis of cohort studies. | 2: ischemic-heart-disease → colorectal-cancer; ischemic-heart-disease → respiratory-cancer |
| 37149284 | Association between gout and abdominal aortic aneurysm. | 1: gout → aortic-aneurysm |
| 37223912 | Cannabis Use Disorder and Subsequent Risk of Psychotic and Nonpsychotic Unipolar Depression and Bipolar Disorder. | 2: substance-use-disorder → depressive-disorder; substance-use-disorder → bipolar-disorder |
| 37230817 | Association between hepatitis B virus infection and risk of osteoporosis: A systematic review and meta-analysis. | 1: hepatitis → osteoporosis |
| 37349198 | Silicosis and tuberculosis: A systematic review and meta-analysis. | 1: pneumoconiosis → tuberculosis |
| 37357958 | Polycythemia vera: 2024 update on diagnosis, risk-stratification, and management. | 1: polycythemia-vera → leukemia |
| 37574171 | Incident Atrial Fibrillation and Survival Outcomes in Esophageal Cancer following Radiotherapy. | 1: esophageal-cancer → cardiac-arrhythmia |
| 37899363 | Risk of Parkinson's disease in hepatitis B and C populations: a systematic review and meta-analysis. | 1: hepatitis → parkinsons-disease |
| 38251522 | Association between biological immunotherapy for psoriasis and time to incident inflammatory arthritis: a retrospective cohort study. | 1: psoriasis → psoriatic-arthritis |
| 38269572 | Essential thrombocythemia: 2024 update on diagnosis, risk stratification, and management. | 1: essential-thrombocythemia → leukemia |
| 38355151 | Lung cancer risk and occupational pulmonary fibrosis: systematic review and meta-analysis. | 1: pulmonary-fibrosis → respiratory-cancer |
| 38573463 | Risk of sleep disorders in patients with pneumoconiosis: a retrospective cohort study. | 1: pneumoconiosis → sleep-apnea |
| 38652139 | Risk factors of transient and permanent hypoparathyroidism after thyroidectomy: a systematic review and meta-analysis. | 1: thyroid-cancer → hypoparathyroidism |
| 39005656 | Salmonella typhi and endocarditis: a systematic review of case reports. | 1: typhoid-fever → cardiac-inflammatory-disease |
| 39046420 | Immune recovery uveitis: an ocular manifestation in HIV/AIDS receiving treatment. | 1: hiv-aids → uveitis |
| 39324122 | Schizophrenia and type 2 diabetes risk: a systematic review and meta-analysis. | 1: schizophrenia → diabetes-mellitus-type-2 |
| 39847853 | Treatment Options for Buerger Disease: A Systematic Review and Meta-Analysis of Outcomes. | 1: thromboangiitis-obliterans → amputation-or-loss-of-use |
| 39895893 | Pancreatitis-associated Myocarditis: Systematic Review and Meta-analysis of a Deadly Duo. | 1: pancreatitis → cardiac-inflammatory-disease |
| 39963138 | Management of tuberculosis risk, screening and preventive therapy in patients with chronic autoimmune arthritis undergoing biotechnological and targeted immunosuppressive agents. | 1: psoriatic-arthritis → tuberculosis |
| 40005458 | Sarcoidosis-Associated Pulmonary Hypertension. | 1: sarcoidosis → pulmonary-hypertension |
| 40196966 | Benign Prostatic Hyperplasia Increases Long-term Chronic Kidney Disease Risk. | 1: benign-prostatic-hyperplasia → chronic-kidney-disease |
| 40329131 | Osteoarthritis and the risk of sleep apnea: a general population-based cohort study. | 1: osteoarthritis → sleep-apnea |
| 40420581 | Paradoxical Eczema Associated With Biologic Therapy in Psoriasis: A Systematic Review and Meta-Analysis. | 1: psoriasis → eczema |
| 40632946 | GOUT AND RISK OF AGE-RELATED MACULAR DEGENERATION. | 1: gout → macular-degeneration |
| 40658955 | Glucagon-Like Peptide-1 Receptor Agonists and Risk for Gastroesophageal Reflux Disease in Patients With Type 2 Diabetes : A Population-Based Cohort Study. | 1: diabetes-mellitus-type-2 → gerd |
| 40772230 | Association of gastroesophageal reflux disease with the incidence of pulmonary disease. | 7: gerd → asthma; gerd → bronchiectasis; gerd → copd; gerd → interstitial-lung-disease; gerd → pulmonary-fibrosis; gerd → respiratory-cancer; gerd → tuberculosis |
| 40959074 | Tuberculosis in patients with systemic lupus erythematosus. | 1: systemic-lupus-erythematosus → tuberculosis |
<!-- CLINICAL-MAPPING-MASTER-2026:END -->
