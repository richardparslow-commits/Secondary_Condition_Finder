"use client";

import { formatClaimSummary } from "@/lib/engine/export";
import type { Recommendation } from "@/lib/engine/types";

type ConsultationSummaryDownloadProps = {
  recommendations: Recommendation[];
};

const DOWNLOAD_FILENAME = "secondary-condition-research-summary.txt";

export function ConsultationSummaryDownload({ recommendations }: ConsultationSummaryDownloadProps) {
  function downloadSummary() {
    const content = formatClaimSummary(recommendations, []);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = DOWNLOAD_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div>
      <button type="button" className="ui-button w-full" onClick={downloadSummary}>
        Download consultation summary
      </button>
      <p className="mt-2 text-sm text-slate-600">
        Creates a text file in this browser only. The export includes authored research recommendations,
        contributing primary conditions, evidence gaps, and citations. It does not include raw local-evidence
        excerpts or optional medication/treatment context.
      </p>
    </div>
  );
}
