// @vitest-environment jsdom
/**
 * Mounted proof for the privacy request intake (R-01 / B-02).
 *
 * `tests/privacy-request-intake.test.ts` reads source; this suite mounts the
 * real page and drives the real rendered output, because the two properties a
 * reviewer actually cares about are only visible in the DOM:
 *
 *   1. each request type produces a correctly addressed, fully composed
 *      `mailto:` — recipient, subject and body — so "a request can be started"
 *      is demonstrated rather than asserted in prose;
 *   2. the rendered page contains no form, no field and no submit control, so
 *      there is no path by which a visitor's identifying details could reach
 *      this application.
 *
 * Accessibility is checked here too, through the shared axe gate
 * (`tests/setup/accessibility.ts`), because this is a page a Section 508
 * reviewer will open: it is new markup, and the repo's rule is that new markup
 * arrives already passing the automated portion of the gate.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrivacyRequestPage from "@/app/privacy/request/page";
import { SecondaryWorkflowCompletionActions } from "@/components/secondary/SecondaryWorkflowCompletionActions";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_INTAKE_PATH,
  PRIVACY_REQUESTS,
  privacyRequestMessage,
} from "@/lib/privacy/intake";

import { expectNoBlockingA11yViolations } from "./setup/accessibility";

// The completion controls navigate on a confirmed cleanup, so the router is
// stubbed the way the repo's other mounted client suites stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

afterEach(cleanup);

describe("privacy request intake surface", () => {
  it("prepares one correctly addressed message per request type", () => {
    render(<PrivacyRequestPage />);

    for (const request of PRIVACY_REQUESTS) {
      const href = screen.getByRole("link", { name: request.label }).getAttribute("href") ?? "";
      expect(href.startsWith(`mailto:${PRIVACY_CONTACT_EMAIL}?`)).toBe(true);
      const decoded = decodeURIComponent(href);
      expect(decoded).toContain(request.subject);
      expect(decoded).toContain(privacyRequestMessage(request.type));
    }
  });

  it("carries the commitment into every composed message", () => {
    render(<PrivacyRequestPage />);

    const hrefs = PRIVACY_REQUESTS.map(
      (request) => screen.getByRole("link", { name: request.label }).getAttribute("href") ?? "",
    );
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      expect(decodeURIComponent(href)).toContain("within 45 days of receiving it");
    }
  });

  it("offers the same message as copyable text and names the mailbox in plain text", () => {
    render(<PrivacyRequestPage />);

    const textareas = screen.getAllByLabelText(/^Message text for:/);
    expect(textareas).toHaveLength(PRIVACY_REQUESTS.length);
    expect((textareas[0] as HTMLTextAreaElement).value).toContain("Subject:");
    expect((textareas[0] as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByText(PRIVACY_CONTACT_EMAIL)).toBeTruthy();
  });

  it("submits nothing to the application: no form, no field, no submit control", () => {
    const { container } = render(<PrivacyRequestPage />);

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    // The only interactive controls are links and the copyable text blocks.
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(PRIVACY_REQUESTS.length);
  });

  it("discloses the exceptions and the verification step on the page itself", () => {
    const { container } = render(<PrivacyRequestPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("36 CFR Chapter XII");
    expect(text).toContain("verify your identity");
    expect(text).toContain("45 days");
  });

  it("passes the automated WCAG 2.1 AA gate", async () => {
    const { container } = render(<PrivacyRequestPage />);
    const summary = await expectNoBlockingA11yViolations(container);
    // A vacuous pass would be a suite with no rules enabled; require that axe
    // actually evaluated the markup.
    expect(summary.passes).toBeGreaterThan(0);
  });
});

describe("the intake is reachable from the workflow completion controls", () => {
  it("links it beside the controls that clear browser-local state", () => {
    // A visitor who has just been told what Finish Review clears is exactly the
    // visitor who wants to know how to delete what it does not reach. The link
    // therefore lives with the controls, not only in the policy (R-01 / B-02),
    // and the rendered copy keeps clearing this browser apart from deleting
    // what the application keeps.
    const { container } = render(<SecondaryWorkflowCompletionActions />);

    const intake = screen.getByRole("link", { name: "privacy request" });
    expect(intake.getAttribute("href")).toBe(PRIVACY_INTAKE_PATH);
    expect(PRIVACY_INTAKE_PATH).toBe("/privacy/request");
    expect(
      screen.getByRole("link", { name: "privacy policy" }).getAttribute("href"),
    ).toBe("/privacy");

    // The distinction the link rests on is rendered, not only implied.
    expect(container.textContent).toMatch(/clears what this browser holds/);
    expect(container.textContent).toMatch(/application itself keeps/);

    // The controls themselves are unchanged: clearing still comes first.
    expect(screen.getByRole("button", { name: /Finish Review/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start a new review" })).toBeTruthy();
  });

  it("keeps the completion markup passing the automated WCAG 2.1 AA gate", async () => {
    const { container } = render(<SecondaryWorkflowCompletionActions />);
    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });
});
