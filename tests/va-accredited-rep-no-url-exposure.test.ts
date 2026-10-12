/**
 * Audit A01 — the accredited-representative locator's ZIP must not travel in a
 * URL.
 *
 * The finding: the locator's Server Action **redirected** with
 * `{returnTo}?zip=&radiusMiles=&type=`, so the ZIP a visitor typed was written
 * into the address bar, browser history, any copied link, and the hosting/edge
 * request line for the navigation. That the lookup is public directory data was
 * never the same property as "the ZIP does not appear in a URL".
 *
 * These are the contracts that make the fix checkable:
 *
 *   1. the hosting pages read no lookup query parameter and build no lookup URL;
 *   2. the search is a Server Action whose input goes through the PHI-free
 *      contract, and a refusal never echoes the submitted value or key;
 *   3. a successful search still returns display state (the visitor's own
 *      browser may show their ZIP back to them — that is not a leak) and still
 *      sends the ZIP upstream, which is explicitly recorded as the remaining
 *      exposure rather than claimed closed;
 *   4. our own log sinks never receive the ZIP.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchAccreditedRepresentatives } from "@/lib/actions/accredited-representatives";
import type { AccreditedRepSearchState } from "@/lib/va/accredited-rep-search";

const START_STATE: AccreditedRepSearchState = { view: null, error: null };

const CANARY = "CANARY-QUERY-90210";

const { fetchAccreditedRepMock, auditLogMock } = vi.hoisted(() => ({
  fetchAccreditedRepMock: vi.fn(),
  auditLogMock: vi.fn(),
}));

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaAccreditedRepresentatives: fetchAccreditedRepMock,
}));

vi.mock("@/lib/observability/audit", () => ({ auditLog: auditLogMock }));

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function searchForm(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  fetchAccreditedRepMock.mockReset();
  fetchAccreditedRepMock.mockResolvedValue({ success: false });
  auditLogMock.mockReset();
  // Disabled by default: the lookup then returns the labelled local fallback
  // without any network call, which is what most of these cases are about.
  vi.stubEnv("VA_API_ENABLED", "");
  vi.stubEnv("VA_SANDBOX_ENABLED", "");
  vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("locator search is not URL-borne (A01)", () => {
  it("keeps the lookup out of every hosting page's URL surface", () => {
    const hosts = [
      "src/app/secondary/suggestions/page.tsx",
      "src/app/secondary/evidence/page.tsx",
      "src/app/presumptive/results/page.tsx",
    ];

    // `regSnapshot` is the workflow's own locked regulatory snapshot and is the
    // only query value these shells may read; a lookup field read here would be
    // exactly the transport this fix removed.
    const sanctionedQueryKeys = new Set(["regSnapshot"]);

    for (const host of hosts) {
      const page = read(host);
      expect(page, `${host} must not parse a URL`).not.toContain("URLSearchParams");
      expect(page, `${host} must not load the directory view`).not.toContain(
        "loadAccreditedRepresentatives",
      );
      // A `?zip=` URL from an old bookmark, a copied link, or the pre-fix
      // redirect is inert rather than a second transport.
      for (const match of page.matchAll(/(?:searchParams|queryParams)\??\.([A-Za-z]+)/g)) {
        expect(
          sanctionedQueryKeys.has(match[1]),
          `${host} reads ?${match[1]} from the URL`,
        ).toBe(true);
      }
    }

    // And nothing in the rendered surface may synthesise a URL from the lookup.
    const component = read("src/components/va/AccreditedRepresentativeFinder.tsx");
    for (const forbidden of [
      "router.push",
      "router.replace",
      "window.location",
      "history.pushState",
      "history.replaceState",
      "URLSearchParams",
      "method=\"get\"",
    ]) {
      expect(component, `locator surface must not use ${forbidden}`).not.toContain(
        forbidden,
      );
    }
    expect(component).toContain('name="zip"');
    expect(component).toContain('name="radiusMiles"');
    expect(component).toContain('name="type"');
  });

  it("keeps every non-function export out of the Server Action module", () => {
    // Discovered in the browser for the Forms Finder, not in unit tests: a
    // Server Action module is replaced by an action reference in the client
    // graph, so importing its constants or state type type-checks and then
    // answers 500. The locator follows the same split.
    const action = read("src/lib/actions/accredited-representatives.ts");
    const component = read("src/components/va/AccreditedRepresentativeFinder.tsx");

    expect(action).not.toMatch(/^export (const|interface|type) /m);
    expect(component).toContain('from "@/lib/va/accredited-rep-search"');
    expect(component).toContain('from "@/lib/va/accredited-representative-constants"');
    // A redirect is a URL: the action must return its result, never build one.
    expect(action).not.toContain("redirect(");
    expect(action).not.toContain("URLSearchParams");
    expect(action).not.toMatch(/^import .*next\/navigation/m);
  });

  it("routes the lookup through the PHI-free Server Action contract", () => {
    const action = read("src/lib/actions/accredited-representatives.ts");

    expect(action).toContain('"use server"');
    expect(action).toContain("sanitizeActionInput(");
    expect(action).toContain("phiFreeActionInput(");
    // The whole POST body is checked for PHI-shaped names, not only the fields
    // the action reads.
    expect(action).toContain("findPhiInputField(formData.keys())");
  });

  it("returns the directory view as state and sends the ZIP upstream only through the loader", async () => {
    vi.stubEnv("VA_API_ENABLED", "true");
    vi.stubEnv("VA_ACCREDITED_REP_ENABLED", "true");
    fetchAccreditedRepMock.mockResolvedValue({
      success: true,
      source: "va-sandbox-api",
      data: {
        data: [
          {
            id: "rep-1",
            name: "Jane Representative",
            accreditationType: "VSO",
            zip: "22101",
            distanceMiles: 1.2,
          },
        ],
      },
    });

    const state = await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({
        zip: "22101",
        radiusMiles: "50",
        type: "VSO",
        returnTo: "/secondary/suggestions",
      }),
    );

    expect(state.error).toBeNull();
    // The loader re-attaches the requested params for display; the visitor's own
    // browser showing them their lookup back is not an exposure.
    expect(state.view?.params.zip).toBe("22101");
    expect(state.view?.items).toHaveLength(1);
    expect(state.view?.live).toBe(true);
    // Synthetic evidence for the remaining (documented) exposure: the loader
    // still passes the ZIP to the VA adapter. This is the upstream half, not
    // the URL half.
    expect(fetchAccreditedRepMock).toHaveBeenCalledTimes(1);
    expect(fetchAccreditedRepMock.mock.calls[0][0]).toMatchObject({
      zip: "22101",
      radiusMiles: 50,
      type: "VSO",
    });
  });

  it("attributes the audit event to an allowlisted page and never to a caller URL", async () => {
    await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({
        zip: "22101",
        returnTo: `https://attacker.example.invalid/${CANARY}`,
      }),
    );

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const [action, fields] = auditLogMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(action).toBe("accredited-rep-search");
    // An unvalidated `returnTo` would write attacker text into the audit log,
    // so the allowlist still applies even though the value no longer builds a
    // URL.
    expect(fields.route).toBe("/secondary/suggestions");
    expect(JSON.stringify(fields)).not.toContain(CANARY);
    expect(JSON.stringify(fields)).not.toContain("22101");
  });

  it("refuses a malformed ZIP with a fixed code and no network use", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    const state = await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({ zip: "CANARY1" }),
    );

    expect(state).toEqual({ view: null, error: "invalid-zip" });
    expect(fetchAccreditedRepMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
    // Nothing in the returned state or on a sink can be read back as the input.
    expect(JSON.stringify(state)).not.toContain(CANARY);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(CANARY);
    }
  });

  it("refuses an out-of-vocabulary radius or type without a network call", async () => {
    await expect(
      searchAccreditedRepresentatives(
        START_STATE,
        searchForm({ zip: "22101", radiusMiles: "9999" }),
      ),
    ).resolves.toEqual({ view: null, error: "invalid-radius" });
    await expect(
      searchAccreditedRepresentatives(
        START_STATE,
        searchForm({ zip: "22101", type: "notary" }),
      ),
    ).resolves.toEqual({ view: null, error: "invalid-type" });
    expect(fetchAccreditedRepMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("refuses a PHI-shaped field name or an oversized value without echoing either", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    const phiShaped = await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({ zip: "22101", ssn: CANARY }),
    );
    expect(phiShaped).toEqual({ view: null, error: "refused" });

    const oversized = await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({ zip: "22101", returnTo: `/${"x".repeat(200)}${CANARY}` }),
    );
    expect(oversized).toEqual({ view: null, error: "refused" });

    for (const state of [phiShaped, oversized]) {
      expect(JSON.stringify(state)).not.toContain(CANARY);
    }
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(CANARY);
    }
    expect(fetchAccreditedRepMock).not.toHaveBeenCalled();
  });

  it("still answers the disabled path with the labelled local fallback and its OGC guidance", async () => {
    const state = await searchAccreditedRepresentatives(
      START_STATE,
      searchForm({ zip: "22101" }),
    );

    expect(state.error).toBeNull();
    expect(state.view?.live).toBe(false);
    expect(state.view?.items).toEqual([]);
    expect(state.view?.notice).toContain("va.gov/ogc/apps/accreditation");
    expect(fetchAccreditedRepMock).not.toHaveBeenCalled();
  });
});
