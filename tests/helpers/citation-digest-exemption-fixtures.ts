import { buildReport } from "../../scripts/audit-citation-decay";
import { compileEntries, validateEntries } from "../../scripts/lib/citation-digest-exemptions";

/**
 * The digest-exemption register exists because two SOP rules collided.
 *
 * docs/citation-verification-sop.md requires a body that varies per fetch to
 * OMIT its contentDigest rather than record a value that false-positives on
 * every probe, and separately fails the decay audit for any `verified: true`
 * reference that lacks one. 394 of the 398 verified references point at source
 * classes measured to be undigestible, so following the first rule guaranteed
 * breaching the second and the weekly probe failed for correct behaviour.
 *
 * These tests pin the resolution: the ratchet counts only debt a qualified human
 * can actually retire, the exempt population stays fully reported, and an
 * unsound register entry grants nothing.
 */

const TODAY = "2026-10-10";
const VOLATILE_URL = "https://pubmed.ncbi.nlm.nih.gov/30407234/";
const STABLE_URL = "https://www.law.cornell.edu/cfr/text/38/3.310";

type Ref = Record<string, unknown>;
type Entry = Record<string, unknown>;

/** A sound entry, shaped like the ones committed in the real register. */
function volatileEntry(overrides: Entry = {}): Entry {
  return {
    id: "test-volatile",
    host: "pubmed.ncbi.nlm.nih.gov",
    urlPattern: "^https://pubmed\\.ncbi\\.nlm\\.nih\\.gov/\\d+/?$",
    reason: "volatile-body-per-fetch",
    summary: "body varies per fetch",
    sopBasis: "docs/citation-verification-sop.md",
    assessment: {
      assessedOn: TODAY,
      method: "three sequential GETs, SHA-256 compared",
      sampleUrls: [VOLATILE_URL],
      sampleCount: 3,
      distinctBodyDigests: 3,
      deterministic: false,
      httpStatuses: [203, 203, 203],
    },
    review: { status: "approved", reviewer: "Test fixture reviewer (not a real approval)", reviewedOn: TODAY },
    ...overrides,
  };
}

const REDIRECT_URL = "https://www.ecfr.gov/current/title-38/chapter-I/part-3/subpart-A/subject-group-ECFR39056aee4e9ff13/section-3.310";
const REDIRECT_FINAL_URL = "https://unblock.federalregister.gov/";

/** A fully evidenced redirect-to-interstitial entry, distinct from body volatility. */
function redirectedEntry(overrides: Entry = {}): Entry {
  return {
    id: "test-redirected",
    host: "www.ecfr.gov",
    urlPattern: "^https://www\\.ecfr\\.gov/current/title-38/chapter-I/part-3/subpart-A/subject-group-ECFR39056aee4e9ff13/section-3\\.310/?$",
    reason: "redirected-to-interstitial",
    summary: "The source URL redirects to an unblock interstitial instead of the regulation.",
    sopBasis: "docs/citation-verification-sop.md",
    assessment: {
      assessedOn: TODAY,
      method: "three sequential GETs, redirect-followed, SHA-256 compared",
      sampleUrls: [REDIRECT_URL],
      sampleCount: 3,
      distinctBodyDigests: 2,
      deterministic: false,
      httpStatuses: [302, 302, 302],
      finalHttpStatuses: [200, 200, 200],
      finalUrls: [REDIRECT_FINAL_URL, REDIRECT_FINAL_URL, REDIRECT_FINAL_URL],
      bodyBytes: [10596, 10596, 10596],
      bodySha256: [
        "sha256-3e8f75b59806092ad7a78c353c9582892a4f35da3200335f04dad0d0ceca2d9d",
        "sha256-66e140c19e6f51cb049e22ce8d5d46cda4065a8aef9af8177fbdf0e21b795f0a",
        "sha256-66e140c19e6f51cb049e22ce8d5d46cda4065a8aef9af8177fbdf0e21b795f0a",
      ],
      articleContentPresent: false,
    },
    review: { status: "pending-qualified-human", reviewer: null, reviewedOn: null },
    ...overrides,
  };
}

/**
 * Builds the register shape buildReport consumes, using the same validation and
 * compilation the disk loader uses so an in-memory register cannot be sounder
 * than a real one.
 */
function register(entries: Entry[]) {
  return {
    present: true,
    version: 1,
    entries,
    compiled: compileEntries(entries),
    problems: validateEntries(entries),
  };
}

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

function verifiedRef(overrides: Ref = {}): Ref {
  return {
    citation: "38 CFR 3.310",
    sourceUrl: STABLE_URL,
    sourceCheckedOn: TODAY,
    sourceLocator: "locator",
    verified: true,
    ...overrides,
  };
}

function report(refs: Ref[], entries: Entry[] = []) {
  return buildReport(corpus(refs), new Map(), TODAY, register(entries));
}

export {
  TODAY,
  VOLATILE_URL,
  STABLE_URL,
  REDIRECT_URL,
  REDIRECT_FINAL_URL,
  volatileEntry,
  redirectedEntry,
  register,
  corpus,
  verifiedRef,
  report,
};
export type { Ref, Entry };
