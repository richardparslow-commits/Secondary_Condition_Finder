// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import PrivacyRequestPage from "@/app/privacy/request/page";
import { configuredPrivacyContact, privacyRequestMailto } from "@/lib/privacy/intake";
import { expectNoBlockingA11yViolations } from "./setup/accessibility";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it.each([undefined, "", "mailto:privacy@example.org", "a@example.org?bcc=other@example.org", "a@example.org\r\nBcc: other@example.org", "a@example.org,b@example.org", "Name <a@example.org>", "a@localhost"])("rejects absent or unsafe contact %s", (address) => {
  expect(configuredPrivacyContact({ PRIVACY_CONTACT_EMAIL: address })).toBeNull();
});
it("accepts one configured bare mailbox and trims surrounding whitespace", () => {
  expect(configuredPrivacyContact({ PRIVACY_CONTACT_EMAIL: " privacy+requests@example.org " })).toBe("privacy+requests@example.org");
});
it("does not silently fall back to the failed historical address", () => {
  vi.stubEnv("PRIVACY_CONTACT_EMAIL", "");
  const { container } = render(<PrivacyRequestPage />);
  expect(screen.getByRole("status").textContent).toContain("Privacy contact unavailable");
  expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  expect(container.textContent).not.toContain("privacy@secondaryconditionfinder.org");
  expect(() => privacyRequestMailto("deletion")).toThrow(/configured/);
});
it("publishes the same configured mailbox on policy and intake pages", () => {
  vi.stubEnv("PRIVACY_CONTACT_EMAIL", "privacy-review@example.org");
  const policy = render(<PrivacyPage />);
  expect(policy.container.querySelector('a[href="mailto:privacy-review@example.org"]')).not.toBeNull();
  cleanup();
  const intake = render(<PrivacyRequestPage />);
  const hrefs = [...intake.container.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute("href"));
  expect(hrefs).toHaveLength(5);
  expect(hrefs.every(href => href?.startsWith("mailto:privacy-review@example.org"))).toBe(true);
  expect(intake.container.querySelector("form")).toBeNull();
});
it("keeps the unavailable intake accessible", async () => {
  vi.stubEnv("PRIVACY_CONTACT_EMAIL", "");
  const { container } = render(<PrivacyRequestPage />);
  await expectNoBlockingA11yViolations(container);
});
