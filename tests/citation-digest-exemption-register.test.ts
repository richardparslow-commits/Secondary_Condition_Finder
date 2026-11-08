import { describe, expect, it } from "vitest";

import {
  classifyDigestPosition,
  DIGEST_EXEMPTION_REASONS,
  EXEMPTION_REASSESS_AFTER_DAYS,
  exemptionAssessmentStale,
  findDigestExemption,
  loadDigestExemptions,
  validateEntry,
} from "../scripts/lib/citation-digest-exemptions";
import { hashContent } from "../scripts/audit-citation-decay";
import {
  register,
  TODAY,
  VOLATILE_URL,
  volatileEntry,
} from "./helpers/citation-digest-exemption-fixtures";

/**
 * The digest-exemption register exists because two SOP rules collided.
 *
 * docs/citation-verification-sop.md requires a body that varies per fetch to
 * OMIT its contentDigest rather than record a value that false-positives on
 * every probe, and separately fails the decay audit for any `verified: true`
 * reference that lacks one. 394 of the 398 verified references point at source
 * classes measured to be undigestible, so following the first rule guaranteed
 * breaching the second, and the weekly probe failed for correct behaviour.
 *
 * These tests pin the resolution: an exemption must be earned by a measurement,
 * and matching fails closed so an unsound or over-broad entry grants nothing.
 */

describe("digest-exemption register validation", () => {
  it("accepts a fully evidenced entry", () => {
    expect(validateEntry(volatileEntry(), 0)).toEqual([]);
  });

  it("rejects an entry with no measurement behind it", () => {
    const entry = volatileEntry();
    delete entry.assessment;
    expect(validateEntry(entry, 0).join("\n")).toMatch(/assessment is required/);
  });

  it("refuses to exempt a body that measured deterministic", () => {
    // A stable body should carry a digest, not an exemption; allowing this would
    // turn the register into a way to waive real, retireable debt.
    const entry = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), deterministic: true, distinctBodyDigests: 1 },
    });
    const problems = validateEntry(entry, 0).join("\n");
    expect(problems).toMatch(/deterministic must be false/);
    expect(problems).toMatch(/at least two distinct body digests/);
  });

  it("refuses to infer volatility from a single fetch", () => {
    const entry = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), sampleCount: 1, distinctBodyDigests: 1 },
    });
    expect(validateEntry(entry, 0).join("\n")).toMatch(/sampleCount must be an integer >= 2/);
  });

  it("refuses an impossible distinct-digest count", () => {
    const entry = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), sampleCount: 3, distinctBodyDigests: 5 },
    });
    expect(validateEntry(entry, 0).join("\n")).toMatch(/exceeds assessment.sampleCount/);
  });

  it("requires a bot-walled entry to have actually been refused", () => {
    const entry = volatileEntry({
      reason: "bot-walled-body-unavailable",
      assessment: { ...(volatileEntry().assessment as object), httpStatuses: [200, 200, 200] },
    });
    expect(validateEntry(entry, 0).join("\n")).toMatch(/every observed status to be >= 400/);
  });

  it("rejects a reason outside the closed vocabulary", () => {
    const problems = validateEntry(volatileEntry({ reason: "too-much-work" }), 0).join("\n");
    expect(problems).toMatch(/reason must be one of/);
    expect(DIGEST_EXEMPTION_REASONS).toEqual(["volatile-body-per-fetch", "bot-walled-body-unavailable"]);
  });

  it("rejects an invalid urlPattern and a missing SOP basis", () => {
    const problems = validateEntry(volatileEntry({ urlPattern: "^https://(unclosed", sopBasis: "" }), 0).join("\n");
    expect(problems).toMatch(/not a valid regular expression/);
    expect(problems).toMatch(/sopBasis is required/);
  });

  it("requires a review block so sign-off state is always recorded", () => {
    const entry = volatileEntry();
    delete entry.review;
    expect(validateEntry(entry, 0).join("\n")).toMatch(/review is required/);
  });

  it("flags duplicate ids so two entries cannot shadow one another", () => {
    expect(register([volatileEntry(), volatileEntry()]).problems.join("\n")).toMatch(/duplicate id/);
  });

});

describe("exemption matching fails closed", () => {
  it("exempts a URL on the declared host", () => {
    const loaded = register([volatileEntry()]);
    expect(findDigestExemption(VOLATILE_URL, loaded.compiled)?.entry.id).toBe("test-volatile");
  });

  it("does not exempt another host smuggled into the path of an over-broad pattern", () => {
    // The declared host must match the URL's real host, so a pattern written
    // loosely enough to reach elsewhere cannot silently exempt a source nobody
    // measured.
    const loose = volatileEntry({ id: "loose", urlPattern: "pubmed\\.ncbi\\.nlm\\.nih\\.gov/\\d+" });
    const loaded = register([loose]);
    const spoofed = "https://evil.example/pubmed.ncbi.nlm.nih.gov/12345/";
    expect(findDigestExemption(spoofed, loaded.compiled)?.mismatchedHost).toBe(true);
    expect(classifyDigestPosition({ sourceUrl: spoofed }, loaded.compiled).state).toBe("actionable");
  });

  it("does not apply an HTTPS measurement to an HTTP source URL", () => {
    const mixedScheme = volatileEntry({
      urlPattern: "^https?://pubmed\\.ncbi\\.nlm\\.nih\\.gov/\\d+/?$",
    });
    const loaded = register([mixedScheme]);
    const httpUrl = "http://pubmed.ncbi.nlm.nih.gov/30407234/";

    expect(findDigestExemption(httpUrl, loaded.compiled)).toBeNull();
    expect(classifyDigestPosition({ sourceUrl: httpUrl }, loaded.compiled).state).toBe("actionable");
  });

  it("classifies a well-formed digest as digested regardless of any exemption", () => {
    const loaded = register([volatileEntry()]);
    const position = classifyDigestPosition(
      { sourceUrl: VOLATILE_URL, contentDigest: `sha256-${hashContent("body")}` },
      loaded.compiled,
    );
    expect(position.state).toBe("digested");
  });

  it("does not credit a malformed digest as coverage", () => {
    const loaded = register([volatileEntry()]);
    // A malformed recorded digest is a defect even on an exempt host: it must
    // remain debt rather than being hidden behind a waiver.
    expect(classifyDigestPosition({ sourceUrl: VOLATILE_URL, contentDigest: "md5-deadbeef" }, loaded.compiled).state)
      .toBe("actionable");
    expect(classifyDigestPosition({ sourceUrl: "https://example.gov/x", contentDigest: "md5-deadbeef" }, loaded.compiled).state)
      .toBe("actionable");
  });

  it("leaves an unmatched or URL-less reference actionable", () => {
    const loaded = register([volatileEntry()]);
    expect(classifyDigestPosition({ sourceUrl: "https://example.gov/x" }, loaded.compiled).state).toBe("actionable");
    expect(classifyDigestPosition({ sourceUrl: undefined }, loaded.compiled).state).toBe("actionable");
    expect(classifyDigestPosition(undefined, loaded.compiled).state).toBe("actionable");
  });

  it.each(["2026-02-30", "2026-10-12"])("does not exempt an invalid or future assessment %s", (assessedOn) => {
    const loaded = register([volatileEntry({ assessment: { ...(volatileEntry().assessment as object), assessedOn } })]);
    expect(classifyDigestPosition({ sourceUrl: VOLATILE_URL }, loaded.compiled, TODAY).state).toBe("actionable");
  });

  it("does not activate pending or rejected exemptions", () => {
    for (const status of ["pending-qualified-human", "rejected"]) {
      const loaded = register([volatileEntry({ review: { status } })]);
      expect(classifyDigestPosition({ sourceUrl: VOLATILE_URL }, loaded.compiled, TODAY).state).toBe("actionable");
    }
  });

  it("requires real approval metadata before activating an exemption", () => {
    const entry = volatileEntry({ review: { status: "approved" } });
    expect(validateEntry(entry, 0).join("\n")).toMatch(/named reviewer/);
    expect(register([entry]).compiled).toEqual([]);
  });

  it("expires an assessment older than the re-measurement window", () => {
    const old = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), assessedOn: "2024-01-01" },
    });
    const rejected = volatileEntry({
      assessment: { ...(volatileEntry().assessment as object), assessedOn: "2024-01-01" },
      review: { status: "rejected" },
    });
    expect(exemptionAssessmentStale(old, TODAY)).toBe(true);
    expect(exemptionAssessmentStale(rejected, TODAY)).toBe(false);
    expect(exemptionAssessmentStale(volatileEntry(), TODAY)).toBe(false);
    expect(exemptionAssessmentStale({}, TODAY)).toBe(true);
    expect(EXEMPTION_REASSESS_AFTER_DAYS).toBe(365);
  });

  it("treats a missing register file as empty rather than as an error", () => {
    const loaded = loadDigestExemptions("/nonexistent-root-for-test");
    expect(loaded.present).toBe(false);
    expect(loaded.entries).toEqual([]);
    expect(loaded.problems).toEqual([]);
  });
});
