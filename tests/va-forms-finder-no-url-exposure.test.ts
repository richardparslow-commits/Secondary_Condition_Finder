/**
 * Audit A01 — Forms Finder search text must not travel in a URL.
 *
 * The finding: the finder was a GET form, so the text a visitor typed reached
 * the address bar, browser history, any copied link, and the hosting request
 * log for the page load. The identifier guard refused whole-input identifiers
 * but deliberately still allowed mixed text, so "refuses obvious identifiers"
 * was never the same property as "the text is not in a URL".
 *
 * These are the contracts that make the fix checkable:
 *
 *   1. the page reads no query parameter and builds no search URL;
 *   2. the search is a Server Action whose input goes through the PHI-free
 *      contract, and a refusal never echoes the submitted text;
 *   3. a successful search still returns display state (the user's own browser
 *      may show their query back to them — that is not a leak) and still sends
 *      the query upstream, which is explicitly recorded as the remaining
 *      exposure rather than claimed closed;
 *   4. our own log sinks never receive the text.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchVaFormsFinder } from "@/lib/actions/va-forms-finder";

const CANARY = "CANARY-QUERY-90210";

const { fetchVaFormsMock } = vi.hoisted(() => ({ fetchVaFormsMock: vi.fn() }));

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: fetchVaFormsMock,
}));

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function searchForm(q: string): FormData {
  const data = new FormData();
  data.set("q", q);
  return data;
}

beforeEach(() => {
  fetchVaFormsMock.mockReset();
  fetchVaFormsMock.mockResolvedValue({ success: false });
  vi.stubEnv("VA_API_ENABLED", "");
  vi.stubEnv("VA_SANDBOX_ENABLED", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Forms Finder search is not URL-borne (A01)", () => {
  it("keeps the search out of the page's URL surface entirely", () => {
    const page = read("src/app/va-forms/finder/page.tsx");
    const component = read("src/components/va/VaFormsFinder.tsx");

    // The page must not read a query parameter at all: a `?q=` URL from an old
    // bookmark or a copy-paste is inert rather than a second transport.
    expect(page).not.toContain("searchParams");
    expect(page).not.toContain("URLSearchParams");
    // The search input lives in the action-driven form, with no GET method.
    expect(page).not.toContain('method="get"');
    expect(component).not.toContain('method="get"');
    expect(component).toContain("name=\"q\"");
    // And nothing in the surface may synthesise a URL from the input.
    for (const forbidden of [
      "router.push",
      "router.replace",
      "window.location",
      "history.pushState",
      "history.replaceState",
      "URLSearchParams",
    ]) {
      expect(component, `finder surface must not use ${forbidden}`).not.toContain(
        forbidden,
      );
    }
  });

  it("keeps every non-function export out of the Server Action module", () => {
    // Discovered in the browser, not in unit tests: the finder surface first
    // imported its bound, refusal copy, and state type from the `"use server"`
    // module. That type-checked and passed every mocked-action test, then
    // answered 500 for the real page — Next replaces a Server Action module
    // with an action reference in the client graph, so its non-function exports
    // do not exist and the import threw before hydration. The constants and the
    // state type must therefore live in a plain module.
    const action = read("src/lib/actions/va-forms-finder.ts");
    const component = read("src/components/va/VaFormsFinder.tsx");

    expect(action).not.toMatch(/^export (const|interface|type) /m);
    expect(component).toContain('from "@/lib/va/forms-finder-search"');
    expect(component).not.toMatch(/import \{[^}]*FORMS_FINDER_[A-Z_]+[^}]*\} from "@\/lib\/actions/);
  });

  it("routes the search through the PHI-free Server Action contract", () => {
    const action = read("src/lib/actions/va-forms-finder.ts");

    expect(action).toContain('"use server"');
    expect(action).toContain("sanitizeActionInput(");
    expect(action).toContain("phiFreeActionInput(");
    // A redirect is a URL: the action must return its result, never build one.
    expect(action).not.toContain("redirect(");
    expect(action).not.toContain("URLSearchParams");
  });

  it("returns the search result as state and sends the text upstream only through the loader", async () => {
    const state = await searchVaFormsFinder(
      { view: undefined as never, refusal: null },
      searchForm("21-526EZ"),
    );

    expect(state.refusal).toBeNull();
    // The loader owns the display echo; the finder shows the visitor their own
    // query back, which is not an exposure.
    expect(state.view.query).toBe("21-526EZ");
    // Synthetic evidence for the remaining (documented) exposure: the loader
    // still passes the text to the VA Forms adapter when live VA access is
    // enabled. This is the upstream half, not the URL half.
    expect(fetchVaFormsMock).toHaveBeenCalledWith("21-526EZ", expect.anything());
  });

  it("refuses oversized input without echoing it, in the state or to a log sink", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    const oversized = `${CANARY}-${"x".repeat(200)}`;
    const state = await searchVaFormsFinder(
      { view: undefined as never, refusal: null },
      searchForm(oversized),
    );

    expect(state.refusal).toBe("oversized-value");
    // The refusal is a fixed constant path: nothing in the returned state can
    // be read back as the submitted text.
    expect(JSON.stringify(state)).not.toContain(CANARY);
    expect(state.view.query).toBe("21-526EZ");
    // And no application sink printed it.
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(CANARY);
    }
  });

  it("accepts a plain keyword search and leaves identifier refusal to the loader", async () => {
    const keyword = await searchVaFormsFinder(
      { view: undefined as never, refusal: null },
      searchForm("application for disability compensation"),
    );
    expect(keyword.refusal).toBeNull();

    // An identifier-looking whole input is refused by the loader (single
    // definition of searchable text), and the raw value is not echoed back.
    const identifier = await searchVaFormsFinder(
      { view: undefined as never, refusal: null },
      searchForm("123-45-6789"),
    );
    expect(identifier.refusal).toBeNull();
    expect(identifier.view.items).toEqual([]);
    expect(identifier.view.query).toBe("");
    expect(identifier.view.notice).toMatch(/looks like a personal identifier/);
  });

  it("does not place the query in the cache key's readable form or the cached view", async () => {
    // The cache-value and cache-key redaction is owned by
    // tests/va-reference-cache-value-redaction.test.ts; this asserts the finder
    // did not regain a second, readable copy of the text in the state it
    // returns for rendering.
    const state = await searchVaFormsFinder(
      { view: undefined as never, refusal: null },
      searchForm(CANARY),
    );
    const serialized = JSON.stringify(state.view);
    // `view.query` is the display echo (the visitor's own field value).
    expect(state.view.query).toBe(CANARY);
    // Everything else — items, provenance, status — carries no copy of it.
    const withoutDisplayEcho = { ...state.view, query: "" };
    expect(JSON.stringify(withoutDisplayEcho)).not.toContain(CANARY);
    expect(serialized.length).toBeLessThan(20_000);
  });
});
