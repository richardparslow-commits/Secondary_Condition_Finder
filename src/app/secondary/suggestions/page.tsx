import { SuggestionsStep } from "@/components/secondary/steps/SuggestionsStep";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
} from "@/lib/regulatory/preflight";
import { loadDisabilityReference } from "@/lib/va/disability-reference";

interface SuggestionsPageProps {
  searchParams?: Promise<{ regSnapshot?: string | string[] }>;
}
export const dynamic = "force-dynamic";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Uniform shell (PRIV-01 stage 2): prepares a scope-free regulatory snapshot
 * (identical for every visitor) and loads the public VA reference — neither of
 * which accepts veteran health context. The client step reads the
 * browser-local context and runs the engine locally.
 *
 * Audit A01: the accredited-representative locator reads no query parameter
 * here any more. Its lookup is a Server Action whose ZIP travels in the request
 * body, so this page's URL cannot carry a searched ZIP into browser history or
 * the hosting request line; the locator renders whatever the action returns.
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

  const vaReference = await loadDisabilityReference();

  return (
    <SuggestionsStep
      snapshot={snapshot}
      vaReference={{
        live: vaReference.live,
        sourceLabel: vaReference.sourceLabel,
        environment: vaReference.environment,
        items: vaReference.items,
        totalAvailable: vaReference.totalAvailable,
      }}
    />
  );
}
