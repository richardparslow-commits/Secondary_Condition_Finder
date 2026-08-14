# Clinical Evidence Promotion Batch 9

Batch 9 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while adding one evidence-led expansion promotion, repairing one unsafe legacy mapping, and completing one bounded endocrine catalog relocation.

## Expansion promotion: Type 1 diabetes → chronic kidney disease

- `diabetes-mellitus-type-1` → `chronic-kidney-disease` is published as a bounded `disease-progression` research pathway using the 2026 American Diabetes Association CKD Standards of Care (PMID 41358881).
- The mapping does not equate CKD in a person with diabetes with diabetic kidney disease. It requires Type 1 diabetes duration, serial UACR/eGFR and urinalysis findings, the renal phenotype and chronology, and review for alternative renal disease when the presentation is atypical.
- The source remains `verified: false` after source checking; no automated authoring step performs qualified-human citation verification.

## Legacy safety repair: erectile dysfunction

- The prior `erectile-dysfunction` → `gerd` edge is removed. Its NSAID/GERD studies did not establish that erectile-dysfunction treatment produced the relevant NSAID exposure, so preserving that chain would overstate the attached evidence.
- `erectile-dysfunction` → `depressive-disorder` is clinically repaired with the 49-publication systematic review/meta-analysis by Liu et al. (PMID 29960891).
- The repaired rationale is deliberately association-focused: the meta-analysis found association in both directions and could not determine causal direction. Individual chronology, distress/functional impact, medication effects, vascular/endocrine/neurologic contributors, and other psychiatric or psychosocial causes remain explicit development issues.

## Bounded identity/modeling cleanup

- `hyperthyroidism` is physically moved from the historical `neurological.json` placement into `endocrine.json` while preserving its stable ID and knowledge-base publication state.
- The display name is normalized to **Hyperthyroidism**, and the current 38 CFR 4.119 / DC 7900 endocrine rating framework is recorded with `verified: false` preserved.
- No other thyroid or parathyroid identities are moved in this batch; their remaining historical placement debt stays isolated for later bounded maintenance.

## Citation position

Batch 9 tightens the automated non-regression ratchet to:

- total references: **133**;
- verified: **14**;
- unverified: **119**;
- published-unverified review findings: **117**;
- clinical-evidence references with canonical URLs: **at least 44**.

The unsupported ED→GERD chain retires three references, the ED→depression legal-only reference is replaced by one clinical source, and the Type 1 diabetes→CKD promotion adds one clinical source. The clinical-URL floor therefore remains 44 while total and published-unverified debt decrease. None of the new or repaired clinical sources is automatically marked verified.

## Expansion state

Type 1 diabetes is the twelfth individually reviewed Wave 1-7 expansion mapping to be promoted. **95 of the 107 expansion mappings remain safe drafts**. The overall condition catalog and knowledge-base universe remains frozen at 300/300.
