import { configuredPrivacyContact } from "../src/lib/privacy/contact-config.mjs";
/**
 * Gate C verifier (issue #539 / R-01 §9) — is the published privacy-request channel
 * deliverable yet?
 *
 *   node scripts/verify-privacy-channel.mjs            # DNS + registry readings
 *   node scripts/verify-privacy-channel.mjs --smtp     # also ask the mail host whether it
 *                                                      # accepts mail for the published address
 *
 * Why this exists. The gate's completion criterion is external — a mailbox a human reads,
 * proven by a message that arrives — and the [fulfilment procedure](../docs/privacy-request-fulfilment-procedure.md) §8
 * says plainly that the repository can record those steps but cannot perform them. Recording
 * them is exactly what this script makes patient: each of §8's first three steps gets a dated,
 * reproducible reading instead of an assertion, so the closure evidence is checkable by
 * anyone rather than being whatever the operator remembered to write down.
 *
 * What it never does:
 *   - it sends no mail. `--smtp` stops at `RCPT TO` and sends `QUIT` before `DATA`, so the
 *     host is asked whether it would accept the address, never given a message. Acceptance is not
 *     delivery, and §8 step 4's send/receive test — a real message **from a mailbox outside the domain**
 *     — is a human act this script cannot perform and never claims to be;
 *   - it needs no credential and reads no mailbox, so its result cannot be mistaken for
 *     evidence that a human read anything;
 *   - it reads the same approved PRIVACY_CONTACT_EMAIL setting as the pages, so a
 *     renamed address cannot leave this verifier checking a channel nobody publishes.
 *
 * Exit codes follow this repository's convention for probes that gate on external state:
 *   0  the name resolves and a mail route exists (and, with `--smtp`, the host accepted the
 *      published address) — routing prerequisites are observed, not actual delivery;
 *   1  not there yet, with the reason named — the gate is still open, and no state changed;
 *   2  the verifier could not run (network, resolver or registry unreachable) — never a
 *      deliverability verdict. A control that cannot be read fails closed here: the registry
 *      answer is only trusted alongside a same-registry control that answers correctly in the same run,
 *      because `rdap.org` answers 403 for every name (registered or not) and a 404 on a
 *      non-`.org` name means nothing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import net from "node:net";

const HELP = `usage: node scripts/verify-privacy-channel.mjs [--smtp] [--json] [--timeout=<ms>]`;

const DOH = {
  cloudflare: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  google: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
};
const RCODE = { 0: "NOERROR", 2: "SERVFAIL", 3: "NXDOMAIN", 5: "REFUSED" };
const TYPES = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 257: "CAA" };
/** Authoritative endpoints from https://data.iana.org/rdap/dns.json.
 * Only direct registrations with known same-registry controls are supported.
 * Unknown suffixes/subdomains are indeterminate, never inferred unregistered.
 */
const REGISTRIES = {
  org: { endpoint: "https://rdap.publicinterestregistry.org/rdap/domain/", controlName: "example.org" },
  com: { endpoint: "https://rdap.verisign.com/com/v1/domain/", controlName: "example.com" },
  net: { endpoint: "https://rdap.verisign.com/net/v1/domain/", controlName: "example.net" },
};

export function registryForDomain(domain) {
  const labels = domain.toLowerCase().split(".");
  if (labels.length !== 2) return null;
  return Object.hasOwn(REGISTRIES, labels[1]) ? REGISTRIES[labels[1]] : null;
}

/** The published address, read from the module that owns it — never retyped here. */
export function publishedAddressFromSource(source) {
  const match = source.match(/PRIVACY_CONTACT_EMAIL\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error("PRIVACY_CONTACT_EMAIL is not declared in the privacy intake module");
  }
  return match[1];
}

/** @param {string} root @param {{ PRIVACY_CONTACT_EMAIL?: string }} env */
export function readPublishedAddress(root = process.cwd(), env = process.env) {
  // Read the same approved setting as the pages, not the historical failed address.
  const source = readFileSync(resolve(root, "src/lib/privacy/intake.ts"), "utf8");
  if (!source.includes("configuredPrivacyContact")) throw new Error("Privacy intake configuration is missing");
  const address = configuredPrivacyContact(env);
  if (!address) throw new Error("A valid PRIVACY_CONTACT_EMAIL must be configured; no mailbox is published");
  return address;
}

/** Collapse raw DoH answers into the facts the gate cares about. */
export function summarizeDns(readings, domain) {
  const forName = (type) => readings.filter((r) => r.type === type && r.name === domain);
  const answers = (type) => [...new Set(forName(type).flatMap((r) => r.answers || []))];
  const rcodes = [...new Set(forName("NS").concat(forName("MX")).map((r) => r.rcode).filter(Boolean))];
  const mx = answers("MX");
  // DMARC lives at `_dmarc.<domain>`, not at the apex — reading it from the apex name alone would
  // report "none published" for a correct record, which is a false negative in the exact evidence
  // an operator would paste into the gate record. The apex is accepted too, in case a provider
  // publishes it there.
  const dmarcTxt = [...new Set(readings.filter((r) => r.type === "TXT" && (r.name === `_dmarc.${domain}` || r.name === domain)).flatMap((r) => r.answers || []))];
  return {
    nameExists: answers("NS").length > 0 || mx.length > 0,
    mailRoute: mx.length > 0,
    mx,
    ns: answers("NS"),
    spf: answers("TXT").filter((t) => /v=spf1/i.test(t)),
    dmarc: dmarcTxt.filter((t) => /v=DMARC1/i.test(t)),
    rcodes,
  };
}

/**
 * The verdict, and the reason for it. Fail-closed in both directions a reader could be misled:
 * an unreadable control is not evidence of anything, and a `.org` 404 without a working control
 * is not evidence of availability.
 */
export function verdictFor({ registry, dns, smtp }) {
  const reasons = [];
  if (registry.subject === null || registry.control === null) {
    return { code: 2, status: "could not run", reasons: [`registry reading unusable: ${registry.error || "no answer"}`] };
  }
  if (registry.control !== 200) {
    return {
      code: 2,
      status: "could not run",
      reasons: [`registry control ${registry.controlName || "registered control"} answered HTTP ${registry.control}, not 200 — the registry answer cannot be trusted this run`],
    };
  }
  if (![200, 404].includes(registry.subject)) {
    return { code: 2, status: "could not run", reasons: [`registry subject answered HTTP ${registry.subject}, not 200 or 404`] };
  }
  const registered = registry.subject === 200;
  if (!registered) reasons.push("the name is not registered (registry RDAP 404, against a 200 control)");
  if (!dns.nameExists) reasons.push("no NS answers: the name does not resolve");
  if (!dns.mailRoute) reasons.push("no MX answers: no mail route exists, so nothing can be delivered");
  if (dns.mailRoute && smtp && smtp.accepted !== true) {
    reasons.push(`the mail host did not accept the published address (${smtp.detail || "no RCPT acceptance"})`);
  }
  const deliverable = registered && dns.nameExists && dns.mailRoute && (!smtp || smtp.accepted === true);
  if (deliverable) {
    reasons.push("a mail route exists" + (smtp?.accepted ? " and the host accepted the published address" : " (run with --smtp to ask the host about the address)"));
    return { code: 0, status: "mail route ready (steps 1–3; actual delivery unverified)", reasons };
  }
  return { code: 1, status: "not deliverable — gate C's first item stays unmet", reasons };
}

async function doh(provider, name, type, timeoutMs) {
  const res = await fetch(DOH[provider](name, type), {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json();
  return {
    provider,
    name,
    type,
    rcode: RCODE[json.Status] ?? `RCODE ${json.Status}`,
    answers: (json.Answer || []).map((a) => `${TYPES[a.type] ?? a.type} ${a.data}`),
  };
}

export async function registryStatus(domain, timeoutMs, fetcher = fetch) {
  const registry = registryForDomain(domain);
  if (!registry) return { subject: null, control: null, error: "unsupported registry or subdomain; no registration verdict available" };
  const ask = async (name) => {
    const res = await fetcher(registry.endpoint + encodeURIComponent(name), {
      headers: { accept: "application/rdap+json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status;
  };
  try {
    const [subject, control] = [await ask(domain.toLowerCase()), await ask(registry.controlName)];
    return { ...registry, subject, control, error: null };
  } catch (e) {
    return { ...registry, subject: null, control: null, error: String(e).slice(0, 120) };
  }
}

/** Ask the mail host whether it would accept the published address. Sends QUIT before DATA. */
export function askMailHost({ mx, address, timeoutMs = 15000 }) {
  return new Promise((resolvePromise) => {
    const host = (mx[0] || "").split(/\s+/).pop();
    if (!host) return resolvePromise({ accepted: false, detail: "no MX host to ask" });
    const socket = net.createConnection({ host, port: 25, timeout: timeoutMs });
    const lines = [];
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolvePromise(result);
    };
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      lines.push(...String(chunk).split(/\r?\n/).filter(Boolean));
      const last = lines[lines.length - 1] || "";
      if (/^220/.test(lines[0] || "") && !socket.__ehloSent) {
        socket.__ehloSent = true;
        socket.write("EHLO gate-c-verifier.invalid\r\n");
      } else if (/^250/.test(last) && socket.__ehloSent && !socket.__fromSent) {
        socket.__fromSent = true;
        socket.write("MAIL FROM:<postmaster@gate-c-verifier.invalid>\r\n");
      } else if (/^250/.test(last) && socket.__fromSent && !socket.__rcptSent) {
        socket.__rcptSent = true;
        socket.write(`RCPT TO:<${address}>\r\n`);
      } else if (socket.__rcptSent) {
        if (/^(250|251)/.test(last)) {
          socket.write("QUIT\r\n");
          return finish({ accepted: true, detail: last.slice(0, 90), exchange: lines.slice(-3) });
        }
        if (/^(4|5)\d\d/.test(last)) {
          socket.write("QUIT\r\n");
          return finish({ accepted: false, detail: last.slice(0, 90), exchange: lines.slice(-3) });
        }
      }
    });
    socket.on("timeout", () => finish({ accepted: false, detail: `no answer within ${timeoutMs}ms (port 25 may be blocked outbound)` }));
    socket.on("error", (e) => finish({ accepted: false, detail: String(e).slice(0, 90) }));
    socket.on("close", () => finish({ accepted: false, detail: "connection closed before RCPT was answered" }));
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const timeoutMs = Number((argv.find((a) => a.startsWith("--timeout=")) || "--timeout=15000").split("=")[1]);
  const wantSmtp = argv.includes("--smtp");
  const asJson = argv.includes("--json");

  let address;
  try {
    address = readPublishedAddress();
  } catch (e) {
    console.error(`could not read the published address: ${e.message}`);
    process.exit(2);
  }
  const domain = address.split("@")[1];

  const readings = [];
  let networkError = null;
  for (const type of ["NS", "MX", "TXT"]) {
    for (const provider of ["cloudflare", "google"]) {
      try {
        readings.push(await doh(provider, domain, type, timeoutMs));
      } catch (e) {
        networkError = networkError || String(e).slice(0, 120);
      }
    }
  }
  try {
    readings.push(await doh("cloudflare", `_dmarc.${domain}`, "TXT", timeoutMs));
  } catch (e) {
    networkError = networkError || String(e).slice(0, 120);
  }

  const dns = summarizeDns(readings, domain);
  const registry = await registryStatus(domain, timeoutMs);
  const smtp = wantSmtp && dns.mailRoute ? await askMailHost({ mx: dns.mx, address, timeoutMs }) : null;
  let verdict = verdictFor({ registry, dns, smtp });
  if (readings.length === 0 && networkError) {
    verdict = { code: 2, status: "could not run", reasons: [`no DNS reading succeeded: ${networkError}`] };
  }

  if (asJson) {
    console.log(JSON.stringify({ at: new Date().toISOString(), address, domain, dns, registry, smtp, verdict }, null, 2));
  } else {
    console.log(`published channel : ${address}`);
    console.log(`read at           : ${new Date().toISOString()}`);
    console.log(`registry          : subject HTTP ${registry.subject ?? "error"} / control ${registry.controlName ?? "unsupported"} HTTP ${registry.control ?? "error"}`);
    console.log(`NS                : ${dns.ns.length ? JSON.stringify(dns.ns) : `none (${dns.rcodes.join(", ") || "no reading"})`}`);
    console.log(`MX                : ${dns.mailRoute ? JSON.stringify(dns.mx) : `none (${dns.rcodes.join(", ") || "no reading"})`}`);
    console.log(`SPF               : ${dns.spf.length ? dns.spf.join(" | ").slice(0, 120) : "none published"}`);
    console.log(`DMARC             : ${dns.dmarc.length ? dns.dmarc.join(" | ").slice(0, 120) : "none published"}`);
    if (wantSmtp) console.log(`host accepts ${address} : ${smtp ? (smtp.accepted ? "yes" : `no — ${smtp.detail}`) : "not asked (no MX route)"}`);
    console.log(`\nverdict: ${verdict.status}`);
    for (const reason of verdict.reasons) console.log(`  - ${reason}`);
    if (verdict.code !== 0) {
      console.log(
        "\nThis is a reading of external state, not a closure: steps 1–3 of the fulfilment procedure §8 are the\n" +
          "registration, the mailbox and the published records, and step 4 is a real message from outside the domain —\n" +
          "which only a person with the mailbox can run and report."
      );
    }
  }
  process.exit(verdict.code);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(String(e).slice(0, 200));
    process.exit(2);
  });
}
