# Mapping Expansion Batch ME-34 - Approved Implementation Ledger

## Scope

ME-34 adds four conservative, draft-only, association-only mappings over existing catalog identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `appendicitis` | `female-infertility` | 25303785 | Require complicated or perforated appendicitis, relevant pelvic or tubal pathology, independently documented infertility, compatible chronology, and gynecologic review. |
| `arnold-chiari-malformation` | `sleep-apnea` | 31992420 | Require MRI-confirmed Chiari malformation, polysomnographic sleep-apnea phenotype, compatible chronology, and neurologic/sleep-medicine review; do not generalize a pediatric case report. |
| `atrial-flutter` | `cerebrovascular-accident-stroke-residuals` | 29223550 | Require documented atrial flutter, completed ischemic stroke with objective residuals, compatible chronology, rhythm/vascular evaluation, and competing-cause review. |
| `burns` | `contractures` | 30948277 | Require compatible burn depth/site, documented scar contracture or objective joint limitation, compatible chronology, and burn or rehabilitation review. |

## Evidence and publication state

- All four primary knowledge-base records remain `draft: true`.
- All four suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All four clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- Registry hashes were generated from the final suggestion/reference objects using repository canonicalization.

## Deferred and rejected candidates

- `benign-prostatic-hyperplasia -> urinary-incontinence` was deferred because `benign-prostatic-hyperplasia.json` already contains two published, citation-verified suggestions; adding a pending reference would violate the fail-closed publication gate. The pre-existing BPH mappings were restored unchanged.
- `bruxism-awake-sleep -> tmj-dysfunction` was rejected because PMID 9758394 concluded juvenile bruxism appeared unrelated to TMJ symptoms. **SUPERSEDED AS TO OUTCOME ONLY (2026-10-04):** the signed ME-34 reopening disposition (docs/catalog-identity-migration-design-2026-09-29.md, qualified-human decision 2026-09-29; executed as Stage 3c on 2026-10-04) reconciled the juvenile null with the adult meta-analytic association as an age-scope matter and authorized the `bruxism-awake-sleep` → `tmj-disorder` route only (adult anchors PMID 37474733 and PMID 27796166; the juvenile null PMID 9758394 carried as an explicit counterweight, direction unresolved). This historical rejection text is not rewritten, and no other ME-34 conclusion is reopened.

## Aggregate ratchet

- Relationships: `338 -> 342`
- Live source reference uses: `346 -> 350`
- Verified live uses: `256` unchanged
- Pending live uses: `90 -> 94`
- Clinical uses: `341 -> 345`
- Explicit publication guards: `264 -> 268`
- Source entities including lineage: `329 -> 333`
- Published/draft mapping counts: `139 / 674` unchanged

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
