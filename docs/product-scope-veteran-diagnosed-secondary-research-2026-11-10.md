# Product boundary and evidence architecture — Veteran-entered diagnosed conditions only

**Scope decision: 2026-11-10.** This design supersedes *record-derived diagnosis discovery* proposed in merged PR #686 and its follow-up PR #687. Production must remain on the safe pre-#686 rollback until a separate scope-aligned PR passes required gates. This document is a technical and research plan, not a clinical or legal certification.

## Purpose: compare only conditions the Veteran provides

1. **The Veteran selects existing doctor-diagnosed conditions** in Step 1. No uploaded record, symptom list, OCR transcript, rule, API, or model may create a diagnosis or insert a new diagnosed condition.
2. **The Veteran identifies which of those diagnoses are already VA service connected** and supplies the VA-rated percentage or status. All VA information is self-reported unless a separately authorized VA source later verifies it. The UI must never assert a Veteran's award was verified when it was self-reported.
3. **The app compares two explicitly selected sets:** a service-connected primary condition A and a doctor-diagnosed condition B that the Veteran reports is not VA-rated. It investigates *A → B* causation, aggravation, service-connected treatment adverse effects, or treatment interference. **Do not reverse the direction** because the source literature discusses an association.
4. **The result is a clinician conversation packet:** defined clinical question, onset and course considerations, medical literature and limitations, possible alternate etiologies, and links to applicable law or procedures. It neither diagnoses B, produces a medical nexus determination, promises an award, nor submits claims automatically. Medical conclusions belong to a qualified medical professional; VA claim strategy can be discussed with a VA-accredited representative.
5. **Uploaded records are optional corroborating evidence only.** Existing local document analysis may highlight provenance of an excerpt relevant to an already entered condition but must never populate additional conditions. No private record or identifiable data is sent to public research APIs or Tiger Cloud.

Legacy browser sessions created under #686 may contain record-origin IDs. They are excluded on both **read and write**, preserving manually supplied service-connected primaries, ratings and unrelated data. If an excluded condition truly has been clinically diagnosed, the Veteran must select it in Step 1.

## Medical knowledge expansion: breadth and quality separately measured

**Breadth:** use the permitted versions of MONDO, Human Phenotype Ontology, Orphanet/rare-disease sources as licensed, ICD-10-CM and other NLM terminology resources, RxNorm, PubMed E-utilities, PubTator3, Open Targets, ClinicalTrials.gov, NIH RePORTER, VA and other reliable public sources. Review usage, API limits, licenses and clinical ontology mapping ambiguity. The current generated client corpus contains **819 conditions and 140 published mapping entries**; this is not comprehensive medical coverage or comprehensive secondary-connection verification.

Index clinical systems across:
- Mental health and substance use; TBI and acquired neurologic injury; epilepsy, dementia and other neurological disorders.
- Spine, orthopedic, pain and joint disorders; connective tissue, autoimmune and systemic inflammatory diseases.
- Pulmonary, cardiovascular, sleep medicine, endocrine and metabolic conditions.
- Oncology, benign tumors, hematology (including rare blood disorders), immunology and infectious disease.
- Gastrointestinal, renal, genitourinary, reproductive, dermatologic, ophthalmic and otolaryngologic conditions.
- Congenital, genetic, rare and multisystem diseases, with age, sex and exposure caveats when scientifically applicable.

Do not present an ontology synonym or a paper's co-occurrence as a causal pathway. Each **directional** candidate relationship requires:
- A and B normalized to durable condition IDs, original terms and possible ambiguity;
- Mechanism/pathway classification: causation, aggravation, treatment-mediated, treatment-interference, or **association-only**;
- Primary literature IDs (PMID, DOI), trial NCT IDs and research project IDs where relevant;
- Study design, population, comparator, strength/limitations, confounding, contrary findings, year, source URL, retrieval date and provenance checksum;
- Whether evidence concerns a population association or individualized causal proposition;
- Explicit requirement for qualified-human medical review before public promotion.

Tiger Cloud DEV can gather and index public research metadata, calculate coverage, find contradictions and generate candidate review queues. **Do not send Veteran medical records or PHI into DEV research.** A wider medical ontology is a search vocabulary, not an assertion that all possible medical cause/effect links are mapped or scientifically established.

**Coverage dashboard:** separately report number of valid concepts; concepts with reviewed mapping; directional paths reviewed and published; contested or conflicting paths; invalid/ambiguous crosswalks; gaps by medical system; and citation age. No "fully mapped" claim unless supported by a specific measurable definition and verified audit receipt.

## Veterans compensation law and research authority

Maintain versioned, dated research records and an authority hierarchy, not an unqualified "all cases are binding" claim:

| Source | Role in decision support | Required caution |
| --- | --- | --- |
| **38 U.S.C.**, statutes and amendments | Legislative authority with effective and applicability dates | Distinguish enacted law from proposals |
| **38 C.F.R.**, notably § 3.310 | Secondary service connection: causation and aggravation, applicable prerequisites, specific TBI provisions | Link to official current text; analyze baseline/aggravation carefully |
| **Supreme Court and Federal Circuit** | Precedential judicial interpretation when applicable | Track holdings, procedural posture, overruling and jurisdiction |
| **Precedential CAVC opinions** | Veterans-law interpretation and required legal standards | Label precedential versus nonprecedential/memorandum decisions |
| **BVA decisions** | Case examples and fact patterns | **Nonprecedential generally** under 38 C.F.R. § 20.1303; never portray a similar BVA grant as binding or guarantee |
| **M21-1 Adjudication Procedures Manual** | VA claims processing instructions (dated and versioned) | Administrative procedures; distinguish from controlling statute, regulation and judicial precedent |
| **VA forms and claim evidence guidance** | Veteran-friendly process and required evidence | Not legal representation or proof of eligibility |

Research cases including **Ward v. Wilkie** on aggravation without a rigid permanent-worsening requirement, **Spicer v. McDonough** on but-for causation and treatment interference, and the relevant **Allen v. Brown** line of precedent. Add court, docket, decision date, precedential status, quoted holding span, statutory/regulatory provisions, later negative/positive treatment and applicability conditions. Do not infer claims outcomes from case facts. Route potentially contested legal interpretation to professional review.

Primary source starters:
- 38 C.F.R. § 3.310: https://www.ecfr.gov/current/title-38/chapter-I/part-3/section-3.310
- 38 C.F.R. § 20.1303: https://www.ecfr.gov/current/title-38/chapter-I/part-20/section-20.1303
- VA official evidence guidance: https://www.va.gov/disability/how-to-file-claim/evidence-needed/
- VA M21-1 secondary/aggravation instructions: https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/content/554400000180484/
- CAVC opinions: https://www.uscourts.cavc.gov/opinions.php
- Federal Circuit: https://www.cafc.uscourts.gov/
- Supreme Court opinions: https://www.supremecourt.gov/opinions/

## Publication gates

- A condition's medical existence comes from the Veteran's report of a prior qualified professional diagnosis, not from this app. The app does not validate that claim.
- Each new *medical A→B mapping* is a proposal until evidence and direction are reviewed by an appropriately qualified human. Unreviewed pathways do **not** appear as medically confirmed.
- Clinical uncertainty, inadequate literature, and a missing mapping must never be presented as "no secondary connection possible."
- New legal materials require official-source reconciliation, authority level, effective date and conflict/overruling checks.
- Complete automated CI and privacy tests, **human manual Section 508 testing**, an independent qualified medical sign-off on published relationships, and explicit release authorization before merging into Production.
