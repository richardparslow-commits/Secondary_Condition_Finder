/**
 * R-07 legibility guard for legal disclaimers, safety notices, and label casing.
 *
 * Two distinct regressions this suite exists to stop:
 *
 * 1. **Type scale.** Legal disclaimers and safety notices shipped at 12px
 *    (`text-xs`). That is the copy telling users the tool is not legal or
 *    medical advice, that a full SSN is never stored, and that a representative
 *    may only charge a fee after VA approves an agreement (38 U.S.C. § 5904).
 *    Low-vision users are the audience least able to read it and most harmed by
 *    missing it, and at 200% zoom 12px body copy is the first thing that becomes
 *    unusable. R-07 raises these to `text-sm` (14px).
 *
 * 2. **Label casing.** All-caps styling was applied to multi-word eyebrow
 *    labels, sentence-like headings, and nexus classifications such as
 *    "Association only — chain broken". CSS `text-transform: uppercase` does not
 *    change the DOM text a screen reader announces, so this is not a
 *    letter-spelling defect — it is a low-vision one: capitalising every word
 *    destroys the word shapes readers rely on, and the letter-spacing added to
 *    keep all-caps legible makes small text worse still. R-07 therefore keeps
 *    `uppercase` only on genuinely short structural table-header labels.
 *
 * Like tests/design-token-contrast.test.ts, this is an analytical source scan
 * rather than a browser assertion: jsdom computes no layout, so no rendered
 * font-size is observable here. It scans **both** components and stylesheets,
 * because a CSS class reaches the rendered page exactly as a Tailwind utility
 * does. It runs in the normal suite, so it gates inside the existing `verify`
 * job with no extra CI wiring. It is deliberately NOT added to
 * pr-508-compliance.yml, which documents a fixed 6-file / 36-test
 * browser-contract gate.
 *
 * Nothing here is human accessibility evidence. Issue #195 still requires a
 * person to test the identified production build; see
 * docs/section508-manual-review-workbook.md.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC_ROOT = path.join(process.cwd(), "src");

/** Smallest unacceptable font size for legal disclaimers and safety notices. */
const FORBIDDEN_SMALL_CLASS = ["text", "xs"].join("-");

/**
 * Copy that must stay at >= 14px. Each entry is located by distinctive text, so
 * the assertion survives unrelated className edits on the same element.
 */
const NOTICE_SITES = [
  {
    file: "src/components/Disclaimer.tsx",
    marker: "curated knowledge base",
    reason: "footer legal scope disclaimer (not legal/medical advice)",
  },
  {
    file: "src/components/presumptive/Dd214LocalAnalyzer.tsx",
    marker: "Full SSN is never stored",
    reason: "SSN privacy notice on the DD-214 preview",
  },
  {
    file: "src/components/presumptive/Dd214LocalAnalyzer.tsx",
    marker: "Nothing is saved until you confirm below",
    reason: "data-persistence safety notice before DD-214 field confirmation",
  },
  {
    file: "src/components/va/AccreditedRepresentativeFinder.tsx",
    marker: "may only charge for services after VA issues the decision",
    reason: "38 U.S.C. § 5904 fee-agreement consumer protection",
  },
  {
    file: "src/components/secondary/PathwayRecordChecklist.tsx",
    marker: "never sent to the server",
    reason: "checklist privacy notice",
  },
  {
    file: "src/components/secondary/PathwayRecordChecklist.tsx",
    marker: "Unchecks every item in this browser tab",
    reason: "clear-checkmarks data-loss consequence notice",
  },
  {
    file: "src/components/secondary/PathwayRecordChecklist.tsx",
    marker: "Creates a text file in this browser only",
    reason: "export data-handling notice",
  },
  {
    file: "src/components/secondary/ConditionTimelineVisualization.tsx",
    marker: "This visualization is a research aid",
    reason: "chronology medical/legal scope disclaimer",
  },
  {
    file: "src/app/scenarios/page.tsx",
    marker: "Demo content is synthetic",
    reason: "demo-scenario data-handling notice",
  },
  {
    file: "src/components/va/DisabilityReferenceExplorer.tsx",
    marker: "Your search text is not submitted to VA",
    reason: "VA reference filter privacy notice",
  },
  {
    file: "src/components/ConsultationSummaryDownload.tsx",
    marker: "Creates a text file in this browser only",
    reason: "consultation-summary export data-handling notice",
  },
  {
    file: "src/components/presumptive/Dd214LocalAnalyzer.tsx",
    marker: "Redaction covers common SSN layouts",
    reason: "SSN redaction-limit safety notice on extracted DD-214 text",
  },
  {
    file: "src/components/presumptive/PresumptiveResults.tsx",
    marker: "confirm at va.gov before relying on this",
    reason: "presumptive-list currency and verification notice",
  },
  {
    file: "src/components/secondary/VaGovRecordWalkthrough.tsx",
    marker: "Creates a text file in this browser only",
    reason: "record-walkthrough export data-handling notice",
  },
  {
    file: "src/components/secondary/MedicalRecordChecklist.tsx",
    marker: "Creates a text file in this browser only",
    reason: "medical-record checklist export data-handling notice",
  },
  {
    file: "src/components/secondary/MedicalRecordChecklist.tsx",
    marker: "Checklist is generated from the current published mappings only",
    reason: "checklist scope-limitation and verification notice",
  },
] as const;

/**
 * The only place `uppercase` may still appear: a table-header row whose every
 * `<th>` is a single short word ("Condition", "Nexus", "Consensus", "Citations",
 * "Gaps", "Primaries"), where capitalisation aids scannability and there is no
 * phrase for a low-vision reader to parse.
 *
 * Two other header rows were originally allowlisted here and have since been
 * de-capitalised, because their `<th>` labels are multi-word phrases —
 * "Evidence excerpt (exact quote)" in PathwayEvidenceTable and "Supporting
 * evidence (exact excerpt)" in PathwayEvidenceMapper. Allowing the row would
 * have made this suite permanently accept the very violation R-07 exists to
 * remove.
 */
const ALLOWED_UPPERCASE = [
  '<tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">',
] as const;

/** Smallest acceptable size for the `.ui-kicker` eyebrow class, in rem. */
const KICKER_MIN_REM = 0.875;

/** How far above the marker line to look for the element's className. */
const CLASSNAME_LOOKBACK = 4;

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkTsx(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * Stylesheets are scanned separately from components. A component-only walk
 * sees Tailwind's `uppercase` utility and nothing else, which is how the
 * `.ui-kicker` class in globals.css survived the first pass: it applies
 * `text-transform: uppercase` plus wide letter-spacing to 24 multi-word scope
 * phrases, so the rendered application still had all-caps small text after the
 * component sweep had already reported the cleanup complete.
 */
function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

describe("legal disclaimers and safety notices render at >= 14px (R-07)", () => {
  for (const site of NOTICE_SITES) {
    it(`${site.file} — ${site.reason}`, () => {
      const absolute = path.join(process.cwd(), site.file);
      const lines = readFileSync(absolute, "utf8").split("\n");

      const markerIndex = lines.findIndex((line) => line.includes(site.marker));
      expect(
        markerIndex,
        `could not locate notice copy ${JSON.stringify(site.marker)} in ${site.file}; ` +
          `if this notice was reworded or moved, update the NOTICE_SITES marker so the ` +
          `type-scale guard keeps covering it`,
      ).toBeGreaterThanOrEqual(0);

      // The className may sit on the marker line (inline copy) or on an opening
      // tag a few lines above it (wrapped copy).
      const start = Math.max(0, markerIndex - CLASSNAME_LOOKBACK);
      const window = lines.slice(start, markerIndex + 1);
      const classLines = window.filter((line) => line.includes("className="));
      expect(
        classLines.length,
        `no className found within ${CLASSNAME_LOOKBACK} lines above ` +
          `${JSON.stringify(site.marker)} in ${site.file}`,
      ).toBeGreaterThan(0);

      for (const classLine of classLines) {
        expect(
          classLine,
          `${site.reason} must render at >= 14px. Found ${FORBIDDEN_SMALL_CLASS} ` +
            `(12px) on: ${classLine.trim()} — use text-sm or larger.`,
        ).not.toContain(FORBIDDEN_SMALL_CLASS);
      }
    });
  }
});

describe("uppercase is restricted to short structural labels (R-07)", () => {
  it("every remaining uppercase usage is an allowlisted table-header label", () => {
    const offenders: string[] = [];

    for (const file of walkTsx(SRC_ROOT)) {
      const relative = path.relative(process.cwd(), file);
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (!line.includes("uppercase")) return;
          if (ALLOWED_UPPERCASE.some((allowed) => line.includes(allowed))) return;
          offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
        });
    }

    expect(
      offenders,
      "All-caps styling is reserved for short structural table-header labels. " +
        "Multi-word eyebrow labels, sentence-like headings, and nexus " +
        "classifications must stay sentence-case for low-vision readability. " +
        "Remove `uppercase` (and its compensating `tracking-wide`) from:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("keeps the allowlisted short table-header labels uppercase", () => {
    // Guards the other direction: the cleanup must not be "fixed" by stripping
    // casing from genuine structural headers as well.
    const haystack = walkTsx(SRC_ROOT)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    for (const allowed of ALLOWED_UPPERCASE) {
      expect(
        haystack,
        `short structural table-header label was removed or restyled: ${allowed}`,
      ).toContain(allowed);
    }
  });
});

describe("stylesheets do not reintroduce all-caps small text (R-07)", () => {
  it("no stylesheet applies text-transform: uppercase", () => {
    const offenders: string[] = [];

    for (const file of walkCss(SRC_ROOT)) {
      const relative = path.relative(process.cwd(), file);
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (!/text-transform:\s*uppercase/i.test(line)) return;
          offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
        });
    }

    expect(
      offenders,
      "A CSS class reaches the rendered page exactly as Tailwind's `uppercase` " +
        "utility does, so scanning components alone leaves a hole wide enough " +
        "for `.ui-kicker` to slip through. Remove `text-transform: uppercase` " +
        "from:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("keeps the .ui-kicker eyebrow class at >= 14px with no wide letter-spacing", () => {
    const css = readFileSync(path.join(SRC_ROOT, "app/globals.css"), "utf8");
    const rule = css.match(/\.ui-kicker\s*\{([^}]*)\}/);
    expect(rule, "`.ui-kicker` rule not found in src/app/globals.css").not.toBeNull();

    const declarations = rule![1];

    const size = declarations.match(/font-size:\s*([0-9.]+)rem/);
    expect(size, "`.ui-kicker` must declare its font-size in rem").not.toBeNull();
    expect(
      Number(size![1]),
      "`.ui-kicker` renders 24 multi-word scope phrases such as " +
        '"Research aid — outside the numbered workflow" and "VA ' +
        'claim-preparation research aid", so it must stay at >= ' +
        `${KICKER_MIN_REM}rem (14px)`,
    ).toBeGreaterThanOrEqual(KICKER_MIN_REM);

    expect(
      declarations.match(/letter-spacing:\s*[0-9.]+em/),
      "`.ui-kicker` must not re-add wide letter-spacing; it existed only to keep " +
        "all-caps text legible and is harmful on sentence-case small text",
    ).toBeNull();
  });
});
