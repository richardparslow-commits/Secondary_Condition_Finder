import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Shared doc-lint harness — the extraction and pattern engine behind the
 * README consistency contract (tests/readme-consistency.test.ts) and the
 * per-doc living-documentation policy (tests/doc-lint.test.ts).
 *
 * The harness answers three questions about a markdown document:
 *
 * 1. `collectFileReferences` — which on-disk paths does the document claim
 *    exist? Sourced from markdown link/image targets plus inline-code spans
 *    that are either a known root file or begin with a real repository root
 *    directory. Bare "looks like a path" matching would drown in false
 *    positives because these docs legitimately backtick non-path phrases
 *    (`2/2` clinical shorthand, `HIV/AIDS`, `@vercel/otel`).
 * 2. `collectNpmScripts` — which `npm run <script>` commands does the
 *    document tell the reader to execute? Script names drift on rename; the
 *    pin works in both directions.
 * 3. `collectVolatileCounts` — where does the document transcribe a
 *    current-state snapshot number instead of pointing at its generator CLI?
 *    Per-document policy decides whether a hit is a violation (living docs)
 *    or expected content (historical records), and historical-record docs are
 *    additionally pinned to their "generated, not transcribed" anchors so the
 *    exemption cannot silently widen.
 *
 * All extraction is deliberately line-scoped (inline-code spans never match
 * across newlines) — a stray unpaired backtick must not invert span pairing
 * for the rest of a document.
 */

/** Repository-root prefixes that mark an inline-code span as a path claim. */
export const REPO_ROOTS = [
  "data/",
  "src/",
  "docs/",
  "tests/",
  "e2e/",
  "scripts/",
  "public/",
  ".github/",
] as const;

/** Slash-less root files that inline-code spans reference directly. */
export const ROOT_FILES: ReadonlySet<string> = new Set([
  "package.json",
  "package-lock.json",
  "SECURITY.md",
  "README.md",
  ".env.example",
  ".env.template",
]);

export type FileReferenceOptions = {
  repoRoots?: readonly string[];
  rootFiles?: ReadonlySet<string>;
};

/** Single-line inline-code spans only; spans must not pair across newlines. */
export function extractInlineCodeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
}

/**
 * Extract candidate file references: markdown link/image targets plus
 * inline-code spans that are a known root file or begin with a repository
 * root. Returned strings are raw (globs, templates, and flag suffixes
 * included); callers existence-check via `isExistingRepoPath` /
 * `missingFileReferences`, which know how to interpret them.
 */
export function collectFileReferences(
  text: string,
  options: FileReferenceOptions = {},
): string[] {
  const repoRoots = options.repoRoots ?? REPO_ROOTS;
  const rootFiles = options.rootFiles ?? ROOT_FILES;

  const linkTargets = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(
    (match) => match[1],
  );

  const codePaths: string[] = [];
  for (const span of extractInlineCodeSpans(text)) {
    if (rootFiles.has(span)) {
      codePaths.push(span);
      continue;
    }
    if (repoRoots.some((rootDir) => span.startsWith(rootDir))) {
      codePaths.push(span);
    }
  }
  return [...linkTargets, ...codePaths];
}

/**
 * References that are not on-disk path claims and must never be
 * existence-checked: URLs, markdown anchors, localhost, and angle-bracket
 * templates (`data/knowledge-base/<id>.json`). Typographic ellipses
 * (`tests/…catalog…`) are authoring shorthand for elided text, not paths.
 */
export function isNotARepoPath(reference: string): boolean {
  return (
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("#") ||
    reference.startsWith("localhost") ||
    reference.includes("<") ||
    reference.includes(">") ||
    reference.includes("…")
  );
}

export type NpmScriptOptions = {
  /** Include bun/npx/pnpm invocations as script references. Default false. */
  includeAlternateRunners?: boolean;
};

/** Every `npm run <script>` the document instructs a reader to execute. */
export function collectNpmScripts(
  text: string,
  options: NpmScriptOptions = {},
): string[] {
  const scripts = [...text.matchAll(/\bnpm run\s+([a-z0-9][a-z0-9:-]*)/g)].map(
    (match) => match[1],
  );
  if (options.includeAlternateRunners) {
    scripts.push(
      ...text
        .matchAll(/\b(?:npx|pnpm|bun(?:x)?)\s+(?:run\s+)?([a-z0-9][a-z0-9:-]*)/g)
        .map((match) => match[1]),
    );
  }
  return scripts;
}

export type VolatilePattern = {
  /** Human-readable metric-class name for assertion messages. */
  name: string;
  /** Global regex; the harness resets lastIndex between documents. */
  pattern: RegExp;
};

/**
 * The volatile snapshot-count classes shared across the doc-lint policies.
 *
 * Every pattern carries a `(?<![\w-])` prefix guard so counts glued to
 * identifiers (the "33" in "ME-33") do not match, and the relationship
 * pattern additionally excludes `Step <n> relationship` (prose ordinal, not a
 * total) and `PMID <n> relationship` (a citation-scoped ledger fact, not a
 * corpus total). Extend this list when a new volatile metric class appears;
 * never loosen a pattern to make a regression pass.
 */
export const VOLATILE_COUNT_PATTERNS: VolatilePattern[] = [
  {
    name: "published/draft split",
    pattern:
      /(?<![\w-])\d[\d,]*\s+published\b|(?<![\w-])\d[\d,]*\s+draft\b|(?<![\w-])\d[\d,]*\s+published\s*\/\s*\d[\d,]*\s+draft\b/gi,
  },
  {
    name: "relationship totals",
    pattern:
      /(?<![\w-])(?<!Step )(?<!PMID )\d[\d,]*\+?\s+(?:authored\s+)?relationships?\b/gi,
  },
  {
    name: "mapping-file totals",
    pattern: /(?<![\w-])\d[\d,]*\s+mappings?\b/gi,
  },
  {
    name: "reference/verification totals",
    pattern:
      /(?<![\w-])\d[\d,]*\s+(?:live\s+)?(?:relationship-source\s+)?(?:source\s+)?(?:references|refs|verified|unverified)\b/gi,
  },
  {
    name: "test-suite totals",
    pattern:
      /(?<![\w-])\d[\d,]*\s+(?:tests|test files)\b|(?<![\w-])\d[\d,]*\s+files\s*\/\s*\d[\d,]*\s+tests\b/gi,
  },
];

export type VolatileHit = {
  patternName: string;
  match: string;
  /** 1-indexed line of the match (zone-aware scans only). */
  line?: number;
};

/** Case-insensitive scan for transcribed snapshot counts. */
export function collectVolatileCounts(
  text: string,
  patterns: VolatilePattern[] = VOLATILE_COUNT_PATTERNS,
): VolatileHit[] {
  const hits: VolatileHit[] = [];
  for (const { name, pattern } of patterns) {
    const scoped = new RegExp(pattern.source, "gi");
    for (const match of text.matchAll(scoped)) {
      hits.push({ patternName: name, match: match[0] });
    }
  }
  return hits;
}

function globToRegExp(glob: string): RegExp {
  // Escape everything except the glob metacharacters, then swap those for
  // placeholder tokens BEFORE building the pattern so inserted regex text
  // (e.g. "(?:.*/)?") can never be re-mangled by a later wildcard pass.
  const tokenized = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "\u0000")
    .replace(/\?/g, "\u0001");
  const pattern = tokenized
    .replace(/\u0000\u0000\//g, "(?:.*/)?")
    .replace(/\u0000\u0000/g, ".*")
    .replace(/\u0000/g, "[^/]*")
    .replace(/\u0001/g, "[^/]");
  return new RegExp(`^${pattern}$`);
}

/** True when at least one file on disk matches a glob-style reference. */
function globHasMatch(reference: string, repoRoot: string): boolean {
  const globIndex = reference.search(/[*?]/);
  if (globIndex === -1) return false;
  const baseDir = reference.slice(0, globIndex).replace(/\/[^/]*$/, "/");
  const baseAbs = join(repoRoot, baseDir);
  if (!existsSync(baseAbs)) return false;
  const regex = globToRegExp(reference);
  const stack = [baseAbs];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name).split(sep).join("/");
      if (entry.isDirectory()) {
        stack.push(abs);
      } else {
        // References are repo-relative; compare repo-relative paths so the
        // walker's absolute traversal does not leak into the match.
        const repoRel = relative(repoRoot, abs).split(sep).join("/");
        if (regex.test(repoRel) || regex.test(abs)) return true;
      }
    }
  }
  return false;
}

export type ExistenceCheckOptions = FileReferenceOptions & {
  /**
   * Directory (repo-relative) where bare file-name references resolve —
   * e.g. "docs" lets a doc under docs/ say `[guide](condition-catalog.md)`.
   */
  baseDir?: string;
};

/**
 * Existence check for one raw reference. Globs pass when at least one file
 * matches; plain paths pass when the repo-root (or `baseDir`) candidate
 * exists. Non-path references and CLI flag suffixes
 * (`scripts/x.js --provider=vercel`) are handled transparently.
 */
export function isExistingRepoPath(
  reference: string,
  repoRoot: string,
  options: ExistenceCheckOptions = {},
): boolean {
  if (isNotARepoPath(reference)) return true;
  const withoutFlags = reference.replace(/\s+--\S.*$/, "");
  if (/[*?]/.test(withoutFlags)) return globHasMatch(withoutFlags, repoRoot);
  if (existsSync(join(repoRoot, withoutFlags))) return true;
  if (options.baseDir && !withoutFlags.includes("/")) {
    return existsSync(join(repoRoot, options.baseDir, withoutFlags));
  }
  return false;
}

/** Convenience: references from `text` that do not resolve on disk. */
export function missingFileReferences(
  text: string,
  repoRoot: string,
  options: ExistenceCheckOptions = {},
): string[] {
  const candidates = collectFileReferences(text, options).filter(
    (reference) => !isExistingRepoPath(reference, repoRoot, options),
  );
  return [...new Set(candidates)];
}

/** Read a markdown document from the repository working directory. */
export function readRepoMarkdown(repoRoot: string, ...segments: string[]): string {
  return readFileSync(join(repoRoot, ...segments), "utf8");
}

/* ─── Historical-zone awareness ──────────────────────────────────────────── *
 *
 * Several living docs interleave an authoritative current-state block with
 * retained historical batch snapshots, fenced by HTML-comment markers in the
 * repository's established convention:
 *
 *   <!-- SOME-SCOPE-2026:START --> ... <!-- SOME-SCOPE-2026:END -->
 *
 * Counts inside such zones are the historical record itself, so the volatile
 * policy applies only OUTSIDE them. The parser is deliberately pragmatic:
 * marker names are case-insensitive (`:start`/`:end` both occur in the
 * corpus), an END closes the innermost open START regardless of name (one
 * queue section is closed with a mismatched marker name), an unclosed START
 * extends to EOF, and a stray END conservatively marks the remainder of the
 * file as historical-suspect. The doc-lint self-tests pin each rule.
 *
 * ─────────────────────────────────────────────────────────────────────── */

export type HistoricalZone = {
  /** 1-indexed line of the zone's opening marker. */
  startLine: number;
  /** 1-indexed line of the zone's closing marker (or EOF). */
  endLine: number;
  label: string;
};

const HISTORICAL_MARKER = /^<!--\s*([A-Za-z0-9-]+):(START|END)\s*-->\s*$/i;

export function parseHistoricalZones(text: string): HistoricalZone[] {
  const zones: HistoricalZone[] = [];
  const stack: { label: string; startLine: number }[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(HISTORICAL_MARKER);
    if (!match) continue;
    const label = match[1] ?? "";
    if (match[2]?.toUpperCase() === "START") {
      stack.push({ label, startLine: i + 1 });
    } else {
      const open = stack.pop();
      if (open) {
        zones.push({ startLine: open.startLine, endLine: i + 1, label: open.label });
      } else {
        // Stray END: everything after it is of uncertain provenance —
        // treat the remainder as historical-suspect rather than live.
        zones.push({ startLine: i + 1, endLine: lines.length, label: `${label}:stray-end` });
      }
    }
  }
  for (const open of stack) {
    zones.push({ ...open, endLine: lines.length });
  }
  return zones;
}

export function lineIsInHistoricalZone(
  line: number,
  zones: HistoricalZone[],
): boolean {
  return zones.some((zone) => line >= zone.startLine && line <= zone.endLine);
}

export type ZoneAwareVolatileScanOptions = {
  /** Pre-parsed zones for the document (skip `parseHistoricalZones`). */
  zones?: HistoricalZone[];
  /** Treat the entire document as historical (versioned ledger docs). */
  historicalEverywhere?: boolean;
};

/**
 * Line-scoped volatile scan that skips historical zones. Each hit carries its
 * 1-indexed line so failures point straight at the offending prose.
 */
export function volatileHitsOutsideHistoricalZones(
  text: string,
  patterns: VolatilePattern[] = VOLATILE_COUNT_PATTERNS,
  options: ZoneAwareVolatileScanOptions = {},
): VolatileHit[] {
  if (options.historicalEverywhere) return [];
  const zones = options.zones ?? parseHistoricalZones(text);
  const hits: VolatileHit[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const lineNo = index + 1;
    if (lineIsInHistoricalZone(lineNo, zones)) continue;
    for (const { name, pattern } of patterns) {
      const scoped = new RegExp(pattern.source, "gi");
      for (const match of line.matchAll(scoped)) {
        hits.push({ patternName: name, match: match[0], line: lineNo });
      }
    }
  }
  return hits;
}

/* ─── Marker-pairing symmetry audit ──────────────────────────────────────── *
 *
 * `parseHistoricalZones` is deliberately tolerant (it must keep computing
 * usable zones even from imperfect markers), but tolerance must never become
 * acceptance: a zone opened and never closed, a stray END, an END that closes
 * a differently-named zone, or a pair whose marker spellings mix casing
 * (`:START` … `:end`) all mean the fencing convention itself is broken and
 * the historical exemption could silently widen. `auditMarkerPairing`
 * enforces that symmetry as a hard, corpus-wide gate with line-precise
 * diagnostics, and `markerPairingReport` returns the structured zone table
 * the lint suite pins.
 *
 * Markers inside fenced code blocks are documentation examples of the
 * convention, not structure, and are ignored.
 *
 * ─────────────────────────────────────────────────────────────────────── */

export type MarkerDiagnosticType =
  | "stray-end"
  | "unclosed-start"
  | "name-mismatch"
  | "casing-mismatch";

export type MarkerDiagnostic = {
  type: MarkerDiagnosticType;
  /** 1-indexed line the diagnostic is reported at. */
  line: number;
  label: string;
  detail: string;
};

export type MarkerZone = {
  label: string;
  /** 1-indexed line of the opening marker. */
  startLine: number;
  /** 1-indexed line of the closing marker. */
  endLine: number;
  /** Exact opening marker text, e.g. "CLINICAL-MAPPING-MASTER-2026:START". */
  startMarker: string;
  /** Exact closing marker text, e.g. "CLINICAL-MAPPING-MASTER-2026:END". */
  endMarker: string;
};

export type MarkerPairingReport = {
  /** Properly paired, correctly nested zones in document order. */
  zones: MarkerZone[];
  diagnostics: MarkerDiagnostic[];
};

/** Uppercase-style kinds (`START`/`END`) vs lowercase-style (`start`/`end`). */
function isUppercaseMarkerStyle(rawKind: string): boolean {
  return rawKind === rawKind.toUpperCase();
}

/**
 * Audit a single document's historical-zone markers for pairing symmetry.
 * Handles fenced code blocks and returns line-precise diagnostics for every
 * asymmetry class; zones are only emitted for fully valid pairs.
 */
export function auditMarkerPairing(text: string): MarkerPairingReport {
  const zones: MarkerZone[] = [];
  const diagnostics: MarkerDiagnostic[] = [];
  const lines = text.split("\n");
  const stack: {
    label: string;
    rawKind: string;
    line: number;
  }[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i] ?? "")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = lines[i]?.match(HISTORICAL_MARKER);
    if (!match) continue;
    const label = match[1] ?? "";
    const rawKind = match[2] ?? "";
    const kind = rawKind.toUpperCase();
    if (kind === "START") {
      stack.push({ label, rawKind, line: i + 1 });
      continue;
    }
    const open = stack.pop();
    if (!open) {
      diagnostics.push({
        type: "stray-end",
        line: i + 1,
        label,
        detail: `END marker "${label}:${rawKind}" has no open START.`,
      });
      continue;
    }
    if (open.label.toLowerCase() !== label.toLowerCase()) {
      diagnostics.push({
        type: "name-mismatch",
        line: i + 1,
        label,
        detail: `END marker "${label}" closes a zone opened as "${open.label}" at line ${open.line}.`,
      });
      continue;
    }
    if (isUppercaseMarkerStyle(open.rawKind) !== isUppercaseMarkerStyle(rawKind)) {
      diagnostics.push({
        type: "casing-mismatch",
        line: i + 1,
        label,
        detail: `END marker casing ("${rawKind}") does not match the opening "${open.rawKind}" at line ${open.line}; each pair must use one style consistently.`,
      });
      continue;
    }
    zones.push({
      label,
      startLine: open.line,
      endLine: i + 1,
      startMarker: `${open.label}:${open.rawKind}`,
      endMarker: `${label}:${rawKind}`,
    });
  }
  for (const open of stack) {
    diagnostics.push({
      type: "unclosed-start",
      line: open.line,
      label: open.label,
      detail: `START marker "${open.label}:${open.rawKind}" is never closed.`,
    });
  }
  return { zones, diagnostics };
}

export type DocMarkerReport = MarkerPairingReport & {
  /** Doc file name relative to the scanned directory. */
  file: string;
};

/**
 * Scan every markdown file in a directory (the docs corpus) and produce the
 * per-document marker-pairing table. Files with no markers yield empty
 * reports, so the corpus table is complete, not filtered.
 */
export function corpusMarkerReports(docsDir: string): DocMarkerReport[] {
  return readdirSync(docsDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((file) => ({
      file,
      ...auditMarkerPairing(readFileSync(join(docsDir, file), "utf8")),
    }));
}
