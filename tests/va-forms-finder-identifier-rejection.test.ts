import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadVaFormsFinder,
  looksLikePersonalIdentifier,
} from "@/lib/va/forms-finder";

const { fetchVaFormsMock } = vi.hoisted(() => ({
  fetchVaFormsMock: vi.fn(),
}));

vi.mock("@/lib/va/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/va/sandbox")>()),
  fetchVaForms: fetchVaFormsMock,
}));

beforeEach(() => {
  fetchVaFormsMock.mockReset();
  fetchVaFormsMock.mockResolvedValue({ success: false });
  vi.stubEnv("VA_API_ENABLED", "");
  vi.stubEnv("VA_SANDBOX_ENABLED", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * A01: the Forms Finder is a GET form, so raw query text reaches browser
 * history, request URLs, upstream VA traffic, and cached view values. A
 * pasted identifier can never match a form number, keyword, or title, so
 * identifier-like input is refused before any upstream send or cache write
 * and is never echoed back in the view.
 */
describe("forms-finder identifier-like input rejection", () => {
  it.each([
    "123-45-6789",
    "123 45 6789",
    "123456789",
    "8005551234",
    "(800) 555-1234",
    "12345678",
  ])("refuses %s without upstream send or raw echo", async (input) => {
    expect(looksLikePersonalIdentifier(input)).toBe(true);

    const view = await loadVaFormsFinder(input);

    expect(fetchVaFormsMock).not.toHaveBeenCalled();
    expect(view.query).toBe("");
    expect(view.items).toEqual([]);
    expect(view.live).toBe(false);
    expect(view.source).toBe("local-fallback");
    expect(view.notice).toContain("personal identifier");
    expect(JSON.stringify(view)).not.toContain("123");
  });

  it.each([
    "21-526EZ",
    "1010EZ",
    "disability compensation",
    "123-45",
    "XXX-XX-1234",
    "526",
    "",
  ])("still searches legitimate input %s", async (input) => {
    if (input) expect(looksLikePersonalIdentifier(input)).toBe(false);

    await loadVaFormsFinder(input || "21-526EZ");

    expect(fetchVaFormsMock).toHaveBeenCalledTimes(1);
  });

  it("passes the normalized query upstream for legitimate input", async () => {
    const view = await loadVaFormsFinder("  21-526EZ  ");

    expect(fetchVaFormsMock).toHaveBeenCalledWith(
      "21-526EZ",
      expect.anything(),
    );
    expect(view.query).toBe("21-526EZ");
  });

  it("still bounds legitimate input at 120 characters", async () => {
    await loadVaFormsFinder(`disability ${"x".repeat(200)}`);

    const sent = String(fetchVaFormsMock.mock.calls[0]?.[0] ?? "");
    expect(sent.length).toBe(120);
  });
});
