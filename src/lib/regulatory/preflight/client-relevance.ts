import { changeMatchesReviewScope } from "./relevance";
import type {
  RegulatoryPreflightChange,
  RegulatoryPreflightSnapshot,
} from "./types";

/**
 * Client-side relevance filter (PRIV-01 stage 2).
 *
 * The server prepares regulatory snapshots with NO review scope — a uniform
 * public artifact identical for every visitor — and the browser filters the
 * changes against its own browser-local condition ids with the same
 * `changeMatchesReviewScope` rule the server used to apply at preparation
 * time. Veteran context therefore never reaches the snapshot, the cache, or
 * the request.
 */
export function relevantChangesForConditionIds(
  snapshot: RegulatoryPreflightSnapshot,
  conditionIds: readonly string[],
): RegulatoryPreflightChange[] {
  const scope = { conditionIds: [...conditionIds] };
  return snapshot.changes.filter((change) =>
    changeMatchesReviewScope(change, scope),
  );
}
