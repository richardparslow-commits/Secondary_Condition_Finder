import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRIVACY_COMPLETION_DAYS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_INTAKE_PATH,
  PRIVACY_REQUEST_TYPES,
  PRIVACY_REQUESTS,
  privacyRequestMailto,
  privacyRequestMessage,
} from "@/lib/privacy/intake";

/**
 * R-01 (Lighthouse blocker B-02) — the intake half of the privacy promise.
 *
 * The deletion right, the 45-day commitment and the statutory exceptions are
 * pinned in `tests/privacy-rights-contact.test.ts`. This suite pins the
 * *intake*: that a request can actually be started, that it reaches the
 * monitored mailbox the operator registered, and — the property that matters
 * most here — that starting one sends nothing to this application.
 *
 * That last point is not a stylistic preference. A server-side intake could not
 * accept an email address or a name without a reviewed exception to
 * `src/lib/security/phi-free-action-input.ts`, whose vocabulary refuses exactly
 * those identifiers, and `tests/phi-logging-boundary.test.ts` enforces that for
 * every `"use server"` module. The intake avoids the exception by keeping the
 * identifying details in the visitor's own mail client, so these assertions are
 * what keep that decision from quietly eroding into a form.
 */

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

/**
 * Source text with line wrapping collapsed.
 *
 * These files are formatted by Prettier, so a phrase a page renders on one line
 * can be split across two in the source (`36 CFR Chapter\n XII`). Asserting on
 * the wrapped bytes would make the test fail on a reformat while the shipped
 * page said exactly the right thing; normalizing whitespace asserts on the copy
 * instead of on where the formatter put the newline. The mounted suite asserts
 * the same phrases against real rendered text, which is the stronger check.
 */
const flat = (source: string): string => source.replace(/\s+/g, " ");

const INTAKE_MODULE = "src/lib/privacy/intake.ts";
const COMPONENT = "src/components/privacy/PrivacyIntakeLinks.tsx";
const PAGE = "src/app/privacy/request/page.tsx";
const POLICY = "src/app/privacy/page.tsx";
const TERMS = "src/app/terms/page.tsx";

const intakeModule = read(INTAKE_MODULE);
const component = read(COMPONENT);
const page = read(PAGE);
const policy = read(POLICY);
const terms = read(TERMS);

/** Any of the primitives that would turn an intake page into a submission. */
const SUBMISSION_PRIMITIVES =
  /fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|new\s+EventSource|<form|<input|action=\{/;

describe("privacy request intake (R-01 / B-02)", () => {
  it("ships the page, and it is the route the policy and the module publish", () => {
    expect(existsSync(resolve(process.cwd(), PAGE))).toBe(true);
    expect(PRIVACY_INTAKE_PATH).toBe("/privacy/request");
    expect(policy).toContain(`href="${PRIVACY_INTAKE_PATH}"`);
    expect(terms).toContain(`href="${PRIVACY_INTAKE_PATH}"`);
  });

  it("publishes the registered monitored mailbox and a 45-day commitment", () => {
    expect(PRIVACY_CONTACT_EMAIL).toBe("privacy@secondaryconditionfinder.org");
    expect(PRIVACY_COMPLETION_DAYS).toBe(45);
    // The policy must keep its own copy of both, including the mailto route the
    // operator register cites as the contact channel.
    expect(policy).toContain(`mailto:${PRIVACY_CONTACT_EMAIL}`);
    expect(policy).toContain("within <strong>45 days</strong>");
  });

  it("shows no placeholder address and no second recipient", () => {
    expect(component).not.toMatch(/REPLACE_WITH|example\.(com|org)|TODO/);
    expect(page).not.toMatch(/REPLACE_WITH|example\.(com|org)|TODO/);
    // The address is interpolated from the module rather than written twice, so
    // the component cannot drift to a different mailbox than the policy names.
    expect(component).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    for (const request of PRIVACY_REQUESTS) {
      const url = privacyRequestMailto(request.type);
      expect(url.split("?")[0]).toBe(`mailto:${PRIVACY_CONTACT_EMAIL}`);
      expect(url).not.toMatch(/&(?:cc|bcc)=/);
    }
  });

  it("composes each request type as a complete, correctly addressed message", () => {
    expect([...PRIVACY_REQUEST_TYPES]).toEqual(
      PRIVACY_REQUESTS.map((request) => request.type),
    );
    expect(PRIVACY_REQUESTS).toHaveLength(4);
    for (const request of PRIVACY_REQUESTS) {
      const message = privacyRequestMessage(request.type);
      expect(message).toContain(request.requestLine);
      // The commitment and the partial-handling promise travel with the request,
      // so the requester holds the terms and not only the policy page.
      expect(message).toContain("within 45 days of receiving it");
      expect(message).toContain("retained and why");
      expect(message).toContain("If you need to verify my identity, tell me what is required");
      // Encoding is real, not incidental: the subject is percent-encoded, spaces
      // are not "+", and the body survives a round trip through the URL.
      const url = privacyRequestMailto(request.type);
      expect(url).toContain("subject=");
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(request.subject);
      expect(decoded).toContain(message);
      expect(decodeURIComponent(url.replace(/\+/g, "%20"))).toBe(
        `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${request.subject}&body=${message}`,
      );
    }
  });

  it("starts nothing on the server: no action module, no submission primitive", () => {
    expect(intakeModule).not.toMatch(/^\s*["']use server["']/m);
    for (const source of [intakeModule, component, page]) {
      expect(source).not.toMatch(SUBMISSION_PRIMITIVES);
    }
    // No imports from the action layer either: an intake with no request body
    // cannot be a Server Action by accident.
    for (const source of [component, page]) {
      expect(source).not.toContain("@/lib/actions/");
    }
  });

  it("offers the message as copyable text for a mail client that will not open", () => {
    // The escape hatch is not optional: a mailto link does nothing for a
    // visitor on a device with no configured mail client, and a promise that
    // only works if a link opens is a promise with a hole in it.
    expect(component).toContain("<textarea");
    expect(component).toContain("readOnly");
    expect(component).toContain("privacyRequestPlainText");
  });

  it("keeps the policy honest about the channels it actually has", () => {
    // The original R-01 guard list, re-asserted here because this change is
    // exactly the kind that could reintroduce an unpublished channel.
    expect(policy).not.toMatch(/request form|postal (address|mail)|PO Box/);
    expect(policy).not.toMatch(/within (3|7|14|30) days/);
    expect(policy).not.toMatch(/mailto:(privacy|info)@va\.gov/);
  });

  it("states the commitment, the exceptions and the verification step on the page", () => {
    const copy = flat(page);
    expect(copy).toContain("45 days");
    expect(copy).toContain("36 CFR Chapter XII");
    expect(copy).toContain("Title 38, United States Code");
    expect(copy).toContain("constituent partial request");
    expect(copy).toContain("verify your identity");
    // The page must not promise a channel it does not have: it links to VA for
    // completeness and says outright that the VA line is not an intake channel.
    expect(copy).toContain("not a privacy-request intake channel");
    expect(copy).not.toMatch(/REPLACE_WITH/);
  });
});
