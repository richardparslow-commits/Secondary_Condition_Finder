# Clinical Evidence Promotion Batch 24 — Wave 1 Rescreen

Status: implementation candidate pending exact-head validation and production closure.

## Scope

Batch 24 re-screens the 15 Wave 1 identities that remained `safe-draft` after Batch 23. Existing published Wave 1 identities are not re-authored except where needed for ledger counts. Rating-schedule authority is not used as medical nexus evidence, and all newly authored clinical references remain `verified: false` pending qualified-human citation review.

## Evidence-led promotions

### `osteitis-deformans` → `osteoarthritis`

Paget disease of bone can produce secondary osteoarthritis where abnormal remodeling, enlargement, or deformity changes mechanics at an adjacent joint. The mapping is site-specific: it does not imply that osteoarthritis at a remote joint is caused by Paget disease.

Clinical source: Devogelaer et al., Belgian Bone Club consensus, Osteoporos Int. 2008; PMID 18504638. The PubMed abstract expressly lists secondary osteoarthritis among Paget disease complications.

### `syringomyelia` → `charcot-arthropathy`

Syringomyelia is a recognized cause of neuropathic/Charcot arthropathy through loss of protective sensation and proprioception. The mapping requires anatomic correlation between the syrinx-related neurologic deficit and the affected joint and requires competing destructive-joint causes to be addressed.

Clinical source: Parida et al., Clin Rheumatol. 2023; PMID 35994178. The systematic review plus case series summarizes 50 patients with syringomyelia-associated elbow Charcot arthropathy and identifies syringomyelia as an important etiology.

### `trigeminal-neuralgia` → `depressive-disorder` and `anxiety-disorder`

Two systematic reviews support substantial depressive/anxiety burden in trigeminal-neuralgia populations. These are authored as somatopsychic association pathways, not automatic individual causation. Chronology, pain/trigger burden, treatment response, pre-existing psychiatric disease, medication effects, sleep, other pain disorders, and psychosocial contributors remain required individual-development questions.

Clinical sources:

- Martinelli et al., Neurosurg Rev. 2025; PMID 40355578 — systematic review of 11 relevant studies reporting higher risks of depressive, anxiety, and sleep disorders in trigeminal neuralgia.
- *The psychosocial impact of orofacial pain in trigeminal neuralgia patients: a systematic review*, Int J Oral Maxillofac Surg. 2018; PMID 29526561 — 13 included studies with mild-to-moderate depression and moderate-to-severe anxiety on psychometric measures.

## Safe-draft dispositions retained

The remaining 12 Wave 1 identities stay intentionally unpublished because the re-screen did not establish a sufficiently specific secondary relationship that matches the catalog identity without over-generalization:

- `osteoporosis`: substantial literature links depression and low bone density, but directionality is predominantly depression → bone loss or remains bidirectional/uncertain; no new osteoporosis-primary secondary pathway is promoted.
- `osteomalacia`: fracture, pain, and weakness are recognized consequences, but the current catalog lacks an appropriately general secondary identity that can be mapped without overreach.
- `bursitis`: no condition-specific secondary disease relationship met the publication threshold.
- `myositis`: idiopathic inflammatory myopathy literature strongly supports ILD, but the catalog identity `myositis` is broader than IIM phenotypes; publication would over-generalize across infectious, drug-related, focal, and other myositis causes.
- `heterotopic-ossification`: functional limitation and local neurovascular complications do not map cleanly to a current secondary identity at the required evidence specificity.
- `tendinopathy`: no condition-specific downstream disease relationship met the publication threshold.
- `pes-cavus`: neurologic disorders are commonly causes of cavus deformity; reversing that direction would be unsafe without a distinct downstream complication supported by evidence.
- `metatarsalgia`: biomechanical associations with forefoot deformity are heterogeneous and do not support a new general secondary disease mapping.
- `hallux-rigidus`: altered gait/forefoot loading is clinically relevant but the available evidence does not justify a separate disease-level secondary mapping in the current catalog.
- `hammertoe`: local pressure/callus/metatarsalgia consequences do not provide a sufficiently specific disease-level target for publication.
- `ulnar-neuropathy`: motor/sensory deficits are manifestations of the neuropathy; no distinct downstream catalog disease met the threshold.
- `common-peroneal-neuropathy`: foot-drop and sensory deficits are manifestations rather than a distinct supported secondary catalog disease in the current model.

## Disposition impact

After Batch 24 candidate changes:

- published-evidence-led Wave 1–7 identities: **23**;
- promotion candidates: **0**;
- safe drafts: **84**.

The frozen catalog/KB universe remains **300 / 300**. No identity is added, removed, renamed, or merged.

## Verification boundary

All newly authored references remain `verified: false`. Source retrieval and metadata checking by automation is preparation evidence only; it is not the qualified-human verification decision.
