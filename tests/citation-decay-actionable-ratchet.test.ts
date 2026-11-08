import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildReport, loadDigestIneligibilityRegister, MAX_UNDIGESTED_VERIFIED_REFS } from "../scripts/audit-citation-decay";
import { loadDigestExemptions } from "../scripts/lib/citation-digest-exemptions";
import {
  corpus,
  report as reportWith,
  register,
  STABLE_URL,
  TODAY,
  verifiedRef,
  VOLATILE_URL,
  volatileEntry,
} from "./helpers/citation-digest-exemption-fixtures";

/**
 * The undigested-verified ratchet must pin debt a qualified human can retire,
 * not debt the SOP itself instructs them to leave alone.
 *
 * Before this change one pin counted both populations. 394 of 398 verified
 * references point at source classes measured to be undigestible, so the audit
 * failed for correct behaviour and could not distinguish "a human skipped the
 * digest step" from "this source can never carry a digest". These tests pin the
 * split, and pin that the exempt population stays reported rather than hidden —
 * reclassifying debt as exempt must always be visible in the report.
 */

/** `count` verified references on a host nothing exempts: real retireable debt. */
function actionable(count: number) {
  return Array.from({ length: count }, (_, i) =>
    verifiedRef({ sourceUrl: `${STABLE_URL}?n=${i}`, citation: `citation-${i}` }),
  );
}

/** `count` verified references on the measured-volatile host. */
function exempt(count: number) {
  return Array.from({ length: count }, (_, i) =>
    verifiedRef({ sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${30000000 + i}/`, citation: `pmid-${i}` }),
  );
}

describe("actionable undigested-verified ratchet", () => {
  it("pins actionable debt only, so a large exempt population does not fail the audit", () => {
    const result = reportWith([...exempt(600), ...actionable(MAX_UNDIGESTED_VERIFIED_REFS)], [volatileEntry()]);

    expect(result.verifiedReferenceCount).toBe(600 + MAX_UNDIGESTED_VERIFIED_REFS);
    expect(result.verifiedDigestExemptCount).toBe(600);
    expect(result.verifiedUndigestedActionableCount).toBe(MAX_UNDIGESTED_VERIFIED_REFS);
    expect(result.verifiedWithoutDigestCount).toBe(600 + MAX_UNDIGESTED_VERIFIED_REFS);
    expect(result.status).toBe("PASS");
    expect(result.structuralFlags).toEqual([]);
  });

  it("fails one actionable reference over the pin and reports the exempt population alongside it", () => {
    const result = reportWith([...exempt(3), ...actionable(MAX_UNDIGESTED_VERIFIED_REFS + 1)], [volatileEntry()]);

    expect(result.status).toBe("FAIL");
    expect(result.verifiedUndigestedActionableCount).toBe(MAX_UNDIGESTED_VERIFIED_REFS + 1);
    const flag = result.structuralFlags[0];
    expect(flag.reason).toMatch(/content-drift observability regressed/);
    expect(flag.reason).toContain(`ratchet baseline ${MAX_UNDIGESTED_VERIFIED_REFS}`);
    // The exempt count must appear in the same flag, so a reader can see the
    // debt was split rather than simply forgiven.
    expect(flag.reason).toContain("3 verified references are exempt");
    expect(flag.reason).toContain("data/citation-digest-exemptions.json");
    expect(flag.reason).toContain("docs/citation-verification-sop.md");
    expect(flag.file).toBe("(corpus-wide)");
  });

  it("still fails the same way with no register at all", () => {
    const result = reportWith(actionable(MAX_UNDIGESTED_VERIFIED_REFS + 1), []);

    expect(result.verifiedDigestExemptCount).toBe(0);
    expect(result.verifiedUndigestedActionableCount).toBe(MAX_UNDIGESTED_VERIFIED_REFS + 1);
    expect(result.status).toBe("FAIL");
  });

  it("lists the actionable references so a verifier gets a worklist, not just a count", () => {
    const result = reportWith(actionable(2), []);

    expect(result.actionableUndigested).toHaveLength(2);
    expect(result.actionableUndigested[0]).toMatchObject({ sourceCheckedOn: TODAY, citation: "citation-0" });
    expect(result.actionableUndigested[0].sourceUrl).toContain("law.cornell.edu");
  });

  it("keeps drift coverage at zero while the exempt population grows, never implying detection", () => {
    const result = reportWith(exempt(500), [volatileEntry()]);

    expect(result.contentDriftDetectable).toBe(false);
    expect(result.verifiedWithDigestCount).toBe(0);
    expect(result.contentDriftCoveragePercent).toBe(0);
    expect(result.contentDriftCount).toBe(0);
  });

  it("publishes per-entry coverage so an over-broad exemption is visible", () => {
    const result = reportWith([...exempt(4), ...actionable(1)], [volatileEntry()]);

    expect(result.digestExemptionEntryCount).toBe(1);
    expect(result.digestExemptions).toEqual([
      expect.objectContaining({ id: "test-volatile", verifiedReferences: 4, stale: false }),
    ]);
  });

  it("reports an entry that exempts nothing, which usually means a dead or mis-scoped pattern", () => {
    const result = reportWith(actionable(1), [volatileEntry()]);

    expect(result.digestExemptions[0].verifiedReferences).toBe(0);
  });
});
describe("register soundness gates the audit", () => {
  it("fails when the register is invalid rather than trusting it", () => {
    const result = buildReport(corpus(exempt(2)), new Map(), TODAY, register([volatileEntry({ reason: "not-a-real-reason" })]));

    expect(result.status).toBe("FAIL");
    expect(result.digestExemptionProblemCount).toBeGreaterThan(0);
    expect(result.verifiedDigestExemptCount).toBe(0);
    expect(result.verifiedUndigestedActionableCount).toBe(2);
    expect(result.structuralFlags.map((f: { reason: string }) => f.reason).join("\n"))
      .toMatch(/digest-exemption register is invalid/);
  });

  it("fails when an exemption's measurement has expired", () => {
    const old = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), assessedOn: "2024-01-01" },
    });
    const result = buildReport(corpus(exempt(2)), new Map(), TODAY, register([old]));

    expect(result.status).toBe("FAIL");
    expect(result.structuralFlags.map((f: { reason: string }) => f.reason).join("\n"))
      .toMatch(/older than 365 days: re-measure the source class/);
    expect(result.digestExemptions[0].stale).toBe(true);
    expect(result.verifiedDigestExemptCount).toBe(0);
    expect(result.verifiedUndigestedActionableCount).toBe(2);
  });

  it("fails loudly when an entry is missing its declared host", () => {
    const result = buildReport(corpus(exempt(2)), new Map(), TODAY, register([volatileEntry({ host: "" })]));

    expect(result.status).toBe("FAIL");
    expect(result.digestExemptionProblemCount).toBeGreaterThan(0);
  });
});
describe("the committed register against the real corpus", () => {
  const root = process.cwd();
  const loaded = loadDigestExemptions(root);
  const kbDir = path.join(root, "data", "knowledge-base");
  const files = readdirSync(kbDir).filter((f) => f.endsWith(".json")).sort().map((f) => ({
    file: f,
    data: JSON.parse(readFileSync(path.join(kbDir, f), "utf8")),
  }));
  const result = buildReport(files, new Map(), TODAY, loaded);

  it("is itself valid", () => {
    expect(loaded.present).toBe(true);
    expect(loaded.problems).toEqual([]);
    expect(loaded.entries).toHaveLength(3);
  });

  it("keeps all 398 as debt while the proposed exemptions await human approval", () => {
    expect(result.verifiedReferenceCount).toBe(398);
    expect(result.verifiedWithDigestCount).toBe(0);
    expect(result.verifiedDigestExemptCount).toBe(0);
    expect(result.verifiedDigestExemptionPendingCount).toBe(394);
    expect(result.verifiedUndigestedActionableCount).toBe(398);
  });

  it("does not falsely close #518 by applying unapproved exemptions", () => {
    expect(MAX_UNDIGESTED_VERIFIED_REFS).toBe(4);
    expect(result.status).toBe("FAIL");
    expect(result.structuralFlags.some((f: { reason: string }) => f.reason.includes("awaiting qualified-human approval"))).toBe(true);
  });

  it("attributes the exempt population to the three measured source classes", () => {
    const byId = Object.fromEntries(
      result.digestExemptions.map((e: { id: string; pendingReferences: number }) => [e.id, e.pendingReferences]),
    );
    expect(byId["pubmed-article-html-bot-challenge"]).toBe(392);
    expect(byId["ecfr-current-section-html-csp-nonce"]).toBe(1);
    expect(byId["oup-article-html-bot-wall"]).toBe(1);
  });

  it("names the actionable four as the Cornell CFR references a human can still digest", () => {
    const withoutProposal = result.actionableUndigested.filter((r: { pendingExemptionId: string | null }) => !r.pendingExemptionId);
    expect(withoutProposal).toHaveLength(4);
    expect(withoutProposal.every((r: { sourceUrl: string }) => r.sourceUrl === STABLE_URL)).toBe(true);
    // Recorded 2026-08-11, before the digest field existed. A digest computed
    // now would not be anchored to that date, so this stays human work and is
    // reported as debt rather than quietly written off.
    expect(withoutProposal.every((r: { sourceCheckedOn: string }) => r.sourceCheckedOn === "2026-08-11")).toBe(true);
  });

  it("still reports drift as undetectable, so the blindness is never implied to be coverage", () => {
    expect(result.contentDriftDetectable).toBe(false);
    expect(result.contentDriftCoveragePercent).toBe(0);
    expect(result.contentDriftCount).toBe(0);
  });

  it("keeps measured-volatile sources in the worklist until approval", () => {
    expect(result.actionableUndigested.some((r: { sourceUrl: string }) => r.sourceUrl.startsWith(VOLATILE_URL))).toBe(true);
  });
});

describe("combined measured-class and approval policies", () => {
  it("does not treat the shipped measured-class register as proposal approval", () => {
    const measured = loadDigestIneligibilityRegister().register;
    const pending = volatileEntry({ review: { status: "pending-qualified-human", reviewer: null, reviewedOn: null } });
    const result = buildReport(corpus(exempt(2)), new Map(), TODAY, measured, register([pending]));

    expect(result.digestIneligibleWithoutDigestCount).toBe(2);
    expect(result.verifiedDigestExemptCount).toBe(0);
    expect(result.verifiedDigestExemptionPendingCount).toBe(2);
    expect(result.verifiedUndigestedActionableCount).toBe(2);
    expect(result.status).toBe("FAIL");
    expect(result.structuralFlags.some((f: { reason: string }) => f.reason.includes("awaiting qualified-human approval"))).toBe(true);
  });

  it("does not let an approved proposal bypass a broken measured-class register", () => {
    const result = buildReport(corpus(exempt(2)), new Map(), TODAY, null, register([volatileEntry()]));

    expect(result.verifiedDigestExemptCount).toBe(2);
    expect(result.status).toBe("FAIL");
    expect(result.structuralFlags.some((f: { reason: string }) => f.reason.includes("digest-ineligibility register unusable"))).toBe(true);
  });
});
