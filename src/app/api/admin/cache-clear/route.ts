import { NextResponse } from "next/server";

import { auditLog } from "@/lib/observability/audit";
import { authorizeBearerRequest } from "@/lib/security/bearer-auth";
import { clearVaReferenceCache } from "@/lib/va/reference-cache";
import {
  bumpVaSharedCacheEpoch,
  isVaSharedCacheConfigured,
} from "@/lib/va/reference-shared-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Operator authorization: fail-closed shared-secret bearer check. Requires the
 * `Bearer ` scheme, a configured secret of at least 32 characters, and a
 * constant-time comparison (see `@/lib/security/bearer-auth`). A missing or
 * short secret never authorizes.
 */
const authorized = (request: Request): boolean =>
  authorizeBearerRequest(
    request,
    process.env.REGULATORY_SYNC_SECRET ?? process.env.CRON_SECRET,
  );

/**
 * POST /api/admin/cache-clear
 *
 * Clears the process-local VA reference cache. Authenticated via CRON_SECRET
 * or REGULATORY_SYNC_SECRET Bearer token (same pattern as /api/regulatory/preflight).
 *
 * When a shared KV is configured, the store-wide invalidation epoch is also
 * advanced so every instance discards previously cached entries on its next
 * read (this client cannot enumerate KV keys, and a delete sweep would race
 * concurrent writers). The bump is store-wide by design: a `prefix`-scoped
 * clear over-invalidates other namespaces, which is safe, whereas
 * under-invalidation is the failure mode that matters.
 *
 * Query params:
 * - prefix (optional): only clear process-local keys starting with this prefix
 *
 * Response: { ok, cleared, prefix?, sharedInvalidation, sharedEpoch }
 * HTTP 200 on success, 401 on unauthorized.
 */
export async function POST(request: Request) {
  if (!authorized(request)) {
    auditLog("admin-cache-clear-unauthorized", {
      status: "unauthorized",
      route: "/api/admin/cache-clear",
    });
    return NextResponse.json({ ok: false, error: "Unauthorized cache-clear request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || undefined;

  const { cleared } = clearVaReferenceCache(prefix);

  const sharedConfigured = isVaSharedCacheConfigured();
  const sharedEpoch = sharedConfigured ? await bumpVaSharedCacheEpoch() : null;
  const sharedInvalidation = !sharedConfigured
    ? "not-configured"
    : sharedEpoch !== null
      ? "applied"
      : "failed";

  auditLog("admin-cache-clear-triggered", {
    status: sharedInvalidation === "failed" ? "failure" : "success",
    route: "/api/admin/cache-clear",
    cleared,
    prefix: prefix ?? "(all)",
    // 0 records "no shared epoch was advanced" (bump returns ≥1 on success).
    sharedEpoch: sharedEpoch !== null ? Number(sharedEpoch) : 0,
  });

  return NextResponse.json({
    ok: true,
    cleared,
    prefix: prefix ?? null,
    sharedInvalidation,
    sharedEpoch,
    message:
      (prefix
        ? `Cleared ${cleared} cache entries with prefix "${prefix}".`
        : `Cleared all ${cleared} cache entries.`) +
      (sharedInvalidation === "applied"
        ? ` Advanced shared-cache invalidation epoch to ${sharedEpoch}.`
        : sharedInvalidation === "failed"
          ? " Shared-cache invalidation could not be confirmed; the shared tier may still serve stale entries until their TTL expires."
          : ""),
  });
}
