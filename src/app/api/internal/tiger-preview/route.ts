import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { probeTigerPreview } from "@/lib/tiger/preview-probe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const token = process.env.TIGER_PROBE_TOKEN;
  const bearer = request.headers.get("authorization");
  if (!token || token.length < 32 || !bearer?.startsWith("Bearer ")) return false;
  const supplied = bearer.slice(7);
  const a = Buffer.from(supplied);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  // Fail closed outside Vercel Preview, including local development and Production.
  if (process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (!authorized(request))
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  const result = await probeTigerPreview();
  return NextResponse.json(result, {
    status: result.status === "catalog_matches" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
