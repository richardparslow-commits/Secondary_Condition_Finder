# Qualified-Human Citation Verification Queue

Repository automation can prepare source-check metadata and identify every live published source that remains `verified: false`; it **cannot** make the qualified-human verification decision itself.

## Generate the queue

Run:

```bash
npm run citations:queue
```

The report is generated directly from current published knowledge-base mappings and includes:

- primary mapping ID;
- secondary condition ID;
- citation;
- source role (`clinical-evidence`, `legal-framework`, or procedural guidance where present);
- canonical source URL;
- prior source-check date;
- source locator; and
- blank reviewer-decision fields.

The machine-readable form is available with:

```bash
node scripts/report-citation-verification-queue.js
```

## Current Batch-28 baseline

The expected citation-audit position remains **62 live unverified references** and **60 live unverified published references** pending exact-head CI confirmation. The two-count difference remains intentional: the audit counts unverified references that remain in draft mappings, while the human queue skips drafts and includes only references currently used by published mappings.

Batch 28 adds three focused published clinical sources and removes three nondirectional depression-association rows. This is a citation-debt exchange, not automated verification. The newly added sources for rectal-prolapse→fecal-incontinence, sphincter-involving anal-fistula treatment→fecal-incontinence, and obstructive hydronephrosis→chronic-kidney-disease all remain `verified: false` until qualified-human review.

The three withdrawn rows were also `verified: false`: gout→depressive-disorder, myasthenia-gravis→depressive-disorder, and multiple-sclerosis→depressive-disorder. Because they were never human-verified, they do not enter the verified-source retirement ledger.

`npm run citations:queue` is the authoritative source for the exact current human-review row set and role breakdown because later evidence batches can add, replace, retire, withdraw, consolidate, or verify individual sources.

## Human review procedure

For each row, a qualified reviewer must independently open the canonical source and determine whether the live citation accurately supports the exact proposition for which it is being used. The reviewer should verify:

1. bibliographic identity and canonical source;
2. study/guideline population and condition phenotype;
3. relationship direction and whether the source supports association, progression, treatment link, causation, aggravation, complication, or functional impairment as authored;
4. whether subgroup, phenotype, procedure, treatment, severity, anatomy, or diagnostic limitations are preserved in repository wording;
5. whether the cited source locator actually supports the note/rationale;
6. whether the source is current enough and whether newer evidence materially conflicts with the proposition; and
7. whether the source should be verified, replaced, retired, or the relationship should be narrowed/withdrawn.

## Permitted outcomes

- **VERIFY:** source and proposition are accurate. Update the live source record to `verified: true` and preserve URL/check date/locator/role.
- **REPLACE:** live proposition is defensible but the cited source is weak, outdated, or mismatched. Replace it with a better source; the new source remains `verified: false` until reviewed.
- **RETIRE:** a previously verified live source no longer belongs on the relationship. Use `data/citation-retirements.json` so verified provenance is not silently erased.
- **WITHDRAW/NARROW:** the evidence does not support the live proposition as authored. Fix the relationship rather than marking an inapplicable citation verified.
- **HOLD:** review is incomplete. Leave `verified: false`.

## Non-negotiable boundary

Source checking performed by an automated agent, including opening PubMed or a guideline and recording metadata, is not the qualified-human verification decision required by repository policy. The verification queue is considered **prepared and complete as an automation deliverable**, but individual `verified: true` decisions remain pending until a qualified human performs and records the review.
