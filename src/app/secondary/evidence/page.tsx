import { EvidenceStep } from "@/components/secondary/steps/EvidenceStep";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
} from "@/lib/regulatory/preflight";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";

export const dynamic = "force-dynamic";

interface EvidenceReviewStepPageProps {
  searchParams?: Promise<{ regSnapshot?: string | string[]; zip?: string; radiusMiles?: string; type?: string }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Uniform shell (PRIV-01 stage 2): Step 6 must use the same regulatory
 * snapshot that Step 5 locked. If a user opens Step 6 directly, establish a
 * scope-free public snapshot before recommendation/evidence output. If a prior
 * lock disappeared, fail closed to medical-only instead of substituting a
 * newer legal snapshot mid-review. The client step runs the engine and every
 * checklist locally over the browser-local context.
 */
export default async function EvidenceReviewStepPage({ searchParams }: EvidenceReviewStepPageProps = {}) {
  const queryParams = await searchParams;
  const lockedSnapshotId = firstParam(queryParams?.regSnapshot);
  const lockedSnapshot = loadLockedRegulatorySnapshot(lockedSnapshotId);
  const snapshot = lockedSnapshot
    ? lockedSnapshot
    : lockedSnapshotId
      ? missingLockedRegulatorySnapshot(lockedSnapshotId)
      : (await prepareRegulatoryReview()).snapshot;

  const zipParam2 = typeof queryParams?.zip === "string" ? queryParams.zip : undefined;
  const accreditedRepView2 = zipParam2 && /^\d{5}$/.test(zipParam2)
    ? await loadAccreditedRepresentatives({
        zip: zipParam2,
        radiusMiles: typeof queryParams?.radiusMiles === "string" ? Number(queryParams.radiusMiles) : 50,
        type: (typeof queryParams?.type === "string" ? queryParams.type : undefined) as "VSO" | "agent" | "attorney" | undefined,
      })
    : null;

  return <EvidenceStep snapshot={snapshot} accreditedRepView={accreditedRepView2} />;
}
