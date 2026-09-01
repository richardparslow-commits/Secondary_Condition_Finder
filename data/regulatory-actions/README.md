# Regulatory action registry

Store one JSON file per Regulatory Identification Number (RIN), named exactly as the RIN, for example `2900-AQ73.json`.

The registry is deliberately separate from `data/knowledge-base`. Knowledge-base suggestions may link to one or more regulatory actions with `regulatoryActionRefs`, while the RIN record owns the shared rulemaking history:

- Unified Agenda status and **imprecise planned dates preserved at their real precision**;
- OIRA reviews and review conclusions as non-authoritative review metadata;
- EO 12866 stakeholder meetings as policy-development context only;
- Federal Register proposed/final/correction documents and docket/comment data;
- official-edition verification against GovInfo for binding Federal Register reliance;
- effective/applicability dates and current legal status;
- related RINs, corrections, superseding actions, and regulatory lineage;
- VA-condition, claim-theory, Diagnostic Code, presumption, and effective-date impact.

Run `npm run regulatory:validate` for hard structural/legal-status checks and `npm run regulatory:audit` for lifecycle and cross-KB review findings.
