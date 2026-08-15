# Qualified-Human Citation Verification Queue

Repository automation can prepare source-check metadata and identify every live published source that remains `verified: false`; it **cannot** make the qualified-human verification decision itself.

## Generate the queue

Run:

```bash
npm run citations:queue
```

The generated report is authoritative for the exact current human-review row set.

## Current Batch-30 baseline

The corrected candidate is expected to contain **59 live unverified references** and **57 live unverified published references**, pending fresh exact-head CI confirmation.

Batch 30 removes these four unverified published source rows because they do not meet the current directional publication threshold:

- Parkinson disease→depressive disorder, PMID 27358339;
- seizure disorder→depressive disorder, PMID 41967683;
- psoriatic arthritis→depressive disorder, PMID 38797775; and
- trigeminal neuralgia→anxiety disorder, PMID 29526561.

Only two new bounded clinical sources remain live, both `verified: false`:

- ovarian cancer→peripheral neuropathy, PMID 24582486; and
- testicular cancer→hypogonadism, PMID 27009402.

Two initially screened sources are **not** placed in the live published queue after review:

- PMID 30656706 supports adrenal histoplasmosis, but the current Histoplasmosis of Lung identity cannot enforce adrenal/disseminated disease site;
- PMID 29086803 supports post-total-laryngectomy voice handicap and alaryngeal speech rehabilitation, not the distinct diagnosis of aphonia.

All affected source records are unverified, so no verified-source retirement entry is created.

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
