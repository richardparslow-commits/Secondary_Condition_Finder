# Qualified-Human Citation Verification Queue

Repository automation can prepare source-check metadata and identify every live published source that remains `verified: false`; it **cannot** make the qualified-human verification decision itself.

## Generate the queue

Run:

```bash
npm run citations:queue
```

The generated report is authoritative for the exact current human-review row set.

## Current citation-verification baseline

After qualified-human Citation Verification Batches 01 through 04, the repository contains **41 live unverified references** and **39 live unverified published references**.

Batch 31 adds exactly two new bounded clinical source rows, both `verified: false`:

- insomnia→depressive disorder, PMID 38833937; and
- migraine headaches→depressive disorder, PMID 23588795.

Both are prospective incident-depression sources. Their published rationales explicitly distinguish population-level temporal risk from an individual medical nexus and require diagnosis-specific chronology and competing-cause review.

No source is automatically verified. Citation Verification Batches 01 through 04 each record five explicit qualified-human decisions, reducing the current ceilings to 41 live unverified references and 39 published-unverified review findings without changing the live-reference denominator.

The targeted screen also records several nonpublished evidence dispositions without adding live source rows: carpal tunnel syndrome psychiatric association (PMID 37639884); ME/CFS psychiatric temporal/comorbidity literature (including PMIDs 40785390, 15184691, 19566769); hypothyroidism/CTS evidence (PMID 41002938); narcolepsy/depression meta-analysis (PMID 32671534); peripheral-neuropathy/falls-fractures evidence (PMID 36945108); radial mononeuropathy characterization (PMID 41392533); REM sleep behavior disorder prodromal synucleinopathy evidence (PMIDs 39177811 and 28429825); and social-anxiety/depression prospective evidence (PMID 11231832). These are screening notes, not live published citation rows.

## Completed Citation Verification Batch 01

Five sources were reviewed and explicitly approved by the repository owner acting as the qualified human reviewer: achalasia→esophageal cancer (PMID 37975607), ACL injury→osteoarthritis (PMID 33852440), acromegaly→hypertension (PMID 42050227), traumatic limb amputation→depressive disorder (PMID 25294119), and sphincter-cutting anal-fistula treatment→fecal incontinence (PMID 33387100). The reproducible decision record is `docs/citation-verification-batch-01.md`.

## Completed Citation Verification Batch 02

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: asthma→OSA (PMID 40774162; proposition narrowed before verification), Barrett's esophagus→esophageal adenocarcinoma (PMID 41125322), cardiomyopathy→heart failure (PMID 37622657), cauda equina syndrome→erectile dysfunction (PMID 40380123; population/etiology scope narrowed before verification), and chronic liver disease with documented fibrosis progression→cirrhosis (PMID 32108989). The reproducible decision record is `docs/citation-verification-batch-02.md`.

## Completed Citation Verification Batch 03

Five additional sources were explicitly approved by the repository owner acting as the qualified human reviewer: chronic pyelonephritis→CKD (PMID 11110586), documented allergic-rhinitis phenotype→OSA (PMID 40774162), chronic rhinosinusitis→OSA (PMID 41969980), COPD→OSA overlap/coexistence (PMID 36672523; unsupported direct-secondary/aggravation pathway labels removed before verification), and Cushing's syndrome→hypertension (PMID 35950979). The reproducible decision record is `docs/citation-verification-batch-03.md`.

## Completed Citation Verification Batch 04

Five additional live clinical-evidence references were explicitly approved by the repository owner acting as the qualified human reviewer: depressive-disorder treatment→weight gain (PMID 31524318), obesity/weight gain→OSA as the second link in the depressive-disorder intermediate chain (PMID 40330547), depressive-disorder psychotropic treatment→erectile dysfunction with agent-specific safeguards (PMID 34247952), type 1 diabetes→CKD (PMID 41358881), and scalp discoid lupus→scarring alopecia (PMID 35817588). All five were verified as written. The reproducible decision record is `docs/citation-verification-batch-04.md`.

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
