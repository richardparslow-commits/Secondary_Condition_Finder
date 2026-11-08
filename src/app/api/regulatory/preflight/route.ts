import { NextResponse } from "next/server";

import { auditLog } from "@/lib/observability/audit";
import { refreshRegulatoryPreflightCache } from "@/lib/regulatory/preflight";
import { requiredSourcesFailed } from "@/lib/regulatory/preflight/freshness";
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
  const refreshed = !requiredSourcesFailed(snapshot.sourceResults);
  auditLog("regulatory-preflight-triggered", {
    status: refreshed ? "success" : "failure",
    route: "/api/regulatory/preflight",
    count: snapshot.changes.length,
  });
  return NextResponse.json({
    ok: refreshed,
    ...(refreshed ? {} : { error: "Regulatory refresh did not complete; required sources did not all update." }),
    snapshotId: snapshot.snapshotId,
    finishedAt: snapshot.finishedAt,
    freshness: snapshot.freshness,
    reviewMode: snapshot.reviewMode,
    legalRegulatoryConclusionsAllowed: snapshot.legalRegulatoryConclusionsAllowed,
    changeCount: snapshot.changes.length,
    relevantChangeCount: snapshot.relevantChangeIds.length,
  }, { status: refreshed ? 200 : 503 });
}
