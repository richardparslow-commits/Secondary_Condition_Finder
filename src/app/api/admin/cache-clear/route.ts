import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { auditLog } from "@/lib/observability/audit";
import { clearVaReferenceCache } from "@/lib/va/reference-cache";

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

/**
 * POST /api/admin/cache-clear
 *
 * Clears the process-local VA reference cache. Authenticated via CRON_SECRET
 * or REGULATORY_SYNC_SECRET Bearer token (same pattern as /api/regulatory/preflight).
 *
 * Query params:
 * - prefix (optional): only clear keys starting with this prefix
 *
 * Response: { ok, cleared, prefix? }
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

  auditLog("admin-cache-clear-triggered", {
    status: "success",
    route: "/api/admin/cache-clear",
    cleared,
    prefix: prefix ?? "(all)",
  });

  return NextResponse.json({
    ok: true,
    cleared,
    prefix: prefix ?? null,
    message: prefix
      ? `Cleared ${cleared} cache entries with prefix "${prefix}".`
      : `Cleared all ${cleared} cache entries.`,
  });
}
