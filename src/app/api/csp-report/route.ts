import { NextRequest, NextResponse } from "next/server";

import {
  CSP_REPORT_MAX_BODY_BYTES,
  extractCspViolationEvent,
} from "@/lib/observability/csp-report";
import { recordCspViolation } from "@/lib/observability/csp-metrics";

/**
 * CSP / Trusted-Types violation report endpoint.
 *
 * The production policy in `src/proxy.ts` posts here via `report-uri` (and
 * the report-to endpoint name) when the browser blocks something — most
 * importantly any script_sink violation while `require-trusted-types-for`
 * is active. Reports are redacted to bounded, content-free events before
 * anything is logged or counted; the raw body is never persisted.
 *
 * Privacy posture: the response is a bare 204 for every well-formed request,
 * so violation reporting cannot become an oracle; a small in-memory rate
 * limiter exists only to shed abuse, keyed by client, with no content
 * retained. The endpoint is excluded from CSP response headers (reports are
 * JSON posts, not browsing contexts) and from the security matcher so report
 * delivery never itself triggers violations.
 */

export const dynamic = "force-dynamic";

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 30;
const BUCKET_MAX = 1_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  if (buckets.size > BUCKET_MAX) buckets.clear();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > WINDOW_LIMIT;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("user-agent")?.slice(0, 64) ?? "unknown";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (rateLimited(clientKey(request))) {
    return new NextResponse(null, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("application/csp-report") &&
    !contentType.includes("application/json") &&
    !contentType.includes("application/reports+json")
  ) {
    return new NextResponse(null, { status: 204 });
  }

  const rawBody = await request.text();
  if (rawBody.length > CSP_REPORT_MAX_BODY_BYTES) {
    recordCspViolation({
      effectiveDirective: "unknown",
      disposition: "enforce",
      documentOrigin: "unknown",
      blockedOrigin: null,
      sourceFileOrigin: null,
      sampleFingerprint: null,
      oversized: true,
    });
    return new NextResponse(null, { status: 204 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    // Malformed JSON: nothing to learn, no error surfaced (never an oracle).
    return new NextResponse(null, { status: 204 });
  }

  const event = extractCspViolationEvent(parsed);
  if (event) {
    recordCspViolation(event);
  }
  return new NextResponse(null, { status: 204 });
}
