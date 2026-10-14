import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * R-09 / M-03 — §6 of the privacy policy has to be readable by the person who
 * is being asked to authorize account access.
 *
 * The requirement is a length one rather than a style opinion. §6 ("VA API and
 * claim-submission boundary") is the section that explains sign-in, service
 * scopes, token storage, cookie attributes, session expiry, what the UI shows,
 * what disconnect does, and the callback-logging caveat — everything a reader
 * must weigh *before* connecting an account. The production audit measured a
 * single **163-word** sentence carrying all of it.
 *
 * That sentence was split during the R-01 privacy work, but later additions
 * (the reference-lookup and locator paragraphs) put two sentences of **73** and
 * **39** words back into the same section, so the finding's subject had
 * regressed. This suite makes the audit's stated target checkable instead of
 * remembered — **no sentence in §6 above 35 words** — and prints the measured
 * maximum into the test log as evidence, the way `npm run test:doc-lint`
 * evidence is expected to be reproducible from the log rather than from a
 * reviewer's memory.
 *
 * Why the guard stops at §6. §8's clauses are the operator/legal sentences
 * pinned *verbatim* in `tests/privacy-rights-contact.test.ts` as "the exact
 * sentence the approver is being asked to accept"; two of them run 63 and 45
 * words. Shortening approved legal text is a re-approval, not a readability
 * fix, so §8 is deliberately out of scope here — and the suite asserts that the
 * exemption is a real, recorded pin rather than a hole someone widened.
 *
 * Nothing here is a plain-language certification and no reading-grade number is
 * claimed: the audit declined to assert a grade it had not reliably measured,
 * and so does this suite.
 */

const POLICY = resolve(process.cwd(), "src/app/privacy/page.tsx");
const RIGHTS_GUARD = resolve(process.cwd(), "tests/privacy-rights-contact.test.ts");

/** Section 6, located by its heading and the next numbered section. */
const SECTION_6_START = "6. VA API and claim-submission boundary";
const SECTION_6_END = "7. Retention summary";

/** The legible §8 section, which this suite deliberately does not constrain. */
const SECTION_8_START = "8. Your privacy rights and how to contact us";
const SECTION_8_END = "9. Policy changes";

/** The audit's target for §6. */
const MAX_SENTENCE_WORDS = 35;

/** §6 carried 34 sentences when this guard was written; deletion may not pass. */
const MIN_SENTENCES = 32;

const source = readFileSync(POLICY, "utf8");

function decodeEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;/g, "\u201c")
    .replace(/&rdquo;/g, "\u201d")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&nbsp;/g, " ");
}

/**
 * The rendered prose of a section: `<p>`/`<li>` contents only, because headings
 * and list markers are labels rather than sentences. Tags and JSX expressions
 * (`{formatLimitBytes(...)}`) are removed before words are counted, so a
 * component expression cannot inflate a sentence's length, and the sentence
 * split is the one the audit used — terminal punctuation plus whitespace.
 */
function sectionProse(startHeading: string, endHeading: string): string {
  const start = source.indexOf(startHeading);
  const end = source.indexOf(endHeading);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      `could not locate the section between ${JSON.stringify(startHeading)} and ${JSON.stringify(endHeading)}; ` +
        "if the policy was renumbered, update this suite's boundaries",
    );
  }
  const blocks = [...source.slice(start, end).matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)];
  return blocks
    .map((block) =>
      decodeEntities(block[2]!.replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .join(" ");
}

function sentencesOf(prose: string): { sentence: string; words: number }[] {
  return prose
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => ({ sentence, words: sentence.split(/\s+/).length }));
}

const section6 = sectionProse(SECTION_6_START, SECTION_6_END);
const section8 = sectionProse(SECTION_8_START, SECTION_8_END);
const sentences = sentencesOf(section6);
const longest = sentences.reduce(
  (worst, entry) => (entry.words > worst.words ? entry : worst),
  { sentence: "", words: 0 },
);

describe("privacy §6 is readable sentence by sentence (R-09 / M-03)", () => {
  it("keeps every sentence at or below the audit's 35-word target", () => {
    console.log(
      `privacy §6: ${sentences.length} sentences, longest ${longest.words} words — "${longest.sentence}"`,
    );

    const overLong = sentences.filter((entry) => entry.words > MAX_SENTENCE_WORDS);
    expect(
      overLong.map((entry) => `[${entry.words} words] ${entry.sentence}`),
      `§6 must stay readable in single sentences. Split each sentence listed above into ` +
        `separate sentences — do not shorten the promise to fit the limit.`,
    ).toEqual([]);
  });

  it("cannot satisfy the length rule by deleting the section's content", () => {
    expect(
      sentences.length,
      "§6 lost sentences; the length rule is not a licence to remove the section",
    ).toBeGreaterThanOrEqual(MIN_SENTENCES);
  });

  it("removes the 73-word chain the audit measured, without rewording the promise", () => {
    // The measured sentence joined three separate facts with a comma and a
    // semicolon: submission of the lookup, URL/history exposure, and the
    // upstream query parameter.
    expect(section6).not.toContain("request line; while live VA access");
    expect(section6).toContain(
      "A Forms search and the accredited-representative directory lookup both submit what you enter to this application in the request body.",
    );
    expect(section6).toContain(
      "While live VA access is explicitly enabled, the lookup is then sent on to the configured VA API as a query parameter.",
    );
  });

  it("keeps every technical claim §6 made before the rewrite", () => {
    for (const claim of [
      "does not connect to a production Veteran account, submit a disability claim, or upload the user's workflow or local evidence to VA",
      "separately enabled sandbox-only account experiment at /va-account",
      "does not collect passwords or MFA codes",
      "Separate service scopes authorize only rating summaries or existing claim reads",
      "encrypted in an isolated server-side session store, not browser storage or workflow cookies",
      "opaque HttpOnly connection handle",
      "five-minute SameSite=Lax callback cookie",
      "SameSite=Strict",
      "expire after 30 minutes without extending on refresh",
      "Displayed results omit ICNs, claim/rating identifiers and diagnosis text",
      "reporting when cleanup or revocation cannot be confirmed",
      "Production account access, representatives, submissions and uploads remain disabled",
      "hosting request-log scrubbing and retention must be reviewed before any credentialed hosted use",
      "only clearly labeled local reference data is shown and no request leaves the origin",
      "store a hash of user-supplied parameters rather than the raw query or ZIP",
    ]) {
      expect(section6, `§6 lost a technical claim: ${claim}`).toContain(claim);
    }
  });

  it("leaves the verbally signed §8 clauses to their own guard, and says why", () => {
    // The §8 exemption is legitimate only while those clauses really are pinned
    // verbatim somewhere. If this fails, the exemption became a hole: either
    // re-pin the approved text in tests/privacy-rights-contact.test.ts, or
    // rewrite §8 deliberately and ask for re-approval.
    const rightsGuard = readFileSync(RIGHTS_GUARD, "utf8");
    expect(rightsGuard).toContain("the exact sentence the approver is");
    expect(rightsGuard).toContain(
      "Requests are completed, including completion of constituent partial requests, within <strong>45 days</strong>.",
    );

    // And the exemption is scoped rather than assumed: the approved exceptions
    // clause lives in §8, not in the section this suite constrains.
    expect(section8).toContain("36 CFR Chapter XII");
    expect(section6).not.toContain("36 CFR Chapter XII");
  });
});
