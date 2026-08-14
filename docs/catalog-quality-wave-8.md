# Catalog Quality Wave 8

Wave 8 is a post-v2 quality-maintenance batch. It does **not** expand the 300-condition target catalog and does not publish any draft secondary relationship.

## Scope

- Correct `fibromyalgia` to the musculoskeletal 38 CFR 4.71a / DC 5025 identity and remove the historical 4.88b carryover.
- Resolve rating-identity debt for `hip-strain`, `ankle-strain`, `diabetic-retinopathy`, `insomnia`, and `substance-use-disorder` without inventing diagnosis-specific codes where the schedule only supports a framework.
- Keep `contralateral-knee-condition` uncoded and explicitly quarantined as a legacy laterality/relationship placeholder rather than pretending it is a distinct diagnosis.
- Preserve exactly 300 catalog conditions and 300 knowledge-base mappings.
- Keep every corrected rating reference `verified: false` under automated-authoring policy.

## Non-goals

- No new condition identities.
- No secondary-pathway publication.
- No medical-causation inference from rating authority.
- No attempt to resolve substance-use service-connection or compensability questions through a rating-schedule citation.
- No laterality schema migration in this batch.

## Regression contract

`tests/catalog-quality-wave8.test.ts` locks the 300/300 integrity contract and the Wave 8 regulatory/modeling safeguards.
