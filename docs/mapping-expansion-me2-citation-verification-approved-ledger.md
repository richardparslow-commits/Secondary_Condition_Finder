# Mapping Expansion Batch ME-2 — Citation Verification Ledger

**Status:** APPROVED-AND-IMPLEMENTED-LOCALLY

- **Qualified-human approval:** I approve Recommended ME-2 citation-verification approval scope: Approve all five sources for qualified-human verification: 3 as implemented and 2 with narrowing; 0 source replacements and 0 rejects.
- **Review date:** 2026-08-20
- **Required source commit:** `c12a6f47355eeae39b7898becef5791b088a645c`
- **Decision count:** 3 as implemented / 2 narrowed / 0 replacements / 0 rejects

## 1. `myocardial-infarction->congestive-heart-failure`

- **Decision:** `as-implemented`
- **PMID:** `39284720`
- **DOI:** `10.1253/circj.CJ-24-0633`
- **Source replacement:** no

**Current guard**

> Require documented acute myocardial infarction and separately documented new or materially worsened heart failure developing in the clinically relevant post-infarction period, with appropriate evidence of ventricular dysfunction and/or a clinically established heart-failure syndrome. Do not infer heart failure from myocardial infarction alone, and do not attribute pre-existing heart failure to a later infarction without evidence of material post-infarction worsening.

**Final approved guard**

> Require documented acute myocardial infarction and separately documented new or materially worsened heart failure developing in the clinically relevant post-infarction period, with appropriate evidence of ventricular dysfunction and/or a clinically established heart-failure syndrome. Do not infer heart failure from myocardial infarction alone, and do not attribute pre-existing heart failure to a later infarction without evidence of material post-infarction worsening.

## 2. `copd->pulmonary-hypertension`

- **Decision:** `as-implemented`
- **PMID:** `39532092`
- **DOI:** `10.1055/s-0044-1791824`
- **Source replacement:** no

**Current guard**

> Require documented COPD and separately established pulmonary hypertension clinically attributable to chronic lung disease/COPD, preferably with appropriate hemodynamic confirmation when clinically available. Evaluate alternative causes of pulmonary hypertension, including left-heart disease, chronic thromboembolic disease, and other pulmonary vascular disorders. Do not infer pulmonary hypertension from COPD severity, hypoxemia, dyspnea, or an elevated echocardiographic estimate alone.

**Final approved guard**

> Require documented COPD and separately established pulmonary hypertension clinically attributable to chronic lung disease/COPD, preferably with appropriate hemodynamic confirmation when clinically available. Evaluate alternative causes of pulmonary hypertension, including left-heart disease, chronic thromboembolic disease, and other pulmonary vascular disorders. Do not infer pulmonary hypertension from COPD severity, hypoxemia, dyspnea, or an elevated echocardiographic estimate alone.

## 3. `interstitial-lung-disease->pulmonary-hypertension`

- **Decision:** `as-implemented`
- **PMID:** `41819536`
- **DOI:** `10.1183/13993003.02651-2025`
- **Source replacement:** no

**Current guard**

> Require documented interstitial lung disease and separately established ILD-associated pulmonary hypertension, with appropriate diagnostic evaluation and hemodynamic confirmation such as right-heart catheterization when clinically indicated or available. Evaluate major competing causes of pulmonary hypertension. Do not infer PH from ILD, fibrosis severity, hypoxemia, reduced diffusion capacity, or echocardiographic suspicion alone.

**Final approved guard**

> Require documented interstitial lung disease and separately established ILD-associated pulmonary hypertension, with appropriate diagnostic evaluation and hemodynamic confirmation such as right-heart catheterization when clinically indicated or available. Evaluate major competing causes of pulmonary hypertension. Do not infer PH from ILD, fibrosis severity, hypoxemia, reduced diffusion capacity, or echocardiographic suspicion alone.

## 4. `mild-tbi->post-concussion-syndrome`

- **Decision:** `narrowed`
- **PMID:** `40531530`
- **DOI:** `10.1001/jamanetworkopen.2025.16619`
- **Source replacement:** no

**Current guard**

> Require documented mild traumatic brain injury/concussion followed by separately documented persistent post-concussive symptoms extending beyond the acute recovery period, with clinical attribution to the qualifying injury. Do not infer post-concussion syndrome from transient acute headache, dizziness, cognitive complaints, or other symptoms occurring only immediately after injury. Consider pre-existing psychiatric, sleep, neurologic, and symptom conditions that may contribute to or mimic persistent post-concussive symptoms.

**Final approved guard**

> Require documented mild traumatic brain injury/concussion in an adult followed by separately documented persistent post-concussive symptoms extending beyond the acute recovery period, with clinical attribution to the qualifying injury. Do not infer post-concussion syndrome from transient acute headache, dizziness, cognitive complaints, or other symptoms occurring only immediately after injury. Consider pre-existing psychiatric, sleep, neurologic, and symptom conditions that may contribute to or mimic persistent post-concussive symptoms.

## 5. `cauda-equina-syndrome->urinary-incontinence`

- **Decision:** `narrowed`
- **PMID:** `42480656`
- **DOI:** `10.1016/j.spinee.2026.07.005`
- **Source replacement:** no

**Current guard**

> Require documented cauda equina syndrome and separately documented urinary incontinence or persistent loss of urinary continence attributable to the CES neurologic injury. Do not map urinary retention alone, nonspecific lower urinary tract symptoms, catheter use, or unrelated urologic disease to urinary-incontinence. Establish the bladder phenotype and temporal relationship to CES, and consider competing urologic or neurologic causes where clinically relevant.

**Final approved guard**

> Require documented cauda equina syndrome secondary to degenerative lumbar spine disease, with separately documented urinary incontinence or persistent loss of urinary continence attributable to the CES neurologic injury. Where the proposition concerns a persistent postoperative residual, require an appropriate post-decompression temporal course. Do not map urinary retention alone, nonspecific lower urinary tract symptoms, catheter use, or unrelated urologic disease to urinary-incontinence. Establish the bladder phenotype and temporal relationship to CES, and consider competing urologic or neurologic causes where clinically relevant.

## Expected transition

- 183 edges remain 183; P1 111 / P2+ 28 unchanged.
- 191 references remain 191.
- Live verified: 186 → 191.
- Unverified: 5 → 0.
- Review findings: 5 → 0.
- Hard findings remain 0.
- Verified provenance: 192 → 197.
- Clinical URL counts remain 186 live / 190 combined provenance.

## Fail-closed constraints

Only the two approved publication-guard narrowings may change substantive mapping text. PMID, DOI, citation, URL, direction, rank, prevalence, taxonomy, publication state, and pathway intelligence must remain unchanged. All non-ME-2 source rows must be preserved. Vercel guard must exit 2. No remote writes are authorized.

## Local promotion result

- 5/5 sources promoted; 3 as implemented / 2 narrowed / 0 replacements / 0 rejects.
- Citation state: 191 verified / 0 unverified / 0 review / 0 hard.
- Verified provenance: 197.
- No remote writes.
