import { z } from "zod";

import type {
  EvidentiaryProfile,
  NexusClaim,
  NexusClassification,
  PathwayIntelligence,
  SecondaryPathwayType,
  SourceReference,
} from "@/lib/kb/schema";

export const intakeSchema = z.object({
  diagnosedConditionIds: z.array(z.string().min(1)).optional(),
  primaryConditions: z.array(z.string().min(1)).min(1),
  symptoms: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  treatments: z.array(z.string()).optional(),
  exposures: z.array(z.string()).default([]),
  history: z.array(z.string()).optional(),
  conditionTimeline: z.record(z.string(), z.object({
    onsetYear: z.number().int().min(1900).max(2100).optional(),
    diagnosisYear: z.number().int().min(1900).max(2100).optional(),
  })).optional(),
  notes: z.string().default(""),
});

export type Intake = z.infer<typeof intakeSchema>;

export interface IntermediatePathEdge {
  conditionId: string;
  conditionName: string;
  targetConditionId: string;
  targetConditionName: string;
  rank: number;
  nexusClassification: NexusClassification;
  etiologicalConsensus: EvidentiaryProfile["etiologicalConsensus"];
  rationale: string;
  pathwayTypes: SecondaryPathwayType[];
  sourceReferences: SourceReference[];
}

export interface IntermediatePathway {
  primaryId: string;
  primaryName: string;
  intermediateId: string;
  intermediateName: string;
  targetId: string;
  targetName: string;
  label: "INTERMEDIATE_CHAIN";
  edges: [IntermediatePathEdge, IntermediatePathEdge];
  causalChain: string;
  sourceReferences: SourceReference[];
}

export interface ClinicalFrictionWarning {
  code: "ALTERNATIVE_ETIOLOGY_OVERLAP";
  primaryId: string;
  primaryName: string;
  message: string;
  matchedHistory?: string;
  alternativeEtiology?: string;
}

export interface ChronologyWarning {
  code: "SECONDARY_PRECEDES_PRIMARY" | "AGGRAVATION_BASELINE_CHRONOLOGY";
  primaryId: string;
  primaryName: string;
  message: string;
  primaryYear?: number;
  secondaryYear?: number;
}

export interface ContributingPrimary {
  id: string;
  name: string;
  rank: number;
  rationale: string;
  pathwayIntelligence?: PathwayIntelligence;
  nexusClaim?: NexusClaim;
  causalMechanism?: {
    mechanismCategory: string;
    primaryVector: string;
    secondaryVector?: string;
    iatrogenicFactor?: string | null;
    hypothesizedOnly: boolean;
  };
  evidentiaryProfile?: EvidentiaryProfile;
}

export interface Recommendation {
  conditionId: string;
  condition: string;
  bodySystem: string;
  etiologicalConsensus: "WELL_ESTABLISHED" | "IATROGENIC_TREATMENT_EFFECT" | "PROBABLE" | "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE" | "NOT_ESTABLISHED";
  score: number;
  contributingPrimaries: ContributingPrimary[];
  evidenceGaps: string[];
  /** Keep the complete source record so downstream exports cannot lose provenance. */
  sourceReferences: SourceReference[];
  /** Advisory warnings only; they never change ranking or establish a nexus. */
  clinicalFrictionWarnings?: ClinicalFrictionWarning[];
  chronologyWarnings?: ChronologyWarning[];
  intermediatePathways?: IntermediatePathway[];
  matchedIntakeContext: string[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  recognizedPrimaries: string[];
  unmappedPrimaries: string[];
  unrecognizedPrimaries: string[];
}
