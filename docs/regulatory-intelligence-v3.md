# Regulatory Intelligence v3: OIRA + Federal Register

This layer models VA regulatory actions as time-aware records keyed by the Regulatory Identification Number (RIN). It is intentionally separate from the medical knowledge base so legal/regulatory history can be reused across many condition mappings without duplicating rulemaking metadata.

## Core rule

A source's authority depends on both **what it is** and **what date/question is being asked**.

- Unified Agenda and OIRA review records describe planning and centralized review. They do not make a rule legally effective.
- OIRA EO 12866 stakeholder meetings are policy-development context only. They are not legal authority and are not a substitute for formal public comments submitted to the action agency.
- FederalRegister.gov is useful structured metadata but is not the official legal edition. Binding Federal Register reliance must be verified against the official edition, normally GovInfo.
- eCFR is current and authoritative but unofficial. Historical/current-law reconstruction should preserve the operative Federal Register action and, where legal-edition verification matters, the official CFR/Federal Register source.

## RIN registry

Every regulatory action is keyed by a RIN such as `2900-AQ73`. The same RIN follows an action across Agenda and rulemaking stages, making it the stable join key for:

- Unified Agenda entries;
- OIRA proposed/final review records;
- EO 12866 meetings;
- Federal Register proposed/final/correction documents;
- dockets and public-comment windows;
- related RINs and successor actions;
- downstream VA-condition impact.

## Lifecycle states

The application can derive a lifecycle state as of a requested date:

`agenda-planned → prerule → oira-review-proposed → proposed-published → comments-open/closed → oira-review-final → final-published → effective → codified`

Exceptional states have precedence when explicitly documented:

`withdrawn`, `delayed`, `stayed`, `corrected`, `superseded`, `rescinded`, `vacated`.

A Unified Agenda entry in “Final Rule Stage” is **not** treated as a final or effective rule. A Federal Register final rule is not treated as operative before its effective date.

## Date precision

Agenda dates are often estimates. The model preserves precision:

- `2027` = year precision;
- `2027-04` = month precision;
- `2027-04-15` = day precision.

A source date such as `04/00/2027` must never be normalized to `2027-04-01`.

## Federal Register applicability

Effective date and applicability are different fields. Applicability can describe, for example:

- claims received on or after a date;
- claims pending before VA;
- claims pending before federal courts;
- rating periods beginning on/after a date;
- custom language requiring legal review.

The authority-as-of helper can determine whether a rule is temporally operative. It does not pretend to resolve claimant-specific applicability when the source language requires human interpretation.

## Docket/comment intelligence

Federal Register document records preserve:

- docket IDs;
- Regulations.gov URL when known;
- comment opening/closing dates;
- comment status;
- comment instructions.

This allows the app to say “proposed rule — comments closed — not current law” rather than treating a proposal as a governing rule.

## OIRA review intelligence

OIRA review records preserve:

- review ID;
- received/concluded dates;
- pending vs concluded status;
- proposed/final/interim-final stage;
- conclusion text such as “Consistent with Change”;
- legal deadline status;
- economically-significant and major indicators when reported;
- regulatory-flexibility status.

All OIRA review records are hard-labeled `review-metadata-only`.

## OIRA stakeholder meetings

EO 12866 meeting records may store requesters, organizations, attendees, and submitted materials. Every record is hard-labeled `policy-development-context-only`.

The data can signal stakeholder interest and policy-development activity. It cannot establish what the final rule says, prove that a rule is effective, or substitute for comments in the agency's notice-and-comment docket.

## Source authenticity tiers

The model distinguishes:

1. `official-legal-edition` — e.g. official Federal Register/CFR material on GovInfo;
2. `authoritative-unofficial` — e.g. eCFR;
3. `informational-unofficial` — FederalRegister.gov structured publication display;
4. `planning-review-metadata` — Reginfo/OIRA;
5. `public-comment-docket` — Regulations.gov;
6. `agency-guidance` — VA procedural/guidance material;
7. `unknown`.

A final/interim-final Federal Register rule that may be relied on as binding authority must have explicit official-edition verification metadata.

## Regulatory impact

Each RIN can record whether it represents a current-law change, a pending change, or both in different aspects, plus affected:

- condition IDs;
- claim theories;
- Diagnostic Codes;
- presumptions;
- effective-date rules;
- CFR references.

The audit cross-checks affected condition IDs against the condition catalog and cross-checks KB `regulatoryActionRefs` against the RIN registry.

## Commands

- `npm run regulatory:validate` — structural and legal-status validation.
- `npm run regulatory:audit` — lifecycle/authenticity/cross-KB audit.
- `npm run regulatory:audit:markdown` — human-readable audit report.

## Migration policy

No existing medical mapping is rewritten merely because this registry exists. Add RIN records and `regulatoryActionRefs` only where the regulatory history materially affects the legal theory, rating criteria, presumption, toxic-exposure pathway, or effective-date analysis.
