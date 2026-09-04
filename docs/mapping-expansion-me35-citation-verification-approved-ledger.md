# Mapping Expansion ME-35 — Qualified-Human Citation Verification Ledger

**APPROVED-AND-APPLIED-LOCALLY — 5/5 VERIFIED**

Qualified-human approval was captured in-session on 2026-09-03: all five ME-35 citations are approved as implemented. This verification changes citation state only; relationship identities, ranks, guards, CRG metadata, draft publication states, and pathway metadata are unchanged.

## Approved dispositions

| Primary | Target | PMID | Decision |
|---|---|---:|---|
| `brown-s-quard-syndrome` | `urinary-incontinence` | 11746547 | `approve-as-implemented` |
| `brain-tumors` | `seizure-disorder` | 26332282 | `approve-as-implemented` |
| `brugada-syndrome` | `cardiac-arrhythmia` | 27378596 | `approve-as-implemented` |
| `bell-s-palsy` | `keratitis` | 28319442 | `approve-as-implemented` |
| `bowen-s-disease` | `squamous-cell-carcinoma` | 7804989 | `approve-as-implemented` |

## Verification boundary

Each citation was approved only for the exact bounded proposition already present in its ME-35 mapping. The evidence remains association-only and does not establish an individual VA medical nexus, causation, aggravation, or service connection. The five primaries remain `draft: true`.

- Brown-Séquard syndrome → urinary incontinence: objective spinal-cord and urinary phenotype, chronology, and competing bladder causes remain required.
- Brain tumors → seizure disorder: pediatric survivor evidence remains bounded by tumor phenotype, treatment, chronology, and acute-versus-late seizure distinction.
- Brugada syndrome → cardiac arrhythmia: the approved scope remains specialist-confirmed Brugada/type-1 ECG phenotype with a separately documented ventricular arrhythmic event.
- Bell's palsy → keratitis: the approved scope remains facial-palsy-related ocular exposure with objective exposure-related corneal disease.
- Bowen's disease → squamous-cell carcinoma: the approved scope remains pathology-confirmed in-situ disease and separately established invasive cutaneous SCC at compatible site and chronology.

## Registry result

- Five KB references changed from `verified: false` to `verified: true`.
- Five matching master sources changed from `pending-verification` to `active` with `verified: true`.
- Each master source records `qualifiedHumanCitationReviewRequired: false`, decision `approve-as-implemented`, and review date `2026-09-03`.
- Live references remain `355`; verified live references advance `256 → 261`; pending live references decline `99 → 94`.
- Active source entities advance `233 → 238`; pending source entities decline `96 → 91`.
- Published/draft mapping totals remain `139 / 674`; relationship count remains `347`.
- No GitHub, Vercel, or other remote write was performed.
