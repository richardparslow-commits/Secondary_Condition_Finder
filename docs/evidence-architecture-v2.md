# Evidence Architecture v2

## Purpose

This upgrade separates **what a source is** from **what proposition the source is being used to prove**. It is a backward-compatible schema migration, not a wholesale remapping of the knowledge base.

Existing `verificationScope` remains supported. New or materially revised references should also populate `authorityCategory` and `propositionRole` when the classification is known.

## Authority categories

| Category | Intended use |
| --- | --- |
| `statutory-authority` | 38 U.S.C., enacted Public Laws, other controlling statutes |
| `current-regulatory-authority` | Current 38 C.F.R./eCFR regulatory text |
| `federal-register-final-rule` | Final/interim-final rule, effective date, applicability, rulemaking rationale/history |
| `federal-register-proposed-or-notice` | Proposed rules/notices used for context or regulatory history; never authored as binding authority |
| `va-adjudication-guidance` | M21-1/KnowVA and related VA procedural guidance |
| `medical-scientific-evidence` | Peer-reviewed literature and authoritative clinical/scientific evidence |
| `individual-evidence` | DBQs, C&P examinations, medical opinions, medical/service records, lay evidence |

## Proposition roles

`legal-framework`, `legal-presumption`, `regulatory-history`, `effective-date-applicability`, `rating-criteria`, `procedural-guidance`, `clinical-evidence`, and `individual-fact`.

The validator rejects explicit metadata that tries to use a statute, regulation, Federal Register document, or VA procedural source as ordinary clinical-causation proof. A legal presumption is represented as a **legal** proposition, not as clinical evidence.

## Claim-theory metadata

Suggestions can optionally identify `claimTheories` and `nexusRequirement`. These fields let audits distinguish direct, presumptive, secondary causation/aggravation, TERA, Gulf War/MUCMI, rating, rating-change, and effective-date work.

A purely presumptive mapping that still says an individualized nexus opinion is required is reported for review rather than silently accepted.

## Federal Register rules

Federal Register URLs are **not automatically assumed to be final rules**. Author `federalRegisterType` when known. Proposed rules/notices cannot be designated `binding`.

For final rules used in a `rating-change` or `effective-date` theory, record `effectiveDate` and `applicability` when available. `ruleVersion` can preserve the historically applicable version or amendment context.

## Migration workflow

1. Run `npm run evidence:architecture` (dry-run JSON audit).
2. Run `npm run evidence:architecture:markdown` for a human-readable review queue.
3. Review unknown Federal Register types and source-role conflicts.
4. If desired, run `node scripts/audit-evidence-architecture.js --write` locally. The write mode only adds high-confidence `authorityCategory`/`propositionRole` metadata; it does not change citations, rationales, ranks, evidence gaps, or substantive mappings.
5. Run `npm run kb:validate`, tests, typecheck, and the existing citation audits.

Do not require every suggestion to contain every authority category. The goal is **appropriate-source matching**, not seven-source completeness.

## Regulatory-action linkage

Evidence Architecture v3 adds optional `regulatoryActionRefs` on a suggestion. These references point to the normalized RIN registry in `data/regulatory-actions` without consuming the 1–3 `sourceReferences` allowance. The RIN registry owns shared OIRA/Federal Register lifecycle data; the medical KB continues to own the condition relationship and clinical evidence.
