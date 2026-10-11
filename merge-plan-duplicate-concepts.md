# Knowledge-base duplicate concept merge plan
# Generated from offline analysis of this repository's data/knowledge-base catalog, graph edges, and evidence baggage.

## Scope and method
- Catalog analyzed: `data/knowledge-base/*.json`
- Recorded edges used for preservation analysis:
  - per-concept `suggestions[].conditionId` as directed primary -> secondary edges
  - `data/knowledge-base/graph/*.json` `outgoingEdges` where present and readable
  - evidence baggage reviewed from `data/evidence/master-relationships.json`, `data/evidence/master-sources.json`, and the per-concept file bodies
- Duplicate detection was conservative and technical:
  - token-set Jaccard overlap >= 0.5 with at least two shared content tokens
  - plus explicit human disclosure that `epilepsy` and `seizure-disorder` are duplicate concepts
- This is a **planning artifact**, not an implemented merge. It proposes canonical targets, redirect/archive behavior, and the exact edge maps that must be preserved before any file is deleted or rewritten.

## Important caveat from the existing maintainer note
`data/knowledge-base/graph/traumatic-brain-injury-residuals.json` already records a maintainer decision target on the epilepsy / seizure-disorder pair:

- The graph node is written against the **draft** identity `seizure-disorder`.
- The maintainer note says: *a maintainer must decide that the two are not duplicate concepts before either is published.*
- It also distinguishes `epilepsy` from `seizure-disorder` operationally by reference to 38 CFR 3.310(d)(1)(ii) presumptions, provoked vs unprovoked seizures, pre-existing epilepsy exclusions, and the requirement to characterize the seizure disorder by neurologist diagnosis / EEG semiology.

That note means the epilepsy / seizure-disorder pair cannot be merged purely as lexical synonyms. It must be resolved as a **catalog-identity decision**: either keep them distinct, or merge them and explicitly transfer the rolled-up identity that the TBI residuals pathway already relies on.

---

## 1. Confirmed duplicate concern from the human disclosure
### 1.1 epilepsy / seizure-disorder

#### Current state
- `data/knowledge-base/epilepsy.json`
  - id: `epilepsy`
  - draft: false
  - one published `ASSOCIATION_ONLY` suggestion to `depressive-disorder`
  - source baggage: PMID 35413534 meta-analysis, qualified-human verified under Clinical Mapping Master Resolution Citation Verification 2026
  - guard language: requires separately diagnosed epilepsy and depressive disorder; association/risk only; bidirectional/confounding acknowledged; no individual nexus asserted
- `data/knowledge-base/seizure-disorder.json`
  - id: `seizure-disorder`
  - draft: true
  - suggestions: empty
  - todo notes describe withdrawal of a prior depressive-disorder edge because the cited evidence only supported comorbidity / screening relevance, not a seizure-disorder-caused pathway

#### Edge map currently in the catalog
From the suggested-condition edges readable today:

- `epilepsy` -> `depressive-disorder`
- `depressive-disorder` incoming includes `epilepsy`
- `seizure-disorder` has no outgoing suggestion edges readable here

From the same catalog build, other live concepts currently point **into** these two identities:

Incoming parents of `epilepsy`:
- cerebral-contusion-diffuse-axonal-injury
- cerebral-palsy
- intracranial-injury-without-skull-fracture
- malaria
- skull-fracture-non-basilar-and-basal

Incoming parents of `seizure-disorder`:
- brain-abscess
- brain-cancer
- brain-tumors
- cerebral-contusion
- encephalitis
- hashimoto-s-encephalopathy
- hypoglycemia
- penetrating-head-trauma
- rickets
- scotoma
- subdural-hematoma
- traumatic-brain-injury-residuals

A separate, higher-resolution edge view also shows:
- `cerebral-contusion` -> `seizure-disorder`
- `cerebral-contusion-diffuse-axonal-injury` -> `epilepsy`
- `traumatic-brain-injury-residuals` -> `seizure-disorder` (DIRECT_CAUSATION, strong regulatory/mechanism baggage)

#### Why this pair is not a trivial rename
There is real semantic overlap, but the catalog already uses the two ids in **different edge neighborhoods** and the draft `seizure-disorder` file is tied to a pending TBI-residuals decision. A merge plan has to preserve:
- the existing `epilepsy -> depressive-disorder` evidence bag and guard
- the incoming parents already attached to each id
- the draft TBI pathway written against `seizure-disorder`

---

## 2. High overlap candidate pairs that are **not** necessarily duplicates
These surfaced from token overlap and deserve human review, but most are **genus/subtype**, **morphologically distinct**, or **partially overlapping clinical concepts**, not obvious duplicates.

I list them because a merge pass should explicitly decide each one rather than let it linger as undeclared redundancy.

### 2.1 Epilepsy neighborhood
- cerebral-contusion
- cerebral-contusion-diffuse-axonal-injury
- diffuse-axonal-injury

These are high-overlap and clinically related, but the catalog currently treats them as distinct identities with **different downstream targets**:
- cerebral-contusion -> seizure-disorder
- cerebral-contusion-diffuse-axonal-injury -> epilepsy
- diffuse-axonal-injury -> cognitive-disorder

Merge posture: **not automatic duplicates**. If anything, this cluster argues for an explicit `is-a / broader-narrower` relationship rather than deletion.

### 2.2 Diabetes mellitus cluster
- diabetes-mellitus
- diabetes-mellitus-type-1
- diabetes-mellitus-type-2

Currently:
- diabetes-mellitus has no outgoing suggestion edge readable here, but incoming parents include glucagonoma, periodontitis, scleredema, somatostatinoma
- diabetes-mellitus-type-1 -> chronic-kidney-disease, diabetic-retinopathy
- diabetes-mellitus-type-2 -> chronic-kidney-disease, depressive-disorder, diabetic-retinopathy, gerd
- diabetes-mellitus-type-2 incoming parents include acanthosis-nigricans, insulin-resistance-syndrome, metabolic-syndrome, ptsd, schizophrenia
- shared outgoing targets between type 1 and type 2: chronic-kidney-disease, diabetic-retinopathy

Merge posture: **keep distinct, but de-duplicate the implied hierarchy**. This is a subtype situation. If the catalog wants a single canonical "diabetes mellitus" node, it must first decide whether type-specific evidence bags are preserved as child relationships or folded into a parent with type tags.

### 2.3 Hearing loss cluster
- hearing-loss
- conductive-hearing-loss
- noise-induced-hearing-loss

Currently:
- hearing-loss -> cognitive-disorder, depressive-disorder
- conductive-hearing-loss -> tinnitus
- noise-induced-hearing-loss: no outgoing suggestion edge readable here
- shared incoming parent: otosclerosis points to both hearing-loss and conductive-hearing-loss

Merge posture: **not duplicates**. These are phenotype mechanism splits.

### 2.4 Spinal stenosis cluster
- spinal-stenosis
- lumbar-spinal-stenosis

Currently:
- spinal-stenosis: no suggestion edge readable here; incoming parent dwarfism
- lumbar-spinal-stenosis -> cauda-equina-syndrome

Merge posture: **probably keep distinct**, or if merged, preserve the cauda-equina-syndrome edge against the more specific node.

### 2.5 Urinary incontinence cluster
- urinary-incontinence
- stress-urinary-incontinence
- urge-urinary-incontinence
- mixed-urinary-incontinence

Currently:
- urinary-incontinence: no suggestion edge readable here; many incoming parents including cauda-equina-syndrome, prostate-cancer, bladder-cancer, central-cord-syndrome, conus-medullaris-syndrome, anterior-cord-syndrome, brown-s-quard-syndrome, dementia
- stress-urinary-incontinence -> depressive-disorder
- mixed-urinary-incontinence -> depressive-disorder
- stress and mixed share outgoing target depressive-disorder

Merge posture: **likely keep distinct subtypes**, but if there is a generic "urinary-incontinence" catch-all that is never used meaningfully, that catch-all may be a merge/archive candidate. The subtype edges to depressive-disorder must survive.

### 2.6 Interstitial pneumonia cluster
- interstitial-pneumonia (no file found in this catalog pass)
- acute-interstitial-pneumonia -> pulmonary-fibrosis
- nonspecific-interstitial-pneumonia: no suggestion edge readable here

Merge posture: **cannot merge safely without finding the interstitial-pneumonia identity first**. The missing file is itself a finding: the high-overlap pair list references an identity that did not resolve to a file in this catalog scan.

### 2.7 Muscle atrophy cluster
- muscle-atrophy
- interosseous-muscle-atrophy

Currently:
- muscle-atrophy: no suggestion edge readable here; incoming parents guyon-s-canal-syndrome, peripheral-nerve-paralysis
- interosseous-muscle-atrophy: no suggestion edge readable here; no incoming parents readable here

Merge posture: **low-risk duplicate candidate**, but still needs evidence-baggage review. This is the kind of pair where a merge is most plausible if a human agrees the more specific node adds nothing beyond the general one.

### 2.8 Lymphoma cluster
- hodgkins-lymphoma -> hypothyroidism
- non-hodgkins-lymphoma -> peripheral-neuropathy
- incoming parent of non-hodgkins-lymphoma: microscopic-colitis, sialadenitis

Merge posture: **not duplicates**. Different entity class in practice and different downstream edges.

### 2.9 Liver abscess cluster
- liver-abscess -> brain-abscess, lung-abscess, meningitis, pleural-effusion, visual-impairment
- amebic-liver-abscess -> pleural-effusion
- incoming parent of amebic-liver-abscess: amebiasis
- shared outgoing target: pleural-effusion

Merge posture: **not duplicates**. One is etiology-specific, the other general. If merged, the amebiasis-linked evidence bag and the broader liver-abscess complication set must be preserved separately or retagged.

### 2.10 Vocal cord cluster
- vocal-cord-dysfunction
- vocal-cord-paralysis
- vocal-cord-nodules-polyps-cysts-paralysis

Currently:
- vocal-cord-nodules-polyps-cysts-paralysis incoming parent: chronic-laryngitis

Merge posture: **not duplicates** based on current naming; these look like distinct laryngeal phenotypes. If anything, this may be a naming-quality issue rather than a true duplicate.

### 2.11 Septal defect cluster
- atrial-septal-defect -> pulmonary-hypertension
- ventricular-septal-defect: no suggestion edge readable here

Merge posture: **not duplicates**. Different cardiac anatomy.

### 2.12 Peripheral neuropathy cluster
- peripheral-neuropathy: no suggestion edge readable here; many incoming parents including breast-cancer, colorectal-cancer, ovarian-cancer, hiv-aids, malabsorption-syndrome, malnutrition-residuals, cold-injury-residuals, heterotopic-ossification, microscopic-polyangiitis, muscle-hernias, non-hodgkins-lymphoma
- early-onset-peripheral-neuropathy -> pes-cavus

Merge posture: **keep distinct**. The early-onset node carries a specific downstream edge and probably a distinct etiologic framing.

### 2.13 Rotator cuff cluster
- rotator-cuff-injury incoming parent: bicipital-tendinitis, slap-tear
- rotator-cuff-tear: no suggestion edge readable here

Merge posture: **possible duplicate or near-duplicate**, depending on whether the catalog intends "injury" and "tear" to be the same concept. If merged, preserve the incoming parents and choose one canonical id.

---

## 3. Duplicate decision map
Use this as the working checklist. Each row is a candidate identity pair/cluster that should be adjudicated before any files change.

### 3.1 Preserve-distinct (at least for now)
These are not convincingly duplicate from the catalog alone:
- cerebral-contusion / cerebral-contusion-diffuse-axonal-injury / diffuse-axonal-injury
- diabetes-mellitus / diabetes-mellitus-type-1 / diabetes-mellitus-type-2
- hearing-loss / conductive-hearing-loss / noise-induced-hearing-loss
- spinal-stenosis / lumbar-spinal-stenosis
- urinary-incontinence / stress-urinary-incontinence / urge-urinary-incontinence / mixed-urinary-incontinence
- hodgkins-lymphoma / non-hodgkins-lymphoma
- liver-abscess / amebic-liver-abscess
- vocal-cord-dysfunction / vocal-cord-paralysis / vocal-cord-nodules-polyps-cysts-paralysis
- atrial-septal-defect / ventricular-septal-defect
- peripheral-neuropathy / early-onset-peripheral-neuropathy
- epilepsy / seizure-disorder — **pending identity decision**, not automatic merge

### 3.2 Likely duplicate / strong merge candidates, if human agrees
These are the weakest-identity pairs and the most plausible true duplicates:
- muscle-atrophy / interosseous-muscle-atrophy
- rotator-cuff-injury / rotator-cuff-tear

These should still be verified because "duplicate concept" is a semantic adjudication, not just a filename similarity call.

### 3.3 Name collision / discovery issues to resolve first
- interstitial-pneumonia appears in overlap analysis but did not resolve to a file in this catalog pass
- epilepsy and seizure-disorder are the explicitly disclosed duplicate concern, but their edge neighborhoods differ and one is a draft tied to a pending TBI decision

---

## 4. Merge mechanics that preserve existing edges
If a pair is approved for merge, do not delete edges by accident. Use a redirect-and-absorb pattern:

### 4.1 Canonical choice rule
- Prefer the **published** identity over a draft identity when all else is equal.
- Prefer the identity with **more preserved evidence baggage** when the two are otherwise equivalent.
- If one identity is draft and the other published, the draft id is the strong merge candidate **only** if the published id is the one intended to disappear.
- If both have meaningful edge differences, merge is probably the wrong operation; prefer a declared broader/narrower or alias relationship instead.

### 4.2 Epilepsy / seizure-disorder specific approach
Two acceptable outcomes are possible; this plan does not force one.

#### Option A: keep distinct, declare relationship
- Keep `epilepsy` and `seizure-disorder` as separate catalog ids.
- Add an explicit cross-reference such as "consider-as-related-identity" or "potential-synonym-under-review" instead of a hard merge.
- Preserve:
  - epilepsy -> depressive-disorder with its existing guard/PMID baggage
  - seizure-disorder draft todo, including the withdrawn depressive-disorder reasoning
  - TBI residuals -> seizure-disorder DIRECT_CAUSATION edge and its regulatory/mechanism baggage
  - all incoming parents currently attached to each id
- This preserves the maintainer note's "decide before publishing" constraint.

#### Option B: merge, with explicit rolled-up identity
If a human decides the catalog should have one canonical seizure/epilepsy concept:
- Choose the canonical id deliberately; do not auto-choose by filename.
- If `epilepsy` becomes canonical:
  - keep `epilepsy.json` as the live concept
  - move all incoming parents of `seizure-disorder` to point at `epilepsy` unless a separate narrower concept is desired
  - preserve `seizure-disorder` draft content as a historical/draft appendix or convert it into a child/refined concept record, not a silent delete
  - preserve the TBI residuals edge and its baggage; do not let the TBI pathway silently lose its target
  - preserve any evidence baggage currently attached to `seizure-disorder`
- If `seizure-disorder` becomes canonical:
  - that is a bigger decision because `seizure-disorder` is draft and currently has no published suggestions
  - any published epilepsy evidence bag would need to be transferred, retargeted, or explicitly superseded
  - the existing epilepsy -> depressive-disorder guard language must not be lost

In either case, the **edge preservation invariant** is:
- no incoming parent loses its target without an explicit redirect
- no published evidence bag disappears without an explicit disposition
- the TBI residuals pathway keeps a valid target concept id
- the withdrawn seizure-disorder depressive-disorder reasoning is retained somewhere, because it is part of the evidentiary history

### 4.3 Generic merge procedure for other candidate pairs
For any approved duplicate pair:
1. Enumerate outgoing edges from both ids.
2. Enumerate incoming parents for both ids.
3. Enumerate evidence baggage: published suggestions, guards, source citations, draft todos, graph-based relationship objects.
4. Choose canonical id.
5. Rewrite redirects: every incoming parent that pointed to the discarded id should point to the canonical id, unless a narrower concept is being kept.
6. Merge or retarget outgoing edges: if both ids pointed to the same target, dedupe; if they pointed to different targets, preserve both under the canonical id with clear provenance.
7. Preserve evidence baggage: copy or reference the discarded id's evidence material; do not silently drop guards, PMIDs, or verification scope notes.
8. Leave an audit trail: record which id was canonical, which was retired/archived, what edges were preserved, and what baggage was moved or kept as historical.

---

## 5. Recommended next decision for epilepsy / seizure-disorder
Because this is the explicitly disclosed duplicate concern and it already has a maintainer note attached, the next step should be a **binary catalog-identity decision** before any files change:

- **Decision 1**: Are epilepsy and seizure-disorder the same catalog concept in this knowledge base, or intentionally distinct concepts that merely overlap clinically?
- **Decision 2**: If they are the same concept, which id is canonical?
- **Decision 3**: If they are distinct, what explicit relationship should the catalog record so future reviewers do not rediscover the same duplication?

Until that decision is made, the safest preservation move is to **document the candidate and the exact edge map**, not to delete or rewrite either file.

---

## 6. Verification steps before declaring the merge done
After any merge or redirect:
- Rebuild the incoming-parent map and confirm every parent that previously pointed to the retired id now resolves to the intended canonical id.
- Rebuild the outgoing-edge map and confirm no suggestion target was dropped unintentionally.
- Confirm evidence baggage continuity: guards, citations, verification scope, and draft todos are accounted for.
- Confirm the TBI residuals graph edge still resolves to a live target concept.
- Re-run the same duplicate detection scan to ensure the merge did not merely hide the duplication under a new name.

---

## 7. One-line summary
The repository has exactly one human-confirmed duplicate concern — epilepsy / seizure-disorder — and a set of high-overlap pairs that are mostly subtype or phenotype splits rather than true duplicates; the merge plan should preserve edges by redirecting incoming parents, merging or retargeting outgoing suggestions, and retaining all evidence baggage, with epilepsy / seizure-disorder resolved first as a catalog-identity decision rather than a blind rename.
