import type { CatalogCondition } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

import type { EtiologicalConsensus, ConsensusTone } from "@/lib/recommendation-prevalence";
import { consensusTone } from "@/lib/recommendation-prevalence";

export interface ComparisonRow {
  conditionId: string;
  conditionName: string;
  bodySystem: string;
  nexusClassifications: string[];
  etiologicalConsensus: EtiologicalConsensus;
  citationCount: number;
  evidenceGapCount: number;
  contributingPrimaryNames: string[];
  ratingFramework: string;
}

function ratingFrameworkLabel(condition: CatalogCondition | undefined): string {
  if (!condition || condition.ratingSchedule.length === 0) return "Refer to VA schedule — no single diagnostic code asserted for this identity";
  const entry = condition.ratingSchedule[0];
  return `${entry.citation}${entry.note ? ` — ${entry.note}` : ""}`;
}

export function buildComparisonRows(
  results: NonServiceConnectedConditionResult[],
  selectedIds: string[],
  catalogById: Map<string, CatalogCondition>,
): ComparisonRow[] {
  const selectedSet = new Set(selectedIds);
  return results
    .filter((result) => selectedSet.has(result.conditionId) && result.recommendation !== null)
    .map((result) => {
      const rec = result.recommendation!;
      const nexus = [...new Set(rec.contributingPrimaries.map((p) => p.nexusClaim?.nexusClassification ?? "unknown"))];
      const catalogEntry = catalogById.get(result.conditionId);
      return {
        conditionId: result.conditionId,
        conditionName: result.conditionName,
        bodySystem: result.bodySystem,
        nexusClassifications: nexus,
        etiologicalConsensus: rec.etiologicalConsensus,
        citationCount: rec.sourceReferences.length,
        evidenceGapCount: rec.evidenceGaps.length,
        contributingPrimaryNames: rec.contributingPrimaries.map((p) => p.name),
        ratingFramework: ratingFrameworkLabel(catalogEntry),
      };
    });
}

export function formatConditionComparison(rows: ComparisonRow[]): string {
  const lines: string[] = [
    "CONDITION COMPARISON — SECONDARY CONDITION FINDER",
    "Research comparison only — not a VA determination or rating prediction.",
    "=".repeat(64),
    "",
  ];
  if (rows.length === 0) {
    lines.push("No conditions selected for comparison.");
    return lines.join("\n");
  }
  // Header row
  lines.push(["Condition", "Body System", "Nexus", "Consensus", "Citations", "Gaps", "Primaries", "Rating Framework"].join(" | "));
  lines.push("-".repeat(96));
  for (const row of rows) {
    lines.push(
      [
        row.conditionName,
        row.bodySystem,
        row.nexusClassifications.join(", "),
        row.etiologicalConsensus,
        String(row.citationCount),
        String(row.evidenceGapCount),
        row.contributingPrimaryNames.join("; "),
        row.ratingFramework,
      ].join(" | "),
    );
  }
  lines.push("");
  lines.push("How to read:");
  lines.push("- Nexus: authored CRG classification per contributing primary (DIRECT_CAUSATION / AGGRAVATION / ASSOCIATION_ONLY).");
  lines.push("- Consensus: WELL_ESTABLISHED / PROBABLE are stronger than CONTESTED / NOT_ESTABLISHED — stronger cells worth prioritizing, but not a VA finding.");
  lines.push("- Citations / Gaps: counts from the published mapping; more citations does not equal stronger claim without individual evidence.");
  lines.push("- Rating Framework: VA schedule citation from the catalog; final rating depends on documented findings and VA evaluation.");
  lines.push("");
  lines.push("DISCLAIMER: Side-by-side comparison is a research triage aid. Confirm current VA guidance with a qualified");
  lines.push("provider or accredited representative. Rating framework text is informational and not a nexus or rating determination.");
  return lines.join("\n");
}

export function consensusBadgeTone(consensus: EtiologicalConsensus): ConsensusTone {
  return consensusTone(consensus);
}
