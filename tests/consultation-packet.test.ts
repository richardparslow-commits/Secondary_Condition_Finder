import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildPacketSections } from "@/components/ConsultationPacketDownload";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import type { CatalogCondition } from "@/lib/catalog/schema";
import type { Recommendation } from "@/lib/engine/types";
import { buildMedicalRecordChecklist, medicalChecklistItemKey } from "@/lib/secondary-workflow/medical-record-checklist";
import { buildPathwayRecordChecklist, pathwayChecklistItemKey } from "@/lib/secondary-workflow/pathway-record-checklist";
import { GENERIC_FUNCTIONAL_PROMPTS, symptomNoteId } from "@/lib/secondary-workflow/rating-guide";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";

/**
 * Phase 4 item B contract: the unified consultation packet is pure
 * composition of the existing privacy-stripped exports.
 *
 * 1. It reuses the exact format* functions the individual panels render, so
 *    the packet cannot diverge from the UI.
 * 2. Privacy exclusions are inherited, not re-implemented: the recommendations
 *    passed in must already have matchedIntakeContext cleared by the Step 6
 *    caller (the component never re-adds context), and no formatter invoked
 *    receives raw evidence excerpts.
 * 3. The packet has a table of contents matching its sections, and every
 *    section is emitted with its heading.
 * 4. The component is wired into Step 6 with the same stripped
 *    recommendations the other exports receive.
 */
const component = fs.readFileSync(
  path.join(process.cwd(), "src/components/ConsultationPacketDownload.tsx"),
  "utf8",
);
const evidencePage = fs.readFileSync(
  path.join(process.cwd(), "src/components/secondary/steps/EvidenceStep.tsx"),
  "utf8",
);

function recommendation(): Recommendation {
  return {
    conditionId: "ptsd",
    condition: "Post-Traumatic Stress Disorder (PTSD)",
    bodySystem: "Mental Disorders",
    etiologicalConsensus: "PROBABLE",
    score: 0.5,
    contributingPrimaries: [{ id: "ptsd", name: "PTSD", rank: 1, rationale: "fixture" }],
    evidenceGaps: [],
    sourceReferences: [],
    matchedIntakeContext: [],
  } as Recommendation;
}

describe("consultation packet composition contract", () => {
  it("reuses the shipped format functions instead of re-implementing exports", () => {
    for (const fn of [
      "formatClaimSummary(",
      "formatPathwayRecordChecklist(",
      "formatMedicalRecordChecklist(",
      "formatRatingGuide(",
      "formatActionPlan(",
    ]) {
      expect(component).toContain(fn);
    }
  });

  it("builds each section through the matching build* function", () => {
    const pairs: Array<[string, string]> = [
      ["formatPathwayRecordChecklist(", "buildPathwayRecordChecklist("],
      ["formatMedicalRecordChecklist(", "buildMedicalRecordChecklist("],
      ["formatRatingGuide(", "buildRatingGuide("],
      ["formatActionPlan(", "buildActionPlan("],
    ];
    for (const [formatFn, buildFn] of pairs) {
      expect(component).toContain(buildFn);
      expect(component.indexOf(buildFn)).toBeLessThan(component.indexOf(formatFn));
    }
  });

  it("renders only non-empty sections with numbered headings and a matching TOC", () => {
    // Sections are conditionally pushed only when groups/entries exist.
    for (const heading of [
      'if (pathwayGroups.length > 0)',
      'if (recordGroups.length > 0)',
      'if (ratingEntries.length > 0)',
      'if (actionEntries.length > 0)',
    ]) {
      expect(component).toContain(heading);
    }
    expect(component).toContain('"Contents:"');
    expect(component).toContain("tableOfContents");
  });

  it("includes the rating-guide symptom notes marked in Step 6", () => {
    const catalogById = new Map(indexById(loadConditionCatalog())) as Map<string, CatalogCondition>;
    const rec = recommendation();
    const results: NonServiceConnectedConditionResult[] = [
      { conditionId: "ptsd", conditionName: "PTSD", bodySystem: "Mental Disorders", recommendation: rec },
    ];
    const selections = { [symptomNoteId("ptsd", GENERIC_FUNCTIONAL_PROMPTS[0])]: true };

    const withNotes = buildPacketSections([rec], results, catalogById, selections);
    const ratingSection = withNotes.find((section) => section.heading.startsWith("4."));
    expect(ratingSection?.content).toContain("Notes you marked while exploring");
    expect(ratingSection?.content).toContain(GENERIC_FUNCTIONAL_PROMPTS[0]);

    const withoutNotes = buildPacketSections([rec], results, catalogById, {});
    expect(withoutNotes.find((section) => section.heading.startsWith("4."))?.content).not.toContain(
      "Notes you marked while exploring",
    );
  });

  it("includes located medical and pathway checklist items in the packet", () => {
    const catalogById = new Map(indexById(loadConditionCatalog())) as Map<string, CatalogCondition>;
    const rec = { ...recommendation(), evidenceGaps: ["First medical gap", "Second medical gap"] };
    const results: NonServiceConnectedConditionResult[] = [
      { conditionId: "ptsd", conditionName: "PTSD", bodySystem: "Mental Disorders", recommendation: rec },
    ];
    const medicalGroup = buildMedicalRecordChecklist(results)[0];
    const medicalLocated: ReadonlySet<string> = new Set([
      medicalChecklistItemKey(medicalGroup, medicalGroup.items[0]),
    ]);
    const pathwayGroup = buildPathwayRecordChecklist(results)[0];
    const pathway = pathwayGroup.pathways[0];
    const pathwayLocated: Record<string, true> = {
      [pathwayChecklistItemKey(pathwayGroup, pathway, pathway.items[0])]: true,
    };

    const sections = buildPacketSections([rec], results, catalogById, {}, {
      medical: medicalLocated,
      pathway: pathwayLocated,
    });
    const medicalSection = sections.find((section) => section.heading.startsWith("3."));
    const pathwaySection = sections.find((section) => section.heading.startsWith("2."));

    expect(medicalSection?.content).toContain(`[x] ${medicalGroup.items[0].gap}`);
    expect(medicalSection?.content).toContain(`[ ] ${medicalGroup.items[1].gap}`);
    expect(pathwaySection?.content).toContain(`[x] ${pathway.items[0].record}`);
    expect(pathwaySection?.content).toContain(`[ ] ${pathway.items[1].record}`);
  });

  it("keeps the privacy boundary: no evidence excerpts or intake context enter the packet", () => {
    // The component imports no evidence/ storage or excerpt types.
    expect(component).not.toContain("evidence/storage");
    expect(component).not.toContain("EvidenceExcerpt");
    expect(component).not.toContain("loadStoredEvidence");
    // The export copy states the exclusions to the user.
    expect(component).toContain("no raw evidence excerpts");
    expect(component).toContain("no medication/treatment context");
  });

  it("wires Step 6 rating-guide selections into both the guide and the packet", () => {
    expect(component).toContain("formatRatingGuide(ratingEntries, ratingSelections)");
    expect(evidencePage).toContain("selections={ratingSelections}");
    expect(evidencePage).toContain("onSelectionsChange={setRatingSelections}");
    expect(evidencePage).toContain("ratingSelections={ratingSelections}");
    expect(evidencePage).toContain("checked={medicalChecklistChecked}");
    expect(evidencePage).toContain("onCheckedChange={setMedicalChecklistChecked}");
    expect(evidencePage).toContain("medicalChecklistChecked={medicalChecklistChecked}");
    expect(component).toContain("readPathwayRecordChecklistState()");
  });

  it("is wired into Step 6 with the same stripped recommendations as the other exports", () => {
    expect(evidencePage).toContain("ConsultationPacketDownload");
    const packetIndex = evidencePage.indexOf("<ConsultationPacketDownload");
    const recommendationsProp = evidencePage.indexOf(
      "recommendations={consultationRecommendations}",
      packetIndex,
    );
    expect(packetIndex).toBeGreaterThan(-1);
    expect(recommendationsProp).toBeGreaterThan(packetIndex);
    // consultationRecommendations is the caller-stripped list (matchedIntakeContext cleared).
    expect(evidencePage).toContain("matchedIntakeContext: []");
  });
});
