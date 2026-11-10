import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildReport,
  digestIneligibilityClassId,
  loadDigestIneligibilityRegister,
  MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS,
  validateDigestIneligibilityRegister,
} from "../scripts/audit-citation-decay";

/**
 * Contract tests for the digest-ineligibility register
 * (docs/citation-digest-ineligible-classes.json) and for the ratchet it feeds.
 *
 * A `contentDigest` is anchored to the reference's `sourceUrl` and checked by
 * re-fetching that URL, so for some URLs no digest can ever validate: the
 * probe's own fetch of a PubMed record page is a per-request anti-bot
 * interstitial, and a bot-walled publisher page never yields a comparable body.
 * docs/citation-verification-sop.md requires omitting a digest there rather
 * than recording one that false-positives — which means those references are
 * not a backlog any human can work down, and a gate that counts them can never
 * be satisfied. That is exactly what happened: on 2026-10-14 the weekly probe
 * failed at 398 undigested against a pin of 383 with zero link rot, drift or
 * staleness (issue #518).
 *
 * The register is the fix's load-bearing part, so it is checked three ways:
 * its own shape (every class carries the measurement that justifies it), its
 * coverage of the live corpus (no reference escapes the class it belongs to and
 * none is captured by accident), and its tightness against the ratchet (the pin
 * equals the eligible backlog, so it can be neither slack nor overflowing).
 */

const AUDIT_SOURCE = "scripts/audit-citation-decay.js";
const POLICY_RECORD = "docs/citation-digest-ineligibility-policy-2026-10-14.md";
const KB_DIR = path.join(process.cwd(), "data", "knowledge-base");

function correctionFiles() {
  return readdirSync(KB_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ file, data: JSON.parse(readFileSync(path.join(KB_DIR, file), "utf8")) }));
}

/** Every verified reference in the live corpus, with its provenance. */
function verifiedReferences() {
  const references = [];
  for (const { file, data } of correctionFiles()) {
    for (const suggestion of data.suggestions ?? []) {
      for (const reference of suggestion.sourceReferences ?? []) {
        if (reference.verified === true && reference.sourceUrl) {
          references.push({ file, primary: data.id, target: suggestion.conditionId, reference });
        }
      }
    }
  }
  return references;
}

const { register, issues: loadIssues } = loadDigestIneligibilityRegister();
const declaredHosts = new Set(
  (((register as Record<string, unknown>)?.classes as { host: string }[]) ?? []).map(
    (entry) => entry.host,
  ),
);

describe("digest-ineligibility register shape", () => {
  it("loads and validates without issues", () => {
    expect(loadIssues).toEqual([]);
    expect(validateDigestIneligibilityRegister(register)).toEqual([]);
  });

  it("cites the SOP and the decision record the register belongs to", () => {
    expect(String((register as Record<string, unknown>).authority)).toContain(
      "docs/citation-verification-sop.md",
    );
    expect(String((register as Record<string, unknown>).policyBasis)).toMatch(/dynamic pages/i);
    expect(JSON.stringify(register)).toContain(POLICY_RECORD);
    // A register may not cite a decision record that does not exist.
    expect(existsSync(path.join(process.cwd(), POLICY_RECORD))).toBe(true);
  });

  it("is inside its review window, so the exclusion cannot become permanent", () => {
    const record = register as Record<string, unknown>;
    const reviewedOn = Date.parse(`${record.reviewedOn as string}T00:00:00Z`);
    const expiry = reviewedOn + (record.reviewWindowDays as number) * 86_400_000;

    expect(Number.isNaN(reviewedOn)).toBe(false);
    expect(record.reviewWindowDays).toBeGreaterThan(0);
    // Deliberately date-dependent: when the window lapses this test fails and
    // the classes must be re-measured rather than inherited.
    expect(
      Date.now() < expiry,
      `the digest-ineligibility register was last reviewed ${record.reviewedOn as string} with a ` +
        `${record.reviewWindowDays as number}-day window — re-measure each class (two fetches of its ` +
        `observation URL, comparing status, length and sha256) and re-date the register`,
    ).toBe(true);
  });

  it("records the measurement behind every class rather than an assertion", () => {
    const classes = (register as { classes: Record<string, unknown>[] }).classes;

    expect(classes.length).toBeGreaterThan(0);
    for (const entry of classes) {
      const evidence = entry.evidence as Record<string, unknown>;
      expect(entry.id, "class id").toBeTruthy();
      expect(entry.host, `host for ${entry.id as string}`).toBeTruthy();
      expect(["dynamic-per-fetch", "probe-blocked"]).toContain(entry.ineligibility);
      expect(String(entry.reason)).toMatch(/digest/i);
      expect(evidence.observedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // The method must describe a repeatable retrieval, not a recollection.
      expect(evidence.method).toMatch(/GET/i);
      expect(evidence.method).toMatch(/apart/i);
      expect(String(evidence.observation)).toMatch(/HTTP/);
      expect(Array.isArray(evidence.urls) && (evidence.urls as string[]).length > 0).toBe(true);
      expect(String(evidence.observation)).toMatch(/sha256|byte/i);
    }
  });
});

describe("digest-ineligibility register against the live corpus", () => {
  const references = verifiedReferences();
  const onDeclaredHosts = references.filter(({ reference }) => {
    try {
      return declaredHosts.has(new URL(reference.sourceUrl).host);
    } catch {
      return false;
    }
  });

  it("has references to classify, so the corpus check is not vacuous", () => {
    expect(references.length).toBeGreaterThan(100);
    expect(onDeclaredHosts.length).toBeGreaterThan(100);
  });

  it("classifies every reference on a declared host, so none escapes its class", () => {
    const unclassified = onDeclaredHosts.filter(
      ({ reference }) => digestIneligibilityClassId(reference.sourceUrl, register) === null,
    );

    expect(
      unclassified.map(({ primary, target, reference }) => `${primary}→${target} ${reference.sourceUrl}`),
      "a verified reference on a host the register declares ineligible does not match any declared " +
        "pathPattern — extend the class (with its measurement) or record a digest",
    ).toEqual([]);
  });

  it("classifies nothing on hosts the register does not declare", () => {
    const captured = references.filter(({ reference }) => {
      let host;
      try {
        host = new URL(reference.sourceUrl).host;
      } catch {
        return false;
      }
      return !declaredHosts.has(host) && digestIneligibilityClassId(reference.sourceUrl, register) !== null;
    });

    expect(captured).toEqual([]);
  });
});

describe("the ratchet is pinned to the live eligible backlog", () => {
  const report = buildReport(
    correctionFiles(),
    new Map(),
    new Date().toISOString().slice(0, 10),
    register,
  );

  it("measures exactly the pin, so it is neither slack nor overflowing", () => {
    expect(
      report.digestEligibleWithoutDigestCount,
      "the digest-eligible backlog moved — record a digest for the newly verified eligible reference " +
        "(and lower MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS), or declare a measured class",
    ).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
    expect(report.maxUndigestedEligibleVerifiedRefs).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
  });

  it("keeps the ineligible population disclosed rather than dropped", () => {
    expect(report.digestIneligibleWithoutDigestCount).toBeGreaterThan(0);
    expect(report.verifiedWithoutDigestCount).toBe(
      report.digestEligibleWithoutDigestCount + report.digestIneligibleWithoutDigestCount,
    );
    expect(Object.keys(report.digestIneligibleByClass)).toContain("pubmed-record-page");
  });

  it("reports no observability or register flag on the shipped corpus", () => {
    // What issue #518 was: this gate failing with nothing decayed.
    expect(
      report.structuralFlags.filter((flag) =>
        /content-drift observability|digest-ineligibility register/.test(flag.reason),
      ),
    ).toEqual([]);
    expect(report.digestIneligibilityRegister.expired).toBe(false);
    expect(report.digestIneligibilityRegister.issues).toEqual([]);
  });

  it("keeps the audit wired to this register and to the class-scoped pin", () => {
    const source = readFileSync(path.join(process.cwd(), AUDIT_SOURCE), "utf8");

    expect(source).toContain("docs/citation-digest-ineligible-classes.json");
    expect(source).toContain("MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS");
    // Production also applies #527's approval-gated policy. A measured class
    // must not silently approve the separate proposals.
    expect(source).toContain("register, loadDigestExemptions(process.cwd())");
    expect(source).toContain("enforceApprovalPolicy && verifiedUndigestedActionable > MAX_UNDIGESTED_VERIFIED_REFS");
  });
});
