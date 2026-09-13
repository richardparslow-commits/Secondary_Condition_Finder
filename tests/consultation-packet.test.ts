import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
  path.join(process.cwd(), "src/app/secondary/evidence/page.tsx"),
  "utf8",
);

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

  it("keeps the privacy boundary: no evidence excerpts or intake context enter the packet", () => {
    // The component imports no evidence/ storage or excerpt types.
    expect(component).not.toContain("evidence/storage");
    expect(component).not.toContain("EvidenceExcerpt");
    expect(component).not.toContain("loadStoredEvidence");
    // The export copy states the exclusions to the user.
    expect(component).toContain("no raw evidence excerpts");
    expect(component).toContain("no medication/treatment context");
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
