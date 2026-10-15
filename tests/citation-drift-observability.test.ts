import { describe, expect, it } from "vitest";

import {
  buildReport,
  hashContent,
  loadDigestIneligibilityRegister,
  MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS,
} from "../scripts/audit-citation-decay";

/**
 * Contract tests for content-drift observability in the citation-decay audit.
 *
 * Two hazards are pinned here.
 *
 * 1. `contentDriftCount: 0` is emitted both when every digested source still
 *    matches and when nothing was digest-comparable at all, so the report must
 *    distinguish the two: a `contentDigest` may only be recorded by the
 *    qualified human who verified the source (docs/citation-verification-sop.md),
 *    and its coverage is stated rather than implied (FAIL-002's ratchet).
 *
 * 2. The ratchet may only measure a backlog a human can actually move. A digest
 *    is anchored to the reference's `sourceUrl` and checked by re-fetching it,
 *    so for some URLs — PubMed record pages, which the probe is served as a
 *    per-request anti-bot interstitial; bot-walled publisher pages — no digest
 *    can ever validate, and the SOP requires omitting one rather than recording
 *    a false positive. Pinning the whole corpus-wide backlog made this gate
 *    unsatisfiable: on 2026-10-14 it failed at 398 undigested against a pin of
 *    383 with zero link rot, drift or staleness, and the auto-opened tracking
 *    issue asked for re-verification of references that had not decayed (issue
 *    #518). The ratchet now counts the digest-eligible backlog, and the
 *    ineligible classes are declared with their measurement in
 *    docs/citation-digest-ineligible-classes.json — a register that fails closed
 *    when it is missing, malformed or past its review window.
 *
 * The HTTP probe is not exercised here (no network in unit tests); an empty
 * probeResults map means every URL probe is skipped, isolating the counting.
 */

const TODAY = "2026-09-25";
/** Eligible: not declared in the register, so a digest here is achievable. */
const URL = "https://example.gov/source";
/** Declared ineligible: the probe's own fetch of this URL is never comparable. */
const PUBMED_URL = "https://pubmed.ncbi.nlm.nih.gov/30407234/";

type Ref = Record<string, unknown>;

function corpus(refs: Ref[]) {
  return [
    {
      file: "primary.json",
      data: {
        id: "primary",
        draft: false,
        todo: [],
        suggestions: [{ conditionId: "target-1", rank: 1, sourceReferences: refs }],
      },
    },
  ];
}

/** A verified reference that is current, so it cannot trip staleness. */
function verifiedRef(overrides: Ref = {}): Ref {
  return {
    citation: "38 CFR 3.310",
    sourceUrl: URL,
    sourceCheckedOn: TODAY,
    verified: true,
    ...overrides,
  };
}

/** `count` verified references on eligible URLs with no digest. */
function undigested(count: number): Ref[] {
  return Array.from({ length: count }, (_, i) =>
    verifiedRef({ sourceUrl: `${URL}?n=${i}`, citation: `citation-${i}` }),
  );
}

/** `count` verified references in a declared digest-ineligible class. */
function ineligible(count: number): Ref[] {
  return Array.from({ length: count }, (_, i) =>
    verifiedRef({ sourceUrl: `${PUBMED_URL}?pmid=${i}`, citation: `pubmed-${i}` }),
  );
}

/** The shipped register, optionally patched to exercise a fault. */
function shippedRegister(patch: Record<string, unknown> = {}): Record<string, unknown> {
  const { register } = loadDigestIneligibilityRegister();
  return { ...(register as Record<string, unknown>), ...patch };
}

function report(refs: Ref[], register?: unknown) {
  // `undefined` exercises the audit's own default: the register on disk.
  return register === undefined
    ? buildReport(corpus(refs), new Map(), TODAY)
    : buildReport(corpus(refs), new Map(), TODAY, register);
}

describe("content-drift observability", () => {
  it("reports drift as undetectable rather than clean when no digest is recorded", () => {
    const result = report([verifiedRef(), verifiedRef({ sourceUrl: `${URL}?n=2` })]);

    // The hazardous part: zero drift is reported...
    expect(result.contentDriftCount).toBe(0);
    // ...and the report now says why that zero carries no assurance.
    expect(result.contentDriftDetectable).toBe(false);
    expect(result.verifiedReferenceCount).toBe(2);
    expect(result.verifiedWithDigestCount).toBe(0);
    expect(result.verifiedWithoutDigestCount).toBe(2);
    expect(result.contentDriftCoveragePercent).toBe(0);
  });

  it("reports drift as detectable and scores coverage once digests exist", () => {
    const digested = hashContent("verified body");
    const result = report([
      verifiedRef({ contentDigest: `sha256-${digested}` }),
      verifiedRef({ sourceUrl: `${URL}?n=2` }),
    ]);

    expect(result.contentDriftDetectable).toBe(true);
    expect(result.verifiedWithDigestCount).toBe(1);
    expect(result.verifiedWithoutDigestCount).toBe(1);
    expect(result.contentDriftCoveragePercent).toBe(50);
  });

  it("rounds partial coverage to one decimal place", () => {
    const digested = hashContent("verified body");
    const result = report([
      verifiedRef({ contentDigest: `sha256-${digested}` }),
      verifiedRef({ sourceUrl: `${URL}?n=2` }),
      verifiedRef({ sourceUrl: `${URL}?n=3` }),
    ]);

    expect(result.contentDriftCoveragePercent).toBe(33.3);
  });

  it("does not credit a malformed digest as coverage", () => {
    const result = report([
      verifiedRef({ contentDigest: "md5-deadbeef" }),
      verifiedRef({ sourceUrl: `${URL}?n=2`, contentDigest: hashContent("bare hex, no prefix") }),
      verifiedRef({ sourceUrl: `${URL}?n=3`, contentDigest: "" }),
    ]);

    expect(result.verifiedWithDigestCount).toBe(0);
    expect(result.verifiedWithoutDigestCount).toBe(3);
    expect(result.contentDriftDetectable).toBe(false);
  });

  it("counts only verified references with a URL, since a digest anchors to both", () => {
    const result = report([
      verifiedRef(),
      // Unverified: no human verification has occurred, so no digest is expected.
      verifiedRef({ sourceUrl: `${URL}?n=2`, verified: false }),
      // No URL: nothing to hash, and the schema forbids a digest without one.
      { citation: "no url", verified: true, sourceCheckedOn: TODAY },
      // verified omitted entirely is not an affirmative verification.
      { citation: "unset", sourceUrl: `${URL}?n=3`, sourceCheckedOn: TODAY },
    ]);

    expect(result.verifiedReferenceCount).toBe(1);
    expect(result.verifiedWithoutDigestCount).toBe(1);
  });

  it("treats an empty verified population as fully covered, not as a division by zero", () => {
    const result = report([]);

    expect(result.verifiedReferenceCount).toBe(0);
    expect(result.contentDriftCoveragePercent).toBe(100);
    expect(result.digestEligibleCoveragePercent).toBe(100);
    expect(result.contentDriftDetectable).toBe(false);
  });
});

describe("digest-eligible ratchet", () => {
  it("exposes the pin and the eligible population in the report", () => {
    const result = report([]);

    expect(result.maxUndigestedEligibleVerifiedRefs).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
    expect(result.digestEligibleWithoutDigestCount).toBe(0);
    expect(result.digestIneligibleWithoutDigestCount).toBe(0);
    expect(result.digestEligibleReferenceCount).toBe(0);
  });

  it("passes at exactly the baseline without raising a structural flag", () => {
    const result = report(undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS));

    expect(result.digestEligibleWithoutDigestCount).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
    expect(result.status).toBe("PASS");
    expect(result.structuralFlags).toEqual([]);
  });

  it("fails one eligible reference over the baseline and names the SOP as the remedy", () => {
    const result = report(undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS + 1));

    expect(result.status).toBe("FAIL");
    expect(result.structuralFlagCount).toBe(1);
    const flag = result.structuralFlags[0];
    expect(flag.reason).toMatch(/content-drift observability regressed/);
    expect(flag.reason).toContain(`ratchet baseline ${MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS}`);
    expect(flag.reason).toContain("docs/citation-verification-sop.md");
    // The remedy must point at the register that decides eligibility, so the
    // reader can tell a missing digest from an impossible one.
    expect(flag.reason).toContain("docs/citation-digest-ineligible-classes.json");
    expect(flag.reason).toMatch(/measured class list/);
    expect(flag.reason).toMatch(/not headroom/);
    // The failure must not be attributable to a per-reference defect.
    expect(flag.file).toBe("(corpus-wide)");
    expect(result.staleCount).toBe(0);
    expect(result.linkRotCount).toBe(0);
  });

  it("lets recording digests shrink the backlog back under the pin", () => {
    const refs = undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS + 1);
    // Simulate the qualified-human step: one more digest recorded.
    refs[0].contentDigest = `sha256-${hashContent("newly verified body")}`;

    const result = report(refs);

    expect(result.digestEligibleWithoutDigestCount).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
    expect(result.status).toBe("PASS");
  });

  it("never counts a declared digest-ineligible reference against the pin", () => {
    // Issue #518 regression: this is the population the SOP forbids digesting,
    // and the gate used to fail because of it alone.
    const refs = [...undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS), ...ineligible(400)];

    const result = report(refs);

    expect(result.digestEligibleWithoutDigestCount).toBe(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS);
    expect(result.digestIneligibleWithoutDigestCount).toBe(400);
    expect(result.digestIneligibleByClass["pubmed-record-page"]).toBe(400);
    expect(result.status).toBe("PASS");
    expect(result.structuralFlags).toEqual([]);
  });

  it("still fails when only the eligible backlog grows, however large the excluded class", () => {
    const refs = [
      ...undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS + 1),
      ...ineligible(400),
    ];

    const result = report(refs);

    expect(result.status).toBe("FAIL");
    expect(result.structuralFlagCount).toBe(1);
    // The excluded population is disclosed inside the failure, not silently dropped.
    expect(result.structuralFlags[0].reason).toContain("400 further verified references");
    expect(result.structuralFlags[0].reason).toContain("pubmed-record-page");
  });

  it("keeps the corpus-wide count as the sum of both populations", () => {
    const refs = [...undigested(2), ...ineligible(3)];

    const result = report(refs);

    expect(result.verifiedWithoutDigestCount).toBe(5);
    expect(result.verifiedWithoutDigestCount).toBe(
      result.digestEligibleWithoutDigestCount + result.digestIneligibleWithoutDigestCount,
    );
  });

  it("scores coverage against the achievable population as well as the whole corpus", () => {
    const digested = hashContent("stable page body");
    const result = report([
      verifiedRef({ contentDigest: `sha256-${digested}` }),
      verifiedRef({ sourceUrl: `${URL}?n=2` }),
      ...ineligible(3),
    ]);

    // One of two eligible references carries a digest...
    expect(result.digestEligibleReferenceCount).toBe(2);
    expect(result.digestEligibleCoveragePercent).toBe(50);
    // ...while corpus-wide coverage stays at one of five, which is the honest
    // number for a reader asking how much drift detection can see.
    expect(result.contentDriftCoveragePercent).toBe(20);
  });

  it("treats an unknown or unparsable URL as eligible, so it cannot escape the pin", () => {
    const result = report([
      undigested(MAX_UNDIGESTED_ELIGIBLE_VERIFIED_REFS)[0],
      verifiedRef({ sourceUrl: "not a url", citation: "unparsable" }),
      verifiedRef({ sourceUrl: `${URL}?n=9`, citation: "plain" }),
    ]);

    expect(result.digestEligibleWithoutDigestCount).toBe(3);
    expect(result.digestIneligibleWithoutDigestCount).toBe(0);
  });
});

describe("digest-ineligibility register fails closed", () => {
  const APPLIED =
    "Re-measure each declared class (two fetches of its observation URL, comparing HTTP status, byte length and sha256)";

  it("flags a register that cannot be read at all", () => {
    const result = report([verifiedRef()], null);

    expect(result.status).toBe("FAIL");
    const flag = result.structuralFlags.find((entry) => /register unusable/.test(entry.reason));
    expect(flag).toBeDefined();
    expect(flag?.reason).toContain(APPLIED);
    // The register summary must not claim classes it could not read.
    expect(result.digestIneligibilityRegister.classes).toEqual([]);
    expect(result.digestIneligibilityRegister.expired).toBe(false);
  });

  it("flags a malformed class instead of reading it as an exemption", () => {
    const result = report(
      [verifiedRef()],
      shippedRegister({ classes: [{ id: "half-written", host: "example.gov" }] }),
    );

    expect(result.status).toBe("FAIL");
    const flag = result.structuralFlags.find((entry) => /register unusable/.test(entry.reason));
    expect(flag?.reason).toContain("pathPattern must be a non-empty string");
    expect(flag?.reason).toContain("must be an object recording the measurement");
  });

  it("flags an expired review window rather than treating the classes as permanent", () => {
    const result = report(
      [verifiedRef()],
      shippedRegister({ reviewedOn: "2020-01-01" }),
    );

    expect(result.status).toBe("FAIL");
    expect(result.digestIneligibilityRegister.expired).toBe(true);
    expect(result.digestIneligibilityRegister.reviewExpiresOn).toBe("2020-06-29");
    const flag = result.structuralFlags.find((entry) => /review expired/.test(entry.reason));
    expect(flag?.reason).toContain("measured on 2020-01-01");
    expect(flag?.reason).toContain(APPLIED);
    // The eligible backlog itself was fine: only the register's freshness failed.
    expect(result.digestEligibleWithoutDigestCount).toBe(1);
  });

  it("discloses the declared classes and the review dates it applied", () => {
    const result = report([verifiedRef()]);

    expect(result.digestIneligibilityRegister.issues).toEqual([]);
    expect(result.digestIneligibilityRegister.expired).toBe(false);
    expect(result.digestIneligibilityRegister.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.digestIneligibilityRegister.reviewExpiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.digestIneligibilityRegister.classes.map((entry) => entry.id)).toContain(
      "pubmed-record-page",
    );
    expect(result.digestIneligibilityRegister.classes.map((entry) => entry.host)).toContain(
      "pubmed.ncbi.nlm.nih.gov",
    );
  });
});
