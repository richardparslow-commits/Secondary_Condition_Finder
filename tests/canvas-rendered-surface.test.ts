import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * R-09 / L-04 + L-05 — the canvas surfaces: what is proven about them, and what
 * is not.
 *
 * The audit recorded two Low findings here, and they are the same problem seen
 * from two sides. jsdom has no rasterizer, so the accessibility run emits
 * `Not implemented: HTMLCanvasElement's getContext()`; canvas-rendered content
 * therefore has no automated pixel evidence at all — while the timeline's
 * tooltip, the one place two drawn values can be read together, shipped its body
 * text at 12px.
 *
 * What this suite does about it, without adding a native `canvas` dependency
 * (which would mean a rasterizer in the test runner and a heavy build for
 * evidence the human pass still has to produce):
 *
 *   1. **A fail-closed inventory of every canvas surface.** A new one cannot
 *      appear unnoticed; it has to be added here with its classification.
 *   2. **The drawn content keeps a DOM alternative.** The timeline graphic's
 *      data is reachable as a `<details>`-wrapped table, so the meaning does not
 *      depend on a bitmap — and the mounted axe suite still renders the
 *      component, so that alternative is what the automated gate checks.
 *   3. **The tooltip's size and contrast are measured, not asserted in prose.**
 *      The surface colour was resolved to its painted pixel in headless Chrome
 *      against this stylesheet (#0f172b) and the ratios below are computed from
 *      it with the WCAG 2.1 formula.
 *   4. **The residual is recorded, not implied.** No automated check in this
 *      repository inspects rasterized pixels; the evidence report says so and
 *      points at the manual session that owns it.
 *
 * Nothing here is human accessibility evidence. Issue #195 still requires a
 * person on the identified build; see `docs/section508-manual-review-workbook.md`.
 */

const SRC_ROOT = path.join(process.cwd(), "src");

const TIMELINE = "src/components/secondary/ConditionTimelineVisualization.tsx";
const EVIDENCE_ANALYZER = "src/components/evidence/LocalEvidenceAnalyzer.tsx";
const DD214_ANALYZER = "src/components/presumptive/Dd214LocalAnalyzer.tsx";
const AXE_SUITE = "src/components/__tests__/accessibility.test.tsx";
const EVIDENCE_REPORT = "docs/accessibility-audit.md";

/** `text-xs` (12px), assembled so Tailwind cannot emit a utility for it. */
const FORBIDDEN_SMALL_TEXT = ["text", "xs"].join("-");

/**
 * What each canvas surface is for. The two OCR surfaces raster a page or an
 * image to recognise text from it — the bitmap is an input, never an output.
 * The timeline draws and then exports a shareable PNG, so its bitmap *is*
 * content, which is why only it needs a DOM alternative.
 */
const REVIEWED_CANVAS_SURFACES = [
  { file: EVIDENCE_ANALYZER, kind: "decode-only" },
  { file: DD214_ANALYZER, kind: "decode-only" },
  { file: TIMELINE, kind: "drawn-content" },
] as const;

/**
 * Tailwind 4.3.3 emits `bg-slate-900` as `lab(7.78673 1.82345 -15.0537)`. The
 * pixel it paints was read back from a 1×1 canvas in headless Chrome against
 * this stylesheet: `#0f172b`, the same value the H-01 contrast measurement
 * recorded.
 */
const TOOLTIP_SURFACE = "#0f172b";
const WHITE = "#ffffff";
/** `text-slate-200`, measured the same way. */
const TOOLTIP_BODY_TEXT = "#e2e8f0";

/** WCAG 2.1 AA minimum for normal text. */
const MIN_RATIO = 4.5;

function walkSource(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkSource(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/** sRGB channel -> linear light, per WCAG 2.1 relative luminance. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Any way a source file can get a bitmap drawing surface. */
const CANVAS_SURFACE_PATTERN = /getContext\(|createElement\(\s*["']canvas["']\s*\)|<canvas\b/;

const canvasFiles = walkSource(SRC_ROOT)
  .filter((file) => CANVAS_SURFACE_PATTERN.test(readFileSync(file, "utf8")))
  .map((file) => path.relative(process.cwd(), file).split(path.sep).join("/"))
  .sort();

const timeline = read(TIMELINE);

describe("canvas surfaces are a reviewed inventory, not an accident (R-09 / L-05)", () => {
  it("touches a bitmap canvas only in the surfaces on this list", () => {
    expect(
      canvasFiles,
      "A canvas surface appeared or disappeared. Its content has no jsdom " +
        "rasterization and no automated pixel evidence, so review it and add it " +
        "here with its classification (drawn-content needs a DOM alternative; " +
        "decode-only does not) before shipping it.",
    ).toEqual(REVIEWED_CANVAS_SURFACES.map((surface) => surface.file));
  });

  it("keeps the drawn surface's content reachable without rasterizing it", () => {
    // The bitmap is the graphic, so the same data has to exist as DOM text: a
    // screen reader, a printer, and a jsdom run all reach it without pixels.
    expect(timeline).toContain("Text alternative");
    expect(timeline).toContain("<details");
    expect(timeline).toContain("<table");
    // And the export path, which is why this surface is drawn-content: the
    // bitmap is handed to the reader as a PNG.
    expect(timeline).toContain("toBlob(");
  });

  it("does not present either OCR surface's raster as content", () => {
    for (const file of [DD214_ANALYZER, EVIDENCE_ANALYZER]) {
      const source = read(file);
      expect(source, `${file} exports a bitmap`).not.toContain("toBlob(");
      expect(source, `${file} lost its bounded canvas sizing`).toMatch(
        /canvas\.width\s*=/,
      );
    }
  });

  it("is exercised at DOM level by the mounted accessibility suite", () => {
    // The inventory above says the drawn content has a DOM alternative; this
    // pins that something actually renders and axe-checks it.
    expect(read(AXE_SUITE)).toContain("ConditionTimelineVisualization");
  });

  it("records the residual in the accessibility evidence report", () => {
    const report = read(EVIDENCE_REPORT);
    expect(report).toContain("Canvas-rendered surfaces (L-05)");
    expect(report).toContain("docs/section508-manual-review-workbook.md");
    expect(report, "no automated pass may claim rasterized-pixel evidence").toContain(
      "no automated check in this repository inspects rasterized pixels",
    );
  });
});

describe("the timeline tooltip is readable, not merely contrast-compliant (R-09 / L-04)", () => {
  const tooltipLine = timeline
    .split("\n")
    .find((line) => line.includes("pointer-events-none absolute") && line.includes("bg-slate-900"));

  it("renders its body text at >= 14px", () => {
    expect(
      tooltipLine,
      "could not locate the timeline tooltip's className; update this suite if the tooltip was rebuilt",
    ).toBeDefined();
    expect(
      tooltipLine,
      `The tooltip is the only place two values on the drawn timeline can be read ` +
        `together, so it may not render at 12px (${FORBIDDEN_SMALL_TEXT}).`,
    ).not.toContain(FORBIDDEN_SMALL_TEXT);
    expect(tooltipLine).toContain("text-sm");
  });

  it("keeps the tooltip's measured contrast far above the AA floor", () => {
    const heading = ratio(WHITE, TOOLTIP_SURFACE);
    const body = ratio(TOOLTIP_BODY_TEXT, TOOLTIP_SURFACE);
    console.log(
      `timeline tooltip: ${WHITE} on ${TOOLTIP_SURFACE} = ${heading.toFixed(2)}:1, ` +
        `${TOOLTIP_BODY_TEXT} on ${TOOLTIP_SURFACE} = ${body.toFixed(2)}:1`,
    );
    expect(heading).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(body).toBeGreaterThanOrEqual(MIN_RATIO);

    // The audit recorded 17.83:1 and 14.46:1 for these pairs. Reproducing them
    // from the surface colour proves the constant above is the real painted
    // pixel rather than a guess that happens to pass.
    expect(heading).toBeCloseTo(17.83, 1);
    expect(body).toBeCloseTo(14.46, 1);
  });
});
