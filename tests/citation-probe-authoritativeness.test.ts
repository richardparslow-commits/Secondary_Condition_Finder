import { describe, expect, it } from "vitest";

import {
  bodyIsBotChallenge,
  botBlockReason,
  buildReport,
  CHALLENGE_BODY_MARKERS,
  evaluateGet,
  hashContent,
  isBotBlockedProbe,
  NON_AUTHORITATIVE_STATUSES,
} from "../scripts/audit-citation-decay";
import { corpus, register, TODAY, verifiedRef } from "./helpers/citation-digest-exemption-fixtures";

/**
 * A success status is not evidence about the origin.
 *
 * NCBI serves PubMed record pages to automated clients as HTTP 203 with a
 * 5590-byte JavaScript challenge interstitial whose challengeId is regenerated
 * per request. The probe scored that `ok` because 203 < 400, so `linkRotCount: 0`
 * asserted the health of 392 verified references whose content it had never
 * observed — the same unearned-zero defect the digest-coverage fields were added
 * to prevent, on the link-rot dimension. These tests pin that a
 * non-authoritative or challenge response is unverifiable-by-probe, never a
 * healthy source and never a dead link, and that the report publishes how much
 * of the corpus link rot actually saw.
 */

const URL_ = "https://pubmed.ncbi.nlm.nih.gov/30407234/";
const CHALLENGE_BODY = '<!doctype html><title>pubmed.ncbi.nlm.nih.gov</title><script>const challengeId = "j7MSSNkCJVwzp7LFyz7YsA";</script>';
const ARTICLE_BODY = "<html><body><h1>Depression and type 2 diabetes</h1><div id='abstract'>...</div></body></html>";

function report(probeResults: Map<string, unknown>) {
  return buildReport(corpus([verifiedRef({ sourceUrl: URL_ })]), probeResults, TODAY, register([]));
}

describe("bot-challenge detection", () => {
  it("recognises the NCBI challenge interstitial", () => {
    expect(bodyIsBotChallenge(CHALLENGE_BODY)).toBe(true);
  });

  it("does not mistake real article content for a challenge", () => {
    expect(bodyIsBotChallenge(ARTICLE_BODY)).toBe(false);
    expect(bodyIsBotChallenge("")).toBe(false);
    expect(bodyIsBotChallenge(undefined)).toBe(false);
  });

  it("treats HTTP 203 as non-authoritative by definition", () => {
    expect(NON_AUTHORITATIVE_STATUSES.has(203)).toBe(true);
    expect(botBlockReason(203, ARTICLE_BODY)).toBe("non-authoritative-status");
  });

  it("names the reason for each class of unverifiable response", () => {
    expect(botBlockReason(403, ARTICLE_BODY)).toBe("bot-wall-status");
    expect(botBlockReason(405, ARTICLE_BODY)).toBe("bot-wall-status");
    expect(botBlockReason(406, ARTICLE_BODY)).toBe("bot-wall-status");
    expect(botBlockReason(200, CHALLENGE_BODY)).toBe("bot-challenge-interstitial");
    expect(botBlockReason(200, ARTICLE_BODY)).toBeNull();
    expect(botBlockReason(404, ARTICLE_BODY)).toBeNull();
  });

  it("keeps the marker list specific so a genuine source is never walled off", () => {
    expect(CHALLENGE_BODY_MARKERS.length).toBeGreaterThan(0);
    for (const marker of CHALLENGE_BODY_MARKERS) {
      expect(ARTICLE_BODY.includes(marker)).toBe(false);
    }
  });
});
describe("GET verdict", () => {
  it("reports a 203 challenge page as blocked, not as a live source", () => {
    const verdict = evaluateGet({ status: 203, body: CHALLENGE_BODY }, null);
    expect(verdict).toMatchObject({ ok: false, status: 203, blocked: true, blockedReason: "non-authoritative-status" });
    expect(isBotBlockedProbe(verdict)).toBe(true);
  });

  it("reports a challenge interstitial served at HTTP 200 as blocked", () => {
    const verdict = evaluateGet({ status: 200, body: CHALLENGE_BODY }, null);
    expect(verdict).toMatchObject({ ok: false, blocked: true, blockedReason: "bot-challenge-interstitial" });
  });

  it("accepts an authoritative body and records that no digest was compared", () => {
    const verdict = evaluateGet({ status: 200, body: ARTICLE_BODY }, null);
    expect(verdict).toMatchObject({ ok: true, status: 200, digestCompared: false });
    expect(verdict.drift).toBeUndefined();
    expect(isBotBlockedProbe(verdict)).toBe(false);
  });

  it("compares a recorded digest and reports a match", () => {
    const verdict = evaluateGet({ status: 200, body: ARTICLE_BODY }, hashContent(ARTICLE_BODY));
    expect(verdict).toMatchObject({ ok: true, drift: false, digestCompared: true });
  });

  it("compares a recorded digest and reports drift on a mismatch", () => {
    const verdict = evaluateGet({ status: 200, body: ARTICLE_BODY }, hashContent("the body a human verified"));
    expect(verdict).toMatchObject({ ok: true, drift: true, digestMatched: false, digestCompared: true });
  });

  it("never reports drift for a blocked body, since the source was not read", () => {
    const verdict = evaluateGet({ status: 203, body: CHALLENGE_BODY }, hashContent("anything"));
    expect(verdict.drift).toBeUndefined();
    expect(verdict.blocked).toBe(true);
  });
});
describe("link-rot observability in the report", () => {
  it("counts a 203 challenge response as unverifiable-by-probe, never as link rot", () => {
    const result = report(new Map([[URL_, evaluateGet({ status: 203, body: CHALLENGE_BODY }, null)]]));

    expect(result.linkRotCount).toBe(0);
    expect(result.decayed).toEqual([]);
    expect(result.botBlockedUnverifiableCount).toBe(1);
    expect(result.botBlockedUnverifiable[0]).toMatchObject({ sourceUrl: URL_, status: 203, blockedReason: "non-authoritative-status" });
    // Nothing was observed, so the zero carries no assurance and says so.
    expect(result.linkRotObservedCount).toBe(0);
    expect(result.linkRotObservabilityPercent).toBe(0);
  });

  it("counts an authoritative 200 as genuinely observed", () => {
    const result = report(new Map([[URL_, evaluateGet({ status: 200, body: ARTICLE_BODY }, null)]]));

    expect(result.linkRotCount).toBe(0);
    expect(result.botBlockedUnverifiableCount).toBe(0);
    expect(result.linkRotObservedCount).toBe(1);
    expect(result.linkRotObservabilityPercent).toBe(100);
  });

  it("counts a successfully read drifted response as observed", () => {
    const result = report(new Map([[URL_, evaluateGet({ status: 200, body: "revised article" }, hashContent(ARTICLE_BODY))]]));

    expect(result.contentDriftCount).toBe(1);
    expect(result.linkRotObservedCount).toBe(1);
    expect(result.linkRotObservabilityPercent).toBe(100);
  });

  it("still reports a real 404 as link rot and fails the audit", () => {
    const result = report(new Map([[URL_, { ok: false, status: 404 }]]));

    expect(result.linkRotCount).toBe(1);
    expect(result.decayed[0]).toMatchObject({ sourceUrl: URL_, status: 404 });
    expect(result.status).toBe("FAIL");
    expect(result.linkRotObservedCount).toBe(0);
  });

  it("qualifies a mixed corpus so the observability denominator is visible", () => {
    const stable = "https://www.law.cornell.edu/cfr/text/38/3.310";
    const gone = "https://example.gov/withdrawn";
    const result = buildReport(
      corpus([
        verifiedRef({ sourceUrl: URL_ }),
        verifiedRef({ sourceUrl: stable, citation: "stable" }),
        verifiedRef({ sourceUrl: gone, citation: "gone" }),
      ]),
      new Map<string, unknown>([
        [URL_, evaluateGet({ status: 203, body: CHALLENGE_BODY }, null)],
        [stable, evaluateGet({ status: 200, body: ARTICLE_BODY }, null)],
        [gone, { ok: false, status: 404 }],
      ]),
      TODAY,
      register([]),
    );

    expect(result.botBlockedUnverifiableCount).toBe(1);
    expect(result.linkRotObservedCount).toBe(1);
    expect(result.linkRotCount).toBe(1);
    expect(result.linkRotProbedReferenceCount).toBe(3);
    expect(result.linkRotObservabilityPercent).toBe(33.3);
  });

  it("reports no observed coverage for an unprobed corpus", () => {
    const result = report(new Map());

    expect(result.linkRotProbedReferenceCount).toBe(0);
    expect(result.linkRotObservabilityPercent).toBe(0);
    expect(result.linkRotObservedCount).toBe(0);
  });

  it("keeps bot-walled references out of the ceiling budget so CI is not held hostage", () => {
    const result = report(new Map([[URL_, evaluateGet({ status: 203, body: CHALLENGE_BODY }, null)]]));

    expect(result.citationCeilingUsage).toBe(0);
    expect(result.status).toBe("PASS");
  });

  it("does not let a blocked body masquerade as content drift", () => {
    const result = report(new Map([[URL_, evaluateGet({ status: 203, body: CHALLENGE_BODY }, hashContent("verified body"))]]));

    expect(result.contentDriftCount).toBe(0);
    expect(result.contentDrift).toEqual([]);
    expect(result.botBlockedUnverifiableCount).toBe(1);
  });

  it("does not fail decay audit for a rejected exemption's expired assessment", () => {
    const rejected = {
      id: "rejected-exemption",
      host: "pubmed.ncbi.nlm.nih.gov",
      urlPattern: "^https://pubmed\\.ncbi\\.nlm\\.nih\\.gov/\\d+/?$",
      reason: "volatile-body-per-fetch",
      summary: "previously proposed dynamic source",
      sopBasis: "docs/citation-verification-sop.md",
      assessment: {
        assessedOn: "2024-01-01",
        method: "fixture",
        sampleUrls: [URL_],
        sampleCount: 3,
        distinctBodyDigests: 3,
        deterministic: false,
        httpStatuses: [203, 203, 203],
      },
      review: { status: "rejected" },
    };
    const result = buildReport(
      corpus([verifiedRef({ sourceUrl: URL_ })]),
      new Map(),
      TODAY,
      register([rejected]),
    );

    expect(result.structuralFlags.some(({ reason }) => reason.includes("was measured on"))).toBe(false);
    expect(result.digestExemptions[0]?.stale).toBe(false);
  });
});
