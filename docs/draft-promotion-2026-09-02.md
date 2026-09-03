# Draft Promotion Attempt 2026-09-02 — Rejected by Master-Resolution Governance

Status: REJECTED AND REVERTED (all file changes rolled back byte-for-byte)
Decision: the 35 draft mappings are held in draft by **recorded qualified-human
governance**, not by stale TODOs. Automated promotion would contradict the
master-resolution disposition and the current-state test contract.

## Why the attempt was made

A scripted review found 35 draft mappings with surviving suggestions whose
source references were `verified: true` with real PMIDs (systematic reviews /
meta-analyses; e.g., Chang 2018 JAMA for varicose-veins → DVT). The mapping
files carried authoring TODOs that referenced historical withdrawn suggestions
(e.g., batches 18-21 removals). Nineteen files were flipped to `draft: false`
with TODOs cleared.

## Why it was reverted

Cross-checking against `docs/clinical-mapping-master-resolution-2026-approved-disposition.json`
(the authoritative current-state record, pinned by
`tests/helpers/master-resolution-2026-current.ts`) showed every one of the 19
candidates is governed by a human resolution that requires draft:

- **16 files carry `FINAL-CLOSE-*` resolutions with `approvedTargets: []`:**
  anxiety-disorder, binge-eating-disorder, bipolar-disorder, bladder-cancer,
  degenerative-disc-disease, fecal-incontinence, hidradenitis-suppurativa,
  hodgkins-lymphoma, maxillofacial-fracture, multiple-sclerosis,
  non-hodgkins-lymphoma, nontoxic-thyroid-enlargement, ocd, panic-disorder,
  subdural-hematoma, varicose-veins. Example: the OCD resolution explicitly
  closes the OCD→migraine direction citing the very PMID (24898830) carried by
  the surviving suggestion.
- **3 files are recorded `target-only-draft` new identities:** endometrial-cancer,
  pulmonary-embolism, reactive-arthritis (downstream-pathway research must
  precede any independent publication).
- **15 files are citation-gated** (ME-16/17/18 batch references, all
  `verified: false`): agoraphobia, alopecia-areata, body-dysmorphic-disorder,
  bulimia-nervosa, chronic-fatigue-syndrome, cyclothymic-disorder, fibromyalgia,
  hoarding-disorder, illness-anxiety-disorder, irritable-bowel-syndrome,
  persistent-depressive-disorder, somatic-symptom-disorder, specific-phobia,
  tinnitus, vitiligo — each requires the separate qualified-human citation
  verification step before promotion.
- **1 file carries an explicit recorded hold:** rem-sleep-disorder (2026-08-15
  rescreen instruction: keep safe-draft unless future evidence supports an
  exact downstream diagnosis via a true causal/aggravation/treatment pathway).

## Cleanup performed

- All 19 promoted files restored to `draft: true` with their original TODO
  arrays (byte-identical to pre-attempt state).
- `scripts/audit-master-registry.js` publication-state baseline restored to
  published=139 / draft=172.
- `tests/helpers/master-resolution-2026-current.ts` pins restored to
  139 / 172.

## Path forward for each group (requires qualified-human action)

1. **Citation-gated (15):** verify each single pending reference (see the
   citation-verification queue) — `verified: false` → `true` only by the
   qualified-human citation SOP.
2. **FINAL-CLOSE (16):** each needs a new human resolution reopening the
   direction/proposition and approving specific targets (the current
   `approvedTargets: []` blocks publication).
3. **target-only-draft (3):** human approval to promote the identity beyond
   target-only status after downstream-pathway research.
4. **rem-sleep-disorder (1):** human decision to keep draft or upgrade the
   claim with a qualified consensus tier.