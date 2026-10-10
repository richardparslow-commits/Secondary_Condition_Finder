import { SuggestionsStep } from "@/components/secondary/steps/SuggestionsStep";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
} from "@/lib/regulatory/preflight";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

interface SuggestionsPageProps {
  searchParams?: Promise<{ regSnapshot?: string | string[]; zip?: string; radiusMiles?: string; type?: string }>;
}
export const dynamic = "force-dynamic";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Uniform shell (PRIV-01 stage 2): prepares a scope-free regulatory snapshot
 * (identical for every visitor), loads the public VA reference, and resolves
 * the optional accredited-representative lookup from URL parameters — none of
 * which accept veteran health context. The client step reads the
 * browser-local context and runs the engine locally.
 */
export default async function SuggestionsStepPage({ searchParams }: SuggestionsPageProps = {}) {
  const queryParams = await searchParams;
  // Regulatory preflight is intentionally completed before recommendation
  // output. If this is a back-navigation inside the same review, reuse the
  // locked snapshot rather than silently changing the legal/regulatory basis
  // mid-review. Relevance is filtered in the browser against the browser-local
  // selections — the snapshot itself never sees them.
  const lockedSnapshotId = firstParam(queryParams?.regSnapshot);
  const lockedSnapshot = loadLockedRegulatorySnapshot(lockedSnapshotId);
  const snapshot = lockedSnapshot
    ? lockedSnapshot
    : lockedSnapshotId
      ? missingLockedRegulatorySnapshot(lockedSnapshotId)
      : (await prepareRegulatoryReview()).snapshot;

  const zipParam = typeof queryParams?.zip === "string" ? queryParams.zip : undefined;
  const radiusParam = typeof queryParams?.radiusMiles === "string" ? queryParams.radiusMiles : undefined;
  const typeParam = typeof queryParams?.type === "string" ? queryParams.type : undefined;
  const [vaReference, accreditedRepView] = await Promise.all([
    loadDisabilityReference(),
    zipParam && /^\d{5}$/.test(zipParam)
      ? loadAccreditedRepresentatives({
          zip: zipParam,
          radiusMiles: radiusParam ? Number(radiusParam) : 50,
          type: (typeParam as "VSO" | "agent" | "attorney" | undefined),
        })
      : Promise.resolve(null),
  ]);

  return (
    <SuggestionsStep
      snapshot={snapshot}
      vaReference={{
        live: vaReference.live,
        sourceLabel: vaReference.sourceLabel,
        environment: vaReference.environment,
        items: vaReference.items,
      }}
      accreditedRepView={accreditedRepView}
    />
  );
}
