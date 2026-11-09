import { NextResponse } from "next/server";

import { authorizeBearerRequest } from "@/lib/security/bearer-auth";
import { probePreviewCatalog } from "@/lib/tiger/preview-catalog-probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * POST /api/internal/tiger-catalog-compare
 * PREVIEW ONLY. Requires independent TIGER_CATALOG_PROBE_TOKEN (>=32 chars).
 * Never available in Production, even if environment secrets are mis-scoped.
 * Returns only connection/parity statuses and aggregate counts, no DB rows.
 */
export async function POST(request: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    !authorizeBearerRequest(request, process.env.TIGER_CATALOG_PROBE_TOKEN)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const connection = process.env.TIGER_DATABASE_URL;
  if (!connection) {
    return NextResponse.json(
      { connection: "not_configured", catalog: "not_checked" },
      { status: 503, headers },
    );
  }
  try {
    const result = await probePreviewCatalog(connection);
    return NextResponse.json(result, {
      status: result.catalog === "parity_verified" ? 200 : 409,
      headers,
    });
  } catch {
    // No exception detail, SQL statement, database URL, or password in the response/logs.
    return NextResponse.json(
      { connection: "unavailable", catalog: "not_checked" },
      { status: 503, headers },
    );
  }
}
