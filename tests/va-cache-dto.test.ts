import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import { loadDisabilityReference } from "@/lib/va/disability-reference";
import { loadClaimFormReference } from "@/lib/va/form-reference";
import { loadVaFormsFinder } from "@/lib/va/forms-finder";
import { vaLiveStatus, vaProvenanceCopy } from "@/lib/va/provenance";
import { clearVaReferenceCache, hashedCacheKeySegment, readVaReferenceCache } from "@/lib/va/reference-cache";
import { VA_SHARED_CACHE_ENVELOPE_VERSION } from "@/lib/va/reference-shared-cache";
import { loadServiceBranchReference } from "@/lib/va/service-branches";
import { clearSharedSingleFlightStateForTests } from "@/lib/va/shared-single-flight";
import { createFakeSharedKv } from "./helpers/fake-shared-kv";

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
const repKey = `accredited-rep:sandbox:${hashedCacheKeySegment("90210:50:VSO")}`;
const formItem = {
  formName: query,
  title: "Application for Disability Compensation",
  url: "https://www.va.gov/find-forms/about-form-21-526ez/",
  lastRevisionOn: "2026-01-01",
  pages: 4,
  validPdf: true,
};
const repItem = {
  id: "rep-1",
  name: "Example VSO",
  accreditationType: "VSO",
  specializations: ["Claims"],
  zip: "20001", // Directory data, not the caller's ZIP.
  distanceMiles: 3,
  website: "https://vso.example.org/help",
};

interface LoaderCase {
  name: string;
  key: string;
  load: () => Promise<{ source: string }>;
  fetcher: ReturnType<typeof vi.fn>;
  view: () => Record<string, unknown>;
}
const loaders: LoaderCase[] = [
  {
    name: "forms finder", key: formsKey, load: () => loadVaFormsFinder(query), fetcher: mocks.forms,
    view: () => ({ ...vaLiveStatus("forms-finder", "sandbox", "va-sandbox-api"), lookupKey: formsKey, query: "", items: [formItem] }),
  },
  {
    name: "claim form", key: "forms-reference:sandbox", load: () => loadClaimFormReference(), fetcher: mocks.forms,
    view: () => ({ ...vaProvenanceCopy("form-reference", "sandbox"), source: "va-sandbox-api", formName: formItem.formName, title: formItem.title, url: formItem.url, lastRevisionOn: formItem.lastRevisionOn }),
  },
  {
    name: "disabilities", key: "disabilities:sandbox", load: () => loadDisabilityReference(), fetcher: mocks.disabilities,
    view: () => ({ ...vaLiveStatus("disability-reference", "sandbox", "va-sandbox-api"), items: [{ id: "1", name: "Migraine" }] }),
  },
  {
    name: "service branches", key: "service-branches:sandbox", load: () => loadServiceBranchReference(), fetcher: mocks.branches,
    view: () => ({ ...vaLiveStatus("service-branches", "sandbox", "va-sandbox-api"), items: [{ code: "ARMY", description: "Army" }] }),
  },
  {
    name: "representatives", key: repKey, load: () => loadAccreditedRepresentatives(params), fetcher: mocks.representatives,
    view: () => ({ ...vaLiveStatus("accredited-representatives", "sandbox", "va-sandbox-api"), lookupKey: repKey, params: { ...params, zip: "" }, items: [repItem] }),
  },
];

function envelope(value: unknown) {
  return JSON.stringify({ envelopeVersion: VA_SHARED_CACHE_ENVELOPE_VERSION, epoch: "0", value });
}

beforeEach(() => {
  clearVaReferenceCache();
  vi.stubEnv("NODE_ENV", "test");
  for (const marker of ["VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "FUNCTIONS_WORKER_RUNTIME", "K_SERVICE"]) vi.stubEnv(marker, "");
  vi.stubEnv("VA_API_ENABLED", "true");
  vi.stubEnv("VA_API_ENV", "sandbox");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_URL", "https://example.upstash.io");
  vi.stubEnv("VA_REFERENCE_SHARED_CACHE_TOKEN", "test-token");
  for (const fetcher of Object.values(mocks)) {
    fetcher.mockReset().mockResolvedValue({ success: false, data: null, source: "local-fallback", environment: "sandbox" });
  }
});

afterEach(() => {
  clearVaReferenceCache();
  clearSharedSingleFlightStateForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function useKv(loader: LoaderCase, candidate: unknown, contender = false) {
  const kv = createFakeSharedKv();
  if (contender) kv.seed(`va:ref:inflight:${loader.key}`, "other-instance", 60_000);
  else kv.seed(`va:ref:${loader.key}`, envelope(candidate));
  let reads = 0;
  vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => {
    const command = JSON.parse(String(init?.body)) as string[];
    if (command[0] === "MGET") {
      reads += 1;
      // Publish only after the initial miss and lease contention, so this
      // exercises awaitVaSharedFetchOutcome rather than the ordinary hit.
      if (contender && reads === 2) kv.seed(`va:ref:${loader.key}`, envelope(candidate));
    }
    return kv.respond(init);
  }));
  return kv;
}

for (const loader of loaders) {
  describe(`A04 ${loader.name} shared-cache DTO`, () => {
    for (const contender of [false, true]) {
      const path = contender ? "contender-published" : "ordinary shared";
      it(`accepts and promotes a valid ${path} hit without upstream work`, async () => {
        const candidate = loader.view();
        const kv = useKv(loader, candidate, contender);
        const view = await loader.load();
        expect(view.source).toBe("va-sandbox-api");
        expect(loader.fetcher).not.toHaveBeenCalled();
        expect(readVaReferenceCache(loader.key)).toEqual(candidate);
        if (loader.name !== "claim form") expect(view).toHaveProperty("cacheStatus", "hit");
        if (loader.name === "forms finder") expect(view).toHaveProperty("query", query);
        if (loader.name === "representatives") expect(view).toHaveProperty("params", params);
        expect(kv.executed.filter(([name]) => name === "MGET")).toHaveLength(contender ? 2 : 1);
      });

      it(`refetches instead of promoting a malformed ${path} DTO`, async () => {
        const candidate = { ...loader.view(), sourceLabel: "Forged label" };
        useKv(loader, candidate, contender);
        const view = await loader.load();
        expect(view.source).toBe("local-fallback");
        expect(loader.fetcher).toHaveBeenCalledTimes(1);
        expect(readVaReferenceCache(loader.key)).toBeNull();
      });
    }

    it("accepts a production DTO only in the matching environment", async () => {
      vi.stubEnv("VA_API_ENV", "production");
      // Synthetic gate configuration only: no production request is made.
      vi.stubEnv("VA_PRODUCTION_ACCESS_GRANTED", "true");
      vi.stubEnv("VA_FORMS_PRODUCTION_API_KEY", "synthetic-forms-key");
      vi.stubEnv("VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY", "synthetic-reference-key");
      vi.stubEnv("VA_ACCREDITED_REP_PRODUCTION_API_KEY", "synthetic-rep-key");
      const surface = ({ "forms finder": "forms-finder", "claim form": "form-reference", disabilities: "disability-reference", "service branches": "service-branches", representatives: "accredited-representatives" } as const)[loader.name as "forms finder" | "claim form" | "disabilities" | "service branches" | "representatives"];
      const key = loader.key.replace(":sandbox", ":production");
      const candidate = {
        ...loader.view(),
        ...vaProvenanceCopy(surface, "production"),
        source: "va-production-api",
        ...(loader.name === "claim form" ? {} : { environment: "production" }),
        ...(["forms finder", "representatives"].includes(loader.name) ? { lookupKey: key } : {}),
      };
      useKv({ ...loader, key }, candidate);
      expect((await loader.load()).source).toBe("va-production-api");
      expect(loader.fetcher).not.toHaveBeenCalled();
    });

    if (loader.name !== "claim form") {
      it("accepts its maximum item count with bounded fields", async () => {
        const candidate = loader.view();
        candidate.items = Array.from({ length: loader.name === "forms finder" ? 25 : 200 }, () => (candidate.items as unknown[])[0]);
        useKv(loader, candidate);
        expect((await loader.load()).source).toBe("va-sandbox-api");
        expect(loader.fetcher).not.toHaveBeenCalled();
      });
    }

    const invalid: Array<[string, (view: Record<string, unknown>) => Record<string, unknown>]> = [
      ["unknown top-level field", (view) => ({ ...view, unexpected: true })],
      ["wrong environment/source", (view) => ({ ...view, source: "va-production-api" })],
      ["wrong notice", (view) => ({ ...view, notice: "Not this loader's copy" })],
    ];
    if (loader.name === "claim form") {
      invalid.push(
        ["another form", (view) => ({ ...view, formName: "21-0966" })],
        ["object title", (view) => ({ ...view, title: {} })],
        ["overlong title", (view) => ({ ...view, title: "x".repeat(201) })],
        ["invalid revision date", (view) => ({ ...view, lastRevisionOn: "2026-02-31" })],
        ["credential URL", (view) => ({ ...view, url: "https://user:pass@www.va.gov/form" })],
      );
    } else {
      invalid.push(
        ["non-array items", (view) => ({ ...view, items: "NOT_AN_ARRAY" })],
        ["null item", (view) => ({ ...view, items: [null] })],
        ["missing item fields", (view) => ({ ...view, items: [{}] })],
        ["too many items", (view) => ({ ...view, items: Array.from({ length: loader.name === "forms finder" ? 26 : 201 }, () => (view.items as unknown[])[0]) })],
        ["invalid timestamp", (view) => ({ ...view, retrievedAt: "2026-02-31T00:00:00Z" })],
        ["missing timestamp", (view) => ({ ...view, retrievedAt: null })],
        ["invalid cache status", (view) => ({ ...view, cacheStatus: "fresh" })],
      );
      const itemPatch = (patch: object) => (view: Record<string, unknown>) => ({
        ...view, items: [{ ...(view.items as object[])[0], ...patch }],
      });
      if (loader.name === "forms finder") invalid.push(
        ["unredacted query", (view) => ({ ...view, query })],
        ["different query binding", (view) => ({ ...view, lookupKey: `forms-finder:sandbox:q:${hashedCacheKeySegment("other query")}` })],
        ["missing query binding", (view) => { const result = { ...view }; delete result.lookupKey; return result; }],
        ["object title", itemPatch({ title: {} })],
        ["overlong title", itemPatch({ title: "x".repeat(201) })],
        ["overlong URL", itemPatch({ url: `https://www.va.gov/${"x".repeat(2_048)}` })],
        ["invalid revision", itemPatch({ lastRevisionOn: "not-a-date" })],
        ["fractional pages", itemPatch({ pages: 1.5 })],
        ["too many pages", itemPatch({ pages: 1_001 })],
        ["non-boolean validPdf", itemPatch({ validPdf: "true" })],
        ["untrusted URL", itemPatch({ url: "javascript:alert(1)" })],
      );
      if (loader.name === "disabilities") invalid.push(
        ["object name", itemPatch({ name: {} })],
        ["overlong name", itemPatch({ name: "x".repeat(201) })],
        ["non-numeric id", itemPatch({ id: "migraine" })],
        ["numeric rather than string id", itemPatch({ id: 1 })],
        ["empty items", (view) => ({ ...view, items: [] })],
      );
      if (loader.name === "service branches") invalid.push(
        ["object description", itemPatch({ description: {} })],
        ["overlong code", itemPatch({ code: "x".repeat(51) })],
        ["overlong description", itemPatch({ description: "x".repeat(201) })],
        ["empty items", (view) => ({ ...view, items: [] })],
      );
      if (loader.name === "representatives") invalid.push(
        ["different ZIP binding", (view) => ({ ...view, lookupKey: `accredited-rep:sandbox:${hashedCacheKeySegment("10001:50:VSO")}` })],
        ["missing ZIP binding", (view) => { const result = { ...view }; delete result.lookupKey; return result; }],
        ["unredacted ZIP", (view) => ({ ...view, params })],
        ["wrong radius", (view) => ({ ...view, params: { ...params, zip: "", radiusMiles: 25 } })],
        ["wrong type", (view) => ({ ...view, params: { ...params, zip: "", type: "attorney" } })],
        ["extra param", (view) => ({ ...view, params: { ...params, zip: "", injected: true } })],
        ["overlong name", itemPatch({ name: "x".repeat(201) })],
        ["object name", itemPatch({ name: {} })],
        ["bad accreditation", itemPatch({ accreditationType: "lawyer" })],
        ["bad directory ZIP", itemPatch({ zip: "9021" })],
        ["negative distance", itemPatch({ distanceMiles: -1 })],
        ["too many specializations", itemPatch({ specializations: Array(21).fill("Claims") })],
        ["overlong specialization", itemPatch({ specializations: ["x".repeat(201)] })],
        ["unknown provider field", itemPatch({ extra: { href: "https://example.org" } })],
        ["insecure website", itemPatch({ website: "http://vso.example.org" })],
      );
    }
    for (const contender of [false, true]) {
      it.each(invalid)(`rejects %s on the ${contender ? "contender" : "shared-hit"} path without promotion`, async (_name, mutate) => {
        useKv(loader, mutate(loader.view()), contender);
        expect((await loader.load()).source).toBe("local-fallback");
        expect(loader.fetcher).toHaveBeenCalledTimes(1);
        expect(readVaReferenceCache(loader.key)).toBeNull();
      });
    }

    it("round-trips its own fresh view through the shared DTO", async () => {
      const data = loader.name === "representatives" ? { data: [repItem] }
        : loader.name === "disabilities" ? { items: [{ id: 1, name: "Migraine" }] }
          : loader.name === "service branches" ? { items: [{ code: "ARMY", description: "Army", providerExtra: "not part of the cache DTO" }] }
            : { data: [{ attributes: { form_name: formItem.formName, title: formItem.title, url: formItem.url, last_revision_on: formItem.lastRevisionOn, pages: formItem.pages, valid_pdf: formItem.validPdf } }] };
      loader.fetcher.mockResolvedValue({ success: true, source: "va-sandbox-api", environment: "sandbox", data });
      const kv = createFakeSharedKv();
      vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
      expect((await loader.load()).source).toBe("va-sandbox-api");
      expect(kv.get(`va:ref:${loader.key}`)).not.toBeNull();
      clearVaReferenceCache();
      expect((await loader.load()).source).toBe("va-sandbox-api");
      expect(loader.fetcher).toHaveBeenCalledTimes(1);
    });
  });
}

it("binds omitted radius/type to the same effective params without caching the ZIP", async () => {
  mocks.representatives.mockResolvedValue({ success: true, source: "va-sandbox-api", environment: "sandbox", data: { data: [repItem] } });
  const kv = createFakeSharedKv();
  vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init?: RequestInit) => kv.respond(init)));
  const defaultParams = { zip: "90210" };
  await loadAccreditedRepresentatives(defaultParams);
  clearVaReferenceCache();
  const hit = await loadAccreditedRepresentatives({ ...defaultParams, radiusMiles: 50 });
  expect(hit.cacheStatus).toBe("hit");
  expect(mocks.representatives).toHaveBeenCalledTimes(1);
  const key = `va:ref:accredited-rep:sandbox:${hashedCacheKeySegment("90210:50:any")}`;
  const stored = String(kv.get(key));
  expect(stored).not.toContain("90210");
  expect(JSON.parse(stored).value.params).toEqual({ zip: "", radiusMiles: 50 });
});
