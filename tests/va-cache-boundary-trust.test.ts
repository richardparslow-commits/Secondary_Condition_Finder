import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import {
  accreditedRepresentativeCacheDto,
  claimFormReferenceCacheDto,
  formsFinderCacheDto,
} from "@/lib/va/cached-view-guard";
import { loadDisabilityReference } from "@/lib/va/disability-reference";
import { loadClaimFormReference } from "@/lib/va/form-reference";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import { vaLiveStatus, vaProvenanceCopy } from "@/lib/va/provenance";
import {
  clearVaReferenceCache,
  hashedCacheKeySegment,
  readVaReferenceCache,
  writeVaReferenceCache,
} from "@/lib/va/reference-cache";
import {
  readVaSharedReferenceCache,
  VA_SHARED_CACHE_ENVELOPE_VERSION,
  VA_SHARED_CACHE_MAX_REPLY_BYTES,
  VA_SHARED_CACHE_REPLY_RESERVE_BYTES,
  vaSharedCacheReplyBytes,
  writeVaSharedReferenceCache,
} from "@/lib/va/reference-shared-cache";
import { loadServiceBranchReference } from "@/lib/va/service-branches";
import { clearSharedSingleFlightStateForTests } from "@/lib/va/shared-single-flight";
import { createFakeSharedKv } from "./helpers/fake-shared-kv";

/**
 * A04, the boundaries the shared-read DTO slice left open:
 *
 *   1. a **process-local** hit was served without the loader's DTO;
 *   2. a **freshly loaded** view was written to both tiers without it, so the
 *      same value could be served as live and rejected as a cached candidate by
 *      the next request;
 *   3. link policy was one rule — credential-free HTTPS, any host — where the
 *      surface's own data is VA-hosted;
 *   4. the shared write budget (256 KiB) was four times the read budget
 *      (64 KiB), so a value in between was stored successfully and then missed
 *      forever.
 *
 * These tests exercise the real loaders through `withVaReferenceCache`, the real
 * shared-envelope reader, and the real Redis-REST command shapes.
 */

const mocks = vi.hoisted(() => ({
  forms: vi.fn(),
  disabilities: vi.fn(),
  branches: vi.fn(),
  representatives: vi.fn(),
}));
vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: mocks.forms,
  fetchVaDisabilityReference: mocks.disabilities,
  fetchVaServiceBranches: mocks.branches,
  fetchVaAccreditedRepresentatives: mocks.representatives,
}));

const query = "21-526EZ";
const params = { zip: "90210", radiusMiles: 50, type: "VSO" } as const;
const formsKey = `forms-finder:sandbox:q:${hashedCacheKeySegment(query.toLowerCase())}`;
const claimFormKey = "forms-reference:sandbox";
const repKey = `accredited-rep:sandbox:${hashedCacheKeySegment("90210:50:VSO")}`;
const vaFormUrl = "https://www.va.gov/find-forms/about-form-21-526ez/";
const offHostUrl = "https://collect.example.org/form.pdf";

const formAttributes = {
  form_name: query,
  title: "Application for Disability Compensation",
  url: vaFormUrl,
  last_revision_on: "2026-01-01",
  pages: 4,
  valid_pdf: true,
};
const repItem = {
  id: "rep-1",
  name: "Example VSO",
  accreditationType: "VSO" as const,
  specializations: ["Claims"],
  zip: "20001",
  distanceMiles: 3,
  // A VSO's own site: legitimately outside va.gov, so the directory keeps the
  // credential-free-HTTPS rule rather than the VA-host rule.
  website: "https://vso.example.org/help",
};

interface BoundaryCase {
  name: string;
  key: string;
  load: () => Promise<{ source: string }>;
  fetcher: ReturnType<typeof vi.fn>;
  /** Upstream payload whose fresh view satisfies the loader DTO. */
  withinBounds: () => unknown;
  /** Upstream payload whose fresh view violates it. */
  outOfBounds: () => unknown;
  /** A process-local entry the loader DTO rejects but a caller could have written. */
  forgedLocal: () => Record<string, unknown>;
}

const live = (surface: Parameters<typeof vaLiveStatus>[0]) =>
  vaLiveStatus(surface, "sandbox", "va-sandbox-api");

const cases: BoundaryCase[] = [
  {
    name: "forms finder",
    key: formsKey,
    load: () => loadVaFormsFinder(query),
    fetcher: mocks.forms,
    withinBounds: () => ({ data: [{ attributes: { ...formAttributes } }] }),
    outOfBounds: () => ({ data: [{ attributes: { ...formAttributes, url: offHostUrl } }] }),
    forgedLocal: () => ({
      ...live("forms-finder"),
      lookupKey: formsKey,
      query: "",
      // An off-host link: the pre-A04 guard accepted any credential-free HTTPS.
      items: [{ formName: query, title: "t", url: offHostUrl, lastRevisionOn: null, pages: null, validPdf: null }],
    }),
  },
  {
    name: "claim form",
    key: claimFormKey,
    load: () => loadClaimFormReference(),
    fetcher: mocks.forms,
    withinBounds: () => ({ data: [{ attributes: { ...formAttributes } }] }),
    outOfBounds: () => ({ data: [{ attributes: { ...formAttributes, url: offHostUrl } }] }),
    forgedLocal: () => ({
      source: "va-sandbox-api",
      ...vaProvenanceCopy("form-reference", "sandbox"),
      formName: query,
      title: "Application for Disability Compensation",
      url: offHostUrl,
      lastRevisionOn: null,
    }),
  },
  {
    name: "disabilities",
    key: "disabilities:sandbox",
    load: () => loadDisabilityReference(),
    fetcher: mocks.disabilities,
    withinBounds: () => ({ items: [{ id: 1, name: "Migraine" }] }),
    outOfBounds: () => ({ items: [{ id: 1, name: "x".repeat(201) }] }),
    forgedLocal: () => ({
      ...live("disability-reference"),
      items: [{ id: "1", name: "Migraine" }],
      // The pre-A04 guard tolerated a non-null unparseable timestamp too.
      retrievedAt: "not-a-date",
    }),
  },
  {
    name: "service branches",
    key: "service-branches:sandbox",
    load: () => loadServiceBranchReference(),
    fetcher: mocks.branches,
    withinBounds: () => ({ items: [{ code: "ARMY", description: "Army" }] }),
    outOfBounds: () => ({ items: [{ code: "x".repeat(51), description: "Army" }] }),
    forgedLocal: () => ({
      ...live("service-branches"),
      items: [null],
    }),
  },
  {
    name: "representatives",
    key: repKey,
    load: () => loadAccreditedRepresentatives(params),
    fetcher: mocks.representatives,
    withinBounds: () => ({ data: [{ ...repItem }] }),
    outOfBounds: () => ({ data: [{ ...repItem, name: "x".repeat(201) }] }),
    forgedLocal: () => ({
      ...live("accredited-representatives"),
      lookupKey: repKey,
      params,
      items: [{ ...repItem }],
    }),
  },
];

function stubSharedKvEnv(): void {
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "test-token");
}

beforeEach(() => {
  clearVaReferenceCache();
  clearSharedSingleFlightStateForTests();
  vi.stubEnv("NODE_ENV", "test");
  for (const marker of ["VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "FUNCTIONS_WORKER_RUNTIME", "K_SERVICE"]) {
    vi.stubEnv(marker, "");
  }
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
  for (const fetcher of Object.values(mocks)) {
    fetcher.mockReset().mockResolvedValue({
      success: false,
      data: null,
      source: "local-fallback",
      environment: "sandbox",
    });
  }
});

afterEach(() => {
  clearVaReferenceCache();
  clearSharedSingleFlightStateForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

for (const testCase of cases) {
  describe(`A04 ${testCase.name} trust at the process-local tier`, () => {
    it("drops a process-local entry its own DTO rejects instead of serving it as live", async () => {
      writeVaReferenceCache(testCase.key, testCase.forgedLocal());
      expect(readVaReferenceCache(testCase.key)).not.toBeNull();
      // Upstream is unavailable for this case, so nothing can repopulate the
      // tier: an entry that survived would be the rejected value still being
      // served. No shared coordinator is configured, so no request leaves the
      // process either.
      const upstream = vi.fn();
      vi.stubGlobal("fetch", upstream);

      const view = await testCase.load();

      expect(view.source).toBe("local-fallback");
      expect(testCase.fetcher).toHaveBeenCalledTimes(1);
      expect(readVaReferenceCache(testCase.key)).toBeNull();
      expect(upstream).not.toHaveBeenCalled();
    });

    it("serves a process-local entry its own fresh write produced, without upstream work", async () => {
      testCase.fetcher.mockResolvedValue({
        success: true,
        source: "va-sandbox-api",
        environment: "sandbox",
        data: testCase.withinBounds(),
      });
      expect((await testCase.load()).source).toBe("va-sandbox-api");
      expect(readVaReferenceCache(testCase.key)).not.toBeNull();

      // The write and the read now share one rule: a DTO that rejected the
      // loader's own output would force a second upstream call here.
      testCase.fetcher.mockReset();
      expect((await testCase.load()).source).toBe("va-sandbox-api");
      expect(testCase.fetcher).not.toHaveBeenCalled();
    });
  });

  describe(`A04 ${testCase.name} trust for fresh views`, () => {
    it("degrades to the labelled fallback and caches nothing when upstream is out of bounds", async () => {
      const kv = createFakeSharedKv();
      stubSharedKvEnv();
      vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
      testCase.fetcher.mockResolvedValue({
        success: true,
        source: "va-sandbox-api",
        environment: "sandbox",
        data: testCase.outOfBounds(),
      });

      const view = await testCase.load();

      expect(view.source).toBe("local-fallback");
      expect(readVaReferenceCache(testCase.key)).toBeNull();
      expect(kv.get(`va:ref:${testCase.key}`)).toBeNull();
      // The refused write issues no value SET at all: size/admission work is not
      // spent persisting a value no reader would accept. (A `SET` on the
      // single-flight lease key is coordination, not a cached view.)
      expect(
        kv.executed.filter(([command, key]) => command === "SET" && key === `va:ref:${testCase.key}`),
      ).toHaveLength(0);
    });
  });
}

it("discloses a rejected fresh view as an operational signal without echoing the value", async () => {
  const logged: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map((arg) => String(arg)).join(" "));
  });
  const kv = createFakeSharedKv();
  stubSharedKvEnv();
  vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
  mocks.forms.mockResolvedValue({
    success: true,
    source: "va-sandbox-api",
    environment: "sandbox",
    data: { data: [{ attributes: { ...formAttributes, url: offHostUrl } }] },
  });

  expect((await loadVaFormsFinder(query)).source).toBe("local-fallback");

  const sink = logged.join("\n");
  // Silent degradation was the defect: an operator has to be able to tell a
  // refused view from an upstream outage. The logger emits reviewed field
  // values (its message text is replaced by the telemetry policy), so the
  // outcome code is the signal to assert on.
  expect(sink).toContain('"outcome":"fresh-view-rejected"');
  expect(sink).toContain("va-reference-cache");
  // ...and the disclosure stays operational-only: no cached value, no rejected
  // URL, no search text.
  expect(sink).not.toContain(offHostUrl);
  expect(sink).not.toContain(query);
});

describe("A04 loader-specific link rules", () => {
  it("requires VA-hosted form links on the VA Forms surfaces", () => {
    const dto = formsFinderCacheDto("sandbox", formsKey);
    const item = {
      formName: query,
      title: "Application for Disability Compensation",
      url: vaFormUrl,
      lastRevisionOn: "2026-01-01",
      pages: 4,
      validPdf: true,
    };
    const view = (url: string) => ({
      ...live("forms-finder"),
      lookupKey: formsKey,
      query: "",
      items: [{ ...item, url }],
    });
    expect(dto.safeParse(view(vaFormUrl)).success).toBe(true);
    expect(dto.safeParse(view("https://www.vba.va.gov/pubs/forms/VBA-21-526EZ-ARE.pdf")).success).toBe(true);
    for (const url of [offHostUrl, "https://notva.gov.evil.example/x", "https://va.gov.attacker.example/x"]) {
      expect(dto.safeParse(view(url)).success).toBe(false);
    }

    const claimForm = claimFormReferenceCacheDto("sandbox");
    const claimFormView = (url: string) => ({
      source: "va-sandbox-api",
      ...vaProvenanceCopy("form-reference", "sandbox"),
      formName: query,
      title: "Application for Disability Compensation",
      url,
      lastRevisionOn: null,
    });
    expect(claimForm.safeParse(claimFormView(vaFormUrl)).success).toBe(true);
    expect(claimForm.safeParse(claimFormView(offHostUrl)).success).toBe(false);
  });

  it("keeps a representative's own external site acceptable (a VSO is not VA-hosted)", () => {
    const dto = accreditedRepresentativeCacheDto("sandbox", repKey, params);
    const view = (website: string) => ({
      ...live("accredited-representatives"),
      lookupKey: repKey,
      params: { zip: "", radiusMiles: 50, type: "VSO" },
      items: [{ ...repItem, website }],
    });
    expect(dto.safeParse(view("https://vso.example.org/help")).success).toBe(true);
    // Still credential-free HTTPS only: scheme, credentials, and shape hold.
    for (const website of ["http://vso.example.org/help", "https://user:pass@vso.example.org/help", "javascript:alert(1)"]) {
      expect(dto.safeParse(view(website)).success).toBe(false);
    }
  });
});

describe("A04 shared-store envelope alignment", () => {
  const budget = VA_SHARED_CACHE_MAX_REPLY_BYTES - VA_SHARED_CACHE_REPLY_RESERVE_BYTES;

  /** Largest `x` filler whose projected reply still fits the write budget. */
  function largestFittingFiller(): number {
    let low = 0;
    let high = VA_SHARED_CACHE_MAX_REPLY_BYTES;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const bytes = vaSharedCacheReplyBytes({ live: true, filler: "x".repeat(mid) });
      if (bytes !== null && bytes <= budget) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  it("measures the reply a reader parses, not the raw value", () => {
    // The reply wraps the envelope as a JSON string, so quotes and backslashes
    // inside it are escaped again: the stored bytes understate the reply.
    const value = { live: true, quoted: '"'.repeat(64) };
    const stored = Buffer.byteLength(
      JSON.stringify({ envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION, epoch: "0", value }),
      "utf8",
    );
    expect(vaSharedCacheReplyBytes(value)).toBeGreaterThan(stored);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(vaSharedCacheReplyBytes(circular)).toBeNull();
  });

  it("writes and reads back the largest value that fits its own read budget", async () => {
    const filler = largestFittingFiller();
    const fitting = { live: true, filler: "x".repeat(filler) };
    const bytes = vaSharedCacheReplyBytes(fitting);
    // Guard the search itself: the fitting value must be near the budget, and
    // one byte more must not fit — otherwise this test proves nothing.
    expect(bytes).not.toBeNull();
    expect(bytes!).toBeLessThanOrEqual(budget);
    expect(bytes!).toBeGreaterThan(budget - 64);
    expect(vaSharedCacheReplyBytes({ live: true, filler: "x".repeat(filler + 1) })!).toBeGreaterThan(budget);

    const kv = createFakeSharedKv();
    stubSharedKvEnv();
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
    await writeVaSharedReferenceCache("forms:sandbox:envelope-max", fitting, 300_000);

    expect(kv.executed.map(([command]) => command)).toContain("SET");
    await expect(readVaSharedReferenceCache("forms:sandbox:envelope-max")).resolves.toEqual(fitting);
  });

  it("refuses a value whose reply exceeds the read budget, so nothing unreadable is stored", async () => {
    const overflow = { live: true, filler: "x".repeat(largestFittingFiller() + 1) };
    const kv = createFakeSharedKv();
    stubSharedKvEnv();
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));

    await writeVaSharedReferenceCache("forms:sandbox:envelope-over", overflow);

    expect(kv.executed.map(([command]) => command)).not.toContain("SET");
    expect(kv.get("va:ref:forms:sandbox:envelope-over")).toBeNull();
    await expect(readVaSharedReferenceCache("forms:sandbox:envelope-over")).resolves.toBeNull();
  });

  it("still bounds a hostile reply that was not written by this client", async () => {
    const kv = createFakeSharedKv();
    stubSharedKvEnv();
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
    kv.seed(
      "va:ref:forms:sandbox:hostile",
      JSON.stringify({
        envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION,
        epoch: "0",
        value: { live: true, filler: "x".repeat(VA_SHARED_CACHE_MAX_REPLY_BYTES) },
      }),
    );

    await expect(readVaSharedReferenceCache("forms:sandbox:hostile")).resolves.toBeNull();
  });
});
