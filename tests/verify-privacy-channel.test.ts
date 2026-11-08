import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  publishedAddressFromSource,
  readPublishedAddress,
  registryForDomain,
  registryStatus,
  summarizeDns,
  verdictFor,
} from "../scripts/verify-privacy-channel.mjs";

/**
 * Contracts for scripts/verify-privacy-channel.mjs — the gate C (#539 / R-01 §9) verifier.
 *
 * The verifier's job is to turn the fulfilment procedure's §8 steps 1–3 into a dated,
 * reproducible reading, because the gate closes on external evidence the repository cannot
 * manufacture. Two properties matter more than the plumbing and are pinned here:
 *
 *   1. **It fails closed.** A registry answer is only evidence when the control beside it
 *      answered correctly in the same run: `rdap.org` answers 403 for every name, registered
 *      or not, and a 404 on a non-`.org` name means nothing. A run whose control did not
 *      answer 200 is reported as "could not run" (exit 2), never as unavailable or available.
 *   2. **It cannot send mail.** `--smtp` stops at `RCPT TO` and sends `QUIT`, so the host is
 *      asked about the address and never given a message. Acceptance is not delivery, and
 *      §8 step 4's send/receive test stays a human act — the verifier's own output says so.
 *
 * Only pure functions are exercised here; the DNS, registry and SMTP readers are network
 * calls, and a unit test that asserted their results would be asserting the internet.
 */

const SCRIPT = readFileSync(resolve(process.cwd(), "scripts/verify-privacy-channel.mjs"), "utf8");
/**
 * Comment prose with the comment leaders removed and wrapping collapsed, so a pinned
 * sentence can be asserted as the sentence it is rather than as it happens to be wrapped.
 */
const prose = (source: string): string => source.replace(/^\s*\*/gm, "").replace(/\s+/g, " ");

const reading = (name: string, type: string, rcode: string, answers: string[] = []) => ({
  provider: "cloudflare",
  name,
  type,
  rcode,
  answers,
});

describe("the gate C verifier reads the published address instead of retyping it", () => {
  it("takes the address from the intake module that owns it", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/privacy/intake.ts"), "utf8");
    const address = publishedAddressFromSource(source);

    expect(address).toBe("privacy@secondaryconditionfinder.org");
    // The same answer through the file-reading path, so a rename cannot leave the verifier
    // checking a channel the policy no longer publishes.
    expect(readPublishedAddress(process.cwd(), { PRIVACY_CONTACT_EMAIL: address })).toBe(address);
  });

  it("refuses to verify an unconfigured or invalid published channel", () => {
    expect(() => readPublishedAddress(process.cwd(), {})).toThrow(/must be configured/);
    expect(() => readPublishedAddress(process.cwd(), { PRIVACY_CONTACT_EMAIL: "bad?bcc=other@example.org" })).toThrow(/must be configured/);
  });

  it("refuses to guess when the constant is absent", () => {
    expect(() => publishedAddressFromSource("export const SOMETHING_ELSE = 1;")).toThrow(
      /PRIVACY_CONTACT_EMAIL is not declared/,
    );
  });
});

describe("DNS readings collapse into the two facts the gate turns on", () => {
  const domain = "secondaryconditionfinder.org";

  it("reports no name and no mail route when every reading is NXDOMAIN", () => {
    const dns = summarizeDns(
      [
        reading(domain, "NS", "NXDOMAIN"),
        reading(domain, "MX", "NXDOMAIN"),
        reading(domain, "TXT", "NXDOMAIN"),
        reading(`_dmarc.${domain}`, "TXT", "NXDOMAIN"),
      ],
      domain,
    );

    expect(dns.nameExists).toBe(false);
    expect(dns.mailRoute).toBe(false);
    expect(dns.rcodes).toEqual(["NXDOMAIN"]);
  });

  it("reports a name and a mail route once the records exist, with SPF and DMARC", () => {
    const dns = summarizeDns(
      [
        reading(domain, "NS", "NOERROR", ["NS ns1.example.net", "NS ns2.example.net"]),
        reading(domain, "MX", "NOERROR", ["MX 10 mx1.mailhost.example", "MX 20 mx2.mailhost.example"]),
        reading(domain, "TXT", "NOERROR", ["TXT v=spf1 include:spf.mailhost.example ~all"]),
        reading(`_dmarc.${domain}`, "TXT", "NOERROR", ["TXT v=DMARC1; p=none; rua=mailto:privacy@x.org"]),
      ],
      domain,
    );

    expect(dns.nameExists).toBe(true);
    expect(dns.mailRoute).toBe(true);
    expect(dns.mx).toHaveLength(2);
    expect(dns.spf).toHaveLength(1);
    expect(dns.dmarc).toHaveLength(1);
  });
});

describe("the verdict fails closed, and never reports delivery it cannot see", () => {
  const domain = "secondaryconditionfinder.org";
  const nxdomain = summarizeDns([reading(domain, "NS", "NXDOMAIN"), reading(domain, "MX", "NXDOMAIN")], domain);
  const live = summarizeDns(
    [reading(domain, "NS", "NOERROR", ["NS ns1.example.net"]), reading(domain, "MX", "NOERROR", ["MX 10 mx1.example.net"])],
    domain,
  );

  it("today's state is exit 1 with the reasons named, not an error", () => {
    const verdict = verdictFor({ registry: { subject: 404, control: 200, error: null }, dns: nxdomain, smtp: null });

    expect(verdict.code).toBe(1);
    expect(verdict.status).toContain("unmet");
    expect(verdict.reasons.join(" ")).toContain("not registered");
    expect(verdict.reasons.join(" ")).toContain("no MX answers");
  });

  it("refuses to read a registry answer whose control did not answer correctly", () => {
    // The lesson from the earlier record: a 404 is only an answer when the endpoint is known
    // to answer 200 for a registered name in the same minute.
    for (const control of [403, 404, 500]) {
      const verdict = verdictFor({ registry: { subject: 404, control, error: null }, dns: nxdomain, smtp: null });
      expect(verdict.code, `control ${control} must not be trusted`).toBe(2);
      expect(verdict.status).toBe("could not run");
      expect(verdict.reasons.join(" ")).toContain("cannot be trusted");
    }
  });

  it("reports an unreadable registry as could-not-run rather than as availability", () => {
    const verdict = verdictFor({ registry: { subject: null, control: null, error: "timeout" }, dns: live, smtp: null });
    expect(verdict.code).toBe(2);
  });

  it("reaches exit 0 only when the name is registered, resolves, and has a mail route", () => {
    const verdict = verdictFor({ registry: { subject: 200, control: 200, error: null }, dns: live, smtp: null });
    expect(verdict.code).toBe(0);
    expect(verdict.status).toContain("steps 1\u20133");
  });

  it("treats a mail host that refuses the address as still unmet", () => {
    const refused = verdictFor({
      registry: { subject: 200, control: 200, error: null },
      dns: live,
      smtp: { accepted: false, detail: "550 5.1.1 no such user" },
    });
    expect(refused.code).toBe(1);
    expect(refused.reasons.join(" ")).toContain("did not accept the published address");

    const accepted = verdictFor({
      registry: { subject: 200, control: 200, error: null },
      dns: live,
      smtp: { accepted: true, detail: "250 2.1.5 Ok" },
    });
    expect(accepted.code).toBe(0);
  });
});

describe("the verifier cannot send mail, and says so", () => {
  it("stops at RCPT and quits before DATA", () => {
    // The only token a mail server would act on as a message body is the SMTP verb, so assert
    // that no write of it exists anywhere in the script — the DOCUMENTED token in the header is
    // fine, a `.write(...)` of it is not.
    expect(SCRIPT).not.toMatch(/\.write\([^)]*DATA/);
    expect(SCRIPT).toContain("RCPT TO:<${address}>");
    expect(SCRIPT).toContain('socket.write("QUIT\\r\\n")');
  });

  it("states that acceptance is not delivery and points at the human step", () => {
    expect(prose(SCRIPT)).toContain("Acceptance is not delivery");
    expect(prose(SCRIPT)).toContain("**from a mailbox outside the domain**");
    expect(prose(SCRIPT)).toContain("only a person with the mailbox can run and report");
  });
});


describe("authoritative registry selection", () => {
  it.each([
    ["gmail.com", "https://rdap.verisign.com/com/v1/domain/", "example.com"],
    ["example.net", "https://rdap.verisign.com/net/v1/domain/", "example.net"],
    ["secondaryconditionfinder.org", "https://rdap.publicinterestregistry.org/rdap/domain/", "example.org"],
  ])("queries %s and a control at the correct registry", async (domain, endpoint, controlName) => {
    const fetcher = vi.fn().mockResolvedValue({ status: 200 });
    const registry = await registryStatus(domain, 1000, fetcher);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([endpoint + domain, endpoint + controlName]);
    expect(registry).toMatchObject({ subject: 200, control: 200, controlName });
    const verdict = verdictFor({ registry, dns: { nameExists: true, mailRoute: true }, smtp: null });
    expect(verdict.code).toBe(0);
    expect(verdict.status).toContain("actual delivery unverified");
  });

  it("normalizes case without sending a .com name to the .org registry", () => {
    expect(registryForDomain("GMAIL.COM")).toEqual(registryForDomain("gmail.com"));
  });

  it.each(["example.edu", "mail.example.com", "example.co.uk", "example.constructor", "example.__proto__"])("does not invent an unregistered verdict for %s", async domain => {
    const fetcher = vi.fn();
    const registry = await registryStatus(domain, 1000, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(verdictFor({ registry, dns: { nameExists: true, mailRoute: true }, smtp: null }).code).toBe(2);
  });

  it.each([403, 429, 500, 503])("treats subject HTTP %s as unreadable rather than unregistered", status => {
    const verdict = verdictFor({ registry: { subject: status, control: 200 }, dns: { nameExists: true, mailRoute: true }, smtp: null });
    expect(verdict.code).toBe(2);
    expect(verdict.reasons.join(" ")).not.toContain("not registered");
  });

  it("keeps transport errors indeterminate", async () => {
    const registry = await registryStatus("gmail.com", 1000, vi.fn().mockRejectedValue(new Error("timeout")));
    expect(verdictFor({ registry, dns: { nameExists: true, mailRoute: true }, smtp: null }).code).toBe(2);
  });
});
