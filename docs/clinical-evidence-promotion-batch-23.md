# Clinical Evidence Promotion Batch 23

Batch 23 preserves the exact **300 catalog / 300 knowledge-base** contract, resolves the final two screened Wave 1–7 promotion candidates, and exchanges two lower-value published citation-review rows for two condition-specific clinical-evidence sources without increasing unverified or published-review debt.

## Production-validated base

The batch branches from exact `main` SHA `fe2d29d1470755decffb5a3403db3fa9ec3d921d`, which passed CI #933 and Production Runtime Readiness #292 before the branch was created.

## Review-debt cleanup before promotion

Two published unverified rows are removed before the new sources are added:

1. `adjustment-disorder` → `migraine-headaches` is withdrawn. Its only attached source was `38 CFR 4.124a`, a rating framework, and the edge had no clinical-evidence source supporting the medical proposition.
2. `depressive-disorder` → `erectile-dysfunction` retains its two clinical systematic reviews and medication-related pathway, but the redundant unverified `38 CFR 3.310(a)-(b)` source is removed. The legal citation was not needed to support the medical proposition.

Neither cleanup changes the supported adjustment-disorder→OSA/GERD relationships or the antidepressant→sexual-dysfunction clinical evidence.

## Gout → depressive disorder

- `gout` is promoted from empty draft to one association/comorbidity suggestion: `depressive-disorder`.
- The source is Howren et al., *J Rheumatol* (2021), PMID 32115430, a systematic review/meta-analysis of 20 studies.
- The review reported a pooled depression odds ratio of 1.29 (95% CI 1.07–1.56); four incidence studies produced a pooled HR of 1.17 (95% CI 1.01–1.36).
- The mapping explicitly does **not** infer individual causation or aggravation from those population results. It requires case-specific review of gout phenotype, flares/tophi, pain/function, chronology, comorbidity, treatment, sleep, and prior psychiatric history.
- No automatic `pathwayIntelligence` is added.
- The source remains `verified: false` pending qualified-human verification.

## Myasthenia gravis → depressive disorder

- `myasthenia-gravis` is promoted from empty draft to one association/comorbidity suggestion: `depressive-disorder`.
- The source is Nadali et al., *Brain Behav* (2023), PMID 36495116, a systematic review/meta-analysis of 38 studies.
- The pooled prevalence of depression among people with MG was 36% (95% CI 28%–45%).
- The mapping treats that as comorbidity/prevalence evidence only, not proof that MG caused or aggravated an individual's depressive disorder. Disease severity, fatigue, ADL burden, bulbar/respiratory symptoms, treatment, sleep, disability, psychosocial factors, chronology, and prior psychiatric history remain individual review questions.
- No automatic `pathwayIntelligence` is added.
- The source remains `verified: false` pending qualified-human verification.

## Citation position

The two-row cleanup offsets the two new clinical references exactly:

- live references: **70**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **62**;
- published-unverified review findings: **60**;
- live clinical-evidence references with canonical URLs: **65** (up from 63);
- retired clinical-evidence URLs: **4**;
- clinical-URL provenance: **69** (up from 67).

The qualified-human queue contains 60 pending published references. The audit's 62 live-unverified total also includes two unverified references in draft mappings, which are intentionally excluded from the published-review queue.

## Expansion state

Batch 23 closes the screened promotion-candidate queue:

- published-evidence-led Wave identities: **20**;
- promotion candidates: **0**;
- intentional safe drafts: **87**;
- total Wave 1–7 identities: **107**.

The remaining 87 drafts are explicit safe dispositions, not an instruction to manufacture additional relationships. Future publication requires new condition-specific evidence sufficient for a separate bounded review.

## Validation policy

Batch 23 is not production-closed by documentation alone. The exact final branch head must pass citation audit, KB validation, lint, typecheck, critical-module composition, full one-shot tests, production build, both Chrome journeys, diagnostics, and aggregate fail-safe. Merge must use the exact validated head SHA, followed by independent `main` CI, exact Vercel deployment/canonical-alias/log proof, and Production Runtime Readiness on the merge SHA.
