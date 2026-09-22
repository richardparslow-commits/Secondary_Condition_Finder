# Regulatory action registry

Store one JSON file per Regulatory Identification Number (RIN), named exactly as the RIN, for example `2900-AQ73.json`.

The registry is deliberately separate from `data/knowledge-base`. Knowledge-base suggestions may link to one or more regulatory actions with `regulatoryActionRefs`, while the RIN record owns the shared rulemaking history:

- Unified Agenda status and **imprecise planned dates preserved at their real precision** (see [Imprecise planned dates](#imprecise-planned-dates));
- OIRA reviews and review conclusions as non-authoritative review metadata;
- EO 12866 stakeholder meetings as policy-development context only;
- Federal Register proposed/final/correction documents and docket/comment data;
- official-edition verification against GovInfo for binding Federal Register reliance;
- effective/applicability dates and current legal status;
- related RINs, corrections, superseding actions, and regulatory lineage;
- VA-condition, claim-theory, Diagnostic Code, presumption, and effective-date impact.

## Minimal file structure

The schema is `.strict()` — unknown keys are rejected — and every array field
defaults to empty, so a new record only needs the three required fields:

```json
{
  "rin": "2900-AQ73",
  "title": "Example VA rulemaking title",
  "agency": { "department": "Department of Veterans Affairs" }
}
```

With this input, `relatedRins`, `agenda`, and `federalRegisterDocuments`
materialize as `[]` and `oiraMeetingAvailability` as `"unknown"`. Add the
remaining sections (`agenda`, `federalRegisterDocuments`, `oiraReviews`,
`impact`, `sourceCheckedOn`) as research is completed — an intentionally
minimal record is preferable to speculative content.

## Imprecise planned dates

Unified Agenda entries frequently publish targets such as "Spring 2026" or
"May 2026". Record these at their **real precision** instead of inventing a day
or zero-padding a month — the schema enforces that the number of date segments
matches the declared precision (`year` → `YYYY`, `month` → `YYYY-MM`,
`day` → `YYYY-MM-DD`). A fabricated day is either rejected outright (a
three-segment value cannot carry `month` precision) or falsely exact (a
`day`-precision value asserts knowledge the source never gave).

```json
{ "action": "Final Action", "date": { "value": "2026-05", "precision": "month", "status": "anticipated" } }
```

For seasonal windows, use year precision and record the qualifier in `note`:

```json
{ "action": "Proposed Rule", "date": { "value": "2026", "precision": "year", "status": "anticipated", "note": "Spring 2026 per the Unified Agenda; exact month not yet announced." } }
```

## How to add a new RIN

1. **Create the file** at `data/regulatory-actions/<RIN>.json`, named exactly
   as the RIN in `NNNN-XXXX` form (uppercase; the validator compares the
   filename to the `rin` field). Files prefixed with `_` and non-`.json` files
   are ignored by the loader.
2. **Populate the required fields** — `rin`, `title`, and `agency.department` —
   using the minimal structure above. Dates follow the precision rules; source
   records must carry an `authenticity` block whose `publisher` and
   `legalEditionStatus` pair matches the schema's publisher rules (for example,
   Reginfo/OIRA content is always `planning-review-metadata`).
3. **Record provenance, not conclusions.** Set `sourceCheckedOn` to the date you
   verified the source, keep legal-status enums accurate (a proposed rule can
   never be marked effective), and leave `impact` off until a reviewed summary
   exists.
4. **Validate:** run `npm run regulatory:validate` for hard structural and
   legal-status checks, then `npm run regulatory:audit` for lifecycle and
   cross-KB review findings. Both must pass before opening a PR; CI runs them
   in the `verify-regulatory-intelligence` check.
