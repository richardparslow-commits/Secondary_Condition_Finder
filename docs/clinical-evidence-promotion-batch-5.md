# Clinical Evidence Promotion Batch 5

Batch 5 preserves the exact **300 catalog / 300 knowledge-base** integrity contract.

## Expansion promotions

- `barretts-esophagus` → `esophageal-cancer`: published only as an **esophageal adenocarcinoma** progression pathway using the 2025 AGA Clinical Practice Guideline on surveillance of Barrett's esophagus (PMID 41125322). The generic cancer target is broader than this histology-specific pathway, so the mapping requires endoscopic/pathology confirmation, dysplasia and surveillance chronology when present, adenocarcinoma histology, and competing-risk review.
- `achalasia` → `esophageal-cancer`: published as a histology-aware risk/progression research pathway using the nationwide Veterans Affairs matched cohort (PMID 37975607). The cohort contained 1,863 Veterans with achalasia matched 1:4 to 7,452 controls and reported a higher esophageal-cancer risk (HR 4.6, 95% CI 2.3-9.2); cancers in the achalasia group were predominantly squamous-cell carcinoma. The mapping therefore requires pathology, chronology, treatment history, and competing-risk review rather than generalizing the association to every esophageal malignancy.

## Safety withdrawal

- `al-amyloidosis`: returned to draft. Its depression and GERD suggestions used only 38 CFR 3.310 plus generic chronic-condition/treatment language rather than AL-amyloidosis-specific clinical evidence.

## Catalog maintenance

`substance-use-disorder` is physically moved from `carried-over.json` into `mental-disorders.json`, preserving its stable ID, aliases, broad 38 CFR 4.130 framework, legal-eligibility cautions, and `verified: false` status. `carried-over.json` is reduced to the intentionally quarantined `contralateral-knee-condition` laterality placeholder.

## Citation position

Batch 5 keeps the Batch-4 debt ceilings flat while improving provenance:

- total references: **140**;
- verified: **14**;
- unverified: **126**;
- published-unverified review findings: **124**;
- clinical-evidence references with canonical URLs: **at least 37** (up from 35).

The two new clinical references replace the two legal-only AL-amyloidosis references that are retired with the safety withdrawal. No new source is automatically verified.

## Expected expansion state

Barrett's esophagus and achalasia are the eighth and ninth individually promoted Wave 1-7 mappings. **98 of 107 Wave 1-7 expansion mappings remain draft**.
