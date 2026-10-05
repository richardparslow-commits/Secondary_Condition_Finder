import { describe, expect, it } from "vitest";

import { createRateLimiter, rateLimitScope } from "@/lib/rate-limiter";
import {
  DISTRIBUTED_RUNTIME_MARKERS,
  isDistributedRuntime,
  type RuntimeEnvironment,
} from "@/lib/runtime-deployment";
import { vaProcessLocalStateAllowed } from "@/lib/va/runtime-state";

/**
 * Pins the contract behind two modules that used to disagree.
 *
 * `src/lib/va/runtime-state.ts` failed closed on process-local state, while
 * `src/lib/rate-limiter.ts` kept per-instance buckets and called it intentional.
 * Both verdicts are defensible — they are policies — but each module was
 * deriving the underlying runtime *fact* privately, so the two could drift apart
 * without anything failing.
 *
 * This suite separates the two concerns: the fact has one owner
 * (`runtime-deployment.ts`) and is asserted directly, and the deliberate policy
 * divergence is asserted as intentional rather than left to be rediscovered.
 */

const markerCases: RuntimeEnvironment[] = DISTRIBUTED_RUNTIME_MARKERS.flatMap(
  (marker) => [
    { NODE_ENV: "test", [marker]: "1" },
    { NODE_ENV: "test", [marker]: "true" },
    { NODE_ENV: "test", [marker]: "0" },
    { NODE_ENV: "test", [marker]: "" },
    { NODE_ENV: "test", [marker]: "false" },
  ],
);

const envCases: RuntimeEnvironment[] = [
  {},
  { NODE_ENV: "test" },
  { NODE_ENV: "development" },
  { NODE_ENV: "production" },
  { NODE_ENV: "PRODUCTION" },
  { NODE_ENV: " production " },
  ...markerCases,
];

describe("the runtime fact has a single owner", () => {
  it("classifies production and known distributed runtimes as distributed", () => {
    expect(isDistributedRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(isDistributedRuntime({ NODE_ENV: "PRODUCTION" })).toBe(true);
    expect(isDistributedRuntime({ NODE_ENV: "test", VERCEL: "1" })).toBe(true);
    expect(isDistributedRuntime({ NODE_ENV: "test", K_SERVICE: "svc" })).toBe(true);
  });

  it("does not read a disabled marker as a live one", () => {
    expect(isDistributedRuntime({ NODE_ENV: "test" })).toBe(false);
    expect(isDistributedRuntime({})).toBe(false);
    for (const marker of DISTRIBUTED_RUNTIME_MARKERS) {
      expect(isDistributedRuntime({ NODE_ENV: "test", [marker]: "0" })).toBe(false);
      expect(isDistributedRuntime({ NODE_ENV: "test", [marker]: "" })).toBe(false);
      expect(isDistributedRuntime({ NODE_ENV: "test", [marker]: "false" })).toBe(false);
    }
  });

  it("derives the VA verdict from that one classification across an env matrix", () => {
    for (const env of envCases) {
      expect(
        vaProcessLocalStateAllowed(env),
        `env ${JSON.stringify(env)}`,
      ).toBe(!isDistributedRuntime(env));
    }
  });

  it("exercises both verdicts, so the parity assertion is not vacuous", () => {
    const verdicts = new Set(envCases.map((env) => isDistributedRuntime(env)));
    expect(verdicts).toEqual(new Set([true, false]));
  });
});

describe("the two policies diverge deliberately, not accidentally", () => {
  it("refuses process-local VA state where the limiter keeps working", () => {
    const env: RuntimeEnvironment = { NODE_ENV: "production" };

    expect(isDistributedRuntime(env)).toBe(true);

    // Correctness guarantee → fail closed. A per-instance reference cache can
    // serve data from the wrong environment; a per-instance outbound budget can
    // permit N× the intended traffic against VA. Refusing is the only safe move.
    expect(vaProcessLocalStateAllowed(env)).toBe(false);

    // Availability guard → degrade and disclose. A limiter that permits more than
    // intended is still restricting traffic, and switching it off in production
    // would remove defense-in-depth entirely.
    expect(rateLimitScope(env).scope).toBe("per-instance");

    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    expect(limiter.check("ip").limited).toBe(false);
    expect(limiter.check("ip").limited).toBe(false);
    expect(limiter.check("ip").limited).toBe(true);
  });
});
