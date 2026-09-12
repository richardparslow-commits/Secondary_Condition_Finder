"use client";

import type { Recommendation } from "@/lib/engine/types";
import { formatClaimSummary } from "@/lib/engine/export";
import type { CatalogCondition } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import {
  buildActionPlan,
  formatActionPlan,
} from "@/lib/secondary-workflow/action-plan";
import {
  buildPathwayRecordChecklist,
  formatPathwayRecordChecklist,
} from "@/lib/secondary-workflow/pathway-record-checklist";
import {
  buildMedicalRecordChecklist,
  formatMedicalRecordChecklist,
} from "@/lib/secondary-workflow/medical-record-checklist";
import {
  buildRatingGuide,
  formatRatingGuide,
} from "@/lib/secondary-workflow/rating-guide";

interface ConsultationPacketDownloadProps {
  /** Already-stripped recommendations (matchedIntakeContext cleared by the caller). */
  recommendations: Recommendation[];
  results: NonServiceConnectedConditionResult[];
  /** id -> catalog condition, for the rating guide section headers. */
  catalogById: Map<string, CatalogCondition>;
}

type PacketSection = {
  heading: string;
  content: string;
};

const PACKET_FILENAME = "secondary-condition-consultation-packet.txt";

function buildPacketSections(
  recommendations: Recommendation[],
  results: NonServiceConnectedConditionResult[],
  catalogById: Map<string, CatalogCondition>,
): PacketSection[] {
  const sections: PacketSection[] = [];

  sections.push({
    heading: "1. Consultation summary",
    content: formatClaimSummary(recommendations, []),
  });

  const pathwayGroups = buildPathwayRecordChecklist(results);
  if (pathwayGroups.length > 0) {
    sections.push({
      heading: "2. Pathway-specific record checklist (Prepare Evidence)",
      content: formatPathwayRecordChecklist(pathwayGroups),
    });
  }

  const recordGroups = buildMedicalRecordChecklist(results);
  if (recordGroups.length > 0) {
    sections.push({
      heading: "3. Medical record checklist by category",
      content: formatMedicalRecordChecklist(recordGroups),
    });
  }

  const ratingEntries = buildRatingGuide(results, catalogById);
  if (ratingEntries.length > 0) {
    sections.push({
      heading: "4. Rating schedule guide (informational)",
      content: formatRatingGuide(ratingEntries),
    });
  }

  const actionEntries = buildActionPlan(results);
  if (actionEntries.length > 0) {
    sections.push({
      heading: "5. Action plan (research steps)",
      content: formatActionPlan(actionEntries),
    });
  }

  return sections;
}

/**
 * Phase 4 item B: one download that assembles the existing privacy-stripped
 * text exports into a single consultation packet. Pure composition — every
 * section reuses the same format* functions the individual panels render, so
 * the packet cannot diverge from what the UI shows. Privacy exclusions are
 * inherited from those functions (notably: matchedIntakeContext is already
 * cleared on the recommendations by the Step 6 caller; raw evidence excerpts
 * never enter these formatters).
 */
export function ConsultationPacketDownload({
  recommendations,
  results,
  catalogById,
}: ConsultationPacketDownloadProps) {
  const sections = buildPacketSections(recommendations, results, catalogById);

  function downloadPacket() {
    const divider = "=".repeat(72);
    const tableOfContents = sections
      .map((section) => `  ${section.heading}`)
      .join("\n");
    const body = sections
      .map((section) => `${divider}\n${section.heading}\n${divider}\n\n${section.content}`)
      .join("\n\n");
    const header = [
      "Secondary Condition Finder — consultation packet",
      `Generated in-browser: ${new Date().toISOString().slice(0, 10)}`,
      "",
      "Research aid only — not a medical or legal determination.",
      "Discuss every item with a qualified provider or accredited representative.",
      "",
      "Contents:",
      tableOfContents,
      "",
    ].join("\n");
    const content = `${header}\n${body}\n\n${divider}\nEnd of packet\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = PACKET_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div>
      <button type="button" className="ui-button w-full" onClick={downloadPacket}>
        Download full consultation packet
      </button>
      <p className="mt-2 text-xs text-slate-600">
        Assembles every research aid on this page — summary, pathway record checklist, record
        checklist, rating guide, and action plan — into one text file, generated in this browser.
        It contains no raw evidence excerpts and no medication/treatment context.
      </p>
    </div>
  );
}
