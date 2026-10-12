import { PresumptiveResults } from "@/components/presumptive/PresumptiveResults";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { loadServiceBranchReference } from "@/lib/va/service-branches";
import { buildSecondaryCrossLinkIndex } from "./secondary-cross-link";

/**
 * Presumptive results shell (PRIV-01 follow-on, 2026-10-08).
 *
 * The confirmed service history lives in the browser, so this page reads no
 * session and renders no match itself: it loads only public data and hands it
 * to the browser-local view. Nothing here depends on who the visitor is.
 *
 * Audit A01: this page reads no query parameter either. The
 * accredited-representative locator's ZIP lookup is a Server Action that
 * returns the directory view as state, so a searched ZIP cannot enter this
 * page's URL, browser history, or the hosting request line. The lookup still
 * stays server-side (and rate-limited) because it queries a public directory,
 * like the secondary track's identical finder.
 */
export const dynamic = "force-dynamic";

export default async function PresumptiveResultsPage() {
  return (
    <PresumptiveResults
      categories={loadExposureCatalog()}
      crossLinkIndex={buildSecondaryCrossLinkIndex(
        loadConditionCatalog(),
        loadKnowledgeBase(),
      )}
      branchReference={await loadServiceBranchReference()}
    />
  );
}
