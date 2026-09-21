import type {
  ContributingPrimary,
  Recommendation,
} from "@/lib/engine/types";
import type {
  EtiologicalConsensus,
  MechanismCategory,
  NexusClassification,
  SecondaryPathwayType,
} from "@/lib/kb/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import { SPICER_PATHWAY_TYPES } from "@/lib/secondary-workflow/spicer-aggravation";

/**
 * Pathway-specific record checklist.
 *
 * Unlike `medical-record-checklist.ts` (which types the authored evidence-gap
 * text), this module works one level lower: per claim pathway (primary →
 * secondary via a nexus theory and mechanism) it names the concrete medical
 * records a Veteran can request from providers or VA. Everything projected
 * here is derived from authored KB output (`nexusClaim`, `causalMechanism`,
 * `pathwayIntelligence`, `evidentiaryProfile`) — no new data collection, no
 * LLM, no network. It is a records-gathering aid, never a determination.
 */
export type PathwayRecordCategory =
  | "diagnosis"
  | "specialist"
  | "testing"
  | "treatment"
  | "chronology"
  | "baseline"
  | "alternatives"
  | "nexus-opinion";

export interface PathwayRecordItem {
  record: string;
  category: PathwayRecordCategory;
  why: string;
}

export interface PathwayRecordPathway {
  primaryId: string;
  primaryName: string;
  nexusClassification: NexusClassification | null;
  mechanismCategory: MechanismCategory | null;
  mechanismHypothesizedOnly: boolean;
  pathwayTypes: SecondaryPathwayType[];
  /** Authored Spicer treatment-interference aggravation variant (M21-1 May 2026). */
  spicerTreatmentInterference: boolean;
  etiologicalConsensus: EtiologicalConsensus | null;
  items: PathwayRecordItem[];
}

export interface PathwayRecordGroup {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  etiologicalConsensus: Recommendation["etiologicalConsensus"];
  pathways: PathwayRecordPathway[];
}

export const PATHWAY_RECORD_CATEGORY_LABEL: Record<PathwayRecordCategory, string> = {
  diagnosis: "Diagnosis confirmation",
  specialist: "Specialist evaluation",
  testing: "Testing / imaging",
  treatment: "Treatment records",
  chronology: "Timeline / chronology",
  baseline: "Baseline severity",
  alternatives: "Competing causes",
  "nexus-opinion": "Nexus opinion",
};

export const NEXUS_THEORY_LABEL: Record<NexusClassification, string> = {
  DIRECT_CAUSATION: "Direct causation — 38 CFR § 3.310(a)",
  AGGRAVATION: "Aggravation — 38 CFR § 3.310(b)",
  ASSOCIATION_ONLY: "Association only — neither causation nor aggravation established",
};

export const MECHANISM_CATEGORY_LABEL: Record<MechanismCategory, string> = {
  MICROVASCULAR_METABOLIC: "Microvascular / metabolic",
  BIOMECHANICAL_ALTERATION: "Biomechanical alteration",
  NEUROENDOCRINE_CASCADE: "Neuroendocrine cascade",
  PHARMACOLOGICAL_IATROGENIC: "Pharmacological (medication effect)",
  PSYCHOPHYSIOLOGICAL: "Psychophysiological",
  SYSTEMIC_INFLAMMATORY: "Systemic inflammatory",
  IMMUNE_MEDIATED: "Immune-mediated",
  THROMBOTIC_OR_VASCULAR: "Thrombotic / vascular",
  NEUROLOGICAL_DEGENERATION: "Neurological",
  METABOLIC_OR_NUTRITIONAL: "Metabolic / nutritional",
  MALIGNANT_TRANSFORMATION: "Malignant transformation",
  INFECTIOUS_SPREAD: "Infectious spread",
  MECHANICAL_OR_COMPRESSIVE: "Mechanical / compressive",
  POST_SURGICAL_OR_TREATMENT: "Post-surgical / treatment",
  MULTIFACTORIAL: "Multifactorial",
  NOT_ESTABLISHED: "Mechanism not established",
};

/** Mirrors the pathway chips shown on Step 5 result cards. */
export const PATHWAY_TYPE_LABEL: Record<SecondaryPathwayType, string> = {
  "direct-secondary": "Direct secondary",
  aggravation: "Aggravation",
  "medication-related": "Medication-related",
  "treatment-complication": "Treatment complication",
  biomechanical: "Biomechanical / altered movement",
  "intermediate-chain": "Intermediate chain",
  "disease-progression": "Disease progression / known complication",
  somatopsychic: "Somatopsychic",
  neuroautonomic: "Neuroautonomic",
  "adaptive-equipment": "Adaptive equipment",
  "care-obstacle": "Care obstacle",
};

function baseItems(
  conditionName: string,
  primaryName: string,
  primary: ContributingPrimary,
): PathwayRecordItem[] {
  const alternatives = primary.evidentiaryProfile?.alternativeEtiologiesToRuleOut ?? [];
  const alternativeText = alternatives.length > 0 ? `: ${alternatives.join("; ")}` : "";
  return [
    {
      record: `Current diagnostic confirmation of ${conditionName} (chart notes, testing, or imaging that state the diagnosis)`,
      category: "diagnosis",
      why: "The secondary condition must be currently diagnosed independently of any tool output. Authoritative diagnostic documentation is the foundation every other item builds on.",
    },
    {
      record: `Earliest records showing when ${conditionName} began or was first diagnosed`,
      category: "chronology",
      why: `Timeline records let a reviewer sequence ${primaryName} against ${conditionName} and help distinguish a delayed diagnosis from a later onset.`,
    },
    {
      record: `Records that speak to the competing causes the authored research flags${alternativeText}`,
      category: "alternatives",
      why: "The authored mapping lists alternative etiologies a reviewer will weigh. Records addressing them — or a clinician's written discussion of them — remove avoidable doubt from the theory.",
    },
  ];
}

function theoryItems(
  conditionName: string,
  primaryName: string,
  classification: NexusClassification,
  spicerVariant: boolean,
): PathwayRecordItem[] {
  if (classification === "AGGRAVATION") {
    const items: PathwayRecordItem[] = [
      {
        record: `Baseline severity documentation for ${conditionName} from before ${primaryName} worsened it`,
        category: "baseline",
        why: "38 CFR § 3.310(b) and M21-1 (Spicer, May 2026) require a pre-aggravation baseline. Older chart notes, prior test results, or first treatment records establish where the condition started.",
      },
      {
        record: `Later records showing ${conditionName} needing more treatment, stronger medication, or worse function`,
        category: "treatment",
        why: "Aggravation rests on the difference between the baseline and now. Escalating prescriptions, new referrals, or documented functional loss make that difference concrete.",
      },
    ];
    // Treatment-interference (Spicer) records are listed only when the authored
    // mapping actually marks that pathway — an ordinary aggravation theory is
    // carried by baseline + worsening, not by interference records.
    if (spicerVariant) {
      items.push({
        record: `Records showing ${primaryName} interfered with treatment of ${conditionName} (missed appointments, halted therapy, or medication conflicts)`,
        category: "treatment",
        why: "M21-1 (May 2026), implementing Spicer v. McDonough, treats interference with treatment as aggravation under § 3.310(b) — a different proof path from the before-and-after severity comparison. Provider-documented interference records are the evidence this variant is carried by.",
      });
    }
    return items;
  }
  if (classification === "ASSOCIATION_ONLY") {
    return [
      {
        record: `Specialist evaluation of ${conditionName} that addresses the association with ${primaryName}`,
        category: "specialist",
        why: "With neither causation nor aggravation established for this pairing, a specialist who documents the association — and rules out unrelated causes — is the strongest individual evidence available for it.",
      },
    ];
  }
  return [
    {
      record: `Treatment and management records for ${primaryName}`,
      category: "treatment",
      why: "These document how severe and how active the service-connected condition is — the driver the direct-causation mechanism acts through.",
    },
  ];
}

/**
 * Mechanism-directed records. Conservative and generic enough to be valid for
 * any condition pair sharing the mechanism category — the items name record
 * kinds, never assert a clinical finding.
 */
const MECHANISM_ITEMS: Record<MechanismCategory, PathwayRecordItem[]> = {
  NEUROLOGICAL_DEGENERATION: [
    {
      record: "Sleep study results (polysomnography or home sleep test) when sleep is affected",
      category: "testing",
      why: "Objective sleep data is a measurable injury this mechanism can produce and separates sleep-disordered breathing from insomnia alone.",
    },
    {
      record: "Neurology records, including any neuroimaging (MRI/CT) reports",
      category: "specialist",
      why: "Neurologist notes document the nerve-related findings that connect the service-connected condition to the secondary diagnosis.",
    },
    {
      record: "Sleep-medicine / sleep specialist consultation notes",
      category: "specialist",
      why: "A sleep specialist's notes tie the objective study results to a diagnosis and treatment plan a reviewer can follow.",
    },
  ],
  PSYCHOPHYSIOLOGICAL: [
    {
      record: "Mental-health treatment notes covering the period the secondary condition developed",
      category: "specialist",
      why: "Therapy and psychiatry notes document the stress-physiology pathway and its timing relative to the service-connected condition.",
    },
    {
      record: "Symptom journal or sleep log kept over several weeks",
      category: "chronology",
      why: "A dated log shows frequency and severity patterns consistent with psychophysiological triggers rather than an unrelated course.",
    },
  ],
  MICROVASCULAR_METABOLIC: [
    {
      record: "Recent metabolic labs (for example A1c, lipid panel, kidney function)",
      category: "testing",
      why: "Objective metabolic markers show the systemic injury this mechanism predicts and let a clinician speak to control and progression.",
    },
    {
      record: "Vascular or microvascular studies ordered for the affected system",
      category: "testing",
      why: "Vascular testing turns the microvascular hypothesis into measurable findings on the specific body system involved.",
    },
  ],
  PHARMACOLOGICAL_IATROGENIC: [
    {
      record: "Complete prescription and pharmacy fill history for the implicated medication",
      category: "treatment",
      why: "Fill dates and dosages establish exposure timing and dose — the two facts a medication-effect theory depends on.",
    },
    {
      record: "Prescriber notes documenting why the medication was chosen and any side-effect discussions",
      category: "treatment",
      why: "These notes connect the prescription to the service-connected condition and show the side effect was recognized clinically.",
    },
  ],
  BIOMECHANICAL_ALTERATION: [
    {
      record: "Gait, mobility, or functional-capacity assessment from physical therapy or an examiner",
      category: "testing",
      why: "Functional testing documents the altered movement or loading pattern the mechanism acts through.",
    },
    {
      record: "Imaging of the affected joints or spine",
      category: "testing",
      why: "Imaging provides the structural counterpart to reported pain and shows degeneration or compensation consistent with altered mechanics.",
    },
  ],
  POST_SURGICAL_OR_TREATMENT: [
    {
      record: "Operative or procedure reports with dates",
      category: "treatment",
      why: "The reports anchor exactly when the treatment occurred — the starting point of any treatment-complication timeline.",
    },
    {
      record: "Post-treatment follow-up notes documenting the complication timeline",
      category: "chronology",
      why: "Follow-up notes show the complication emerging after the treatment, which is the sequence a reviewer needs to see.",
    },
  ],
  MECHANICAL_OR_COMPRESSIVE: [
    {
      record: "Nerve-conduction studies or EMG, if performed",
      category: "testing",
      why: "Electrodiagnostic studies objectively localize nerve injury where a compressive mechanism is claimed.",
    },
    {
      record: "Imaging showing the compressive or mechanical source",
      category: "testing",
      why: "Imaging identifies the anatomical source — disc, hardware, scarring — that the mechanism requires.",
    },
  ],
  SYSTEMIC_INFLAMMATORY: [
    {
      record: "Inflammatory marker labs (ESR, CRP) or rheumatology notes",
      category: "testing",
      why: "Objective inflammatory activity supports a systemic-inflammatory link between the two conditions.",
    },
  ],
  NEUROENDOCRINE_CASCADE: [
    {
      record: "Mental-health treatment records showing chronic stress exposure",
      category: "specialist",
      why: "Longitudinal mental-health records document the sustained stress state the neuroendocrine mechanism posits.",
    },
    {
      record: "Endocrine or cortisol-related labs, if ordered",
      category: "testing",
      why: "Where a clinician ordered endocrine testing, results give the cascade objective footing.",
    },
  ],
  IMMUNE_MEDIATED: [
    {
      record: "Immunology or allergy testing results",
      category: "testing",
      why: "Immune testing gives the immune-mediated hypothesis objective markers instead of reported flares alone.",
    },
    {
      record: "Specialist notes documenting immune-mediated activity",
      category: "specialist",
      why: "Specialist interpretation connects the lab values to the clinical course of both conditions.",
    },
  ],
  THROMBOTIC_OR_VASCULAR: [
    {
      record: "Coagulation studies and vascular imaging",
      category: "testing",
      why: "These studies document the clotting or vascular events the mechanism describes and their anatomical location.",
    },
    {
      record: "Hematology or vascular-surgery consult notes",
      category: "specialist",
      why: "Consult notes interpret the vascular findings and relate them to the service-connected condition's course.",
    },
  ],
  METABOLIC_OR_NUTRITIONAL: [
    {
      record: "Nutrition, weight, or endocrine-related lab trend over time",
      category: "testing",
      why: "A trend line shows the metabolic shift the mechanism predicts, rather than a single snapshot.",
    },
  ],
  MALIGNANT_TRANSFORMATION: [
    {
      record: "Oncology records and biopsy/pathology reports",
      category: "specialist",
      why: "Pathology is the decisive record for any malignant-transformation theory; oncology notes carry the treatment history.",
    },
  ],
  INFECTIOUS_SPREAD: [
    {
      record: "Infectious-disease consult notes and culture or serology results",
      category: "specialist",
      why: "Microbiological evidence and specialist interpretation document the infection's course and spread.",
    },
  ],
  MULTIFACTORIAL: [
    {
      record: "Treating-specialist notes that address each contributing system",
      category: "specialist",
      why: "Because several systems contribute, notes that speak to each one prevent a reviewer from weighing only a fragment of the picture.",
    },
    {
      record: "Comprehensive labs spanning the involved systems",
      category: "testing",
      why: "Broad objective data supports the multifactorial theory across all of its contributing mechanisms.",
    },
  ],
  NOT_ESTABLISHED: [
    {
      record: "Records covering both the hypothesized link and the competing causes",
      category: "alternatives",
      why: "The biological cascade is not established for this pairing, so records that let a clinician weigh the hypothesized link against alternatives carry the argument.",
    },
  ],
};

function nexusItem(conditionName: string, primaryName: string): PathwayRecordItem {
  return {
    record: `Nexus opinion from a qualified clinician linking ${primaryName} to ${conditionName}`,
    category: "nexus-opinion",
    why: "A competent clinician's individualized opinion is the evidence VA weighs under the at-least-as-likely-as-not standard. Bring the gathered records to that appointment so the opinion can address your specific history.",
  };
}

function dedupeByRecord(items: PathwayRecordItem[]): PathwayRecordItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.record.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPathway(
  conditionName: string,
  primary: ContributingPrimary,
): PathwayRecordPathway {
  const classification = primary.nexusClaim?.nexusClassification ?? null;
  // Engine types carry mechanismCategory as a plain string; narrow it to the
  // authored enum before the keyed lookup so unknown values fail closed to null.
  const rawMechanism = primary.causalMechanism?.mechanismCategory ?? null;
  const mechanismCategory: MechanismCategory | null =
    rawMechanism && rawMechanism in MECHANISM_ITEMS ? (rawMechanism as MechanismCategory) : null;

  const authoredPathwayTypes = primary.pathwayIntelligence?.pathways ?? [];
  const spicerVariant =
    classification === "AGGRAVATION" &&
    SPICER_PATHWAY_TYPES.some((type) => authoredPathwayTypes.includes(type));

  const items = dedupeByRecord([
    ...baseItems(conditionName, primary.name, primary),
    ...(classification
      ? theoryItems(conditionName, primary.name, classification, spicerVariant)
      : []),
    ...(mechanismCategory ? MECHANISM_ITEMS[mechanismCategory] : []),
    nexusItem(conditionName, primary.name),
  ]);

  return {
    primaryId: primary.id,
    primaryName: primary.name,
    nexusClassification: classification,
    mechanismCategory,
    mechanismHypothesizedOnly: primary.causalMechanism?.hypothesizedOnly ?? false,
    pathwayTypes: authoredPathwayTypes,
    spicerTreatmentInterference: spicerVariant,
    etiologicalConsensus: primary.evidentiaryProfile?.etiologicalConsensus ?? null,
    items,
  };
}

export function buildPathwayRecordChecklist(
  results: NonServiceConnectedConditionResult[],
): PathwayRecordGroup[] {
  return results
    .filter((result) => result.recommendation !== null)
    .map((result) => {
      const rec = result.recommendation!;
      return {
        conditionId: result.conditionId,
        conditionName: result.conditionName,
        bodySystem: result.bodySystem,
        etiologicalConsensus: rec.etiologicalConsensus,
        pathways: rec.contributingPrimaries.map((primary) => buildPathway(result.conditionName, primary)),
      };
    })
    .sort((a, b) => a.conditionName.localeCompare(b.conditionName));
}

export function formatPathwayRecordChecklist(groups: PathwayRecordGroup[]): string {
  const lines: string[] = [
    "PATHWAY-SPECIFIC MEDICAL RECORD CHECKLIST — SECONDARY CONDITION FINDER",
    "Generated in this browser for research preparation (not a VA determination).",
    "=".repeat(64),
    "",
    "How to use: for each claim pathway below, request or locate the records listed.",
    "One pathway may list the same record kind as another — gather it once and file",
    "it under both. Share the packet with a qualified clinician or accredited",
    "representative for nexus review. A checkmark means you found material to",
    "discuss, never that the evidence is sufficient or accepted by VA.",
    "",
  ];
  for (const group of groups) {
    lines.push(`Condition: ${group.conditionName} (${group.bodySystem}) — Consensus: ${group.etiologicalConsensus}`);
    lines.push("-".repeat(48));
    group.pathways.forEach((pathway, index) => {
      lines.push(`Pathway ${index + 1}: ${pathway.primaryName} → ${group.conditionName}`);
      lines.push(`  Claim theory: ${pathway.nexusClassification ?? "(not specified in authored mapping)"}${pathway.nexusClassification ? ` (${NEXUS_THEORY_LABEL[pathway.nexusClassification]})` : ""}`);
      if (pathway.spicerTreatmentInterference) {
        lines.push("  Spicer variant: treatment-interference aggravation (M21-1 May 2026, Spicer v. McDonough) — provider-documented interference with treatment carries this theory under 38 CFR § 3.310(b).");
      }
      if (pathway.mechanismCategory) {
        lines.push(`  Mechanism: ${MECHANISM_CATEGORY_LABEL[pathway.mechanismCategory]}${pathway.mechanismHypothesizedOnly ? " (hypothesized, not established)" : ""}`);
      }
      if (pathway.pathwayTypes.length > 0) {
        lines.push(`  Authored pathways: ${pathway.pathwayTypes.map((type) => PATHWAY_TYPE_LABEL[type]).join(", ")}`);
      }
      if (pathway.etiologicalConsensus) {
        lines.push(`  Pathway consensus: ${pathway.etiologicalConsensus}`);
      }
      for (const item of pathway.items) {
        lines.push(`  [ ] ${item.record}  [${PATHWAY_RECORD_CATEGORY_LABEL[item.category]}]`);
        lines.push(`      Why: ${item.why}`);
      }
      lines.push("");
    });
  }
  lines.push("DISCLAIMER: Research checklist only — not medical diagnosis, legal advice,");
  lines.push("or a VA rating prediction. Verify current VA guidance with a qualified");
  lines.push("provider or accredited representative.");
  return lines.join("\n");
}

/** Joins the pathway checklist with the consultation-summary text for one combined export. */
export function combineChecklistWithSummary(checklistText: string, summaryText: string): string {
  return `${checklistText}\n\n${"=".repeat(64)}\n\n${summaryText}`;
}
