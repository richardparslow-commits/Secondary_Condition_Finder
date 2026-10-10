import { PresumptiveResults } from "@/components/presumptive/PresumptiveResults";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { loadExposureCatalog } from "@/lib/presumptive/load";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import { loadServiceBranchReference } from "@/lib/va/service-branches";
import { buildSecondaryCrossLinkIndex } from "./secondary-cross-link";

/**
 * Presumptive results shell (PRIV-01 follow-on, 2026-10-08).
 *
 * The confirmed service history lives in the browser, so this page reads no
 * session and renders no match itself: it loads only public data and hands it
 * to the browser-local view. Nothing here depends on who the visitor is.
 */
export const dynamic = "force-dynamic";

export default async function PresumptiveResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ zip?: string; radiusMiles?: string; type?: string }>;
}) {
  // Accredited-rep locator uses a non-PII ZIP lookup (public directory, not service history).
  // It stays server-side (and rate-limited) because it queries a public directory,
  // like the secondary track's identical finder.
  const queryParams = await searchParams;
  const zipForRep =
    typeof queryParams?.zip === "string" ? queryParams.zip : undefined;
  const accreditedRepView =
    zipForRep && /^\d{5}$/.test(zipForRep)
      ? await loadAccreditedRepresentatives({
          zip: zipForRep,
          radiusMiles:
            typeof queryParams?.radiusMiles === "string"
              ? Number(queryParams.radiusMiles)
              : 50,
          type: (typeof queryParams?.type === "string"
            ? queryParams.type
            : undefined) as "VSO" | "agent" | "attorney" | undefined,
        })
      : null;

  return (
    <PresumptiveResults
      categories={loadExposureCatalog()}
      crossLinkIndex={buildSecondaryCrossLinkIndex(
        loadConditionCatalog(),
        loadKnowledgeBase(),
      )}
      branchReference={await loadServiceBranchReference()}
      accreditedRepView={accreditedRepView}
    />
  );
}
