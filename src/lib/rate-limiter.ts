/**
 * Application-level **fixed-window** rate limiter.
 *
 * Provides defense-in-depth behind Vercel's edge WAF. Each limiter tracks
 * per-key (typically IP) request counts within a fixed window and returns 429
 * when the limit is exceeded. Fixed windows admit up to 2× the nominal rate
 * across a window boundary (a burst at the end of one window plus a burst at
 * the start of the next); that is an accepted trade-off for this secondary
 * layer, and the headers/contracts here must not claim a sliding guarantee.
 * All state is process-local and resets on cold start — intentional for
 * serverless (no stale state across instances) and acceptable as a secondary
 * layer behind the edge.
 *
 * Key cardinality is hard-bounded: an attacker rotating source keys cannot
 * grow the tracking map without limit. Expired buckets are swept as the map
 * grows, and a hard cap evicts the oldest buckets as a final backstop.
 *
 * What this module promises is per-client request **fairness**, as a secondary
 * layer behind the edge WAF. That is deliberately a weaker promise than the one
 * `src/lib/va/runtime-state.ts` makes about process-local state, and the
 * difference is the point:
 *
 *   - Buckets here are per instance, so running N instances means the effective
 *     limit is roughly the configured limit × N — the guard **degrades** as the
 *     deployment scales. `rateLimitScope()` reports which regime a process is in.
 *   - That degradation can only make this limiter *weaker* than intended. It
 *     cannot make it *wrong*. A per-instance VA reference cache can serve data
 *     belonging to a different environment, and a per-instance outbound budget
 *     can permit N× the intended traffic against VA. A limiter that permits more
 *     than intended is still restricting traffic; a cache that returns the wrong
 *     snapshot is a correctness failure.
 *
 * So this module does **not** fail closed in production the way the VA cache
 * does, and that is policy rather than oversight: disabling a limiter in
 * production would remove defense-in-depth entirely, while its worst failure
 * mode is a weaker guard. Both modules read the same runtime fact from
 * `runtime-deployment.ts`, so they can no longer disagree about the runtime —
 * only about what to do with it, which is written down here and pinned by
 * `tests/process-local-state-contract.test.ts`.
 *
 * Usage:
 *   import { createRateLimiter } from "@/lib/rate-limiter";
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
 *   const result = limiter.check(key);
 *   if (result.limited) return 429;
 */

import { isDistributedRuntime, type RuntimeEnvironment } from "./runtime-deployment";

export interface RateLimiterOptions {
  /** Fixed window duration in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum requests per window per key. Default: 60. */
  max?: number;
  /** Human label for logging / metrics. Default: "default". */
  name?: string;
}

/**
 * Hard cap on tracked keys per limiter. A source rotating keys (spoofed
 * X-Forwarded-For values, many clients behind one NAT) must not grow process
 * memory without bound; past this many live buckets the oldest are evicted.
 */
export const RATE_LIMITER_MAX_TRACKED_KEYS = 10_000;

export interface CheckResult {
  /** Whether the request should be rejected (429). */
  limited: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfterSeconds: number;
  /** Current count of requests in the window. */
  count: number;
}

/** A limiter instance: the surface `check` and its own declared budget. */
export interface RateLimiter {
  check(key: string): CheckResult;
  reset(): void;
  readonly name: string;
  readonly windowMs: number;
  readonly max: number;
}

interface Bucket {
  /** Window start timestamp (ms). */
  windowStart: number;
  /** Number of requests in the current window. */
  count: number;
}

/**
 * Create a rate limiter. Keys are typically IP addresses extracted from
 * `X-Forwarded-For` (Vercel sets this header on every request).
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;
  const name = options.name ?? "default";

  const buckets = new Map<string, Bucket>();

  /**
   * Remove expired buckets to bound memory, then enforce the hard cap by
   * evicting the oldest windows. Sweeping on every check past the threshold
   * keeps the map at live-window size instead of letting an attacker who
   * rotates keys grow it without limit.
   */
  function sweep(now = Date.now()): void {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
    if (buckets.size <= RATE_LIMITER_MAX_TRACKED_KEYS) return;
    const oldestFirst = [...buckets.entries()].sort(
      (a, b) => a[1].windowStart - b[1].windowStart,
    );
    const excess = buckets.size - RATE_LIMITER_MAX_TRACKED_KEYS;
    for (let i = 0; i < excess; i += 1) {
      buckets.delete(oldestFirst[i][0]);
    }
  }

  /**
   * Check whether the given key has exceeded its rate limit.
   * Increments the counter if not limited.
   */
  function check(key: string): CheckResult {
    const now = Date.now();
    if (buckets.size > 1_000) sweep(now);
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      // New or expired window
      buckets.set(key, { windowStart: now, count: 1 });
      return {
        limited: false,
        remaining: max - 1,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
        count: 1,
      };
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const elapsed = now - bucket.windowStart;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return {
        limited: true,
        remaining: 0,
        retryAfterSeconds,
        count: bucket.count,
      };
    }

    return {
      limited: false,
      remaining: max - bucket.count,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      count: bucket.count,
    };
  }

  /** Reset all state (for tests). */
  function reset(): void {
    buckets.clear();
  }

  return { check, reset, name, windowMs, max };
}

/** The per-client limiter, plus the shared bounds that already charged it. */
export interface AdmissionResult extends CheckResult {
  /**
   * Which budget refused the request, if any. `ceiling` is the shared cap over
   * aggregate and unattributed traffic; `per-client` is this client's own bucket;
   * `unidentified` is the shared class bucket an identity-less request is charged
   * to where the deployment has declared an ingress model. A caller can therefore
   * report the reason without re-deriving it.
   */
  refusedBy: "ceiling" | "per-client" | "unidentified" | null;
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for application routes.
// ---------------------------------------------------------------------------

/** Workflow session writes (saveDiagnosed, saveServiceConnected, etc.) */
export const workflowSessionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "workflow-session",
});

/** Regulatory preflight sync (authenticated, expensive upstream refresh). */
export const regulatoryPreflightLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  name: "regulatory-preflight",
});

/** Health endpoint (public, but should not be hammered). */
export const healthLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "health",
});

/** Admin cache-clear endpoint (authenticated, destructive). */
export const adminCacheClearLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  name: "admin-cache-clear",
});

/**
 * Public dynamic reference GETs that can reach upstream VA quota or shared
 * cache writes. Bounds inbound abuse independently of the workflow limiter,
 * which only covers POST Server Actions.
 */
export const referenceReadLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "reference-read",
});

/**
 * Restricted-API login initiation: each call mints a server-side OAuth
 * transaction, so unbounded initiation exhausts the bounded transaction
 * store rather than merely costing CPU.
 */
export const accountAuthLoginLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "account-auth-login",
});

/**
 * Restricted-API authorization callback: each call performs an upstream
 * token exchange (plus JWKS fetch), so it is policed tighter than login
 * initiation, like the other upstream-forcing route.
 */
export const accountAuthCallbackLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  name: "account-auth-callback",
});

// ---------------------------------------------------------------------------
// Runtime scope
// ---------------------------------------------------------------------------

/**
 * The environment a runtime's rate limiting actually has.
 *
 * Reported rather than inferred by operators, so that "this limiter is
 * per-instance" is a fact anyone can read off `/api/health` instead of a
 * paragraph in a comment that has to be found first.
 */
export interface RateLimitScope {
  /** `single-process` when one process owns the buckets; `per-instance` when several do. */
  scope: "single-process" | "per-instance";
  /** Operator-facing explanation of what the configured limits mean here. */
  detail: string;
  /**
   * What the per-client keys are worth: an asserted ingress, or self-declared
   * headers. Reported rather than assumed, so a deployment can be audited for
   * the claim instead of trusting a comment.
   */
  identity: RateLimitIdentityPolicy;
  /** The shared budget that bounds unattributed and key-rotating traffic. */
  ceiling: {
    max: number;
    windowMs: number;
    variable: string;
    /** The single bucket key every limited request is charged to. */
    key: string;
    detail: string;
  };
  /**
   * Where the counters live, and whether that makes the enforced limit
   * deployment-wide. `process-local` is the only implemented mode: a distributed
   * quota needs a shared store the deployment has not provisioned, and saying so
   * here is what keeps a green `/api/health` from implying one exists. See
   * SEC-02 in the security audit for the evidence a hosted deployment owes before
   * this can report anything else.
   */
  store: {
    mode: "process-local";
    distributed: false;
    /**
     * Why no shared counter store is in use, so this reads as a recorded
     * limitation with a named blocker rather than as "nothing to see here".
     */
    blockedBy: "no-store-provisioned";
    detail: string;
  };
}

/**
 * Describe what the configured limits mean in this runtime. Classification comes
 * from `runtime-deployment.ts`, the same source the VA cache uses for its own,
 * stricter verdict.
 */
export function rateLimitScope(
  env: RuntimeEnvironment = process.env,
): RateLimitScope {
  const identity = rateLimitIdentityPolicy(env);
  const ceilingLimiter = unattributedAdmissionLimiter(env);
  const ceiling = {
    // Read off the limiter that actually enforces it, so the reported ceiling
    // and the applied ceiling cannot drift apart.
    max: ceilingLimiter.max,
    windowMs: ceilingLimiter.windowMs,
    variable: RATE_LIMIT_UNATTRIBUTED_MAX_VARIABLE,
    key: UNATTRIBUTED_ADMISSION_KEY,
    detail:
      "unattributed requests (no valid IP literal) and any request's share of aggregate traffic are bounded by this shared budget, which is deliberately separate from the per-client limit",
  };
  const store = {
    mode: "process-local" as const,
    distributed: false as const,
    blockedBy: "no-store-provisioned" as const,
    detail:
      "counters live in this process only, so the enforced limit is per instance; a deployment-wide quota needs a shared counter store the operator must provision (and prove atomic in the hosting environment), and no shared store is wired for inbound admission, so none is claimed (SEC-02 remains open on that half)",
  };

  if (isDistributedRuntime(env)) {
    return {
      scope: "per-instance",
      detail: `${clientKeyRegime(identity)} limits apply per instance, so the aggregate is roughly the configured limit x instance count; the edge WAF remains the capacity layer`,
      identity,
      ceiling,
      store,
    };
  }

  return {
    scope: "single-process",
    detail: `${clientKeyRegime(identity)} limits apply to the whole deployment`,
    identity,
    ceiling,
    store,
  };
}

/**
 * What the per-client keys are worth here, in the model's own terms: the
 * append model keys on a hop the client cannot write, the set model on a hop the
 * declared ingress wrote, and the unasserted model on whatever a client sent.
 */
function clientKeyRegime(identity: RateLimitIdentityPolicy): string {
  if (identity.model === "append") return "per-ingress-observed-client";
  if (identity.identity === "asserted") return "per-validated-client";
  return "per-client (key only as trustworthy as the forwarding header)";
}

// ---------------------------------------------------------------------------
// Client identity helpers.
// ---------------------------------------------------------------------------

/** Header a client key was taken from, or why no key was used. */
export type ClientKeySource =
  | "x-forwarded-for"
  | "x-real-ip"
  /** Header present but not an IP literal: never used as a bucket key. */
  | "invalid"
  | "none";

const IPV4_LITERAL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;

function isIpv4Literal(value: string): boolean {
  const match = IPV4_LITERAL.exec(value);
  if (!match) return false;
  for (let index = 1; index <= 4; index += 1) {
    const octet = match[index];
    if (octet.length > 1 && octet.startsWith("0")) return false; // ambiguous form
    if (Number(octet) > 255) return false;
  }
  return true;
}

/**
 * IPv6, including `::` compression and a trailing IPv4-mapped group. A zone id
 * (`%eth0`) is rejected: it is interface-local and never an ingress identity.
 */
function isIpv6Literal(value: string): boolean {
  const host = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (!host.includes(":") || host.includes("%")) return false;
  const compressed = host.split("::");
  if (compressed.length > 2) return false;
  const groups: string[] = [];
  for (let index = 0; index < compressed.length; index += 1) {
    const chunk = compressed[index];
    if (chunk === "") continue;
    const parts = chunk.split(":");
    if (parts.some((part) => part === "")) return false;
    const last = parts[parts.length - 1];
    if (isIpv4Literal(last)) {
      if (index !== compressed.length - 1) return false; // only a trailing IPv4 form
      parts.pop();
      parts.push("0", "0");
    }
    groups.push(...parts);
  }
  if (groups.some((group) => !IPV6_GROUP.test(group))) return false;
  return compressed.length === 2 ? groups.length <= 7 : groups.length === 8;
}

/**
 * Whether `value` is an IP literal we are willing to bucket on.
 *
 * A forwarding header is a **string a client can send**. Without this check any
 * token (a hostname, a path fragment, an emoji, a fresh random value per
 * request) became a bucket key, so an attacker could rotate headers and never
 * reach a limit while honest traffic stayed capped. Bucketing now requires a
 * syntactically valid IP literal; everything else is unattributed, counted by
 * the shared admission ceiling instead of minting a private bucket.
 */
export function isIpLiteral(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return isIpv4Literal(trimmed) || isIpv6Literal(trimmed);
}

/**
 * Whether an operator has **asserted how** the ingress in front of this process
 * presents the observed peer address — and, when they have, which end of
 * `X-Forwarded-For` that makes authoritative.
 *
 * The value is a **model**, not a boolean, because "trusted ingress" is two
 * different deployments with two different correct hop rules:
 *
 *   - `set` (aliases `true`, `overwrite`, `platform`) — the ingress *sets* the
 *     forwarding header to the peer it observed, so the **leftmost** hop is the
 *     ingress's value. This is the rule the limiter applied unconditionally
 *     before the model existed.
 *   - `append` / `append:N` — the ingress *appends* the peer it observed to
 *     whatever the client sent, so the peer is hop **N from the right** and
 *     every hop before it is client-supplied. This is the common shape for a
 *     proxy or CDN in front of the app, and the unconditional leftmost rule was
 *     *wrong* for it: the client's own first hop was the bucket key, so rotating
 *     it minted a fresh allowance per request — the A2 discriminator in the
 *     SEC-02 hosted-acceptance runbook — and a client that pre-seeded
 *     `X-Real-IP` could choose which bucket it was charged against.
 *
 * Making the claim a model is what turns it into a mechanism: enforcement
 * follows the declaration instead of applying one hard-coded rule, so an
 * appending ingress no longer has to be replaced with an overwriting one to get
 * a key the client cannot choose, and the deployment can be audited by comparing
 * the hop this module reports using against what the ingress actually writes.
 * What the claim cannot do is make itself true — it only decides *which end* is
 * trusted — so it stays opt-in, named and reported
 * (`rateLimitIdentityPolicy`), and the admission ceiling below bounds abuse
 * whether or not the claim holds.
 *
 * `append` is the model with the weakest verifiable shape: a request carrying
 * exactly one hop is indistinguishable from one that never traversed the
 * ingress. Declare `append:2` or higher when a CDN *and* the app proxy both
 * append, because then a request that did not traverse every declared appender
 * carries fewer hops and is unattributed instead of keyed on a client-supplied
 * value. No model substitutes for origin protection: a client that can reach the
 * origin directly can always present its own single hop.
 */
export const RATE_LIMIT_TRUSTED_INGRESS_VARIABLE = "RATE_LIMIT_TRUSTED_INGRESS";

/** How the declared ingress presents the peer address. */
export type IngressModel = "unasserted" | "set" | "append";

/**
 * Highest `append:N` hop accepted. A mangled value cannot move the trusted
 * position arbitrarily far along a header the client may also be writing.
 */
export const INGRESS_APPEND_MAX_HOPS = 8;

/** A resolved ingress claim: the model, plus the hop for `append`. */
export interface IngressClaim {
  model: IngressModel;
  /** For `append`: which hop from the right the ingress wrote. */
  hopsFromRight: number | null;
}

const UNASSERTED_INGRESS: IngressClaim = { model: "unasserted", hopsFromRight: null };

const SET_MODEL_TOKENS = new Set(["true", "set", "overwrite", "platform"]);
const APPEND_MODEL_TOKEN = /^append(?::(\d{1,2}))?$/;

/**
 * Resolve the operator's ingress claim.
 *
 * An unreadable value (`1`, `yes`, `append:0`, `append:99`, a placeholder, an
 * unknown word) resolves to **unasserted** rather than throwing or guessing: for
 * a claim nothing here can verify, the only safe direction is the rule that
 * trusts the header less, and `rateLimitIdentityPolicy` then reports
 * `model: "unasserted"`, so the unusable value is visible on `/api/health`
 * instead of silently reading as a verified ingress.
 */
export function resolveIngressClaim(
  env: RuntimeEnvironment = process.env,
): IngressClaim {
  const raw = env[RATE_LIMIT_TRUSTED_INGRESS_VARIABLE]?.trim().toLowerCase();
  if (!raw) return UNASSERTED_INGRESS;
  if (SET_MODEL_TOKENS.has(raw)) return { model: "set", hopsFromRight: null };

  const append = APPEND_MODEL_TOKEN.exec(raw);
  if (append) {
    const hops = append[1] === undefined ? 1 : Number(append[1]);
    if (hops >= 1 && hops <= INGRESS_APPEND_MAX_HOPS) {
      return { model: "append", hopsFromRight: hops };
    }
  }

  return UNASSERTED_INGRESS;
}

export interface RateLimitIdentityPolicy {
  /** True only when the operator explicitly asserted an ingress model. */
  trustedIngress: boolean;
  /** Outcome for the operator: is key identity verified or self-declared? */
  identity: "asserted" | "self-declared";
  /** Which ingress behaviour was asserted, and therefore which hop is read. */
  model: IngressModel;
  /** Header an identity is read from, or null when none is read. */
  header: "x-forwarded-for" | "x-real-ip" | null;
  /** Which hop of that header carries the observed peer. */
  hop: "leftmost" | "nth-from-right" | "none";
  /** For `append`, the hop counted from the right; null for the other models. */
  hopsFromRight: number | null;
  /** Whether `X-Real-IP` is consulted when the primary header yields nothing. */
  fallback: "x-real-ip" | null;
  /**
   * What a request with **no usable identity** gets on a limited surface.
   *
   * `ceiling` (the unasserted default) leaves it bounded by the shared aggregate
   * budget, because without a declared ingress an identity-less request cannot be
   * separated from an honest client of a deployment whose headers never arrive.
   * `shared-per-client-bucket` is the declared-ingress policy: the class is charged
   * to one bucket per surface at that surface's own per-client limit, so declining
   * to present an identity is no longer cheaper than presenting one.
   */
  unidentified: {
    policy: "ceiling" | "shared-per-client-bucket";
    /** Key template of the shared class bucket, or null under the ceiling policy. */
    keyTemplate: string | null;
    detail: string;
  };
  /** Variable that changes this; named so it is greppable in the deployment. */
  variable: string;
  /** Operator-facing explanation, including what is *not* verified. */
  detail: string;
}

export function rateLimitIdentityPolicy(
  env: RuntimeEnvironment = process.env,
): RateLimitIdentityPolicy {
  const claim = resolveIngressClaim(env);

  if (claim.model === "append") {
    const hops = claim.hopsFromRight ?? 1;
    const position = hops === 1 ? "hop 1 from the right" : `hop ${hops} from the right`;
    return {
      trustedIngress: true,
      identity: "asserted",
      model: "append",
      header: "x-forwarded-for",
      hop: "nth-from-right",
      hopsFromRight: hops,
      fallback: null,
      unidentified: {
        policy: "shared-per-client-bucket",
        keyTemplate: `${UNIDENTIFIED_ADMISSION_KEY_PREFIX}<limiter>`,
        detail: `this deployment declares an ingress model, so a request carrying no usable identity did not traverse it and is not one of its clients: such requests share one bucket per surface at that surface's own per-client limit (${UNIDENTIFIED_ADMISSION_KEY_PREFIX}<limiter>) instead of drawing on the aggregate ceiling alone, which gave them a larger allowance than an identified client; a refusal charged to that bucket is reported as unidentified, and it means the declared model and the edge disagree`,
      },
      variable: RATE_LIMIT_TRUSTED_INGRESS_VARIABLE,
      detail: `the deployment asserts that ${RATE_LIMIT_TRUSTED_INGRESS_VARIABLE}=append${hops === 1 ? "" : `:${hops}`} means its ingress appends the observed peer to X-Forwarded-For, so the key is ${position} — written after (never instead of) whatever the client sent — and X-Real-IP is not an identity here because an appending ingress does not set it; declare the exact number of appenders in the path, because with more declared than present a client that pads the header with an extra value becomes the hop that is read; a request carrying fewer than ${hops} hop${hops === 1 ? "" : "s"} did not traverse every declared appender and is unattributed rather than keyed on a client-supplied value`,
    };
  }

  if (claim.model === "set") {
    return {
      trustedIngress: true,
      identity: "asserted",
      model: "set",
      header: "x-forwarded-for",
      hop: "leftmost",
      hopsFromRight: null,
      fallback: "x-real-ip",
      unidentified: {
        policy: "shared-per-client-bucket",
        keyTemplate: `${UNIDENTIFIED_ADMISSION_KEY_PREFIX}<limiter>`,
        detail: `this deployment declares an ingress model, so a request carrying no usable identity did not traverse it and is not one of its clients: such requests share one bucket per surface at that surface's own per-client limit (${UNIDENTIFIED_ADMISSION_KEY_PREFIX}<limiter>) instead of drawing on the aggregate ceiling alone, which gave them a larger allowance than an identified client; a refusal charged to that bucket is reported as unidentified, and it means the declared model and the edge disagree`,
      },
      variable: RATE_LIMIT_TRUSTED_INGRESS_VARIABLE,
      detail: `the deployment asserts that ${RATE_LIMIT_TRUSTED_INGRESS_VARIABLE}=set means its ingress sets the forwarding headers to the peer it observed; per-client limits are keyed on a validated IP literal read from the leftmost X-Forwarded-For hop, with X-Real-IP as fallback`,
    };
  }

  return {
    trustedIngress: false,
    identity: "self-declared",
    model: "unasserted",
    header: "x-forwarded-for",
    hop: "leftmost",
    hopsFromRight: null,
    fallback: "x-real-ip",
    unidentified: {
      policy: "ceiling",
      keyTemplate: null,
      detail:
        "no ingress model is declared, so a request with no usable identity cannot be told apart from an honest client of a deployment whose forwarding headers never arrive; it is bounded by the shared admission ceiling, and charging that whole population to one bucket at a client's own limit would cap it at one client's allowance",
    },
    variable: RATE_LIMIT_TRUSTED_INGRESS_VARIABLE,
    detail: `no ingress is asserted, so a per-client key is only as trustworthy as the header that carried it (${RATE_LIMIT_TRUSTED_INGRESS_VARIABLE}=set or append:N records the ingress model and moves the trusted hop); the shared admission ceiling caps abuse that rotates keys either way`,
  };
}

// ---------------------------------------------------------------------------
// Shared admission ceiling.
// ---------------------------------------------------------------------------

/**
 * Bucket all unattributed traffic shares, and that every attributed request also
 * pays into.
 *
 * This closes the gap SEC-02 left open: a request with no usable identity used to
 * be charged nothing at all, and because a forwarding header is client-supplied
 * data, "no usable identity" was reachable on demand — send a junk or rotating
 * `X-Forwarded-For` and the limiter stopped applying. The ceiling is deliberately
 * a **separate, named, generous** budget rather than the per-client limit, so it
 * does not repeat the older defect of silently redefining a per-IP allowance as
 * a global cap: it is reported as its own number (`rateLimitScope().ceiling`).
 *
 * Every limited request is charged to it — including attributed ones — because
 * the per-client buckets cannot bound a client that presents a *different valid*
 * IP literal on every request: each fresh key gets a fresh allowance, so only an
 * aggregate bound can price that attack. The cost is that this number is also
 * the per-instance throughput floor for limited surfaces, which is why the
 * default is set far above plausible honest traffic for one instance rather than
 * near the per-client limit. Fairness stays with the per-client buckets; this is
 * an abuse ceiling, not a capacity plan.
 */
export const UNATTRIBUTED_ADMISSION_KEY = "unattributed:shared";

export const RATE_LIMIT_UNATTRIBUTED_MAX_VARIABLE = "RATE_LIMIT_UNATTRIBUTED_MAX";

export const UNATTRIBUTED_ADMISSION_MAX_DEFAULT = 6_000;

export const UNATTRIBUTED_ADMISSION_WINDOW_MS = 60_000;

/**
 * Effective ceiling per window. An unusable value falls back to the default
 * (predictable, and never *weaker* than the default) rather than throwing inside
 * a request path.
 *
 * Only plain decimal digits are accepted, matching the store's other numeric
 * markers: a value like `1e9`, `0x10`, `5.0` or `5x` is a configuration mistake,
 * and silently accepting whichever ones `Number()` happens to parse would make
 * the deployed ceiling depend on the parser rather than on the operator's
 * intent.
 */
export function unattributedAdmissionMax(
  env: RuntimeEnvironment = process.env,
): number {
  const raw = env[RATE_LIMIT_UNATTRIBUTED_MAX_VARIABLE]?.trim();
  if (!raw || !/^\d{1,9}$/.test(raw)) return UNATTRIBUTED_ADMISSION_MAX_DEFAULT;
  const parsed = Number(raw);
  if (parsed < 1) return UNATTRIBUTED_ADMISSION_MAX_DEFAULT;
  return parsed;
}

/**
 * The ceiling itself, applied to every limited surface (not to static or
 * unpoliced traffic). With a per-client limit of N this bounds aggregate abuse
 * at the ceiling, so key rotation gains an attacker at most the difference
 * between the ceiling and the honest traffic already charged.
 *
 * `max` comes from `unattributedAdmissionMax()` rather than from the constant,
 * so the budget that is **enforced** and the budget `rateLimitScope().ceiling`
 * **reports** are one number by construction. Reporting a configured ceiling
 * that the limiter does not apply is the same class of defect as the shared
 * `"unknown"` bucket: an operator-facing claim that does not describe behaviour.
 *
 * The value is resolved once per distinct `max` and cached, so the reporting
 * path (`rateLimitScope().ceiling`) and the enforcing path resolve to the **same
 * limiter object** and can never describe different budgets. Caching per value
 * rather than in one slot also keeps a read from mutating enforcement: resolving
 * a different ceiling never discards counters already charged under the current
 * one.
 */
const admissionCeilings = new Map<number, RateLimiter>();

export function unattributedAdmissionLimiter(
  env: RuntimeEnvironment = process.env,
): RateLimiter {
  const max = unattributedAdmissionMax(env);
  const existing = admissionCeilings.get(max);
  if (existing) return existing;

  const limiter = createRateLimiter({
    windowMs: UNATTRIBUTED_ADMISSION_WINDOW_MS,
    max,
    name: "unattributed-admission",
  });
  admissionCeilings.set(max, limiter);
  return limiter;
}

/**
 * Bucket key prefix for the shared class of identity-less requests.
 *
 * Namespaced so it can never collide with a per-client key: `resolveClientKey`
 * returns a key only for a syntactically valid IP literal, and no IP literal
 * contains this prefix, so the class bucket and a client bucket cannot be the same
 * map entry even if a limiter is misconfigured.
 */
export const UNIDENTIFIED_ADMISSION_KEY_PREFIX = "unidentified:";

/** The one bucket every identity-less request on a surface shares. */
export function unidentifiedAdmissionKey(limiterName: string): string {
  return `${UNIDENTIFIED_ADMISSION_KEY_PREFIX}${limiterName}`;
}

/**
 * Charge one limited surface: the shared ceiling, plus the per-client bucket when
 * a validated identity exists — and, where the deployment has declared an ingress
 * model, a shared **class bucket** when no identity is present. Returns the result
 * that should decide the response.
 *
 * Order matters: the ceiling is charged first, so a request that is refused for
 * exceeding it is still counted against it, and one request is never charged
 * twice to the same map entry.
 *
 * **Why the identity-less path gets its own bucket.** Leaving that path bounded by
 * the ceiling alone made non-attribution *cheaper than attribution*: with the
 * shipped limits, a request presenting a valid key gets 5–30 charges a minute
 * while the same request with a junk or absent header got the whole ceiling
 * (6000 by default). Sending no usable identity was therefore the best available
 * strategy for a caller, and it drew down the shared budget every honest request
 * also pays into. Where a deployment has declared how its ingress writes the
 * header, an identity-less request is by that claim not one of its clients, so the
 * class is charged to one bucket per surface at **that surface's own limit** — the
 * class gets exactly what one client gets, enforced by the same limiter object
 * that enforces the per-client limit, so the bound and the reported number cannot
 * drift.
 *
 * Under the unasserted default nothing changes, deliberately: without a declared
 * ingress an identity-less request cannot be told apart from an honest client of a
 * deployment whose headers never arrive, and capping the class at one client's
 * allowance would cap *that* traffic — the global-cap defect the shared `"unknown"`
 * bucket represented. The policy is reported (`rateLimitIdentityPolicy().unidentified`)
 * rather than left to be discovered from behaviour.
 *
 * Every budget is still a fixed window, so a burst straddling a boundary can pass
 * up to 2× the budget — the module header's stated trade-off, which the returned
 * `refusedBy` reason does not change.
 */
export function chargeAdmission(
  perClientLimiter: RateLimiter,
  clientKey: string | null,
  env: RuntimeEnvironment = process.env,
): AdmissionResult {
  const ceiling = unattributedAdmissionLimiter(env).check(UNATTRIBUTED_ADMISSION_KEY);
  if (ceiling.limited) return { ...ceiling, refusedBy: "ceiling" };

  if (clientKey === null) {
    if (resolveIngressClaim(env).model === "unasserted") {
      return { ...ceiling, refusedBy: null };
    }
    const unidentified = perClientLimiter.check(unidentifiedAdmissionKey(perClientLimiter.name));
    return { ...unidentified, refusedBy: unidentified.limited ? "unidentified" : null };
  }

  const perClient = perClientLimiter.check(clientKey);
  return { ...perClient, refusedBy: perClient.limited ? "per-client" : null };
}

export interface ClientKeyResolution {
  /** Per-client bucket key, or `null` when the request carries no usable identity. */
  key: string | null;
  source: ClientKeySource;
}

/** Leftmost hop of a comma-separated forwarding header: `"client, proxy1"` → `"client"`. */
function firstHop(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * The Nth entry from the right of a comma-separated forwarding header.
 *
 * Positions are counted over the **raw** entry list, so a blank entry still
 * occupies its position: an appender writes one entry per hop, and a client that
 * sends a trailing comma or an empty value must not be able to shift which
 * entry the declared appender wrote. Returns `null` when the header carries
 * fewer than `fromRight` entries, or when the entry at that position is blank.
 */
function hopFromRight(headerValue: string | null, fromRight: number): string | null {
  if (!headerValue) return null;
  const entries = headerValue.split(",");
  const index = entries.length - fromRight;
  if (index < 0) return null;
  const value = entries[index]?.trim();
  return value ? value : null;
}

/**
 * Resolve the per-client bucket key for a request.
 *
 * `key` is `null` when no **usable** identity is present, and `source` records
 * why: `none` (no forwarding header at all) or `invalid` (a header was present
 * but was not an IP literal). Neither case is a bucket of its own:
 *
 *   - The first shape of this defect collapsed every unattributed request into
 *     one shared `"unknown"` bucket, which is not a per-client limit at all —
 *     the configured per-IP allowance silently became a **global** cap that one
 *     client could exhaust on everyone else's behalf, and nothing in a response,
 *     log or metric revealed that the control had changed meaning.
 *   - The second shape treated `null` as "proceed unlimited", which made the
 *     limiter optional on demand: the headers are client-supplied, so sending a
 *     junk or rotating value was enough to avoid every bucket.
 *
 * Instead, `null` means "unattributed", and `chargeAdmission` bounds those
 * requests with the shared admission ceiling — a named, separately reported
 * budget that every request also pays into, rather than the per-IP allowance
 * relabelled as a global cap.
 *
 * A header token is only accepted when it is a syntactically valid IP literal
 * (`isIpLiteral`), so a hostname, path fragment, or fresh random token cannot
 * mint a private bucket and never reach a limit.
 *
 * **Which hop is read follows the declared ingress model** (`IngressClaim`, from
 * `RATE_LIMIT_TRUSTED_INGRESS`). Without a claim, the historical rule applies:
 * `X-Forwarded-For` is preferred and `X-Real-IP` is accepted next, because it is
 * what nginx-style reverse proxies set, and an unusable `X-Forwarded-For` hop
 * does not mask a usable `X-Real-IP` — attribution takes the first header that
 * yields a valid literal, because discarding a real observation in favour of
 * reporting "unattributed" is strictly less information for the same admission
 * charge. A deployment may instead declare that its ingress **appends** the
 * observed peer (`append`/`append:N`), and then the key is hop N from the right
 * and the client-supplied hops in front of it are never read: otherwise the
 * leftmost hop — the value the client chooses — decides the bucket, so rotating
 * it mints a fresh allowance per request. `X-Real-IP` is deliberately not
 * consulted under that model, because an appending ingress does not set it, so a
 * value there is client-supplied and would let a client choose which bucket it
 * is charged against.
 *
 * Both headers are only as trustworthy as the ingress in front of the app —
 * which is what `rateLimitIdentityPolicy` records, and why the edge WAF remains
 * the capacity layer.
 */
export function resolveClientKey(
  requestHeaders: Headers,
  claim: IngressClaim = UNASSERTED_INGRESS,
): ClientKeyResolution {
  const forwardedHeader = requestHeaders.get("x-forwarded-for");

  if (claim.model === "append") {
    const observed = hopFromRight(forwardedHeader, claim.hopsFromRight ?? 1);
    if (observed !== null) {
      return isIpLiteral(observed)
        ? { key: observed, source: "x-forwarded-for" }
        : { key: null, source: "invalid" };
    }
    // No hop at the declared position: the ingress did not write this request's
    // header — it was stripped, or the request never traversed it. Reporting
    // `invalid` rather than falling back to a client-supplied value is the whole
    // point of declaring a hop count, and it is what makes `append:2` verifiable.
    return {
      key: null,
      source: forwardedHeader === null || forwardedHeader.trim() === "" ? "none" : "invalid",
    };
  }

  const forwarded = firstHop(forwardedHeader);
  if (forwarded !== null && isIpLiteral(forwarded)) {
    return { key: forwarded, source: "x-forwarded-for" };
  }

  const realIp = firstHop(requestHeaders.get("x-real-ip"));
  if (realIp !== null && isIpLiteral(realIp)) {
    return { key: realIp, source: "x-real-ip" };
  }

  return forwarded !== null || realIp !== null
    ? { key: null, source: "invalid" }
    : { key: null, source: "none" };
}
