# Clinical Evidence Promotion Batch 18

Batch 18 preserves the exact **300 catalog / 300 knowledge-base** integrity contract while using the post-Batch-17 review-debt queue to remove two legal/rating-only published mappings, promote one bounded Wave-3 relationship, and complete one matching catalog-placement cleanup.

## Safety withdrawals: agoraphobia and panic disorder

- `agoraphobia` and `panic-disorder` are returned to draft.
- Each previously published sleep-apnea, GERD, and migraine proposition had only a legal or rating-schedule citation attached.
- The review did not identify condition-specific evidence strong enough to preserve those exact directional relationships under the repository's publication standard.
- Withdrawal means the repository is no longer publishing those medical propositions; it does not assert that no individual relationship could ever be supported with case-specific evidence.

## Promotion: pulmonary hypertension → congestive heart failure

- `pulmonary-hypertension` → `congestive-heart-failure` is published only as a **phenotype-bounded right-heart-failure progression pathway**.
- The 2022 ESC/ERS pulmonary-hypertension guideline classifies pulmonary hypertension by mechanism, describes clinical manifestations as linked to right-ventricular dysfunction, and contains a dedicated advanced right-ventricular-failure management section.
- The relationship is limited to documented pulmonary-vascular/pre-capillary pulmonary hypertension—especially pulmonary arterial hypertension—where pulmonary hypertension precedes right-ventricular dysfunction/right-sided heart failure.
- **Group 2 pulmonary hypertension caused by left-heart disease is explicitly outside this directional pathway**, because in that phenotype left-heart disease is upstream of the pulmonary hypertension.
- The target catalog identity `congestive-heart-failure` is broader than isolated right-ventricular failure, so individual development must establish the heart-failure phenotype and chronology.
- The guideline source remains `verified: false` pending qualified-human citation verification.

## Bounded identity/modeling cleanup

- The stable `pulmonary-hypertension` identity is physically moved out of `cardiovascular-expansion-wave-3.json` and into `respiratory-expansion-wave-4.json`.
- Its ID and aliases are unchanged.
- Its body-system placement now matches its existing 38 CFR 4.97 / DC 6817 rating authority.
- The broader `pulmonary-vascular-disease` identity remains separate under the same regulatory umbrella; the two catalog identities are not collapsed.

## Citation position

Batch 18 projects the automated ratchet to:

- live references: **108**;
- live verified: **8**;
- retired verified: **6**;
- verified provenance: **14**;
- live unverified: **100**;
- published-unverified review findings: **98**;
- live clinical-evidence references with canonical URLs: **57**;
- retired clinical-evidence references with canonical URLs: **4**;
- clinical-URL provenance: **61**.

Six unverified legal/rating references are removed and one new condition-specific clinical source is added. No source is automatically promoted to `verified: true`.

## Expansion state

Pulmonary hypertension is a Wave-3 identity. Batch 18 therefore moves the controlled expansion ledger to **15 individually promoted / 92 of 107 Wave 1-7 mappings still draft**. The catalog and KB universe remains frozen at 300/300.
