import { NextRequest, NextResponse } from "next/server";

import {
  CSP_REPORT_MAX_BODY_BYTES,
  extractCspViolationEvent,
} from "@/lib/observability/csp-report";
import { recordCspViolation } from "@/lib/observability/csp-metrics";
import { recordCspViolationFact } from "@/lib/observability/csp-violation-window";

/**
 * CSP / Trusted-Types violation report endpoint.
 *
 * The production policy in `src/proxy.ts` posts here via `report-uri` (and
 * the report-to endpoint name) when the browser blocks something — most
 * importantly any script_sink violation while `require-trusted-types-for`
 * is active. Reports are redacted to bounded, content-free events before
 * anything is logged or counted; the raw body is never persisted.
 *
 * Privacy posture: accepted reports are answered with a content-free 204
 * (malformed, oversized, wrong-content-type, and unreadable bodies included),
 * and abusive request rates are shed by a small in-memory limiter with a
 * content-free 429; neither response reveals whether a report was parsed, so
 * violation reporting cannot become an oracle. The endpoint is excluded from
 * CSP response headers (reports are JSON posts, not browsing contexts) and
 * from the security matcher so report delivery never itself triggers
 * violations.
 *
 * Every accepted report is recorded twice over, with the same redacted event:
 * as a best-effort OTel metric (`csp-metrics.ts`) and as a fact in the recent
 * violation window (`csp-violation-window.ts`) that `/api/health` reports. The
 * metric is a no-op without a collector, so the window is what makes a policy
 * regression visible to an operator in the deployed application; it is handed
 * the bounded directive/disposition pair only, never an origin, URL, or sample,
 * because the health payload is public.
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
  if (buckets.size > BUCKET_MAX) {
    // Evict expired buckets rather than clearing the whole map: `clear()`
    // reset every counter, so an attacker could erase their own limit by
    // flooding the map with fresh keys. Eviction keeps live limits intact.
    for (const [existingKey, existing] of buckets) {
      if (now - existing.windowStart >= WINDOW_MS) buckets.delete(existingKey);
    }
    while (buckets.size > BUCKET_MAX) {
      const oldest = buckets.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > WINDOW_LIMIT;
}

/**
 * Records a payload that was rejected before it could be attributed (declared
 * length over the cap, or the streaming read overrunning it). Both oversized
 * paths report the same fact, so they cannot drift apart.
 */
function recordOversizedReport(): void {
  recordCspViolation({
    effectiveDirective: "unknown",
    disposition: "enforce",
    documentOrigin: "unknown",
    blockedOrigin: null,
    sourceFileOrigin: null,
    sampleFingerprint: null,
    oversized: true,
  });
  recordCspViolationFact({
    effectiveDirective: "unknown",
    disposition: "enforce",
    oversized: true,
  });
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("user-agent")?.slice(0, 64) ?? "unknown";
}

/**
 * Read at most `maxBytes` bytes from the request body, aborting as soon as the
 * cap is exceeded. `request.text()` would buffer an arbitrarily large hostile
 * body before any size check; streaming bounds the allocation itself.
 */
async function readBoundedBody(
  request: NextRequest,
  maxBytes: number,
): Promise<{ text: string; oversized: boolean }> {
  const body = request.body;
  if (!body) return { text: "", oversized: false };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { text: "", oversized: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), oversized: false };
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

  // Byte-accurate cap checked on the declared length first (cheap rejection),
  // then enforced while streaming so the allocation itself stays bounded.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > CSP_REPORT_MAX_BODY_BYTES) {
    recordOversizedReport();
    return new NextResponse(null, { status: 204 });
  }

  let rawBody = "";
  let oversized = false;
  try {
    ({ text: rawBody, oversized } = await readBoundedBody(
      request,
      CSP_REPORT_MAX_BODY_BYTES,
    ));
  } catch {
    // A client abort or malformed stream must not surface as an error oracle:
    // nothing was learned, nothing is logged, and the response stays
    // content-free.
    return new NextResponse(null, { status: 204 });
  }
  if (oversized) {
    recordOversizedReport();
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
    // The window gets the two bounded fields only — no origin, no fingerprint —
    // so nothing a report contains can reach the public health payload.
    recordCspViolationFact({
      effectiveDirective: event.effectiveDirective,
      disposition: event.disposition,
    });
  }
  return new NextResponse(null, { status: 204 });
}
