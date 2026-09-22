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

## Schema Example: Before & After

The example walks one real mapping through the migration: the `anxiety-disorder` suggestion in `data/knowledge-base/sleep-apnea.json` (OSA → anxiety disorder). The reference metadata in the "after" block matches the live file; `claimTheories` and `nexusRequirement` are the fields still to be authored during this migration. Both blocks parse under `conditionMappingSchema` as-is — the narrative fields that must satisfy the 50-character minimums (`etiologicalTrigger`, `primaryVector`, `conservativeRationale`) are shown verbatim.

### Before — legacy suggestion (verificationScope only)

Under the legacy shape each reference carries only `verificationScope`, and the suggestion has no theory-level metadata. This still validates, but audits cannot tell what each source is, what proposition it supports, or which claim theory it serves.

```json
{
  "conditionId": "anxiety-disorder",
  "rank": 3,
  "rationale": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
  "evidenceGaps": [
    "Qualified anxiety-disorder diagnosis rather than symptom screening alone",
    "Chronology comparing anxiety onset or worsening with OSA onset, severity, sleep fragmentation, and treatment",
    "Evaluation of psychiatric history, medications, substance use, psychosocial stressors, other sleep disorders, and other competing contributors",
    "Qualified mental-health or sleep-medicine opinion addressing directionality and any claimed individual causation or aggravation"
  ],
  "sourceReferences": [
    {
      "citation": "Garbarino et al., Behavioral Sleep Medicine (2020), PMID 30453780",
      "note": "Systematic review and meta-analysis found anxiety symptoms common in adults with OSA and described the relationship among OSA, anxiety, and depression as probably bidirectional; supports association, not automatic individual causation.",
      "verificationScope": "clinical-evidence",
      "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/30453780/",
      "verified": true,
      "sourceCheckedOn": "2026-08-19",
      "sourceLocator": "PMID 30453780"
    }
  ],
  "nexusClaim": {
    "nexusClassification": "DIRECT_CAUSATION",
    "etiologicalTrigger": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced."
  },
  "causalMechanism": {
    "mechanismCategory": "PSYCHOPHYSIOLOGICAL",
    "primaryVector": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
    "hypothesizedOnly": false
  },
  "evidentiaryProfile": {
    "etiologicalConsensus": "PROBABLE",
    "vaNexusProbabilityAlignment": "AT_LEAST_AS_LIKELY_AS_NOT",
    "conservativeRationale": "In medically conservative terms, the evidence supports the nexus at the at-least-as-likely-as-not level for this individual's presentation. Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
    "evidenceGaps": "Qualified anxiety-disorder diagnosis rather than symptom screening alone; Chronology comparing anxiety onset or worsening with OSA onset, severity, sleep fragmentation, and treatment; Evaluation of psychiatric history, medications, substance use, psychosocial stressors, other sleep disorders, and other competing contributors; Qualified mental-health or sleep-medicine opinion addressing directionality and any claimed individual causation or aggravation",
    "alternativeEtiologiesToRuleOut": ["Other causes not yet identified in this mapping"],
    "requiresSpecificDbqEvidence": false
  }
}
```

### After — fully migrated to Evidence Architecture v2

The same suggestion carrying the complete v2 metadata surface. The two reference-level fields answer *what the source is* (`authorityCategory`) and *what proposition it is used to prove* (`propositionRole`); the two suggestion-level fields answer *which legal theory the mapping advances* (`claimTheories`) and *what nexus evidence that theory requires* (`nexusRequirement`).

```json
{
  "conditionId": "anxiety-disorder",
  "rank": 3,
  "rationale": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
  "claimTheories": ["secondary-causation"],
  "nexusRequirement": "individual-medical-opinion",
  "evidenceGaps": [
    "Qualified anxiety-disorder diagnosis rather than symptom screening alone",
    "Chronology comparing anxiety onset or worsening with OSA onset, severity, sleep fragmentation, and treatment",
    "Evaluation of psychiatric history, medications, substance use, psychosocial stressors, other sleep disorders, and other competing contributors",
    "Qualified mental-health or sleep-medicine opinion addressing directionality and any claimed individual causation or aggravation"
  ],
  "sourceReferences": [
    {
      "citation": "Garbarino et al., Behavioral Sleep Medicine (2020), PMID 30453780",
      "note": "Systematic review and meta-analysis found anxiety symptoms common in adults with OSA and described the relationship among OSA, anxiety, and depression as probably bidirectional; supports association, not automatic individual causation.",
      "verificationScope": "clinical-evidence",
      "authorityCategory": "medical-scientific-evidence",
      "propositionRole": "clinical-evidence",
      "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/30453780/",
      "verified": true,
      "sourceCheckedOn": "2026-08-19",
      "sourceLocator": "PMID 30453780"
    }
  ],
  "nexusClaim": {
    "nexusClassification": "DIRECT_CAUSATION",
    "etiologicalTrigger": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced."
  },
  "causalMechanism": {
    "mechanismCategory": "PSYCHOPHYSIOLOGICAL",
    "primaryVector": "Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
    "hypothesizedOnly": false
  },
  "evidentiaryProfile": {
    "etiologicalConsensus": "PROBABLE",
    "vaNexusProbabilityAlignment": "AT_LEAST_AS_LIKELY_AS_NOT",
    "conservativeRationale": "In medically conservative terms, the evidence supports the nexus at the at-least-as-likely-as-not level for this individual's presentation. Anxiety symptoms are commonly reported in adults with obstructive sleep apnea, but systematic-review evidence characterizes the OSA-anxiety relationship as probably bidirectional rather than proving that OSA causes an anxiety disorder. The relationship should therefore remain association-focused and require individual diagnostic, chronological, and competing-cause evidence before any secondary-service-connection theory is advanced.",
    "evidenceGaps": "Qualified anxiety-disorder diagnosis rather than symptom screening alone; Chronology comparing anxiety onset or worsening with OSA onset, severity, sleep fragmentation, and treatment; Evaluation of psychiatric history, medications, substance use, psychosocial stressors, other sleep disorders, and other competing contributors; Qualified mental-health or sleep-medicine opinion addressing directionality and any claimed individual causation or aggravation",
    "alternativeEtiologiesToRuleOut": ["Other causes not yet identified in this mapping"],
    "requiresSpecificDbqEvidence": false
  }
}
```

The migration delta is exactly four fields:

- `sourceReferences[].authorityCategory`: `medical-scientific-evidence` (peer-reviewed literature).
- `sourceReferences[].propositionRole`: `clinical-evidence` (the citation is used to prove a clinical-etiology proposition, not a legal one).
- `claimTheories`: `["secondary-causation"]` — this is a service-connected-primary → secondary causation theory.
- `nexusRequirement`: `individual-medical-opinion` — the theory requires a qualified individualized nexus opinion; it is not legally presumed.

Other mappings migrate with different values. The `depressive-disorder` suggestion in the same file (`nexusClassification: "AGGRAVATION"`) carries the same two reference fields but:

```json
{
  "claimTheories": ["secondary-aggravation"],
  "nexusRequirement": "individual-medical-opinion"
}
```

And a purely presumptive mapping (e.g., a §§ 3.307/3.309 presumption with no individualized-nexus requirement) would use:

```json
{
  "claimTheories": ["presumptive"],
  "nexusRequirement": "legally-presumed"
}
```

### Field-by-field migration reference

| Field | Placement | Allowed values | Migration action |
| --- | --- | --- | --- |
| `verificationScope` | per reference | `legal-framework`, `clinical-evidence`, `procedural-guidance` | Retain; still supported for backward compatibility |
| `authorityCategory` | per reference | `statutory-authority`, `current-regulatory-authority`, `federal-register-final-rule`, `federal-register-proposed-or-notice`, `va-adjudication-guidance`, `medical-scientific-evidence`, `individual-evidence` | Add when the source classification is known |
| `propositionRole` | per reference | `legal-framework`, `legal-presumption`, `regulatory-history`, `effective-date-applicability`, `rating-criteria`, `procedural-guidance`, `clinical-evidence`, `individual-fact` | Add when the proposition the source supports is known |
| `claimTheories` | suggestion level | `direct`, `presumptive`, `secondary-causation`, `secondary-aggravation`, `tera`, `gulf-war-mucmi`, `increased-rating`, `rating-change`, `effective-date` (array, 1–4, unique) | Add for new or materially revised suggestions |
| `nexusRequirement` | suggestion level | `individual-medical-opinion`, `legally-presumed`, `theory-dependent`, `not-applicable` | Add alongside `claimTheories` |

### Validation contract

- `claimTheories` values must be unique; duplicates are rejected by `kb:validate`.
- `nexusRequirement: "legally-presumed"` requires the `presumptive` claim theory whenever `claimTheories` is explicitly supplied.
- Existing guardrails still apply: an `ASSOCIATION_ONLY` edge must keep `causalMechanism.hypothesizedOnly: true` and cannot carry a `WELL_ESTABLISHED` etiological consensus.
- The schema reserves `regulatoryActionRefs` for the next iteration — leave it unset during the v2 migration (see [Future Roadmap (v3)](#future-roadmap-v3)).
- After editing, run `npm run evidence:architecture` (dry-run audit) and `npm run kb:validate`; both gates run in CI under the `verify-regulatory-intelligence` check.

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

## Future Roadmap (v3)

> Everything below is **not part of the v2 migration** — do not add `regulatoryActionRefs` to knowledge-base files while landing v2 changes. It documents the next iteration so the v2 `claimTheories` shape leaves room for it.

### Regulatory-action linkage

Evidence Architecture v3 adds optional `regulatoryActionRefs` on a suggestion. These references point to the normalized RIN registry in `data/regulatory-actions` without consuming the 1–3 `sourceReferences` allowance. The RIN registry owns shared OIRA/Federal Register lifecycle data; the medical KB continues to own the condition relationship and clinical evidence.
