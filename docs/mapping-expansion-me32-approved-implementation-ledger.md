# Mapping Expansion Batch ME-32 — Approved Implementation Ledger

## Scope

ME-32 adds five conservative, draft-only, association-only mappings over existing identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `ankle-strain` | `osteoarthritis` | 27259753 | Require independently documented ankle sprain with documented chronic instability or recurrent injury, radiographically documented ipsilateral ankle osteoarthritis compatible in chronology, and orthopedic review. |
| `ankylosis` | `osteoarthritis` | 31925464 | Require independently documented ankylosis of the affected joint by clinical and imaging assessment, radiographically documented adjacent or ipsilateral-segment osteoarthritis compatible in chronology, and orthopedic review. |
| `anorgasmia` | `depressive-disorder` | 11353583 | Require independently documented anorgasmia by sexual-medicine assessment, a diagnosed depressive disorder by structured psychiatric evaluation compatible in chronology, and mental-health review. |
| `anterior-cord-syndrome` | `urinary-incontinence` | 35835550 | Require independently documented anterior cord syndrome by imaging and clinical examination, documented urinary incontinence by urodynamic or validated assessment compatible in chronology, and specialist review. |
| `anorectal-stricture` | `fecal-incontinence` | 21441765 | Require independently documented anorectal stricture by endoscopic or radiographic assessment, documented fecal incontinence by validated assessment compatible in chronology, and specialist review. |

## Identity-scope decisions

- `ankle-strain` carries a `FINAL-CLOSE-PROPOSITION-MISMATCH` resolution (prior knee/flatfoot claims were withdrawn); the new edge is strictly same-ankle degeneration backed by International Ankle Consortium evidence, and both withdrawn-suggestion notes remain in force.
- `anosmia` was deliberately left unmapped: its `FINAL-CLOSE-PROPOSITION-MISMATCH` resolution rests on the withdrawal of a depression meta-analysis whose objective-olfactory-impairment finding did not survive publication-bias adjustment — the same weak-directional evidence category the closure rejected.
- `anhedonia` remains deferred as a transdiagnostic symptom rather than a stand-alone condition.
- `acrocyanosis`, `ankyloglossia`, `amputation-of-thumb-fingers-toes`, and `ankle-disarticulation` were deferred: no credible condition-specific target or evidence within scope.
- `ankle-strain → osteoarthritis` and `ankylosis → osteoarthritis` passed the rule-11 check: both are new carriers of a target already carried by distinct primaries (ACL/PCL injury, avascular necrosis, etc.), and no narrower identity duplicates these edges.

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `328 → 333`
- Live source reference uses: `336 → 341`
- Verified live uses: `256` unchanged
- Pending live uses: `80 → 85`
- Clinical uses: `331 → 336`
- Explicit publication guards: `244 → 259`
- Source entities including lineage: `319 → 324` (all five citations were new source entities)

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
