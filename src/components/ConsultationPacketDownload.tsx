"use client";

import type { Recommendation } from "@/lib/engine/types";
import { formatClaimSummary } from "@/lib/engine/export";
import type { CatalogCondition } from "@/lib/catalog/schema";
import type { NonServiceConnectedConditionResult } from "@/lib/secondary-workflow/suggestions";
import {
  buildActionPlan,
  formatActionPlan,
} from "@/lib/secondary-workflow/action-plan";
import { readPathwayRecordChecklistState } from "@/components/secondary/PathwayRecordChecklist";
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
  /** Rating-guide symptom notes marked in Step 6, keyed `conditionId:prompt`. */
  ratingSelections?: Record<string, boolean>;
  /** Medical-checklist items marked as located in Step 6, shared with the panel. */
  medicalChecklistChecked?: ReadonlySet<string>;
}

type PacketSection = {
  heading: string;
  content: string;
};

interface ChecklistSelections {
  medical?: ReadonlySet<string>;
  pathway?: Readonly<Record<string, true>>;
}

const PACKET_FILENAME = "secondary-condition-consultation-packet.txt";

export function buildPacketSections(
  recommendations: Recommendation[],
  results: NonServiceConnectedConditionResult[],
  catalogById: Map<string, CatalogCondition>,
  ratingSelections: Record<string, boolean> = {},
  checklistSelections: ChecklistSelections = {},
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
      content: formatPathwayRecordChecklist(pathwayGroups, checklistSelections.pathway),
    });
  }

  const recordGroups = buildMedicalRecordChecklist(results);
  if (recordGroups.length > 0) {
    sections.push({
      heading: "3. Medical record checklist by category",
      content: formatMedicalRecordChecklist(recordGroups, checklistSelections.medical),
    });
  }

  const ratingEntries = buildRatingGuide(results, catalogById);
  if (ratingEntries.length > 0) {
    sections.push({
      heading: "4. Rating schedule guide (informational)",
      content: formatRatingGuide(ratingEntries, ratingSelections),
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
  ratingSelections,
  medicalChecklistChecked,
}: ConsultationPacketDownloadProps) {
  function downloadPacket() {
    const sections = buildPacketSections(
      recommendations,
      results,
      catalogById,
      ratingSelections,
      {
        medical: medicalChecklistChecked,
        pathway: readPathwayRecordChecklistState(),
      },
    );
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
      "A veteran-reviewed record term is NOT proof of a clinical diagnosis or VA service connection.",
      "Confirm recorded conditions with a qualified clinician; discuss claim status with an accredited representative.",
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
        checklist, rating guide (including marked symptom notes), and action plan — into one text
        file, generated in this browser. It contains no raw evidence excerpts and no medication/treatment context.
      </p>
    </div>
  );
}
