import { NextResponse } from "next/server";

import { auditLog } from "@/lib/observability/audit";
import { refreshRegulatoryPreflightCache } from "@/lib/regulatory/preflight";
import { authorizeBearerRequest } from "@/lib/security/bearer-auth";

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

export async function GET(request: Request) {
  if (!authorized(request)) {
    auditLog("regulatory-preflight-unauthorized", { status: "unauthorized", route: "/api/regulatory/preflight" });
    return NextResponse.json({ ok: false, error: "Unauthorized regulatory sync request." }, { status: 401 });
  }

  const snapshot = await refreshRegulatoryPreflightCache();
  auditLog("regulatory-preflight-triggered", {
    status: "success",
    route: "/api/regulatory/preflight",
    count: snapshot.changes.length,
  });
  return NextResponse.json({
    ok: true,
    snapshotId: snapshot.snapshotId,
    finishedAt: snapshot.finishedAt,
    freshness: snapshot.freshness,
    reviewMode: snapshot.reviewMode,
    legalRegulatoryConclusionsAllowed: snapshot.legalRegulatoryConclusionsAllowed,
    changeCount: snapshot.changes.length,
    relevantChangeCount: snapshot.relevantChangeIds.length,
  });
}
