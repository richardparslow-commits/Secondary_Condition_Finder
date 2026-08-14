# Clinical Evidence Promotion Batch 1

This is the first post-v2 evidence-promotion batch. It preserves the **300 catalog / 300 knowledge-base** identity contract and changes only individual relationship publication status plus bounded catalog-maintenance debt.

## Promoted relationships

### `cardiomyopathy` → `congestive-heart-failure`

Published as a single `disease-progression` pathway. The rationale is limited to documented cardiomyopathy with structural/functional myocardial dysfunction progressing to clinically diagnosed heart failure in some patients. It requires phenotype, ventricular-function, timing, competing-etiology, and cardiology-nexus review.

Clinical source recorded and source-checked on 2026-08-14:

- Arbelo et al., 2023 ESC Guidelines for the management of cardiomyopathies, PMID 37622657. The relevant guideline sections address heart-failure management in cardiomyopathy and note that patients with dilated cardiomyopathy often develop heart-failure symptoms.

### `urethral-stricture` → `hydronephrosis`

Published as a conservative `disease-progression` / `intermediate-chain` pathway. The claim is limited to sufficiently severe or prolonged urethral obstruction producing upper-tract back-pressure/dilation in some patients. It requires objective obstruction, imaging-confirmed hydronephrosis, timing, alternative-cause review, and response-to-decompression evidence where available.

Clinical source recorded and source-checked on 2026-08-14:

- Renal and ureteral complications of urethral stenosis, PMID 8571802. The clinical series reports ureterohydronephrosis among renal-ureteral complications of urethral stenosis.

## Withdrawn relationship content

`ankle-strain` is returned to `draft: true` with no published suggestions. The prior entries relied only on legal/rating authority and made stronger downstream knee-degradation/acquired-flatfoot claims than the reviewed chronic-ankle-instability literature supports. Biomechanical association evidence may inform future research authoring, but it is not being converted into an individual causation claim in this batch.

## Catalog-quality maintenance

`fibromyalgia` keeps the same stable catalog identity and 38 CFR 4.71a / DC 5025 rating context but is physically relocated from the historical hemic/immune catalog file to `data/conditions/musculoskeletal-quality-maintenance.json`.

This creates **33 catalog files** while preserving exactly **300 unique catalog conditions** and **300 one-to-one knowledge-base mappings**.

## Citation verification state

The repository Citation Verification SOP requires qualified-human verification before a citation may be marked `verified: true`. This batch records canonical URLs, source-check dates, source locators, and `verificationScope: "clinical-evidence"`, while intentionally retaining `verified: false` pending that sign-off.

The batch removes two unsupported published ankle references and adds two source-checked clinical-evidence references, so citation-reference and unverified-review debt should remain non-regressive while clinical-evidence URL coverage increases.

## Regression contract

`tests/clinical-evidence-promotion-batch1.test.ts` locks:

- 300/300 referential integrity;
- exactly the two approved promotions;
- conservative pathway/caveat language;
- source provenance with `verified: false`;
- ankle-strain withdrawal to draft; and
- fibromyalgia's physical catalog relocation without identity drift.
