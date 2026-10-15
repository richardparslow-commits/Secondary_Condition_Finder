/**
 * Recent CSP / Trusted-Types violations as a runtime fact an operator can read.
 *
 * Why this module exists: `/api/csp-report` already redacts every browser
 * report to a bounded, content-free event and counts it as a best-effort OTel
 * metric — but OTel here is a no-op without a collector, so in the deployed
 * application a **policy regression was invisible server-side**. A deploy that
 * starts blocking something (a new inline style under `style-src-attr 'none'`,
 * a script sink under `require-trusted-types-for 'script'`, an asset origin
 * dropped from `connect-src`) produced exactly one observable: a browser
 * console line on a visitor's machine. This module keeps the last few minutes
 * of reports in memory so `/api/health` can report them, which is where an
 * operator already looks.
 *
 * What it deliberately does not keep is the point:
 *
 * - **No content.** It stores a directive name, a disposition, an oversized
 *   flag and a timestamp. It never sees a document URL, a blocked URL, a
 *   source file, or a report body — the route passes those to the metrics
 *   path and hands this module the two bounded fields only. So a violation
 *   report's paths, queries, and page text cannot reach the health payload
 *   even though the payload is a public diagnosis surface.
 * - **No unbounded growth.** Retention is bounded twice: events older than
 *   `CSP_VIOLATION_WINDOW_MS` are dropped, and the list is capped at
 *   `CSP_VIOLATION_WINDOW_MAX_EVENTS` (a flood drops its own oldest rows and
 *   increments `evicted`, so the process cannot be grown by reporting).
 * - **No operator surprise.** The window is process-local and resets on cold
 *   start, like the rate-limit and cache counters it sits beside; a report is
 *   accepted by whichever instance served the POST, so a health request served
 *   by another instance legitimately reports its own window. `scope` and
 *   `detail` say so rather than letting a zero read as "no violations
 *   anywhere".
 *
 * The directive name is re-validated against the same charset
 * `csp-report.ts` uses when extracting it, so a hostile directive value can
 * only ever be reported as `unknown` — this module is a second bound, not a
 * trust boundary.
 */

/** How far back "recent" reaches. Short enough to describe a current deploy. */
export const CSP_VIOLATION_WINDOW_MS = 15 * 60_000;

/** Hard cap on retained events, so a report flood cannot grow the process. */
export const CSP_VIOLATION_WINDOW_MAX_EVENTS = 128;

/** Hard cap on the aggregated rows a health body carries, newest data first. */
export const CSP_VIOLATION_REPORT_MAX_DIRECTIVES = 12;

const DIRECTIVE_PATTERN = /^[a-z][a-z0-9-]{0,99}$/;
const MAX_DISPOSITION_LENGTH = 32;

/**
 * The only fields a caller may hand this module.
 *
 * There is deliberately no origin, URL, or sample field: the health payload is
 * public, so what a violation report *contains* must not have a path into it.
 */
export interface CspViolationFact {
  effectiveDirective: string;
  disposition: string;
  /** True when the payload was rejected before it could be attributed. */
  oversized?: boolean;
}

interface RetainedViolation {
  directive: string;
  disposition: string;
  oversized: boolean;
  at: number;
}

/** One directive's aggregate inside the window. */
export interface CspViolationDirectiveSummary {
  directive: string;
  count: number;
  /** Distinct dispositions seen, bounded and sorted; `enforce` is the norm. */
  dispositions: string[];
  lastReceivedAt: string;
}

export interface CspViolationWindowReport {
  /** Reports are accepted where the POST lands; never a fleet total. */
  scope: "process-local";
  windowMs: number;
  maxEvents: number;
  /** Retained in-window violations, oversized payloads included. */
  received: number;
  /** Retained violations whose payload was rejected before attribution. */
  oversized: number;
  /** Events dropped at the retention bound since this process started. */
  evicted: number;
  /** Oldest retained in-window violation, ISO 8601, or null. */
  since: string | null;
  /** Newest retained in-window violation, ISO 8601, or null. */
  lastReceivedAt: string | null;
  directives: CspViolationDirectiveSummary[];
  /** Directives left out of `directives` because of the reporting cap. */
  directivesOmitted: number;
  detail: string;
}

/**
 * Retained events, oldest first. A plain array rather than a ring buffer: the
 * bound is 128 entries, so the pruning walk is trivially cheap, and the order
 * is what makes `since`/`lastReceivedAt` readable.
 */
const retained: RetainedViolation[] = [];
let evicted = 0;

function boundedDirective(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  return DIRECTIVE_PATTERN.test(normalized) ? normalized : "unknown";
}

function boundedDisposition(value: unknown): string {
  if (typeof value !== "string") return "enforce";
  const normalized = value.trim().toLowerCase();
  if (normalized === "" || normalized.length > MAX_DISPOSITION_LENGTH) return "enforce";
  return normalized;
}

/** Drops events that have left the window. Called on write and on read. */
function prune(now: number): void {
  const cutoff = now - CSP_VIOLATION_WINDOW_MS;
  let drop = 0;
  while (drop < retained.length && retained[drop]!.at <= cutoff) drop += 1;
  if (drop > 0) retained.splice(0, drop);
}

/**
 * Records one redacted violation fact. Never throws and never grows past its
 * bound: observability must not be able to fail request handling or exhaust
 * memory, which is exactly what an unauthenticated report endpoint makes
 * reachable.
 */
export function recordCspViolationFact(fact: CspViolationFact): void {
  try {
    const now = Date.now();
    prune(now);
    retained.push({
      directive: boundedDirective(fact?.effectiveDirective),
      disposition: boundedDisposition(fact?.disposition),
      oversized: fact?.oversized === true,
      at: now,
    });
    while (retained.length > CSP_VIOLATION_WINDOW_MAX_EVENTS) {
      retained.shift();
      evicted += 1;
    }
  } catch {
    // A reporting counter must never be the reason a request fails.
  }
}

function windowLabel(): string {
  return `${Math.round(CSP_VIOLATION_WINDOW_MS / 60_000)}m`;
}

function aggregate(): CspViolationDirectiveSummary[] {
  const byDirective = new Map<string, { count: number; dispositions: Set<string>; last: number }>();
  for (const event of retained) {
    const existing = byDirective.get(event.directive);
    if (existing) {
      existing.count += 1;
      existing.dispositions.add(event.disposition);
      existing.last = Math.max(existing.last, event.at);
    } else {
      byDirective.set(event.directive, {
        count: 1,
        dispositions: new Set([event.disposition]),
        last: event.at,
      });
    }
  }
  return [...byDirective.entries()]
    .map(([directive, summary]) => ({
      directive,
      count: summary.count,
      dispositions: [...summary.dispositions].sort(),
      lastReceivedAt: new Date(summary.last).toISOString(),
    }))
    // Most-reported first, then name: a regression that fires on every page
    // load outranks a one-off, and the order does not depend on insertion.
    .sort((a, b) => b.count - a.count || a.directive.localeCompare(b.directive));
}

/**
 * The report `/api/health` publishes. Pure read: it prunes, aggregates, and
 * renders, and never mutates what it reports beyond dropping expired rows.
 */
export function cspViolationWindowReport(): CspViolationWindowReport {
  const now = Date.now();
  prune(now);

  const aggregated = aggregate();
  const directives = aggregated.slice(0, CSP_VIOLATION_REPORT_MAX_DIRECTIVES);
  const directivesOmitted = Math.max(0, aggregated.length - directives.length);
  const received = retained.length;
  const oversized = retained.filter((event) => event.oversized).length;
  const since = received > 0 ? new Date(retained[0]!.at).toISOString() : null;
  const lastReceivedAt = received > 0 ? new Date(retained[received - 1]!.at).toISOString() : null;

  const caveat = "this window is per instance and forgets rows on cold start";
  let detail: string;
  if (received === 0) {
    detail = `no CSP violation report in the last ${windowLabel()}; ${caveat}`;
  } else {
    const parts = [
      `${received} CSP violation report(s) in the last ${windowLabel()} across ${aggregated.length} directive(s)`,
    ];
    if (oversized > 0) parts.push(`${oversized} oversized payload(s) rejected`);
    if (evicted > 0) parts.push(`${evicted} dropped at the retention bound`);
    detail = `${parts.join("; ")}; ${caveat}`;
  }

  return {
    scope: "process-local",
    windowMs: CSP_VIOLATION_WINDOW_MS,
    maxEvents: CSP_VIOLATION_WINDOW_MAX_EVENTS,
    received,
    oversized,
    evicted,
    since,
    lastReceivedAt,
    directives,
    directivesOmitted,
    detail,
  };
}

/**
 * Clears the retained window. For tests and operator diagnostics only —
 * request handling never calls it, so a hostile request cannot erase the
 * evidence that it happened.
 */
export function clearCspViolationWindow(): void {
  retained.length = 0;
  evicted = 0;
}
