# Mapping Expansion Batch ME-33 - Approved Implementation Ledger

## Scope

ME-33 adds five conservative, draft-only, association-only mappings over existing identities. Each row has one condition-specific clinical reference, an explicit publication guard, bounded evidence gaps, and no pathway intelligence. No primary publication state changed.

| Primary | Target | PMID | Boundary |
|---|---|---:|---|
| `anal-fissure` | `fecal-incontinence` | 17665247 | Require independently documented chronic anal fissure and fecal incontinence by validated assessment with compatible chronology, and colorectal review. |
| `ankle-disarticulation` | `phantom-limb-pain` | 28242264 | Require independently documented ankle disarticulation, documented phantom limb pain by validated assessment compatible in chronology, and specialist review. |
| `ankyloglossia` | `dysphagia` | 31367903 | Require independently documented ankyloglossia with clinically relevant restriction, objectively documented dysphagia by feeding or swallowing assessment compatible in chronology, and pediatric otolaryngology or speech-language pathology review. |
| `apraxia` | `dysphagia` | 35508738 | Require independently documented oral or motor apraxia with a compatible neurologic phenotype, objectively documented dysphagia by clinical or instrumental swallowing assessment compatible in chronology, and neurologic and speech-language pathology review. |
| `anterior-interosseous-nerve-syndrome` | `peripheral-nerve-paralysis` | 21611763 | Require independently documented anterior interosseous nerve syndrome with electrodiagnostic or specialist confirmation, objectively documented motor deficit compatible in chronology, and hand or peripheral-nerve review. |

## Identity-scope decisions

- `anal-fissure` is limited to a chronic-fissure continence association and does not infer incontinence from fissure diagnosis or sphincterotomy without individual chronology and objective review.
- `ankle-disarticulation` uses lower-limb amputation-level evidence and does not generalize phantom pain to every individual.
- `ankyloglossia` is limited to pediatric oral or pharyngeal swallowing concerns; posterior tongue-tie evidence is not generalized to all ages or all dysphagia phenotypes.
- `apraxia` is limited to oral apraxia in a compatible subacute-stroke phenotype; the broad apraxia identity does not establish dysphagia in every neurologic context.
- `anterior-interosseous-nerve-syndrome` uses `peripheral-nerve-paralysis` as the narrowest existing target; the edge is limited to objectively documented motor palsy and does not assert a particular VA severity level.

## Evidence and publication state

- All five primary knowledge-base records remain `draft: true`.
- All five suggestions are `ASSOCIATION_ONLY`; no individual causation or aggravation is asserted.
- All five clinical references remain `verified: false` and `pending-verification`.
- Qualified-human citation review is required before citation promotion or publication-state change.
- The registry snapshots use exact suggestion-object and raw-reference hashes generated with repository canonicalization.

## Aggregate ratchet

- Relationships: `333 -> 338`
- Live source reference uses: `341 -> 346`
- Verified live uses: `256` unchanged
- Pending live uses: `85 -> 90`
- Clinical uses: `336 -> 341`
- Explicit publication guards: `259 -> 264`
- Source entities including lineage: `324 -> 329` (all five citations were new source entities)

## Safety boundary

These records are evidence-navigation aids only. They do not diagnose a condition, establish a VA medical nexus, determine service connection, or replace qualified clinical and accredited-representative review. Pending citation state is intentionally fail-closed.
