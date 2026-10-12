import { EvidenceStep } from "@/components/secondary/steps/EvidenceStep";
import {
  loadLockedRegulatorySnapshot,
  missingLockedRegulatorySnapshot,
  prepareRegulatoryReview,
} from "@/lib/regulatory/preflight";

export const dynamic = "force-dynamic";

interface EvidenceReviewStepPageProps {
  searchParams?: Promise<{ regSnapshot?: string | string[] }>;
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
 *
 * Audit A01: the accredited-representative locator consumes no query parameter
 * here. Its lookup is a Server Action that returns the directory view as state,
 * so a searched ZIP never enters this page's URL, browser history, or the
 * hosting request line.
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

  return <EvidenceStep snapshot={snapshot} />;
}
