#!/usr/bin/env node
/**
 * Register the two registerable batch-5 nexus rows into the CRG knowledge
 * base with registry + graph lockstep.
 *
 * Rows:
 *   A. degenerative-disc-disease → radiculopathy   (DIRECT_CAUSATION, draft primary)
 *   B. traumatic-brain-injury-residuals → seizure-disorder (DIRECT_CAUSATION, draft primary, RANK 2)
 *
 * Held (published-host) rows not registered:
 *   C. hypothyroidism → carpal-tunnel-syndrome
 *   D. osteoarthritis → peptic-ulcer-disease
 *   E. rheumatoid-arthritis → avascular-necrosis
 *
 * NOTE: The TBI residuals host already carries a rank-1 ASSOCIATION_ONLY
 * depressive-disorder edge (ME-19). The graph node file must include BOTH
 * ranks 1 and 2 for the KbNodeMappingSchema's gapless-rank invariant to pass.
 * This script therefore also writes the ME-19 edge into the graph node file.
 *
 * Because this checkout carries iCloud fork copies, the canonical KB dir
 * cannot be loaded with node directly from this checkout — graph.ts would
 * throw on the duplicate nodeId. The deliverable is the written bytes here.
 *
 * Usage: node scripts/register-crg-nexus-batch5.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const KB = join(ROOT, 'data', 'knowledge-base');
const GRAPH = join(KB, 'graph');

const PMIDS = [
  // row A (degenerative-disc-disease → radiculopathy)
  '27144851', '9854752', '17119141',
  // row B (TBI residuals → seizure-disorder)
  '9414327', '19233461', '41686304',
  // ME-19 (depressive-disorder edge that must also live in the graph node)
  '25038422',
];

// ── Row A: degenerative-disc-disease → radiculopathy ─────────────────────
const ROW_A = {
  conditionId: 'radiculopathy',
  rank: 1,
  nexusClaim: {
    nexusClassification: 'DIRECT_CAUSATION',
    etiologicalTrigger:
      'Degenerative disc disease produces disc desiccation, loss of disc height, annular disruption and disc protrusion or herniation; the displaced disc material, and the inflammatory and compressive load it places on the exiting nerve root, generate the radicular pain, dermatomal sensory change and myotomal weakness that constitute radiculopathy at the anatomically corresponding level.',
  },
  causalMechanism: {
    mechanismCategory: 'MECHANICAL_OR_COMPRESSIVE',
    primaryVector:
      'Disc degeneration reduces disc height and competence, permitting annular tears, disc protrusion and frank herniation; mechanical compression of the exiting nerve root and dorsal root ganglion, compounded by local inflammatory mediators released from the degenerate disc, produces ectopic nerve-root firing and the segmental pain, paraesthesia and weakness that define radiculopathy. Both the compressive and the inflammatory arms are described in the registered literature and neither requires an unproven step.',
    secondaryVector:
      'Loss of disc height and the consequent facet loading can narrow the neural foramen and the lateral recess, so foraminal and canal stenosis can contribute to the same nerve-root compromise as the disc protrusion itself.',
    hypothesizedOnly: false,
  },
  evidentiaryProfile: {
    etiologicalConsensus: 'WELL_ESTABLISHED',
    vaNexusProbabilityAlignment: 'AT_LEAST_AS_LIKELY_AS_NOT',
    conservativeRationale:
      'The conservative posture is that mechanical and inflammatory nerve-root compromise by degenerate and herniated disc material is an established mechanism, so the dispute in an individual case is almost never whether the mechanism exists but whether this person\'s radicular findings are anatomically concordant with the documented degenerative level and are not better explained by another lesion.',
    evidenceGaps: [
      'Imaging demonstrating degenerative disc disease at a level and side capable of compromising the claimed nerve root, with the level and side recorded',
      'Clinical and electrodiagnostic findings concordant with that level, including dermatomal sensory loss, myotomal weakness and reflex change',
      'Exclusion of peripheral entrapment neuropathy such as carpal or cubital tunnel syndrome, and of brachial or lumbar plexopathy',
      'Exclusion of spinal stenosis or myelopathy as the explanation of the findings',
    ],
    alternativeEtiologiesToRuleOut: [
      'Peripheral entrapment neuropathy such as carpal or cubital tunnel syndrome',
      'Brachial or lumbar plexopathy',
      'Spinal stenosis or myelopathy rather than isolated nerve-root compromise',
      'Non-degenerative structural lesion including tumour, infection, or fracture',
    ],
    alternativeEtiologyTags: ['entrapment-neuropathy', 'plexopathy', 'spinal-stenosis', 'structural-lesion'],
    requiresSpecificDbqEvidence: true,
  },
  evidenceGaps: [
    'Imaging demonstrating degenerative disc disease at a level and side capable of compromising the claimed nerve root, with the level and side recorded',
    'Clinical and electrodiagnostic findings concordant with that level, including dermatomal sensory loss, myotomal weakness and reflex change',
    'Exclusion of peripheral entrapment neuropathy such as carpal or cubital tunnel syndrome, and of brachial or lumbar plexopathy',
    'Exclusion of spinal stenosis or myelopathy as the explanation of the findings',
  ],
  rationale:
    'Authoring registers the held CRG draft-expansion proposal for the degenerative-disc-disease to radiculopathy window on 2026-10-06, SUPERSEDING the ME-13 association-only framing of this same rank-1 row at the maintainer\'s direction and preserving the ME-13 anatomical-concordance guard in full. Degenerative disc disease and its nerve-root consequence form one of the clearest mechanical secondary-connection relationships in the rating schedule: disc desiccation, loss of disc height, annular disruption and protrusion or herniation displace disc material against the exiting nerve root and the dorsal root ganglion, while the degenerate disc simultaneously releases local inflammatory mediators, so compression and chemical irritation act on the same structure. The ME-13 meta-analysis already registered on this row is a cervical radiculopathy population selected on degenerative disc disease and reports measured operative outcomes at that level (PMID 34402323), and the added pathophysiology anchor is a systematic review of how a herniated disc produces radicular pain and deficit, including the contralateral presentations that simple one-sided compression cannot explain (PMID 32281018). The classification therefore moves to DIRECT_CAUSATION and the evidentiary tier to WELL_ESTABLISHED, because the dispute in an individual case is attribution and level-and-side concordance rather than the existence of the mechanism, and the ME-13 publication guard accordingly remains load-bearing and was left byte-identical to its approved text. Two boundaries are carried rather than buried: the added anchor\'s own population is contralateral lumbar radiculopathy, a less common presentation whose laterality is unusual, so it is registered as the pathophysiology source and not as a laterality model, and the row continues to require imaging at a level and side capable of compromising the claimed nerve root together with clinical or electrodiagnostic findings concordant with that level. All references remain subject to qualified-human citation verification under docs/citation-verification-sop.md.',
  sourceReferences: [
    {
      citation: 'Alomar SA, Maghrabi Y, Baeesa SS, Alves OL. Outcome of Anterior and Posterior Endoscopic Procedures for Cervical Radiculopathy Due to Degenerative Disk Disease: A Systematic Review and Meta-Analysis. Global Spine J. 2022;12(7):1546-1560. PMID 34402323. doi:10.1177/21925682211037270.',
      note: 'Mapping Expansion Batch ME-13 evidence for the bounded degenerative-disc-disease to radiculopathy proposition. Mapping approval is not citation verification; this source enters verified:false pending separate qualified-human citation review.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/34402323/',
      verified: false,
      sourceCheckedOn: '2026-10-06',
      sourceLocator: 'PMID 34402323; approved ME-13 source; guard: Require cervical degenerative disc pathology capable of nerve-root compromise and separately established anatomically concordant cervical radiculopathy. Do not infer radiculopathy from degenerative imaging, axial neck pain, nonspecific paresthesias, myelopathy, or peripheral entrapment neuropathy alone. Preserve peripheral neuropathy, plexopathy, entrapment neuropathy, spinal cord disease, nondegenerative structural lesions, and other causes as competing explanations.',
    },
    {
      citation: 'Ruschel LG, Agnoletto GJ, Aragao A, Duarte JS, de Oliveira MF, Teles AR. Lumbar disc herniation with contralateral radiculopathy: a systematic review on pathophysiology and surgical strategies. Neurosurg Rev. 2021 Apr;44(2):1071-1081. doi:10.1007/s10143-020-01294-3. PMID 32281018.',
      note: 'Added pathophysiology anchor, registered as the MECHANISM source because it sets out how a herniated disc produces radicular pain and deficit through mechanical compression of the nerve root and dorsal root ganglion compounded by local inflammatory mediators, and because it documents contralateral presentations that simple one-sided compression cannot explain. LIMITATIONS CARRIED: its population is contralateral lumbar radiculopathy, a less common presentation, so it is not registered as a laterality model and no level, side or laterality inference may be drawn from it; it is a systematic review of the mechanism rather than a cohort measuring incident radiculopathy. Mapping approval is not citation verification; this source enters verified:false pending separate qualified-human citation review.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/32281018/',
      verified: false,
      sourceCheckedOn: '2026-10-06',
      sourceLocator: 'Neurosurg Rev. 2021;44(2):1071-1081. Systematic review on pathophysiology and surgical strategies for lumbar disc herniation with contralateral radiculopathy; abstract frames the mechanism as nerve-root compromise with inflammatory contribution, and the contralateral population is the disclosed limitation.',
    },
  ],
};

// ── Row B: traumatic-brain-injury-residuals → seizure-disorder ───────────
const ROW_B = {
  conditionId: 'seizure-disorder',
  rank: 2,
  nexusClaim: {
    nexusClassification: 'DIRECT_CAUSATION',
    etiologicalTrigger:
      'A service-connected traumatic brain injury of at least moderate severity can leave cortical contusion, subdural haematoma, blood-brain-barrier breakdown, extravasated blood with haemosiderin and free iron, and reactive gliosis in the injured cortex; the resulting selective loss of GABAergic inhibitory interneurons, upregulation of excitatory glutamatergic signalling, and aberrant recurrent excitatory sprouting produce a population of neurons that fires synchronously and uncontrollably, giving rise to unprovoked post-traumatic seizures.',
  },
  causalMechanism: {
    mechanismCategory: 'NEUROLOGICAL_DEGENERATION',
    primaryVector:
      'Post-traumatic epileptogenesis begins with the primary mechanical event and continues for years: cortical contusion and subdural haematoma cause direct neuronal loss and axonal shearing; blood-brain-barrier breakdown exposes neurons to serum albumin and other proteins that alter astrocytic potassium and glutamate handling; extravasated blood leaves haemosiderin and free iron in the cortex, a potent driver of reactive oxygen species and persistent local inflammation; and reactive gliosis forms a scar that isolates but does not silence the injured cortex. The functional consequence is a failure of excitatory-inhibitory balance — selective loss of GABAergic inhibitory interneurons in the perilesional cortex, upregulation of excitatory glutamatergic signalling and of voltage-gated sodium and calcium channels, and sprouting of aberrant recurrent excitatory collaterals — producing a population of neurons that fires synchronously and uncontrollably.',
    hypothesizedOnly: false,
  },
  evidentiaryProfile: {
    etiologicalConsensus: 'WELL_ESTABLISHED',
    vaNexusProbabilityAlignment: 'LEGALLY_PRESUMED',
    conservativeRationale:
      'For moderate or severe traumatic brain injury the regulation itself holds unprovoked seizures to be the proximate result of that injury in the absence of clear evidence to the contrary (38 CFR § 3.310(d)(1)(ii)), so the conservative posture is presumptive rather than probabilistic: the opinion\'s real work is establishing the severity of the original injury (loss of consciousness, post-traumatic amnesia, Glasgow Coma Scale at the time of injury or shortly thereafter) and excluding provoked seizures, pre-existing epilepsy, and other clear evidence to the contrary. Where the injury was mild the presumption does not attach and the opinion must establish causation under § 3.310(a) using the severity gradient and mechanism evidence below.',
    evidenceGaps: [
      'Contemporaneous emergency department, theatre, or field documentation establishing the severity of the service-connected traumatic brain injury (loss of consciousness, post-traumatic amnesia, Glasgow Coma Scale) because severity is determined at the time of injury or shortly thereafter and a veteran is not required to meet every criterion of a level to be classified there',
      'A clinical diagnosis of epilepsy by a neurologist, supported where possible by electroencephalography, correctly characterised as focal aware, focal impaired awareness, focal to bilateral tonic-clonic, or generalised',
      'Chronological and anatomical concordance between the site of injury, the electroencephalographic focus and the seizure semiology',
      'Exclusion of provoked seizures (alcohol or benzodiazepine withdrawal, metabolic derangement, central nervous system infection, brain tumour, stroke, medication or drug effect, sleep deprivation in a patient with a pre-existing epilepsy syndrome) and of psychogenic non-epileptic spells',
      'Where the veteran had a seizure disorder before the traumatic brain injury, recognition that the correct posture is aggravation under § 3.310(b) with a baseline severity established by medical evidence predating the worsening',
    ],
    alternativeEtiologiesToRuleOut: [
      'Pre-existing epilepsy predating the traumatic brain injury',
      'Alcohol or benzodiazepine withdrawal seizures',
      'Metabolic derangement',
      'Central nervous system infection',
      'Brain tumour',
      'Stroke',
      'Medication or drug effect',
      'Sleep-deprivation-induced seizures in a patient with a pre-existing epilepsy syndrome',
      'Psychogenic non-epileptic spells',
    ],
    alternativeEtiologyTags: ['pre-existing-epilepsy', 'withdrawal', 'metabolic', 'infection', 'tumour', 'stroke', 'drug-induced', 'psychogenic'],
    requiresSpecificDbqEvidence: true,
  },
  evidenceGaps: [
    'Contemporaneous emergency department, theatre, or field documentation establishing the severity of the service-connected traumatic brain injury (loss of consciousness, post-traumatic amnesia, Glasgow Coma Scale) because severity is determined at the time of injury or shortly thereafter and a veteran is not required to meet every criterion of a level to be classified there',
    'A clinical diagnosis of epilepsy by a neurologist, supported where possible by electroencephalography, correctly characterised as focal aware, focal impaired awareness, focal to bilateral tonic-clonic, or generalised',
    'Chronological and anatomical concordance between the site of injury, the electroencephalographic focus and the seizure semiology',
    'Exclusion of provoked seizures (alcohol or benzodiazepine withdrawal, metabolic derangement, central nervous system infection, brain tumour, stroke, medication or drug effect, sleep deprivation in a patient with a pre-existing epilepsy syndrome) and of psychogenic non-epileptic spells',
    'Where the veteran had a seizure disorder before the traumatic brain injury, recognition that the correct posture is aggravation under § 3.310(b) with a baseline severity established by medical evidence predating the worsening',
  ],
  rationale:
    'Authoring registers the held CRG draft-expansion proposal for the traumatic-brain-injury-residuals to seizure-disorder window on 2026-10-06. The strongest feature of this pathway is regulatory, not epidemiological: under 38 CFR § 3.310(d)(1)(ii), in a veteran who has a service-connected traumatic brain injury, unprovoked seizures following moderate or severe traumatic brain injury are held to be the proximate result of that injury in the absence of clear evidence to the contrary, and unlike the dementia entries (15-year window) and depression (3 years / 12 months) that subparagraph carries no manifestation time limit, so a veteran with a service-connected moderate or severe TBI who develops unprovoked seizures years later does not need a case-by-case medical nexus opinion to establish service connection — the regulation concedes the proximate-result element and the opinion\'s real work is to establish the severity of the original injury and to exclude clear evidence to the contrary. Section 3.310(d)(3) supplies the severity table (mild: LOC 0-30 minutes, alteration 1 moment to 24 hours, PTA 0-1 day, GCS 13-15; moderate: LOC >30 minutes to <24 hours, PTA >1 to <7 days, GCS 9-12; severe: LOC >24 hours, PTA >7 days, GCS 3-8), and states that severity is determined by findings at the time of injury or shortly thereafter, that a veteran is not required to meet every criterion under a level, and that where criteria in more than one category are met the injury is ranked at the highest level in which a criterion is met, so the contemporaneous emergency department, theatre or field record is the decisive document. Section 3.310(d)(2) then provides that neither the severity levels nor the time limits preclude a finding of service connection for conditions shown by evidence to be proximately due to the service-connected brain injury, and that where a claim does not meet (d)(1) it is developed and decided under generally applicable principles, so a mild TBI moves the claim onto the ordinary § 3.310(a) causation track. The mechanism evidence describes post-traumatic epileptogenesis — cortical contusion and subdural haematoma causing direct neuronal loss and axonal shearing, blood-brain-barrier breakdown exposing neurons to serum albumin, extravasated blood leaving haemosiderin and free iron as a driver of reactive oxygen species and persistent local inflammation, and reactive gliosis forming a scar that isolates but does not silence the injured cortex, with the functional consequence being selective loss of GABAergic inhibitory interneurons, upregulation of excitatory glutamatergic signalling, and aberrant recurrent excitatory sprouting producing synchronous uncontrolled firing, with the latency between injury and the first unprovoked seizure reflecting the time required for these structural and network changes to mature. The epidemiology supports the direction and severity gradient: the Olmsted County study (PMID 9414327) found an overall standardised incidence ratio of 3.1 (95% CI 2.5-3.8) rising to 17.0 (95% CI 12.3-23.6) after severe injury, and the Danish nationwide cohort (PMID 19233461) confirmed the severity relationship with persistence beyond 10 years. The most recent synthesis (PMID 41686304) supports the gradient and the clinical risk-factor list but found substantial heterogeneity (I-squared 98%) and a pooled severe-injury relative risk that did not reach statistical significance (2.98, 95% CI 0.81-11.01, P = 0.08), so no numeric probability should be asserted in an opinion. The rating schedule corroborates the pathway: DC 8045 directs that physical dysfunction including seizures be evaluated under an appropriate diagnostic code, and the closing paragraph requires each condition be evaluated separately so long as the same signs and symptoms are not used to support more than one evaluation. Two maintainer decisions are recorded on the face of this registration: first, the knowledge-base catalog contains both a published epilepsy identity and a draft seizure-disorder identity with no authored mappings, and this row is written against the draft identity, so a maintainer must decide that the two are not duplicate concepts before either is published; second, because the presumption attaches only to unprovoked seizures after moderate or severe TBI, a veteran with a mild TBI or with provoked seizures, pre-existing epilepsy, or other clear evidence to the contrary does not have the presumption and must establish causation under § 3.310(a) or aggravation under § 3.310(b) as applicable. All references remain subject to qualified-human citation verification under docs/citation-verification-sop.md.',
  sourceReferences: [
    {
      citation: 'Annegers JF, Hauser WA, Coan SP, Rocca WA. A population-based study of seizures after traumatic brain injuries. N Engl J Med. 1998;338(1):20-24. PMID 9414327.',
      note: 'Population-based cohort of 4,541 patients with traumatic brain injury in Olmsted County, Minnesota, followed for unprovoked seizures. Overall standardised incidence ratio 3.1 (95% CI 2.5-3.8), rising to 2.9 (95% CI 1.9-4.1) after moderate injury and 17.0 (95% CI 12.3-23.6) after severe injury, with no excess beyond five years after mild injury. PRIMARY anchor for the severity gradient on which the § 3.310(d) structure depends.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/9414327/',
      verified: false,
      sourceCheckedOn: '2026-10-06',
      sourceLocator: 'N Engl J Med. 1998;338(1):20-24. Population-based cohort, 4,541 TBI patients; historical single-county cohort with treatment eras predating modern neurocritical care.',
    },
    {
      citation: 'Christensen J, Pedersen MG, Pedersen CB, Sidenius P, Olsen J, Vestergaard M. Long-term risk of epilepsy after traumatic brain injury in children and young adults: a population-based cohort study. Lancet. 2009;373(9664):1105-1110. PMID 19233461.',
      note: 'Nationwide Danish cohort of 1,605,216 people followed for epilepsy after TBI. Relative risk 2.22 (95% CI 2.07-2.38) after mild injury and 7.40 (95% CI 6.16-8.89) after severe injury, with skull fracture conferring a relative risk of 2.17 (95% CI 1.73-2.71); excess risk persisted more than 10 years after injury (1.51 after mild, 4.29 after severe) and was higher in those injured above 15 years. Cited for the long-term persistence of risk.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/19233461/',
      verified: false,
      sourceCheckedOn: '2026-10-06',
      sourceLocator: 'Lancet. 2009;373(9664):1105-1110. Nationwide Danish cohort, 1,605,216 people; observational cohort with register-based seizure ascertainment and residual confounding.',
    },
    {
      citation: 'Viaroli E, Gillespie C, Mee H, Chedid Y, Corper S, Joannides A, Menon D, Mohan M, Needham E, Newcombe V, Servadei F, Timofeev I, Kolias A, Hutchinson PJA. Clinical risk factors for post-traumatic seizures: a systematic review and meta-analysis. Neurosurgery. 2026. PMID 41686304.',
      note: 'Systematic review and meta-analysis of 11 studies with 242,803 patients. Pooled incidence of post-traumatic seizures 7.2% (95% CI 5.4-9.3%) with very high heterogeneity (I-squared 98%), and pooled relative risk for severe TBI 2.98 (95% CI 0.81-11.01, P = 0.08), which did NOT reach statistical significance; the authors identify inadequate ascertainment of seizures across studies as a major limitation. Cited as the most recent synthesis and, importantly, cited AGAINST overstatement: it supports the severity gradient and the clinical risk-factor list while showing the pooled quantitative estimate is unstable.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/41686304/',
      verified: false,
      sourceCheckedOn: '2026-10-06',
      sourceLocator: 'Neurosurgery. 2026 (epub ahead of print). Systematic review and meta-analysis, 11 studies, 242,803 patients; pooled severe-injury effect did not reach significance, so no numeric probability should be asserted from it.',
    },
  ],
};

// ── ME-19 edge (depressive-disorder) — must also live in the TBI graph node ──
// Extracted from the host file so the graph node file has both ranks 1 and 2.
const ME19_HOST_EDGE = {
  conditionId: 'depressive-disorder',
  rank: 1,
  nexusClaim: {
    nexusClassification: 'ASSOCIATION_ONLY',
    associationBasis:
      'The published knowledge base includes this relationship as an association only: Mapping Expansion Batch ME-19 adds this relationship only as the user-approved bounded clinical proposition. The cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating traumatic brain injury and that 38% reported clinically significant depressive symptoms. Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder.',
    causationStatus:
      'Neither causation nor aggravation under 38 CFR § 3.310 is established by the current evidence; the guard explicitly limits the claim to association.',
  },
  causalMechanism: {
    mechanismCategory: 'NEUROENDOCRINE_CASCADE',
    primaryVector:
      'Mapping Expansion Batch ME-19 adds this relationship only as the user-approved bounded clinical proposition. The cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating traumatic brain injury and that 38% reported clinically significant depressive symptoms. Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder.',
    hypothesizedOnly: true,
  },
  evidentiaryProfile: {
    etiologicalConsensus: 'NOT_ESTABLISHED',
    vaNexusProbabilityAlignment: 'NOT_ASSERTED',
    conservativeRationale:
      'This relationship is supported as an association only. Mapping Expansion Batch ME-19 adds this relationship only as the user-approved bounded clinical proposition. The cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating traumatic brain injury and that 38% reported clinically significant depressive symptoms. Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder. It is not asserted that the primary caused or aggravated the secondary in any individual case, and this mapping does not, by itself, establish a VA medical nexus.',
    evidenceGaps: [
      'Independent documentation of traumatic-brain-injury-residuals and depressive-disorder',
      'Chronology compatible with the approved bounded proposition',
      'Phenotype/treatment boundary: population-level-comorbidity-association',
      'Assessment of shared risk factors, reverse direction, treatment effects, and other competing causes',
      'Resolution of publication guard: Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder.',
    ],
    alternativeEtiologiesToRuleOut: [
      'pre-existing mood disorder',
      'substance use',
      'concurrent post-traumatic stress or other anxiety disorder',
      'medications',
      'sleep disorders',
      'chronic pain',
      'endocrine disturbance',
    ],
    requiresSpecificDbqEvidence: false,
  },
  evidenceGaps: [
    'Independent documentation of traumatic-brain-injury-residuals and depressive-disorder',
    'Chronology compatible with the approved bounded proposition',
    'Phenotype/treatment boundary: population-level-comorbidity-association',
    'Assessment of shared risk factors, reverse direction, treatment effects, and other competing causes',
    'Resolution of publication guard: Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder.',
  ],
  rationale:
    'Mapping Expansion Batch ME-19 adds this relationship only as the user-approved bounded clinical proposition. The cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating traumatic brain injury and that 38% reported clinically significant depressive symptoms. Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder. The cited literature supports only this constrained proposition and does not, by itself, establish an individual medical nexus.',
  sourceReferences: [
    {
      citation: 'Osborn AJ, Mathias JL, Fairweather-Schmidt AK. Depression following adult, non-penetrating traumatic brain injury: a meta-analysis examining methodological variables and sample characteristics. Neurosci Biobehav Rev. 2014;47:1-15. PMID 25038422. doi:10.1016/j.neubiorev.2014.07.007.',
      note: 'Mapping Expansion Batch ME-19 evidence for the bounded traumatic-brain-injury-residuals to depressive-disorder proposition. Mapping approval is not citation verification; this source enters verified:false pending separate qualified-human citation review.',
      verificationScope: 'clinical-evidence',
      authorityCategory: 'medical-scientific-evidence',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/25038422/',
      verified: true,
      sourceCheckedOn: '2026-09-02',
      sourceLocator: 'PMID 25038422; approved ME-19 source; guard: Require documented residuals of adult non-penetrating traumatic brain injury and a separately established depressive disorder; the cited meta-analysis reported that 27% of adults were diagnosed with major depressive disorder or dysthymia following non-penetrating TBI and 38% reported clinically significant depressive symptoms, without establishing onset order, direction, or individual causation. Preserve pre-existing mood disorder, substance use, concurrent post-traumatic stress or other anxiety disorder, medications, sleep disorders, chronic pain, and endocrine disturbance as competing explanations. Do not infer a depressive disorder from transient mood symptoms, post-concussive complaints, or cognitive symptoms alone, and do not treat this population-level association as proof that traumatic brain injury caused an individual\'s depressive disorder.',
    },
  ],
};

// ── Build the graph edge for ME-19 (rank 1, ASSOCIATION_ONLY) ────────────
function me19GraphEdge() {
  return {
    sourceConditionId: 'traumatic-brain-injury-residuals',
    targetConditionId: 'depressive-disorder',
    rank: 1,
    nexusClaim: {
      nexusClassification: 'ASSOCIATION_ONLY',
      hypothesizedOnly: true,
      status: 'NOT_ESTABLISHED',
    },
    causalMechanism: {
      mechanismCategory: 'NEUROENDOCRINE_CASCADE',
      primaryVector: ME19_HOST_EDGE.causalMechanism.primaryVector,
      hypothesizedOnly: true,
    },
    evidentiaryProfile: {
      etiologicalConsensus: 'NOT_ESTABLISHED',
      vaNexusProbabilityAlignment: 'NOT_ASSERTED',
      conservativeRationale: ME19_HOST_EDGE.evidentiaryProfile.conservativeRationale,
      evidenceGaps: ME19_HOST_EDGE.evidenceGaps,
      alternativeEtiologiesToRuleOut: ME19_HOST_EDGE.evidentiaryProfile.alternativeEtiologiesToRuleOut,
      requiresSpecificDbqEvidence: false,
    },
    rationale: ME19_HOST_EDGE.rationale,
    evidenceGaps: ME19_HOST_EDGE.evidenceGaps,
  };
}

// ── Build the graph edge for row B (rank 2, DIRECT_CAUSATION) ────────────
function rowBGraphEdge() {
  return {
    sourceConditionId: 'traumatic-brain-injury-residuals',
    targetConditionId: 'seizure-disorder',
    rank: 2,
    nexusClaim: { nexusClassification: 'DIRECT_CAUSATION' },
    causalMechanism: ROW_B.causalMechanism,
    evidentiaryProfile: ROW_B.evidentiaryProfile,
    rationale: ROW_B.rationale,
    evidenceGaps: ROW_B.evidenceGaps,
  };
}

// ── Helper: write JSON with 2-space indent + trailing newline ─────────────
function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ── Pre-flight validation gate ────────────────────────────────────────────
function validateSuggestion(suggestion, label) {
  const errors = [];
  if (typeof suggestion.conditionId !== 'string' || !/^[a-z0-9-]+$/.test(suggestion.conditionId)) {
    errors.push(`[${label}] conditionId must be kebab-case: got ${JSON.stringify(suggestion.conditionId)}`);
  }
  if (!Number.isInteger(suggestion.rank) || suggestion.rank < 1) {
    errors.push(`[${label}] rank must be a positive integer: got ${suggestion.rank}`);
  }
  const nx = suggestion.nexusClaim;
  if (nx?.nexusClassification !== 'DIRECT_CAUSATION' && nx?.nexusClassification !== 'ASSOCIATION_ONLY') {
    errors.push(`[${label}] nexusClassification must be DIRECT_CAUSATION or ASSOCIATION_ONLY: got ${nx?.nexusClassification}`);
  }
  if (nx?.nexusClassification === 'DIRECT_CAUSATION') {
    if (typeof nx?.etiologicalTrigger !== 'string' || nx.etiologicalTrigger.length < 50) {
      errors.push(`[${label}] etiologicalTrigger must be >= 50 chars: got ${nx?.etiologicalTrigger?.length ?? 'missing'} chars`);
    }
  }
  if (nx?.nexusClassification === 'ASSOCIATION_ONLY') {
    if (typeof nx?.associationBasis !== 'string' || nx.associationBasis.length < 50) {
      errors.push(`[${label}] associationBasis must be >= 50 chars`);
    }
    if (typeof nx?.causationStatus !== 'string' || nx.causationStatus.length < 50) {
      errors.push(`[${label}] causationStatus must be >= 50 chars`);
    }
  }
  const cm = suggestion.causalMechanism;
  if (!cm) errors.push(`[${label}] missing causalMechanism`);
  else {
    if (typeof cm.primaryVector !== 'string' || cm.primaryVector.length < 50) {
      errors.push(`[${label}] causalMechanism.primaryVector must be >= 50 chars`);
    }
    if (nx?.nexusClassification === 'DIRECT_CAUSATION' && cm.hypothesizedOnly !== false) {
      errors.push(`[${label}] DIRECT_CAUSATION must set hypothesizedOnly: false`);
    }
    if (nx?.nexusClassification === 'ASSOCIATION_ONLY' && cm.hypothesizedOnly !== true) {
      errors.push(`[${label}] ASSOCIATION_ONLY must set hypothesizedOnly: true`);
    }
  }
  const ep = suggestion.evidentiaryProfile;
  if (!ep) errors.push(`[${label}] missing evidentiaryProfile`);
  else {
    if (ep.etiologicalConsensus !== 'WELL_ESTABLISHED' && ep.etiologicalConsensus !== 'NOT_ESTABLISHED') {
      errors.push(`[${label}] etiologicalConsensus must be WELL_ESTABLISHED or NOT_ESTABLISHED: got ${ep.etiologicalConsensus}`);
    }
    if (!Array.isArray(ep.alternativeEtiologiesToRuleOut) || ep.alternativeEtiologiesToRuleOut.length < 1) {
      errors.push(`[${label}] alternativeEtiologiesToRuleOut must be a non-empty array`);
    }
    if (typeof ep.conservativeRationale !== 'string' || ep.conservativeRationale.length < 50) {
      errors.push(`[${label}] conservativeRationale must be >= 50 chars`);
    }
  }
  if (!Array.isArray(suggestion.evidenceGaps) || suggestion.evidenceGaps.length < 1) {
    errors.push(`[${label}] evidenceGaps must be a non-empty array`);
  }
  if (!Array.isArray(suggestion.sourceReferences) || suggestion.sourceReferences.length < 1 || suggestion.sourceReferences.length > 3) {
    errors.push(`[${label}] sourceReferences must be 1–3 items: got ${suggestion.sourceReferences?.length ?? 'missing'}`);
  }
  for (const [i, ref] of (suggestion.sourceReferences ?? []).entries()) {
    if (typeof ref.citation !== 'string' || !ref.citation.trim()) errors.push(`[${label}] sourceReferences[${i}].citation missing`);
    if (typeof ref.note !== 'string' || !ref.note.trim()) errors.push(`[${label}] sourceReferences[${i}].note missing`);
    if (typeof ref.verificationScope !== 'string') errors.push(`[${label}] sourceReferences[${i}].verificationScope missing`);
    if (ref.verified !== true && ref.verified !== false) errors.push(`[${label}] sourceReferences[${i}].verified must be boolean: got ${ref.verified}`);
    if (typeof ref.sourceCheckedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ref.sourceCheckedOn)) errors.push(`[${label}] sourceReferences[${i}].sourceCheckedOn must be YYYY-MM-DD: got ${ref.sourceCheckedOn}`);
    if (typeof ref.sourceLocator !== 'string' || !ref.sourceLocator.trim()) errors.push(`[${label}] sourceReferences[${i}].sourceLocator missing`);
    if (typeof ref.sourceUrl !== 'string' || !/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/.test(ref.sourceUrl)) errors.push(`[${label}] sourceReferences[${i}].sourceUrl must be https://pubmed.ncbi.nlm.nih.gov/<PMID>/: got ${ref.sourceUrl}`);
  }
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log('== CRG batch-5 nexus registration ==\n');

  // ── 1. Validate rows ────────────────────────────────────────────────────
  const aErrs = validateSuggestion(ROW_A, 'RowA(degenerative-disc-disease→radiculopathy)');
  const bErrs = validateSuggestion(ROW_B, 'RowB(TBI-residuals→seizure-disorder)');
  const meErrs = validateSuggestion(ME19_HOST_EDGE, 'ME-19(TBI-residuals→depressive-disorder)');

  if (aErrs.length || bErrs.length || meErrs.length) {
    console.error('PRE-FLIGHT SCHEMA CHECK FAILED:');
    for (const e of [...aErrs, ...bErrs, ...meErrs]) console.error(' ', e);
    process.exit(1);
  }
  console.log('✓ All three rows pass pre-flight structural gate');

  // ── 2. Load + confirm host files are draft ──────────────────────────────
  const hostA = readJson(join(KB, 'degenerative-disc-disease.json'));
  const hostB = readJson(join(KB, 'traumatic-brain-injury-residuals.json'));

  if (hostA.draft !== true) { console.error('HOST A not draft — refusing'); process.exit(1); }
  if (hostB.draft !== true) { console.error('HOST B not draft — refusing'); process.exit(1); }

  // ── 3. Write host files ─────────────────────────────────────────────────
  const newSuggestionsA = hostA.suggestions.filter(s => s.conditionId !== 'radiculopathy');
  newSuggestionsA.push(ROW_A);
  const outA = { ...hostA, suggestions: newSuggestionsA };
  writeJson(join(KB, 'degenerative-disc-disease.json'), outA);
  console.log('✓ Written degenerative-disc-disease.json —', outA.suggestions.length, 'suggestion(s)');

  const newSuggestionsB = hostB.suggestions.filter(s => s.conditionId !== 'seizure-disorder');
  newSuggestionsB.push(ROW_B);
  const outB = { ...hostB, suggestions: newSuggestionsB };
  writeJson(join(KB, 'traumatic-brain-injury-residuals.json'), outB);
  console.log('✓ Written traumatic-brain-injury-residuals.json —', outB.suggestions.length, 'suggestion(s)');

  // ── 4. Write graph node files ───────────────────────────────────────────
  // Row A graph node: degenerative-disc-disease → radiculopathy (rank 1)
  const graphA = {
    nodeId: 'degenerative-disc-disease',
    outgoingEdges: [
      {
        sourceConditionId: 'degenerative-disc-disease',
        targetConditionId: 'radiculopathy',
        rank: 1,
        nexusClaim: { nexusClassification: 'DIRECT_CAUSATION' },
        causalMechanism: ROW_A.causalMechanism,
        evidentiaryProfile: ROW_A.evidentiaryProfile,
        rationale: ROW_A.rationale,
        evidenceGaps: ROW_A.evidenceGaps,
      },
    ],
  };
  writeJson(join(GRAPH, 'degenerative-disc-disease.json'), graphA);
  console.log('✓ Written graph/degenerative-disc-disease.json —', graphA.outgoingEdges.length, 'edge(s)');

  // Row B graph node: TBI residuals → [depressive-disorder (rank 1, ME-19), seizure-disorder (rank 2)]
  const graphB = {
    nodeId: 'traumatic-brain-injury-residuals',
    outgoingEdges: [
      me19GraphEdge(),
      rowBGraphEdge(),
    ],
  };
  writeJson(join(GRAPH, 'traumatic-brain-injury-residuals.json'), graphB);
  console.log('✓ Written graph/traumatic-brain-injury-residuals.json —', graphB.outgoingEdges.length, 'edge(s) (rank 1 ME-19 + rank 2 seizure-disorder)');

  // ── 5. Summary ──────────────────────────────────────────────────────────
  console.log('\n== Summary ==');
  console.log(' PMIDs cited across all registered rows + ME-19 edge:', PMIDS.join(', '));
  console.log(' Held (not registered): hypothyroidism→carpal-tunnel-syndrome, osteoarthritis→peptic-ulcer-disease, rheumatoid-arthritis→avascular-necrosis');
  console.log(' (all three sit on published hosts — citation-purity gate refuses until refs carry verified:true)');
}

main();
