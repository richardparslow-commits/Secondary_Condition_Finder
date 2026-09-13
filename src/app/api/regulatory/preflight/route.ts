import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { auditLog } from "@/lib/observability/audit";
import { refreshRegulatoryPreflightCache } from "@/lib/regulatory/preflight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const authorized = (request: Request): boolean => {
  const configured = process.env.REGULATORY_SYNC_SECRET ?? process.env.CRON_SECRET;
  if (!configured) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(configured, "utf8");
  const right = Buffer.from(supplied, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
};

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
