import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  runtimeCapabilities,
  type RuntimeCapabilityId,
} from "@/lib/runtime-capabilities";

/**
 * Guards the runtime-capabilities report.
 *
 * The point of that module is that a control depending on process-local state
 * cannot exist without answering what it does in a distributed runtime. That
 * property only holds if the registry is checked against what actually exists, so
 * this suite derives the ground truth from `src/` on disk — every file that
 * consults the runtime fact — and requires the registry to account for all of
 * them, in both directions.
 */

const PROJECT_ROOT = process.cwd();
const SRC = path.join(PROJECT_ROOT, "src");

/**
 * Modules that answer the runtime question itself rather than depending on it, so
 * they are not capabilities: `runtime-deployment.ts` owns the fact, and
 * `runtime-capabilities.ts` owns the report over it.
 */
const NON_CAPABILITY_MODULES = [
  "src/lib/runtime-deployment.ts",
  "src/lib/runtime-capabilities.ts",
];

/**
 * Ways a module can depend on the runtime classification.
 *
 * The first two are the shared entry points. The marker tokens are there to catch
 * the regression this whole exercise started from: a module deriving the same fact
 * **privately**, which is exactly how the VA cache and the rate limiter came to
 * hold opposite verdicts while each looked locally reasonable. A private copy has
 * to name at least one marker, so naming them here detects it.
 *
 * The word boundaries matter: `VERCEL_URL` in `security/csrf.ts` is a different
 * thing from the `VERCEL` marker, and a bare `NODE_ENV === "production"` is a
 * legitimate concern of its own (cookie `secure` flags, debug logging) rather than
 * a claim about process-local state, so neither is treated as a dependency here.
 */
const RUNTIME_FACT_USAGE =
  /isDistributedRuntime\(|vaProcessLocalStateAllowed\(|\b(VERCEL|AWS_LAMBDA_FUNCTION_NAME|FUNCTIONS_WORKER_RUNTIME|K_SERVICE)\b/;

const EXPECTED_IDS: RuntimeCapabilityId[] = [
  "circuitBreaker",
  "rateLimit",
  "vaConsumerBudget",
  "vaLiveIntegration",
  "vaReferenceCache",
];

/**
 * The one capability that can be at full strength *while* distributed.
 *
 * A shared atomic window is the fleet-wide *form* of the consumer budget rather
 * than a weaker version of it, so `vaConsumerBudget` is full strength when it is
 * enforced and reduced only when a prerequisite is missing (and live VA access is
 * refused outright in that state). It is listed here so the invariant assertion
 * below states the exception out loud instead of inheriting it.
 */
const DISTRIBUTED_FULL_IDS: RuntimeCapabilityId[] = ["vaConsumerBudget"];

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [absolute];
  });
}

/**
 * Byte-identical duplicates of another source file.
 *
 * A file that duplicates one already in the tree contributes no code, so it must
 * not be mistaken for an unregistered capability. These appear when a folder-sync
 * client forks a file mid-write, leaving names like `runtime-deployment 2.ts`
 * beside the original — and a copy of a module that consults the runtime fact
 * would otherwise be reported as a missing capability entry, failing this suite
 * for a reason that has nothing to do with capabilities. Duplicates add nothing to
 * check, so they are skipped here — which keeps every failure in this suite an
 * answer to the capability question.
 *
 * Skipping is not tolerating: their presence is a failure in its own right, caught
 * by `tests/checkout-fork-hygiene.test.ts`, so a forked copy is reported once, by
 * the suite that can name the cause.
 */
function duplicateContentFiles(files: string[]): Set<string> {
  const byDigest = new Map<string, string[]>();

  for (const file of files) {
    const digest = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    byDigest.set(digest, [...(byDigest.get(digest) ?? []), file]);
  }

  const duplicates = new Set<string>();
  for (const group of byDigest.values()) {
    if (group.length < 2) continue;
    // Keep the shortest path: a forked copy always carries an extra suffix (" 2"),
    // so sorting by length keeps the original. Sorting by name would keep the copy,
    // because a space sorts before the "." in `runtime-deployment.ts`.
    const [, ...rest] = [...group].sort(
      (a, b) => a.length - b.length || a.localeCompare(b),
    );
    for (const file of rest) duplicates.add(file);
  }
  return duplicates;
}

/** Files that consult the runtime fact, repo-relative, sorted. */
function runtimeFactConsumers(): string[] {
  const files = listSourceFiles(SRC);
  const duplicates = duplicateContentFiles(files);

  return files
    .filter((file) => !duplicates.has(file))
    .filter((file) => RUNTIME_FACT_USAGE.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(PROJECT_ROOT, file).split(path.sep).join("/"))
    .filter((file) => !NON_CAPABILITY_MODULES.includes(file))
    .sort();
}

function declaredSources(): string[] {
  return [
    ...new Set(
      Object.values(runtimeCapabilities({ NODE_ENV: "test" }).capabilities).flatMap(
        (capability) => [...capability.sources],
      ),
    ),
  ].sort();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("capability registry covers the code that depends on the runtime fact", () => {
  it("derives consumers from disk rather than trusting a list", () => {
    const consumers = runtimeFactConsumers();

    // Anti-vacuity: both directions below are meaningless on an empty set.
    expect(consumers.length).toBeGreaterThanOrEqual(4);
    expect(consumers).toContain("src/lib/va/sandbox.ts");
    expect(consumers).toContain("src/lib/rate-limiter.ts");
    expect(consumers).toContain("src/lib/va/circuit-breaker.ts");
    for (const file of consumers) {
      expect(fs.existsSync(path.join(PROJECT_ROOT, file)), file).toBe(true);
    }
  });

  it("does not mistake unrelated production checks for a runtime-state dependency", () => {
    const consumers = runtimeFactConsumers();

    // These read NODE_ENV for cookie security, debug logging, or a deployment URL,
    // none of which is a claim about process-local state. Flagging them would force
    // capability entries that describe nothing.
    for (const unrelated of [
      "src/lib/security/csrf.ts",
      "src/lib/observability/logger.ts",
      "src/lib/engine/metrics.ts",
    ]) {
      expect(consumers).not.toContain(unrelated);
    }
  });

  it("accounts for every module that consults the runtime fact", () => {
    const declared = declaredSources();
    const unaccounted = runtimeFactConsumers().filter((file) => !declared.includes(file));

    expect(
      unaccounted,
      `register these in runtime-capabilities.ts so they report a scope: ${unaccounted.join(", ")}`,
    ).toEqual([]);
  });

  it("claims no source that no longer consults the runtime fact", () => {
    const consumers = runtimeFactConsumers();
    const stale = declaredSources().filter((file) => !consumers.includes(file));

    expect(
      stale,
      `these sources no longer consult the runtime fact: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the expected capability ids, so one cannot be dropped silently", () => {
    const ids = Object.keys(runtimeCapabilities({ NODE_ENV: "test" }).capabilities).sort();

    expect(ids).toEqual(EXPECTED_IDS);
    for (const capability of Object.values(
      runtimeCapabilities({ NODE_ENV: "test" }).capabilities,
    )) {
      expect(capability.sources.length, capability.id).toBeGreaterThan(0);
      expect(capability.label.length, capability.id).toBeGreaterThan(0);
    }
  });
});

describe("what this deployment gives up", () => {
  it("reports every capability at full strength where one process serves traffic", () => {
    const { distributed, summary, capabilities } = runtimeCapabilities({ NODE_ENV: "test" });

    expect(distributed).toBe(false);
    expect(summary.reduced).toEqual([]);
    expect(summary.detail).toMatch(/full strength/);
    for (const capability of Object.values(capabilities)) {
      expect(capability.full, capability.id).toBe(true);
    }
  });

  it("reports every process-local capability reduced in a distributed runtime", () => {
    const { distributed, summary, capabilities } = runtimeCapabilities({
      NODE_ENV: "production",
    });

    expect(distributed).toBe(true);
    expect([...summary.reduced].sort()).toEqual(EXPECTED_IDS);
    expect(summary.detail).toMatch(/5 of 5/);
    for (const capability of Object.values(capabilities)) {
      expect(capability.full, capability.id).toBe(false);
    }
    // A future capability that stays at full strength while distributed belongs in
    // DISTRIBUTED_FULL_IDS too, but it must change this assertion on purpose
    // rather than inherit the claim.
    expect(DISTRIBUTED_FULL_IDS).toEqual(["vaConsumerBudget"]);
  });

  it("names the consequence for each control, not just its label", () => {
    const { capabilities } = runtimeCapabilities({ NODE_ENV: "production" });

    expect(capabilities.vaLiveIntegration.detail).toMatch(/shared rate-limit\/cache coordinator/);
    expect(capabilities.vaReferenceCache.detail).toMatch(/counters cannot move/);
    expect(capabilities.vaConsumerBudget.detail).toMatch(/VA_SHARED_CONSUMER_BUDGET=true/);
    expect(capabilities.rateLimit.detail).toMatch(/instance count/);
    expect(capabilities.circuitBreaker.detail).toMatch(/does not protect the others/);
  });

  it("separates controls that refuse from controls that degrade", () => {
    const { capabilities } = runtimeCapabilities({ NODE_ENV: "production" });
    const refusing = Object.values(capabilities)
      .filter((capability) => capability.behavior === "refuses")
      .map((capability) => capability.id)
      .sort();

    expect(refusing).toEqual(["vaConsumerBudget", "vaLiveIntegration", "vaReferenceCache"]);
  });

  it("exposes every scope through the summary map", () => {
    const { capabilities, summary } = runtimeCapabilities({ NODE_ENV: "production" });

    expect(summary.scopes).toEqual({
      vaLiveIntegration: "disabled",
      vaReferenceCache: "disabled",
      vaConsumerBudget: "unenforced",
      rateLimit: "per-instance",
      circuitBreaker: "per-instance",
    });
    for (const capability of Object.values(capabilities)) {
      expect(summary.scopes[capability.id]).toBe(capability.scope);
    }
  });
});

describe("GET /api/health surfaces the aggregate", () => {
  it("lists reduced capabilities and every scope, matching the per-control components", async () => {
    const { GET } = await import("@/app/api/health/route");

    vi.stubEnv("NODE_ENV", "production");
    // The consumer budget is enforced only with its opt-in and a coordinator, so
    // the distributed reading below is pinned to the unenforced one explicitly
    // rather than to whatever the shell happens to export.
    vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "");
    vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "");
    const production = await (await GET()).json();

    expect(production.components.runtime.distributed).toBe(true);
    expect([...production.components.runtime.reduced].sort()).toEqual(EXPECTED_IDS);
    expect(production.components.runtime.capabilities).toEqual({
      vaLiveIntegration: "disabled",
      vaReferenceCache: "disabled",
      vaConsumerBudget: "unenforced",
      rateLimit: "per-instance",
      circuitBreaker: "per-instance",
    });
    expect(production.components.runtime.detail).toMatch(/below full strength/);

    // The per-control components must read the same source as the aggregate, so a
    // health field cannot disagree with the report it came from.
    expect(production.components.rateLimit.scope).toBe(
      production.components.runtime.capabilities.rateLimit,
    );
    expect(production.components.vaReferenceCache.scope).toBe(
      production.components.runtime.capabilities.vaReferenceCache,
    );
    expect(production.components.vaConsumerBudget.scope).toBe(
      production.components.runtime.capabilities.vaConsumerBudget,
    );

    vi.stubEnv("NODE_ENV", "test");
    const singleProcess = await (await GET()).json();

    expect(singleProcess.components.runtime.distributed).toBe(false);
    expect(singleProcess.components.runtime.reduced).toEqual([]);
    expect(singleProcess.components.vaReferenceCache.scope).toBe("process-local");
    expect(singleProcess.components.rateLimit.scope).toBe("single-process");
  });
});
