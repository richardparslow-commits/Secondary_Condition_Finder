import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildReport, CITATION_CEILING } from "../scripts/audit-citation-decay";

/**
 * Signal-integrity tests for the citation-decay gate (npm run citations:decay).
 *
 * Two defects are pinned here.
 *
 * FAIL-006 - the docblock promises the audit "Hard-fails ... when decayed live
 * references are found, because a dead URL can never support a nexus", but the
 * status-driving `decays` array omitted link rot entirely. Dead URLs reached
 * status only through CITATION_CEILING, a budget shared with staleness and
 * drift, so up to ten dead links supporting live nexuses passed the weekly gate
 * while a single merely stale URL failed it outright. Severity was inverted
 * against the gate's own documented rationale.
 *
 * FAIL-007 - the ceiling also counted unverified references, debt that
 * audit-citation-verification.js already ratchets at
 * CITATION_DEBT_BASELINE.unverified and hard-fails if it grows. With 915
 * unverified references against a budget of 10 the ceiling was permanently
 * saturated: the gate failed on every run irrespective of link rot or drift, so
 * it could signal neither - and it masked FAIL-002's digest-coverage ratchet.
 *
 * The HTTP probe is not exercised (no network in unit tests); probe verdicts
 * are supplied directly to buildReport.
 */

const TODAY = "2026-09-20";
const URL = "https://example.gov/guideline";
const VALID_DIGEST = `sha256-${"a".repeat(64)}`;

function mappingFixture(id: string, suggestions: unknown[]) {
  // Matches the { file, data } shape readJsonFiles() hands to buildReport.
  return { file: `${id}.json`, data: { id, draft: false, todo: [], suggestions } };
}

function suggestionFixture(conditionId: string, sourceReferences: unknown[]) {
  return { conditionId, rank: 1, sourceReferences };
}

function oneMapping(refs: unknown[]) {
  return [mappingFixture("primary-x", [suggestionFixture("secondary-y", refs)])];
}

/** A verified, freshly checked reference: no staleness or structural noise. */
function liveRef(overrides: Record<string, unknown> = {}) {
  return {
    citation: "Live nexus source",
    note: "gate-signal fixture",
    sourceUrl: URL,
    verified: true,
    sourceCheckedOn: TODAY,
    ...overrides,
  };
}

function probe(overrides: Record<string, unknown>) {
  return new Map([[URL, { ok: true, status: 200, ...overrides }]]);
}

describe("FAIL-006: link rot hard-fails the gate", () => {
  it("fails on a single dead URL", () => {
    const report = buildReport(oneMapping([liveRef()]), probe({ ok: false, status: 404 }), TODAY);

    expect(report.linkRotCount).toBe(1);
    expect(report.status).toBe("FAIL");
    expect(report.decayed[0]).toMatchObject({
      primary: "primary-x",
      target: "secondary-y",
      sourceUrl: URL,
      status: 404,
    });
  });

  it("fails at exactly the ceiling, where the old budget-only logic passed", () => {
    // Ten dead links sat at ceiling usage 10 - not > 10 - so the gate passed
    // while live nexuses rested on ten dead URLs.
    const refs = Array.from({ length: CITATION_CEILING }, (_, i) =>
      liveRef({ citation: `Dead source ${i + 1}` }),
    );
    const report = buildReport(oneMapping(refs), probe({ ok: false, status: 410 }), TODAY);

    expect(report.linkRotCount).toBe(CITATION_CEILING);
    expect(report.citationCeilingUsage).toBe(CITATION_CEILING);
    // The budget clause alone cannot explain this verdict: usage does not
    // exceed the ceiling, so the hard-fail path is what fires.
    expect(report.citationCeilingUsage).not.toBeGreaterThan(report.citationCeiling);
    expect(report.status).toBe("FAIL");
  });

  it("fails on network errors and 5xx as well as 4xx", () => {
    for (const status of [0, 404, 410, 500, 503]) {
      const report = buildReport(oneMapping([liveRef()]), probe({ ok: false, status }), TODAY);
      expect(report.status, `status ${status}`).toBe("FAIL");
      expect(report.linkRotCount, `status ${status}`).toBe(1);
    }
  });

  it("still treats a bot-walled host as unverifiable rather than decayed", () => {
    // Documented exemption: CI must not be held hostage by bot walls.
    const report = buildReport(oneMapping([liveRef()]), probe({ blocked: true, status: 403 }), TODAY);

    expect(report.botBlockedUnverifiableCount).toBe(1);
    expect(report.linkRotCount).toBe(0);
    expect(report.status).toBe("PASS");
  });

  it("keeps a stale reference a hard failure alongside link rot", () => {
    const report = buildReport(oneMapping([liveRef({ sourceCheckedOn: "2020-01-01" })]), probe({}), TODAY);

    expect(report.staleCount).toBe(1);
    expect(report.status).toBe("FAIL");
  });
});

describe("FAIL-007: verification debt no longer saturates the gate", () => {
  it("excludes unverified references from the ceiling", () => {
    const refs = Array.from({ length: 12 }, (_, i) => ({
      citation: `Never verified ${i + 1}`,
      note: "debt fixture",
      verified: false,
    }));
    const report = buildReport(oneMapping(refs), new Map(), TODAY);

    expect(report.unverifiedCount).toBe(12);
    expect(report.citationCeilingUsage).toBe(0);
    expect(report.status).toBe("PASS");
  });

  it("would not saturate at the real corpus debt level", () => {
    // The live corpus carries 915 unverified references against a ceiling of
    // 10. That debt is ratcheted by citations:audit, not gated here, so this
    // gate stays able to report on rot, staleness and drift.
    const refs = Array.from({ length: 915 }, (_, i) => ({
      citation: `Pending verification ${i + 1}`,
      note: "debt fixture",
      verified: false,
    }));
    const report = buildReport(oneMapping(refs), new Map(), TODAY);

    expect(report.unverifiedCount).toBe(915);
    expect(report.citationCeilingUsage).toBe(0);
    expect(report.citationCeiling).toBe(CITATION_CEILING);
    expect(report.status).toBe("PASS");
  });

  it("still surfaces decay when debt is present", () => {
    // Debt alone passes; debt plus a dead URL must still fail. This is exactly
    // the signal the saturated ceiling destroyed.
    const refs = [
      ...Array.from({ length: 20 }, (_, i) => ({
        citation: `Never verified ${i + 1}`,
        note: "debt fixture",
        verified: false,
      })),
      liveRef(),
    ];
    const report = buildReport(oneMapping(refs), probe({ ok: false, status: 404 }), TODAY);

    expect(report.unverifiedCount).toBe(20);
    expect(report.linkRotCount).toBe(1);
    expect(report.status).toBe("FAIL");
  });
});

describe("the ceiling is now the content-drift tolerance budget", () => {
  it("flags drift within budget without hard-failing", () => {
    const report = buildReport(
      oneMapping([liveRef({ contentDigest: VALID_DIGEST })]),
      probe({ body: "revised body", drift: true, digestMatched: false }),
      TODAY,
    );

    expect(report.contentDriftCount).toBe(1);
    expect(report.citationCeilingUsage).toBe(1);
    expect(report.status).toBe("PASS");
  });

  it("hard-fails when drift exceeds the ceiling", () => {
    const refs = Array.from({ length: CITATION_CEILING + 1 }, (_, i) =>
      liveRef({ citation: `Drifted source ${i + 1}`, contentDigest: VALID_DIGEST }),
    );
    const report = buildReport(
      oneMapping(refs),
      probe({ body: "revised body", drift: true, digestMatched: false }),
      TODAY,
    );

    expect(report.contentDriftCount).toBe(CITATION_CEILING + 1);
    expect(report.citationCeilingUsage).toBe(CITATION_CEILING + 1);
    expect(report.status).toBe("FAIL");
  });

  it("passes a clean corpus", () => {
    const report = buildReport(oneMapping([liveRef()]), probe({}), TODAY);

    expect(report.status).toBe("PASS");
    expect(report.citationCeilingUsage).toBe(0);
    expect(report.linkRotCount).toBe(0);
    expect(report.contentDriftCount).toBe(0);
    expect(report.staleCount).toBe(0);
    expect(report.structuralFlagCount).toBe(0);
  });

  it("counts the union of link rot, staleness and drift toward the ceiling", () => {
    const dead = "https://example.gov/dead";
    const staleUrl = "https://example.gov/stale";
    const driftedUrl = "https://example.gov/drifted";
    const probeResults = new Map([
      [dead, { ok: false, status: 404 }],
      [staleUrl, { ok: true, status: 200 }],
      [driftedUrl, { ok: true, status: 200, body: "revised", drift: true, digestMatched: false }],
    ]);
    const refs = [
      liveRef({ citation: "Dead source", sourceUrl: dead }),
      liveRef({ citation: "Stale source", sourceUrl: staleUrl, sourceCheckedOn: "2020-01-01" }),
      liveRef({ citation: "Drifted source", sourceUrl: driftedUrl, contentDigest: VALID_DIGEST }),
    ];

    const report = buildReport(oneMapping(refs), probeResults, TODAY);

    expect(report.linkRotCount).toBe(1);
    expect(report.staleCount).toBe(1);
    expect(report.contentDriftCount).toBe(1);
    expect(report.unverifiedCount).toBe(0);
    expect(report.citationCeilingUsage).toBe(3);
    expect(report.status).toBe("FAIL");
  });
});

describe("documentation matches enforcement", () => {
  it("keeps the hard-fail promise wired to link rot and debt out of the ceiling", () => {
    const source = readFileSync(
      path.join(process.cwd(), "scripts/audit-citation-decay.js"),
      "utf8",
    );

    // The docblock promise must stay backed by the status-driving union.
    expect(source).toContain("Hard-fails the audit when decayed live");
    expect(source).toContain("const decays = [...stale, ...trueLinkRot, ...flags];");

    // Verification debt must not re-enter the ceiling: that is what saturated
    // the gate at 690/10 and silenced every other signal it could report.
    expect(source).not.toContain("const ceiling = unverified.length");
    expect(source).toContain("const ceiling = trueLinkRot.length + stale.length + drifted.length;");
  });
});
