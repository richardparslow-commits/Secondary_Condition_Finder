import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS,
  CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
  CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS,
  HALF_OPEN_PROBE_AFTER_MS,
  claimCircuitProbe,
  clampRetryAfterCooldownMs,
  clearCircuitBreakerState,
  parseRetryAfterMs,
  readCircuitState,
  recordCircuitFailure,
  recordCircuitSuccess,
  releaseCircuitProbe,
} from "@/lib/va/circuit-breaker";
import {
  reserveVaSharedConsumerSlot,
  VA_SHARED_CONSUMER_MAX_REQUESTS,
} from "@/lib/va/reference-shared-cache";
import {
  clearVaApiOutboundRateLimitState,
  fetchVaForms,
  type VaApiConfig,
} from "@/lib/va/sandbox";
import {
  SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT,
  clearSharedCircuitStateForTests,
  publishSharedCircuitClosed,
  publishSharedCircuitOpen,
  readSharedCircuitGate,
  releaseSharedProbeLease,
} from "@/lib/va/shared-circuit";
import {
  evaluateVaOutboundCircuit,
  recordVaOutboundCircuitOutcome,
} from "@/lib/va/outbound-circuit";

import { createFakeSharedKv } from "./helpers/fake-shared-kv";

const config: VaApiConfig = {
  enabled: true,
  mode: "sandbox",
  modeReason: "Test fixture: sandbox mode.",
  environment: "sandbox",
  formsApiKey: "forms-test-key",
  benefitsReferenceDataApiKey: "reference-test-key",
  formsBaseUrl: "https://sandbox-api.va.gov/services/va_forms/v0",
  benefitsReferenceDataBaseUrl:
    "https://sandbox-api.va.gov/services/benefits-reference-data/v1",
  timeoutMs: 1000,
};

const KV_HOST = "https://kv.example.test";
const FORM_MARKER_KEY = "va:ref:circuit:va-forms";
const FORM_DEADLINE_KEY = "va:ref:circuit-deadline:va-forms";
const FORM_PROBE_KEY = "va:ref:circuit-probe:va-forms";

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function vaFormsPayload(): Response {
  return okJson({ data: [] });
}

function stubSandboxFetch(options: {
  kv: ReturnType<typeof createFakeSharedKv>;
  upstream: (url: string) => Response | Promise<Response>;
}) {
  const spy = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const href = String(input);
      if (href.startsWith(KV_HOST)) return options.kv.respond(init);
      return options.upstream(href);
    },
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

function stubDistributedEnv(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_HOST);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "test-token");
  vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
}

function seededCooldownMarker(openedAt: number): string {
  return JSON.stringify({ state: "open", openedAt });
}

beforeEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
});

afterEach(() => {
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("VA circuit breaker — Retry-After policy", () => {
  it("parses delay-seconds and HTTP-date forms, and rejects garbage", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000);
    expect(parseRetryAfterMs("0")).toBe(0);
    expect(parseRetryAfterMs("  ")).toBeNull();
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("not-a-value")).toBeNull();
    const now = Date.parse("2026-10-03T00:00:00.000Z");
    expect(parseRetryAfterMs("Sat, 03 Oct 2026 00:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfterMs("Fri, 02 Oct 2026 00:00:00 GMT", now)).toBe(0);
  });

  it("clamps the cooldown window and uses the default when no header is usable", () => {
    // A long-but-legal Retry-After (10 min) is honored exactly rather than
    // truncated to a fixed window; only values beyond the policy cap are cut.
    expect(clampRetryAfterCooldownMs(600_000)).toBe(600_000);
    expect(clampRetryAfterCooldownMs(CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS + 1)).toBe(
      CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
    );
    expect(clampRetryAfterCooldownMs(10)).toBe(CIRCUIT_RATE_LIMIT_MIN_COOLDOWN_MS);
    expect(clampRetryAfterCooldownMs(null)).toBe(CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS);
    expect(clampRetryAfterCooldownMs(Number.NaN)).toBe(CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS);
    expect(clampRetryAfterCooldownMs(5_000)).toBe(5_000);
  });
});

describe("VA circuit breaker — single half-open probe", () => {
  it("admits exactly one probe per cooldown and re-opens on probe failure", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i += 1) recordCircuitFailure("va-forms", t0);
    expect(readCircuitState("va-forms").state).toBe("open");

    // Inside the cooldown nobody is admitted.
    expect(claimCircuitProbe("va-forms", t0 + 1)).toBe(false);

    // Cooldown elapsed: first caller claims the only probe.
    expect(claimCircuitProbe("va-forms", t0 + HALF_OPEN_PROBE_AFTER_MS)).toBe(true);
    expect(readCircuitState("va-forms").state).toBe("half-open");
    expect(claimCircuitProbe("va-forms", t0 + HALF_OPEN_PROBE_AFTER_MS + 1)).toBe(false);

    // An abandoned claim can be released so a later caller may retry the probe.
    releaseCircuitProbe("va-forms");
    expect(claimCircuitProbe("va-forms", t0 + HALF_OPEN_PROBE_AFTER_MS + 2)).toBe(true);

    // The probe failed: circuit re-opens with a fresh cooldown.
    expect(recordCircuitFailure("va-forms", t0 + HALF_OPEN_PROBE_AFTER_MS + 3)).toBe(true);
    expect(claimCircuitProbe("va-forms", t0 + 2 * HALF_OPEN_PROBE_AFTER_MS + 2)).toBe(false);
    expect(claimCircuitProbe("va-forms", t0 + 2 * HALF_OPEN_PROBE_AFTER_MS + 3)).toBe(true);

    // The probe succeeded: circuit closes.
    expect(recordCircuitSuccess("va-forms")).toBe(true);
    expect(readCircuitState("va-forms")).toEqual(
      expect.objectContaining({
        state: "closed",
        failures: 0,
        openedAt: null,
        probeInFlight: false,
        cooldownMs: HALF_OPEN_PROBE_AFTER_MS,
      }),
    );
    expect(claimCircuitProbe("va-forms")).toBe(true);
  });

  it("a 429 opens the circuit for the clamped Retry-After window and blocks follow-ups without network calls", async () => {
    const upstreamSpy = vi
      .fn()
      .mockResolvedValue(
        new Response("slow down", { status: 429, headers: { "Retry-After": "600" } }),
      );
    vi.stubGlobal("fetch", upstreamSpy);

    const first = await fetchVaForms("21-526EZ", { config });
    expect(first.success).toBe(false);
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
    expect(readCircuitState("va-forms")).toEqual(
      expect.objectContaining({
        state: "open",
        cooldownMs: 600_000,
      }),
    );

    const second = await fetchVaForms("21-526EZ", { config });
    expect(second.success).toBe(false);
    expect(second.error).toContain("circuit open");
    expect(upstreamSpy).toHaveBeenCalledTimes(1);
  });

  it("admits a single probe after a 429 cooldown and closes the circuit on success", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
    const upstreamSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "Retry-After": "1" } }),
      )
      .mockResolvedValueOnce(vaFormsPayload());
    vi.stubGlobal("fetch", upstreamSpy);

    const first = await fetchVaForms(undefined, { config });
    expect(first.success).toBe(false);

    // Still within the 1s cooldown: no network attempt.
    const blocked = await fetchVaForms(undefined, { config });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain("circuit open");
    expect(upstreamSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-03T00:00:02.000Z"));
    const probe = await fetchVaForms(undefined, { config });
    expect(probe.success).toBe(true);
    expect(upstreamSpy).toHaveBeenCalledTimes(2);
    expect(readCircuitState("va-forms").state).toBe("closed");
  });
});

describe("VA shared circuit coordination — distributed runtimes", () => {
  it("caps the shared consumer budget at the window maximum", async () => {
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_HOST);
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "test-token");
    const kv = createFakeSharedKv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input).startsWith(KV_HOST)).toBe(true);
        return kv.respond(init);
      }),
    );
    const windowBase = 1_000_000;

    for (let index = 0; index < VA_SHARED_CONSUMER_MAX_REQUESTS; index += 1) {
      await expect(
        reserveVaSharedConsumerSlot(undefined, windowBase + index),
      ).resolves.toBe(true);
    }
    // A 61st attempt in the same window is refused consumer-wide.
    await expect(
      reserveVaSharedConsumerSlot(undefined, windowBase + VA_SHARED_CONSUMER_MAX_REQUESTS),
    ).resolves.toBe(false);
    // The window counter is bounded by a TTL, not left to accumulate.
    expect(kv.executed.some((command) => command[0] === "EXPIRE")).toBe(true);
  });

  it("reserves a shared consumer slot for every retry attempt", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    let upstreamCalls = 0;
    const upstream = vi.fn(async () => {
      upstreamCalls += 1;
      if (upstreamCalls === 1) return new Response("unavailable", { status: 503 });
      return vaFormsPayload();
    });
    stubSandboxFetch({ kv, upstream });

    const result = await fetchVaForms(undefined, { config });
    expect(result.success).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(2);
    const reservations = kv.executed.filter((command) => command[0] === "INCR");
    expect(reservations).toHaveLength(2);
  });

  it("blocks every instance while a shared cooldown marker is active, without spending budget", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    kv.seed(FORM_MARKER_KEY, seededCooldownMarker(Date.now()), 3_600_000);
    const upstream = vi.fn();
    stubSandboxFetch({ kv, upstream });

    const result = await fetchVaForms(undefined, { config });

    expect(result.success).toBe(false);
    expect(result.error).toContain("circuit open");
    expect(upstream).not.toHaveBeenCalled();
    // No consumer-budget slot was reserved for a request that never left.
    expect(kv.executed.some((command) => command[0] === "INCR")).toBe(false);
  });

  it("grants the half-open probe to one instance and clears the cooldown after success", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    kv.seed(
      FORM_MARKER_KEY,
      seededCooldownMarker(Date.now() - HALF_OPEN_PROBE_AFTER_MS - 1_000),
      3_600_000,
    );
    // Another instance already holds the probe lease.
    kv.seed(FORM_PROBE_KEY, "other-instance-lease", 60_000);
    const upstream = vi.fn().mockResolvedValue(vaFormsPayload());
    stubSandboxFetch({ kv, upstream });

    const held = await fetchVaForms(undefined, { config });
    expect(held.success).toBe(false);
    expect(held.error).toContain("circuit open");
    expect(upstream).not.toHaveBeenCalled();

    // The competing lease expires; this instance claims the probe and reaches VA.
    kv.seed(FORM_PROBE_KEY, "expired", 0);
    const probe = await fetchVaForms(undefined, { config });
    expect(probe.success).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(1);
    // Success deletes the cooldown marker and the lease it holds.
    expect(kv.get(FORM_MARKER_KEY)).toBeNull();
    expect(kv.get(FORM_PROBE_KEY)).toBeNull();
  });

  it("republishes a shared cooldown when a fleet probe fails even with a closed local breaker", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    kv.seed(
      FORM_MARKER_KEY,
      seededCooldownMarker(Date.now() - HALF_OPEN_PROBE_AFTER_MS - 1_000),
      3_600_000,
    );
    const upstream = vi.fn().mockResolvedValue(new Response("bad", { status: 500 }));
    stubSandboxFetch({ kv, upstream });

    const probe = await fetchVaForms(undefined, { config });
    expect(probe.success).toBe(false);
    expect(upstream).toHaveBeenCalledTimes(1);

    const marker = kv.get(FORM_MARKER_KEY);
    expect(marker).not.toBeNull();
    const parsed = JSON.parse(marker as string) as { state: string; openedAt: number };
    expect(parsed.state).toBe("open");
    expect(Date.now() - parsed.openedAt).toBeLessThan(5_000);
    // The failed probe's lease is released so the next cooldown can probe.
    expect(kv.get(FORM_PROBE_KEY)).toBeNull();

    // Follow-up requests are blocked by the fresh cooldown.
    const blocked = await fetchVaForms(undefined, { config });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toContain("circuit open");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("fails closed without an upstream attempt when the shared coordinator is unreachable", async () => {
    stubDistributedEnv();
    const upstream = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const href = String(input);
        if (href.startsWith(KV_HOST)) throw new Error("connection refused");
        return upstream();
      }),
    );

    const result = await fetchVaForms(undefined, { config });
    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("shared rate-limit/cache coordinator");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("releases a claimed probe lease when the consumer budget fails closed", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    kv.seed(
      FORM_MARKER_KEY,
      seededCooldownMarker(Date.now() - HALF_OPEN_PROBE_AFTER_MS - 1_000),
      3_600_000,
    );
    const upstream = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const href = String(input);
        if (!href.startsWith(KV_HOST)) return upstream();
        const command = JSON.parse(String(init?.body ?? "[]")) as string[];
        if (command[0] === "INCR") return okJson({ error: "ERR" });
        return kv.respond(init);
      }),
    );

    const result = await fetchVaForms(undefined, { config });
    expect(result.success).toBe(false);
    expect(result.error).toContain("shared rate-limit/cache coordinator");
    expect(upstream).not.toHaveBeenCalled();
    // The probe lease was released (atomic compare-and-delete) rather than
    // stranding the fleet.
    expect(kv.get(FORM_PROBE_KEY)).toBeNull();
    expect(
      kv.executed.some(
        (command) =>
          command[0] === "EVAL" &&
          command[1] === SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT &&
          command[3] === FORM_PROBE_KEY,
      ),
    ).toBe(true);
  });

  it("publishes a shared 429 cooldown for the clamped Retry-After window", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    const upstream = vi
      .fn()
      .mockResolvedValue(
        new Response("slow down", { status: 429, headers: { "Retry-After": "600" } }),
      );
    stubSandboxFetch({ kv, upstream });

    const first = await fetchVaForms(undefined, { config });
    expect(first.success).toBe(false);
    expect(upstream).toHaveBeenCalledTimes(1);

    const marker = kv.get(FORM_MARKER_KEY);
    expect(marker).not.toBeNull();
    const parsed = JSON.parse(marker as string) as { state: string; openedAt: number };
    expect(parsed.state).toBe("open");
    expect(Date.now() - parsed.openedAt).toBeLessThan(5_000);

    const second = await fetchVaForms(undefined, { config });
    expect(second.success).toBe(false);
    expect(second.error).toContain("circuit open");
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe("VA shared circuit — deadline fencing and false-success guards (B06/B07)", () => {
  it("extends an active cooldown only, honoring the absolute deadline", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    stubSandboxFetch({ kv, upstream: vi.fn() });
    const t0 = 1_000_000_000;

    await expect(
      publishSharedCircuitOpen("va-forms", { cooldownMs: 5_000, now: t0 }),
    ).resolves.toBe(true);
    const firstMarker = kv.get(FORM_MARKER_KEY);
    // The stored deadline is the absolute instant, not a fixed window.
    expect(Number(kv.get(FORM_DEADLINE_KEY))).toBe(t0 + 5_000);

    // A later, shorter failure can never shorten a deadline already in force.
    await expect(
      publishSharedCircuitOpen("va-forms", { cooldownMs: 1_000, now: t0 + 1_000 }),
    ).resolves.toBe(true);
    expect(Number(kv.get(FORM_DEADLINE_KEY))).toBe(t0 + 5_000);
    expect(kv.get(FORM_MARKER_KEY)).toBe(firstMarker);

    // A later long Retry-After extends the deadline exactly.
    await expect(
      publishSharedCircuitOpen("va-forms", { cooldownMs: 600_000, now: t0 + 2_000 }),
    ).resolves.toBe(true);
    expect(Number(kv.get(FORM_DEADLINE_KEY))).toBe(t0 + 2_000 + 600_000);

    // Beyond the 15-minute policy cap the shared window clamps like the local one.
    await expect(
      publishSharedCircuitOpen("va-forms", { cooldownMs: 24 * 3_600_000, now: t0 + 3_000 }),
    ).resolves.toBe(true);
    expect(Number(kv.get(FORM_DEADLINE_KEY))).toBe(
      t0 + 3_000 + CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS,
    );
  });

  it("treats a Redis body error as a failed command, not as success", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    const upstream = vi.fn();
    stubSandboxFetch({ kv, upstream });

    // A GET that answers 200 with `{error}` is unavailable, so the request
    // fails closed instead of treating an unreadable circuit as closed.
    kv.failCommand("GET");
    const result = await fetchVaForms(undefined, { config });
    expect(result.success).toBe(false);
    expect(result.source).toBe("local-fallback");
    expect(result.error).toContain("shared rate-limit/cache coordinator");
    expect(upstream).not.toHaveBeenCalled();

    // An EVAL that answers 200 with `{error}` is a failed publication and must
    // not leave a partially written cooldown behind.
    kv.clearCommandFailures();
    kv.failCommand("EVAL");
    await expect(
      publishSharedCircuitOpen("va-forms", { cooldownMs: 600_000, now: 1_000 }),
    ).resolves.toBe(false);
    expect(kv.get(FORM_MARKER_KEY)).toBeNull();
    expect(kv.get(FORM_DEADLINE_KEY)).toBeNull();
  });

  it("never clears a newer cooldown from a stale probe or an ordinary success", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    stubSandboxFetch({ kv, upstream: vi.fn() });

    // Admitted while the fleet circuit was closed: no marker was observed.
    const admission = await evaluateVaOutboundCircuit({
      service: "va-forms",
      distributed: true,
    });
    expect(admission.decision).toBe("allow");
    expect(admission.sharedMarker).toBeNull();

    // Another instance hits a 429 and opens a long fleet cooldown meanwhile.
    await publishSharedCircuitOpen("va-forms", { cooldownMs: 600_000, now: Date.now() });
    const marker = kv.get(FORM_MARKER_KEY);
    expect(marker).not.toBeNull();

    // The late ordinary success reports non-probe: it must not attempt recovery.
    await recordVaOutboundCircuitOutcome({
      service: "va-forms",
      distributed: true,
      success: true,
      probeAdmitted: false,
      admission,
    });
    expect(kv.get(FORM_MARKER_KEY)).toBe(marker);
    expect(kv.get(FORM_DEADLINE_KEY)).not.toBeNull();

    // Even a caller that claims probe admission cannot clear a generation it
    // never observed (the admission carries no marker).
    await recordVaOutboundCircuitOutcome({
      service: "va-forms",
      distributed: true,
      success: true,
      probeAdmitted: true,
      admission: {
        decision: "probe",
        localVersion: admission.localVersion,
        sharedMarker: null,
      },
    });
    expect(kv.get(FORM_MARKER_KEY)).toBe(marker);

    // A stale marker string from an older generation is refused as well.
    await expect(
      publishSharedCircuitClosed("va-forms", {
        observedMarker: JSON.stringify({
          state: "open",
          openedAt: 1,
          deadline: 2,
          generation: "older-generation",
        }),
      }),
    ).resolves.toBe(false);
    expect(kv.get(FORM_MARKER_KEY)).toBe(marker);
  });

  it("releases a claimed probe lease atomically without deleting a replacement", async () => {
    stubDistributedEnv();
    const kv = createFakeSharedKv();
    kv.seed(
      FORM_MARKER_KEY,
      seededCooldownMarker(Date.now() - HALF_OPEN_PROBE_AFTER_MS - 1_000),
      3_600_000,
    );
    stubSandboxFetch({ kv, upstream: vi.fn() });

    const gate = await readSharedCircuitGate("va-forms");
    expect(gate.status).toBe("probe-granted");

    // Between the claim and the release the lease expired and a replacement
    // instance claimed it; the old owner must not delete the new lease.
    kv.seed(FORM_PROBE_KEY, "replacement-instance-token", 60_000);
    await releaseSharedProbeLease("va-forms");
    expect(kv.get(FORM_PROBE_KEY)).toBe("replacement-instance-token");
    expect(
      kv.executed.some(
        (command) =>
          command[0] === "EVAL" &&
          command[1] === SHARED_CIRCUIT_COMPARE_DELETE_SCRIPT &&
          command[3] === FORM_PROBE_KEY,
      ),
    ).toBe(true);
  });
});
