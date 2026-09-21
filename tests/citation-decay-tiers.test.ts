import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildReport,
  hashContent,
  parseContentDigest,
  stalenessWindowDays,
  STALE_AFTER_DAYS_BY_CATEGORY,
  DEFAULT_STALE_AFTER_DAYS,
} from "../scripts/audit-citation-decay";

/**
 * Contract tests for the tiered citation-decay audit. The HTTP probe is not
 * exercised here (no network in unit tests); these pin the pure surfaces:
 * per-authorityCategory staleness windows, the self-describing contentDigest
 * format, and buildReport's classification of probe results into
 * stale / drifted / decayed / blocked buckets.
 */

function mappingFixture(id: string, suggestions: unknown[]) {
  // Matches the { file, data } shape readJsonFiles() hands to buildReport.
  return { file: `${id}.json`, data: { id, draft: false, todo: [], suggestions } };
}

function suggestionFixture(conditionId: string, sourceReferences: unknown[]) {
  return { conditionId, rank: 1, sourceReferences };
}

describe("tiered staleness windows", () => {
  it("assigns the long window to statutory and regulatory authority", () => {
    expect(stalenessWindowDays({ authorityCategory: "statutory-authority" })).toBe(1095);
    expect(stalenessWindowDays({ authorityCategory: "current-regulatory-authority" })).toBe(1095);
    expect(stalenessWindowDays({ authorityCategory: "federal-register-final-rule" })).toBe(1095);
    expect(STALE_AFTER_DAYS_BY_CATEGORY["medical-scientific-evidence"]).toBe(540);
    expect(STALE_AFTER_DAYS_BY_CATEGORY["va-adjudication-guidance"]).toBe(730);
  });

  it("keeps the historical window for uncategorized legacy references", () => {
    expect(stalenessWindowDays({})).toBe(DEFAULT_STALE_AFTER_DAYS);
    expect(DEFAULT_STALE_AFTER_DAYS).toBe(365);
  });

  it("decays medical evidence faster than legal authority", () => {
    expect(STALE_AFTER_DAYS_BY_CATEGORY["medical-scientific-evidence"]).toBeLessThan(
      STALE_AFTER_DAYS_BY_CATEGORY["statutory-authority"],
    );
  });
});

describe("content digest helpers", () => {
  it("parses the self-describing sha256 format and rejects everything else", () => {
    const hex = createHash("sha256").update("body", "utf8").digest("hex");
    expect(parseContentDigest(`sha256-${hex}`)).toBe(hex);
    expect(parseContentDigest(`sha256-${hex.toUpperCase()}`)).toBe(hex);
    expect(parseContentDigest(hex)).toBeNull();
    expect(parseContentDigest("md5-abc")).toBeNull();
    expect(parseContentDigest("")).toBeNull();
    expect(parseContentDigest(undefined)).toBeNull();
  });

  it("hashes content the same way the verification capture is specified", () => {
    expect(hashContent("retracted paper body")).toBe(
      createHash("sha256").update("retracted paper body", "utf8").digest("hex"),
    );
  });
});

describe("buildReport classification", () => {
  const TODAY = "2026-09-20";
  const URL = "https://example.gov/guideline";

  function probeResults(overrides: Record<string, unknown>) {
    return new Map([[URL, { ok: true, status: 200, ...overrides }]]);
  }

  it("flags a medical reference past its 540-day tier as stale with the window recorded", () => {
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "Clinical guideline 2020",
            note: "tiered-window fixture",
            authorityCategory: "medical-scientific-evidence",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: "2024-01-01",
          },
        ]),
      ]),
    ];

    const report = buildReport(files, probeResults({}), TODAY);
    expect(report.status).toBe("FAIL");
    expect(report.staleCount).toBe(1);
    expect(report.stale[0]).toMatchObject({
      primary: "primary-x",
      target: "secondary-y",
      windowDays: 540,
      authorityCategory: "medical-scientific-evidence",
    });
  });

  it("does not flag the same age under the statutory window", () => {
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "38 CFR 3.310",
            note: "tiered-window fixture",
            authorityCategory: "statutory-authority",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: "2024-01-01",
          },
        ]),
      ]),
    ];

    const report = buildReport(files, probeResults({}), TODAY);
    expect(report.staleCount).toBe(0);
  });

  it("reports digest mismatch at HTTP 200 as content drift, not decay", () => {
    const recorded = parseContentDigest(
      "sha256-" + createHash("sha256").update("original verified body", "utf8").digest("hex"),
    );
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "Retracted study",
            note: "content-drift fixture",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: TODAY,
            contentDigest: "sha256-" + createHash("sha256").update("original verified body", "utf8").digest("hex"),
          },
        ]),
      ]),
    ];

    const report = buildReport(
      files,
      probeResults({ body: "retracted and replaced body", drift: true, digestMatched: false }),
      TODAY,
    );
    expect(report.contentDriftCount).toBe(1);
    expect(report.linkRotCount).toBe(0);
    expect(report.contentDrift[0]?.primary).toBe("primary-x");
    expect(recorded).not.toBeNull();
  });

  it("does not flag a digest match as drift", () => {
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "Stable guideline",
            note: "content-drift fixture",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: TODAY,
            contentDigest: "sha256-" + hashContent("unchanged body"),
          },
        ]),
      ]),
    ];

    const report = buildReport(
      files,
      probeResults({ body: "unchanged body", drift: false }),
      TODAY,
    );
    expect(report.contentDriftCount).toBe(0);
    expect(report.status).toBe("PASS");
  });

  it("treats a bot-walled 403 as unverifiable rather than decayed", () => {
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "Publisher behind bot wall",
            note: "bot-wall fixture",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: TODAY,
          },
        ]),
      ]),
    ];

    const report = buildReport(files, probeResults({ blocked: true, status: 403 }), TODAY);
    expect(report.botBlockedUnverifiableCount).toBe(1);
    expect(report.linkRotCount).toBe(0);
  });

  it("counts stale plus unverified plus decayed plus drifted toward the ceiling", () => {
    const files = [
      mappingFixture("primary-x", [
        suggestionFixture("secondary-y", [
          {
            citation: "Old uncategorized reference",
            note: "ceiling fixture",
            sourceUrl: URL,
            verified: true,
            sourceCheckedOn: "2020-01-01",
          },
        ]),
      ]),
      mappingFixture("primary-z", [
        suggestionFixture("secondary-y", [
          { citation: "Never verified", note: "ceiling fixture", verified: false },
        ]),
      ]),
    ];

    const report = buildReport(files, new Map(), TODAY);
    expect(report.staleCount).toBe(1);
    expect(report.unverifiedCount).toBe(1);
    expect(report.citationCeilingUsage).toBe(2);
    expect(report.status).toBe("FAIL");
  });
});
