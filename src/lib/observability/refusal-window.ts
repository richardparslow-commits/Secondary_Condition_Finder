/**
 * Recent inbound-admission refusals as a runtime fact an operator can read.
 *
 * Why this module exists: `chargeAdmission` already decides **which budget
 * refused** — the shared admission ceiling, or the client's own per-client
 * bucket — and `src/proxy.ts` already turns that into a `429`. Every `429`
 * deliberately carries the same body, so one response cannot tell a prober which
 * budget it hit; the consequence recorded in the deployment-readiness note was
 * that ceiling saturation was not directly alertable, which is why a `429` count
 * could not be treated as a capacity signal. This window keeps the last few
 * minutes of refusals so `/api/health` can report them, at the surface where an
 * operator already looks — the same shape this repository already uses for CSP
 * violations ([csp-violation-window.ts](./csp-violation-window.ts)).
 *
 * What it deliberately does not keep is the point:
 *
 * - **No identity.** It stores a bounded surface label and which budget refused.
 *   It never sees the client key, so no IP address — the thing the limiter
 *   actually bucketed on — can reach the public health payload, even though the
 *   key is what the decision was made from. The refusal *reason* is observable;
 *   the refused *client* is not.
 * - **No unbounded growth.** Retention is bounded twice: events older than
 *   `REFUSAL_WINDOW_MS` are dropped, and the retained list is capped at
 *   `REFUSAL_WINDOW_MAX_EVENTS` (a flood drops its own oldest rows and increments
 *   `evicted`, so a refusal storm cannot grow the process that is refusing it).
 * - **No counting of accepted traffic.** Nothing here is on the admit path, so
 *   the limiter's own performance cannot depend on observability.
 * - **No operator surprise.** The window is per instance and forgets rows on
 *   cold start, and a `429` the edge WAF answered itself never reaches the
 *   application at all. `scope` and `detail` say so rather than letting a zero
 *   read as "no refusals anywhere".
 *
 * A caller is not trusted: the surface label is re-validated against a charset
 * and the budget against its two known values, so a new caller cannot widen this
 * file's vocabulary or the health payload's shape. Unknown values are reported
 * as `unknown` rather than dropped, so a mislabelled refusal is still visible.
 */

/** How far back "recent" reaches. Short enough to describe the current deploy. */
export const REFUSAL_WINDOW_MS = 15 * 60_000;

/** Hard cap on retained events, so a refusal flood cannot grow the process. */
export const REFUSAL_WINDOW_MAX_EVENTS = 256;

/** Hard cap on the aggregated rows a health body carries, busiest first. */
export const REFUSAL_REPORT_MAX_SURFACES = 12;

/**
 * Which budget refused. Spelled as `chargeAdmission` returns it, so a caller
 * passes the decision through instead of translating it.
 *
 * `unidentified` is the shared class bucket an identity-less request is charged to
 * where the deployment has declared an ingress model — the reading that says the
 * declaration and the edge disagree.
 */
export type AdmissionRefusalBudget = "ceiling" | "per-client" | "unidentified";

/** Bounded surface labels: `method-post`, `reference-read`, or a route path. */
const SURFACE_PATTERN = /^[a-z0-9/._[\]-]{1,64}$/;

/** The only fields a caller may hand this module. */
export interface AdmissionRefusalFact {
  /** Which limited surface refused; free text is bounded to `unknown`. */
  surface: string;
  budget: AdmissionRefusalBudget;
}

interface RetainedRefusal {
  surface: string;
  budget: AdmissionRefusalBudget | "unknown";
  at: number;
}

/** One surface/budget pair's aggregate inside the window. */
export interface AdmissionRefusalSummary {
  surface: string;
  budget: AdmissionRefusalBudget | "unknown";
  count: number;
  lastRefusedAt: string;
}

export interface AdmissionRefusalWindowReport {
  /** Refusals are counted where they happen; never a fleet total. */
  scope: "process-local";
  windowMs: number;
  maxEvents: number;
  /** Retained in-window refusals. */
  received: number;
  /** Retained refusals whose reason was not one of the known budgets. */
  unknownBudget: number;
  /**
   * Refusals by budget — the reading this window exists for. `unidentified`
   * refusals are identity-less requests refused by the shared per-surface class
   * bucket, so a non-zero count means this deployment declared an ingress model and
   * then received a request without the identity that model promises.
   */
  byBudget: { ceiling: number; perClient: number; unidentified: number };
  /**
   * Share of retained refusals charged to the shared admission ceiling, 0–100,
   * or `null` when nothing was retained. A rising share is aggregate pressure
   * (many different clients refused in one window); a low one is individual
   * clients at their own per-client limit.
   */
  ceilingShare: number | null;
  /** Events dropped at the retention bound since this process started. */
  evicted: number;
  /** Oldest retained in-window refusal, ISO 8601, or null. */
  since: string | null;
  /** Newest retained in-window refusal, ISO 8601, or null. */
  lastRefusedAt: string | null;
  surfaces: AdmissionRefusalSummary[];
  /** Surface/budget pairs left out of `surfaces` because of the reporting cap. */
  surfacesOmitted: number;
  detail: string;
}

/**
 * Retained events, oldest first. A plain array rather than a ring buffer: the cap
 * is 256 entries, so the pruning walk is trivially cheap, and the order is what
 * makes `since`/`lastRefusedAt` readable.
 */
const retained: RetainedRefusal[] = [];
let evicted = 0;

function boundedSurface(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  return SURFACE_PATTERN.test(normalized) ? normalized : "unknown";
}

function boundedBudget(value: unknown): AdmissionRefusalBudget | "unknown" {
  return value === "ceiling" || value === "per-client" || value === "unidentified"
    ? value
    : "unknown";
}

/** Drops events that have left the window. Called on write and on read. */
function prune(now: number): void {
  const cutoff = now - REFUSAL_WINDOW_MS;
  let drop = 0;
  while (drop < retained.length && retained[drop]!.at <= cutoff) drop += 1;
  if (drop > 0) retained.splice(0, drop);
}

/**
 * Records one refusal. Never throws and never grows past its bound:
 * observability must not be able to fail request handling, least of all while
 * refusing a request, and the refusal path is reachable by an unauthenticated
 * caller.
 */
export function recordAdmissionRefusal(fact: AdmissionRefusalFact): void {
  try {
    const now = Date.now();
    prune(now);
    retained.push({
      surface: boundedSurface(fact?.surface),
      budget: boundedBudget(fact?.budget),
      at: now,
    });
    while (retained.length > REFUSAL_WINDOW_MAX_EVENTS) {
      retained.shift();
      evicted += 1;
    }
  } catch {
    // A refusal counter must never be the reason a request fails.
  }
}

function windowLabel(): string {
  return `${Math.round(REFUSAL_WINDOW_MS / 60_000)}m`;
}

function aggregate(): AdmissionRefusalSummary[] {
  const byKey = new Map<string, AdmissionRefusalSummary>();
  for (const event of retained) {
    const key = `${event.surface}\u0000${event.budget}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastRefusedAt = new Date(event.at).toISOString();
    } else {
      byKey.set(key, {
        surface: event.surface,
        budget: event.budget,
        count: 1,
        lastRefusedAt: new Date(event.at).toISOString(),
      });
    }
  }
  return [...byKey.values()]
    // Busiest first, then name: a surface refusing in bulk outranks a one-off, and
    // the order does not depend on insertion, so two instances' bodies compare.
    .sort((a, b) => b.count - a.count || a.surface.localeCompare(b.surface));
}

/**
 * The report `/api/health` publishes. Pure read: it prunes, aggregates and
 * renders, and never mutates what it reports beyond dropping expired rows.
 */
export function admissionRefusalWindowReport(): AdmissionRefusalWindowReport {
  const now = Date.now();
  prune(now);

  const aggregated = aggregate();
  const surfaces = aggregated.slice(0, REFUSAL_REPORT_MAX_SURFACES);
  const surfacesOmitted = Math.max(0, aggregated.length - surfaces.length);
  const received = retained.length;
  const ceiling = retained.filter((event) => event.budget === "ceiling").length;
  const perClient = retained.filter((event) => event.budget === "per-client").length;
  const unidentified = retained.filter((event) => event.budget === "unidentified").length;
  const unknownBudget = received - ceiling - perClient - unidentified;
  const ceilingShare = received > 0 ? Math.round((ceiling / received) * 100) : null;
  const since = received > 0 ? new Date(retained[0]!.at).toISOString() : null;
  const lastRefusedAt = received > 0 ? new Date(retained[received - 1]!.at).toISOString() : null;

  const caveat =
    "this window is per instance, forgets rows on cold start, and never sees a refusal the edge WAF answered itself";
  let detail: string;
  if (received === 0) {
    detail = `no inbound admission refusal in the last ${windowLabel()}; ${caveat}`;
  } else {
    const parts = [
      `${received} inbound admission refusal(s) in the last ${windowLabel()}: ${ceiling} by the shared ceiling (${ceilingShare}% of them), ${perClient} by a client's own bucket and ${unidentified} by the shared bucket for requests that presented no identity`,
    ];
    if (unidentified > 0) {
      parts.push(
        "an unidentified refusal means the model this deployment declared and the edge it actually runs disagree",
      );
    }
    if (unknownBudget > 0) {
      parts.push(`${unknownBudget} with an unrecognised refusal reason`);
    }
    if (evicted > 0) parts.push(`${evicted} dropped at the retention bound`);
    parts.push(
      "a rising ceiling share is aggregate pressure — many different clients refused in one window — while per-client refusals are individual clients at their own limit",
    );
    detail = `${parts.join("; ")}; ${caveat}`;
  }

  return {
    scope: "process-local",
    windowMs: REFUSAL_WINDOW_MS,
    maxEvents: REFUSAL_WINDOW_MAX_EVENTS,
    received,
    unknownBudget,
    byBudget: { ceiling, perClient, unidentified },
    ceilingShare,
    evicted,
    since,
    lastRefusedAt,
    surfaces,
    surfacesOmitted,
    detail,
  };
}

/**
 * Clears the retained window. For tests and operator diagnostics only — request
 * handling never calls it, so a hostile request cannot erase the evidence that
 * it happened.
 */
export function clearAdmissionRefusalWindow(): void {
  retained.length = 0;
  evicted = 0;
}
