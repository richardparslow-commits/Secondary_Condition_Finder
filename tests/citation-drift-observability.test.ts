import { describe, expect, it } from "vitest";

import {
  buildReport,
  hashContent,
  MAX_UNDIGESTED_VERIFIED_REFS,
} from "../scripts/audit-citation-decay";

/**
 * Contract tests for content-drift observability in the citation-decay audit.
 *
 * A `contentDigest` may only be recorded by the qualified human who verified
 * the source and is anchored to that verification's `sourceCheckedOn` date, so
 * no script may backfill one (docs/citation-verification-sop.md). That makes
 * the digest population a monotonic backlog, and it creates a reporting hazard:
 * `contentDriftCount: 0` is emitted both when every digested source still
 * matches and when nothing was digest-comparable at all. These tests pin that
 * the report distinguishes the two, and that the backlog cannot grow past
 * MAX_UNDIGESTED_VERIFIED_REFS without failing the audit.
 *
 * The HTTP probe is not exercised here (no network in unit tests); an empty
 * probeResults map means every URL probe is skipped, isolating the counting.
 */

const TODAY = "2026-09-25";
const URL = "https://example.gov/source";

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

/** `count` verified references with no digest — the ratchet's population. */
function undigested(count: number): Ref[] {
  return Array.from({ length: count }, (_, i) =>
    verifiedRef({ sourceUrl: `${URL}?n=${i}`, citation: `citation-${i}` }),
  );
}

function report(refs: Ref[]) {
  return buildReport(corpus(refs), new Map(), TODAY);
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
    expect(result.contentDriftDetectable).toBe(false);
  });
});

describe("undigested-verified ratchet", () => {
  it("exposes the pin in the report so the ceiling is visible to readers", () => {
    expect(report([]).maxUndigestedVerifiedRefs).toBe(MAX_UNDIGESTED_VERIFIED_REFS);
  });

  it("passes at exactly the baseline without raising a structural flag", () => {
    const result = report(undigested(MAX_UNDIGESTED_VERIFIED_REFS));

    expect(result.verifiedWithoutDigestCount).toBe(MAX_UNDIGESTED_VERIFIED_REFS);
    expect(result.status).toBe("PASS");
    expect(result.structuralFlags).toEqual([]);
  });

  it("fails one reference over the baseline and names the SOP as the remedy", () => {
    const result = report(undigested(MAX_UNDIGESTED_VERIFIED_REFS + 1));

    expect(result.status).toBe("FAIL");
    expect(result.structuralFlagCount).toBe(1);
    const flag = result.structuralFlags[0];
    expect(flag.reason).toMatch(/content-drift observability regressed/);
    expect(flag.reason).toContain(`ratchet baseline ${MAX_UNDIGESTED_VERIFIED_REFS}`);
    expect(flag.reason).toContain("docs/citation-verification-sop.md");
    // The failure must not be attributable to a per-reference defect.
    expect(flag.file).toBe("(corpus-wide)");
    expect(result.staleCount).toBe(0);
    expect(result.linkRotCount).toBe(0);
  });

  it("lets recording digests shrink the backlog back under the pin", () => {
    const refs = undigested(MAX_UNDIGESTED_VERIFIED_REFS + 1);
    // Simulate the qualified-human step: one more digest recorded.
    refs[0].contentDigest = `sha256-${hashContent("newly verified body")}`;

    const result = report(refs);

    expect(result.verifiedWithoutDigestCount).toBe(MAX_UNDIGESTED_VERIFIED_REFS);
    expect(result.status).toBe("PASS");
  });
});
