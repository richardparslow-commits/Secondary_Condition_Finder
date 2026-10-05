import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOMATIC_TRACE_EXPORT } from "@/lib/observability/telemetry-policy";
import {
  clearAccreditedRepresentativeCache,
  loadAccreditedRepresentatives,
} from "@/lib/va/accredited-representatives";
import { clearCircuitBreakerState } from "@/lib/va/circuit-breaker";
import { clearVaFormsFinderCache, loadVaFormsFinder } from "@/lib/va/forms-finder";
import {
  clearVaReferenceCache,
  hashedCacheKeySegment,
} from "@/lib/va/reference-cache";
import { clearVaApiOutboundRateLimitState } from "@/lib/va/sandbox";
import { clearSharedCircuitStateForTests } from "@/lib/va/shared-circuit";

const KV_HOST = "https://kv.example.test";

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function stubDistributedEnv(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", KV_HOST);
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "test-token");
  vi.stubEnv("VA_SHARED_CONSUMER_BUDGET", "true");
  vi.stubEnv("VA_FORMS_SANDBOX_API_KEY", "forms-key");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
  vi.stubEnv("VA_ACCREDITED_REP_SANDBOX_API_KEY", "rep-key");
}

/** Routes KV commands to a permissive fake and upstream requests to a payload. */
function stubDistributedKv(options: { upstreamPayload: unknown }): string[][] {
  const commands: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const href = String(input);
      if (href.startsWith(KV_HOST)) {
        const command = JSON.parse(String(init?.body ?? "[]")) as string[];
        commands.push(command);
        if (command[0] === "GET") return okJson({ result: null });
        if (command[0] === "MGET") {
          // [epoch, cached value] — no invalidation marker, no cached value
          return okJson({ result: command.slice(1).map(() => null) });
        }
        if (command[0] === "INCR") return okJson({ result: 1 });
        return okJson({ result: "OK" });
      }
      return okJson(options.upstreamPayload);
    }),
  );
  return commands;
}

function applicationSourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(path);
      }
    }
  };
  walk(join(process.cwd(), "src"));
  return files;
}

beforeEach(() => {
  clearVaReferenceCache();
  clearVaFormsFinderCache();
  clearAccreditedRepresentativeCache();
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
});

afterEach(() => {
  clearVaReferenceCache();
  clearVaFormsFinderCache();
  clearAccreditedRepresentativeCache();
  clearCircuitBreakerState();
  clearVaApiOutboundRateLimitState();
  clearSharedCircuitStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("automatic trace export policy (audit A-04)", () => {
  it("keeps automatic trace export disabled with a recorded reason", () => {
    expect(AUTOMATIC_TRACE_EXPORT.enabled).toBe(false);
    expect(AUTOMATIC_TRACE_EXPORT.status).toBe("disabled-pending-review");
    expect(AUTOMATIC_TRACE_EXPORT.reason).toMatch(/span|collector/i);
  });

  it("registers no OTel SDK, so a canary span cannot record or export attributes", () => {
    const span = trace.getTracer("telemetry-canary").startSpan("canary", {
      attributes: {
        "http.url":
          "https://example.test/va-forms/finder?query=CANARY-QUERY-90210",
      },
    });
    try {
      // With no SDK provider the global API returns a non-recording span; if a
      // provider is ever registered, this canary fails before any attribute can
      // be exported.
      expect(span.isRecording()).toBe(false);
      expect(span.spanContext().traceId).toBe("0".repeat(32));
    } finally {
      span.end();
    }
  });

  it("never imports @vercel/otel or calls registerOTel from application source", () => {
    const offenders = applicationSourceFiles().filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        /registerOTel\s*\(/.test(source) ||
        /from\s+["']@vercel\/otel["']/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });
});

describe("VA reference cache keys — no raw query/ZIP key material", () => {
  it("hashes the user-supplied cache-key segment deterministically", () => {
    const digest = hashedCacheKeySegment("hemochromatosis");
    expect(digest).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toBe(hashedCacheKeySegment("hemochromatosis"));
    expect(digest).not.toContain("hemochromatosis");
    expect(hashedCacheKeySegment("90210")).not.toContain("90210");
  });

  it("never writes the raw forms query into KV key material", async () => {
    stubDistributedEnv();
    const commands = stubDistributedKv({ upstreamPayload: { data: [] } });

    const view = await loadVaFormsFinder("hemochromatosis 90210");
    expect(view.live).toBe(true);

    // The shared write is best-effort (`void`ed by the cache access layer) and
    // reads the invalidation epoch before writing, so wait for the SET to land
    // rather than assuming it completed with the loader.
    const setKeys = () =>
      commands
        .filter((command) => command[0] === "SET")
        .map((command) => String(command[1] ?? ""));
    await vi.waitFor(() =>
      expect(
        setKeys().some((key) => key.startsWith("va:ref:forms-finder:")),
      ).toBe(true),
    );
    for (const key of setKeys()) {
      expect(key).not.toContain("hemochromatosis");
      expect(key).not.toContain("90210");
    }
    // Reads are keyed the same way (MGET sends the epoch key + value key), so
    // no command key carries the raw query.
    for (const command of commands) {
      if (command[0] === "GET" || command[0] === "SET") {
        expect(String(command[1] ?? "")).not.toContain("hemochromatosis");
      }
      if (command[0] === "MGET") {
        for (const key of command.slice(1)) {
          expect(String(key ?? "")).not.toContain("hemochromatosis");
        }
      }
    }
  });

  it("never writes the raw ZIP into KV key material for the locator", async () => {
    stubDistributedEnv();
    const commands = stubDistributedKv({ upstreamPayload: { data: [] } });

    await loadAccreditedRepresentatives({ zip: "90210" });

    const setKeys = () =>
      commands
        .filter((command) => command[0] === "SET")
        .map((command) => String(command[1] ?? ""));
    await vi.waitFor(() =>
      expect(
        setKeys().some((key) => key.startsWith("va:ref:accredited-rep:")),
      ).toBe(true),
    );
    for (const key of setKeys()) {
      expect(key).not.toContain("90210");
    }
  });
});
