# Mapping Expansion Batch ME-25 — Approved Implementation Ledger

## Scope

ME-25 adds five evidence-ready, association-only relationships to the Wave-8 framework-only catalog. Each primary remains `draft: true`; each clinical citation remains `verified: false` and `pending-verification`. No source is promoted and no published mapping is changed.

## Rows

| Primary | Target | PMID | Evidence boundary |
|---|---|---:|---|
| `acanthosis-nigricans` | `diabetes-mellitus-type-2` | 36698243 | Require documented acanthosis nigricans, independent laboratory-confirmed type 2 diabetes, compatible metabolic phenotype/chronology, and competing-cause review. |
| `beriberi` | `congestive-heart-failure` | 29360523 | Restrict to documented wet-beriberi/thiamine-deficiency phenotype with objective heart failure, compatible chronology, and alternative-cause review. |
| `atrial-septal-defect` | `pulmonary-hypertension` | 30305956 | Require documented ASD anatomy, objective pulmonary hypertension, compatible shunt/hemodynamics and chronology, and pulmonary-hypertension group review. |
| `bird-fancier-s-lung` | `pulmonary-fibrosis` | 21870048 | Require avian-antigen hypersensitivity-pneumonitis phenotype, objective serial fibrosis, compatible chronology, and alternative interstitial-lung disease review. |
| `atrophic-glossitis` | `anemia` | 31076315 | Require documented glossitis, anemia subtype, hematinic laboratory findings, compatible chronology, and competing-cause review. |

## Safety and publication policy

- All five suggestions use `ASSOCIATION_ONLY`, `NOT_ESTABLISHED`, `NOT_ASSERTED`, and `causalMechanism.hypothesizedOnly: true`.
- All five primaries remain draft-only and retain nonempty ME-25 todo lists.
- All five references use `verificationScope: "clinical-evidence"`, canonical PubMed URLs, and `verified: false`.
- Each registry relationship has an explicit structured publication guard; no guard contains supersession provenance.
- Qualified-human citation verification is required before any citation promotion or publication-state change.

## Source metadata

- PMID 36698243 — Leung AKC, Lam JM, Barankin B, Leong KF, Hon KL. *Acanthosis Nigricans: An Updated Review.* Curr Pediatr Rev. 2023;19(1):68-82. doi:10.2174/1573396318666220429085231.
- PMID 29360523 — DiNicolantonio JJ, Liu J, O'Keefe JH. *Thiamine and Cardiovascular Disease: A Literature Review.* Prog Cardiovasc Dis. 2018;61(1):27-32.
- PMID 30305956 — Nashat H, Kempny A, Wieland K, et al. *Atrial septal defects and pulmonary arterial hypertension.* J Thorac Dis. 2018;10(Suppl 24):S2953-S2965. doi:10.21037/jtd.2018.08.92.
- PMID 21870048 — Chan AL, Juarez MM, Leslie KO, Ismail HA, Albertson TE. *Bird fancier's lung: a state-of-the-art review.* Clin Rev Allergy Immunol. 2012;43(1-2):69-83. doi:10.1007/s12016-011-8282-y.
- PMID 31076315 — Chiang CP, Chang JYF, Wang YP, Wu YH, Wu YC, Sun A. *Atrophic glossitis: Etiology, serum autoantibodies, anemia, hematinic deficiencies, hyperhomocysteinemia, and management.* J Formos Med Assoc. 2020. doi:10.1016/j.jfma.2019.04.015.

## Aggregate transition

ME-24 → ME-25:

- Relationships: `293 → 298` (+5)
- Explicit publication guards: `219 → 224` (+5)
- Legacy rationale boundaries: `74 → 74`
- Live references: `301 → 306` (+5)
- Verified live references: `256 → 256`
- Pending live references: `45 → 50` (+5)
- Live clinical uses: `296 → 301` (+5)
- Total source entities including lineage: `287 → 292` (+5)
- Published mappings: `139 → 139`
- Draft mappings: `674 → 674`
- Knowledge-base files: `813 → 813`

## Validation record

- `npm run kb:validate` — pass; expected draft-only unverified-citation warnings.
- `node scripts/audit-master-registry.js` — pass at ME-25 totals.
- `node scripts/audit-citation-verification.js` — pass with zero hard/review findings.
- `git diff --check` — pass.
- Focused ME-25 regression — recorded in `tests/mapping-expansion-me25.test.ts`.
