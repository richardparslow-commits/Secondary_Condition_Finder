import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CLIENT_CORPUS_PATH } from "@/lib/client-corpus";
import {
  presumptiveHistoryStorageKey,
  presumptiveLocalStorageKeys,
} from "@/lib/presumptive/browser-history";
import { browserWorkflowContextStorageKey } from "@/lib/secondary-workflow/browser-context";
import { secondaryWorkflowLocalStorageKeys } from "@/lib/secondary-workflow/local-state";

/**
 * Browser-local workflow design conformance.
 *
 * The normative design record is docs/browser-local-veteran-workflow-design.md.
 * The privacy suites pin the record's runtime behavior; this suite is the
 * static conformance gate for the three rules that keep the design from
 * eroding as the workflow grows:
 *
 *   1. a step page or client module reads context only through the sanctioned
 *      record — never from browser storage, cookies, or the URL;
 *   2. every browser storage key that appears in src/ is on the clear-all
 *      registry consumed by `clearSecondaryWorkflowLocalState`;
 *   3. a client fetcher builds a uniform request — never one derived from the
 *      record, a selection, or any private field.
 *
 * Failures name the offending file and expression so the next change is
 * obvious. These are source-level checks on purpose: the sentinel gate proves
 * the running app leaks nothing, while this suite keeps the *shape* of the
 * code from drifting away from the design between sentinel runs.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const STEP_PAGES = [
  "src/components/secondary/steps/DiagnosedStep.tsx",
  "src/components/secondary/steps/ServiceConnectedStep.tsx",
  "src/components/secondary/steps/RatingsStep.tsx",
  "src/components/secondary/steps/UploadStep.tsx",
  "src/components/secondary/steps/SuggestionsStep.tsx",
  "src/components/secondary/steps/EvidenceStep.tsx",
] as const;

/**
 * The only URL values the design permits the workflow to read: the legacy
 * cross-step `error` code and the public regulatory snapshot id. Neither is
 * context-bearing or selection-derived.
 */
const SANCTIONED_QUERY_KEYS = new Set(["error", "regSnapshot"]);

/** Private schema field names; none may reach a request target or worker path. */
const PRIVATE_FIELD_NAMES = [
  "diagnosedConditionIds",
  "serviceConnectedConditionIds",
  "serviceConnectedAnswerDraft",
  "ratingsByConditionId",
  "permanentAndTotalConditionIds",
  "conditionTimeline",
  "symptomIds",
  "medications",
  "treatments",
];

/** Names for the record as a whole; passing one to a request is a leak, not a lookup. */
const CONTEXT_OBJECT_NAMES = [
  "workflowContext",
  "browserWorkflowContext",
  "selections",
  "sessionContext",
];

/** `<namespace>:<name>:v<n>` — every browser-local key this app owns is namespaced and versioned. */
const STORAGE_KEY_PATTERN = /^[a-z0-9-]+:[a-z0-9-]+:v\d+$/;

/**
 * Each workflow registers its own browser-local keys for clear-all. A key that
 * no registry covers fails the suite, so a new store cannot ship without a
 * documented clear-all path in the same change.
 */
const KEY_REGISTRIES: readonly {
  workflow: string;
  prefix: string;
  keys: readonly string[];
}[] = [
  {
    workflow: "secondary",
    prefix: "secondary-condition-finder:",
    keys: secondaryWorkflowLocalStorageKeys,
  },
  {
    workflow: "presumptive",
    prefix: "presumptive-condition-finder:",
    keys: presumptiveLocalStorageKeys,
  },
];

/** The only same-origin worker/OCR assets the design allows the client to load. */
const SANCTIONED_WORKER_PATHS = new Set([
  "/pdf.worker.min.mjs",
  "/tesseract",
  "/tesseract/worker-guard.js",
  "/tesseract/tesseract-core-simd.wasm.js",
]);

interface SourceFile {
  path: string;
  source: string;
}

/** Skips a quoted or backticked string, returning the index of its closing quote. */
function skipString(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) return index;
  }
  return source.length - 1;
}

/**
 * Removes comments so prose that names a banned API (the design docs and code
 * comments do this) cannot fail these checks. String literals are preserved.
 */
function stripComments(source: string): string {
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' || character === "'" || character === "`") {
      const end = skipString(source, index);
      result += source.slice(index, end + 1);
      index = end;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end - 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 1;
      result += " ";
      continue;
    }
    result += character;
  }
  return result;
}

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function readSource(relativePath: string): SourceFile {
  return {
    path: relativePath,
    source: stripComments(fs.readFileSync(path.join(ROOT, relativePath), "utf8")),
  };
}

function asSourceFiles(directory: string): SourceFile[] {
  return listSourceFiles(directory).map((absolute) =>
    readSource(path.relative(ROOT, absolute).split(path.sep).join("/")),
  );
}

const allSourceFiles = asSourceFiles(SRC);

/**
 * Every client-side module the design governs: the six step pages, the
 * workflow / client-corpus / evidence libraries they import, and the client
 * components that render them.
 */
const clientSurface = ([

  ...STEP_PAGES.map((page) => readSource(page)),
  ...asSourceFiles(path.join(SRC, "lib", "secondary-workflow")),
  ...asSourceFiles(path.join(SRC, "lib", "client-corpus")),
  ...asSourceFiles(path.join(SRC, "lib", "evidence")),
  ...asSourceFiles(path.join(SRC, "components", "secondary")),
  ...asSourceFiles(path.join(SRC, "components", "evidence")),
  // The presumptive track went browser-local on 2026-10-08, so its client
  // modules answer to the same rules.
  ...asSourceFiles(path.join(SRC, "components", "presumptive")),
  readSource("src/components/ServiceHistoryForm.tsx"),
  readSource("src/lib/presumptive/browser-history.ts"),
  readSource("src/lib/presumptive/use-browser-history.ts"),
  readSource("src/lib/presumptive/cross-link.ts"),
  readSource("src/app/presumptive/results/secondary-cross-link.ts"),
  // `server-only` modules can never enter the client graph — Next fails the
  // build if a client component imports one — so client transport rules do not
  // apply. The OCR model route's contract (`src/lib/evidence/ocr-model.ts`) is
  // the one such module in these directories: it names a CDN URL server-side
  // and never runs in a browser tab.
] as SourceFile[]).filter((file) => !/^import\s+"server-only";/m.test(file.source));

/** The text inside the parentheses that open at `openIndex`, or null if unbalanced. */
function parenthesizedBody(source: string, openIndex: number): string | null {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' || character === "'" || character === "`") {
      index = skipString(source, index);
      continue;
    }
    if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  return null;
}

/** Splits an argument list on top-level commas, keeping nested calls intact. */
function splitArguments(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '"' || character === "'" || character === "`") {
      const end = skipString(body, index);
      current += body.slice(index, end + 1);
      index = end;
      continue;
    }
    if ("([{".includes(character)) depth += 1;
    else if (")]}".includes(character)) depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

/** Every call to the matched callee, with its top-level argument expressions. */
function callSites(
  source: string,
  calleePattern: RegExp,
): { callee: string; args: string[] }[] {
  const sites: { callee: string; args: string[] }[] = [];
  for (const match of source.matchAll(calleePattern)) {
    const openIndex = (match.index ?? 0) + match[0].length - 1;
    if (source[openIndex] !== "(") continue;
    const body = parenthesizedBody(source, openIndex);
    if (body === null) continue;
    sites.push({ callee: match[1], args: splitArguments(body) });
  }
  return sites;
}

/** The value of a plain single- or double-quoted literal, else null. */
function stringLiteralValue(expression: string): string | null {
  const match = /^["']([^"']*)["']$/.exec(expression.trim());
  return match ? match[1] : null;
}

function offendersMentioning(sites: { callee: string; args: string[] }[]): string[] {
  const names = [...PRIVATE_FIELD_NAMES, ...CONTEXT_OBJECT_NAMES];
  const offenders: string[] = [];
  for (const site of sites) {
    for (const expression of site.args) {
      for (const name of names) {
        if (expression.includes(name)) offenders.push(`${site.callee}(${expression})`);
      }
      if (expression.includes("${")) {
        offenders.push(`${site.callee}(${expression})`);
      }
    }
  }
  return offenders;
}

describe("design conformance: step pages read context only through the sanctioned record", () => {
  it("never touches browser storage, cookies, or server headers", () => {
    for (const page of STEP_PAGES) {
      const { source } = readSource(page);
      expect(source, `${page}: no browser storage`).not.toMatch(
        /\b(?:sessionStorage|localStorage)\b/,
      );
      expect(source, `${page}: no cookie reads`).not.toMatch(/document\.cookie/);
      expect(source, `${page}: no next/headers import`).not.toMatch(
        /["']next\/headers["']/,
      );
      expect(source, `${page}: no raw storage key`).not.toMatch(
        /secondary-condition-finder:/,
      );
    }
  });

  it("reads only the design's public query values from the URL", () => {
    const offenders: string[] = [];
    for (const page of STEP_PAGES) {
      const { source } = readSource(page);
      expect(source, `${page}: no self-built URL parsing`).not.toMatch(
        /URLSearchParams|location\.search|window\.location|new URL\(/,
      );
      for (const match of source.matchAll(/searchParams\??\.get\(\s*([^)]*)\)/g)) {
        const key = stringLiteralValue(match[1]);
        if (key === null) offenders.push(`${page}: computed query key (${match[1].trim()})`);
        else if (!SANCTIONED_QUERY_KEYS.has(key)) offenders.push(`${page}: ?${key}`);
      }
    }
    expect(
      offenders,
      "step pages may read only public, non-context query values",
    ).toEqual([]);
  });

  it("keeps each record's storage key defined in exactly one sanctioned module", () => {
    const definers = (key: string) =>
      allSourceFiles
        .filter((file) => file.source.includes(`"${key}"`))
        .map((file) => file.path);

    expect(definers(browserWorkflowContextStorageKey)).toEqual([
      "src/lib/secondary-workflow/browser-context.ts",
    ]);
    expect(definers(presumptiveHistoryStorageKey)).toEqual([
      "src/lib/presumptive/browser-history.ts",
    ]);
  });
});

describe("design conformance: every browser storage key is on a clear-all registry", () => {
  const registry = new Set<string>(KEY_REGISTRIES.flatMap(({ keys }) => [...keys]));

  it("registers exactly the versioned key literals that src/ declares", () => {
    const declared = new Set<string>();
    for (const file of allSourceFiles) {
      for (const match of file.source.matchAll(/"([^"\n]+)"/g)) {
        if (STORAGE_KEY_PATTERN.test(match[1])) declared.add(match[1]);
      }
    }

    // Set equality both ways: a new key without registration fails, and a
    // registry entry whose key no longer exists anywhere fails too.
    expect([...declared].sort()).toEqual([...registry].sort());
  });

  it("keeps each registry namespaced, versioned, duplicate-free and disjoint", () => {
    const seen = new Set<string>();
    for (const { workflow, prefix, keys } of KEY_REGISTRIES) {
      expect(keys.length, `${workflow} registry is non-empty`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key, `${workflow} namespace`).toMatch(new RegExp(`^${prefix}`));
        expect(key, `${workflow} versioned key`).toMatch(STORAGE_KEY_PATTERN);
        expect(seen.has(key), `${key} is registered twice`).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(registry.size);
    expect(registry.has(browserWorkflowContextStorageKey)).toBe(true);
    expect(registry.has(presumptiveHistoryStorageKey)).toBe(true);
  });

  it("never reaches browser storage through an unregistered key", () => {
    const declaredConstants = new Map<string, string>();
    for (const file of allSourceFiles) {
      for (const match of file.source.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*"([^"\n]+)"/g,
      )) {
        declaredConstants.set(match[1], match[2]);
      }
    }

    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      for (const site of callSites(
        file.source,
        /\.(getItem|setItem|removeItem)\s*\(/g,
      )) {
        const target = site.args[0] ?? "";
        const literal = stringLiteralValue(target);
        if (literal !== null) {
          if (!registry.has(literal)) {
            offenders.push(`${file.path}: ${site.callee}("${literal}")`);
          }
          continue;
        }
        const resolved = declaredConstants.get(target);
        if (resolved !== undefined && registry.has(resolved)) continue;
        const iteratesRegistry =
          /^[A-Za-z0-9_$]+$/.test(target) &&
          new RegExp(
            `(?:const|let|var)\\s+${target}\\s+of\\s+(?:secondaryWorkflowLocalStorageKeys|presumptiveLocalStorageKeys)`,
          ).test(file.source);
        if (iteratesRegistry) continue;
        offenders.push(`${file.path}: ${site.callee}(${target})`);
      }
    }

    expect(
      offenders,
      "browser storage keys must be registered for clear-all",
    ).toEqual([]);
  });
});

describe("design conformance: client fetchers build only uniform requests", () => {
  it("has no alternative transport that could carry private context", () => {
    for (const file of clientSurface) {
      expect(file.source, `${file.path}: sendBeacon`).not.toMatch(
        /navigator\.sendBeacon/,
      );
      expect(file.source, `${file.path}: XHR`).not.toMatch(/XMLHttpRequest/);
      expect(file.source, `${file.path}: EventSource`).not.toMatch(
        /\bnew\s+EventSource/,
      );
      expect(file.source, `${file.path}: WebSocket`).not.toMatch(/\bnew\s+WebSocket/);
      expect(file.source, `${file.path}: service worker`).not.toMatch(
        /navigator\.serviceWorker/,
      );
    }
  });

  it("never constructs a URL or a query in the client surface", () => {
    for (const file of clientSurface) {
      expect(file.source, `${file.path}: no URL construction`).not.toMatch(
        /\bnew URL\(|URLSearchParams|location\.search|history\.(?:push|replace)State/,
      );
    }
  });

  it("requests only a plain same-origin literal or the public corpus constant", () => {
    const offenders: string[] = [];
    for (const file of clientSurface) {
      for (const site of callSites(file.source, /\b(fetch|fetcher)\s*\(/g)) {
        const target = site.args[0] ?? "";
        const literal = stringLiteralValue(target);
        if (literal !== null) {
          if (!literal.startsWith("/")) {
            offenders.push(`${file.path}: ${site.callee}("${literal}") is not same-origin`);
          }
        } else if (target !== "CLIENT_CORPUS_PATH") {
          offenders.push(
            `${file.path}: ${site.callee}(${target}) is not a plain literal or CLIENT_CORPUS_PATH`,
          );
        }
        for (const expression of offendersMentioning([site])) {
          offenders.push(`${file.path}: ${expression}`);
        }
      }
    }

    expect(
      offenders.filter((entry, index) => offenders.indexOf(entry) === index),
      "client fetches must be uniform and free of the record",
    ).toEqual([]);
  });

  it("loads workers and OCR assets only from the sanctioned same-origin paths", () => {
    const offenders: string[] = [];
    for (const file of clientSurface) {
      for (const site of callSites(file.source, /\bnew\s+Worker\s*\(/g)) {
        const target = site.args[0] ?? "";
        if (target.includes("URL.createObjectURL(")) continue; // local blob, no request
        const literal = stringLiteralValue(target);
        if (
          literal === null ||
          !literal.startsWith("/") ||
          !SANCTIONED_WORKER_PATHS.has(literal)
        ) {
          offenders.push(`${file.path}: new Worker(${target})`);
        }
      }
      for (const match of file.source.matchAll(
        /GlobalWorkerOptions\.workerSrc\s*=\s*"([^"]+)"/g,
      )) {
        if (!SANCTIONED_WORKER_PATHS.has(match[1])) {
          offenders.push(`${file.path}: workerSrc = "${match[1]}"`);
        }
      }
      for (const match of file.source.matchAll(
        /\b(workerPath|corePath|langPath)\s*:\s*"([^"]+)"/g,
      )) {
        if (!SANCTIONED_WORKER_PATHS.has(match[2])) {
          offenders.push(`${file.path}: ${match[1]} = "${match[2]}"`);
        }
      }
    }

    expect(
      offenders,
      "worker and OCR assets must be same-origin sanctioned paths",
    ).toEqual([]);
  });

  it("keeps the corpus request parameterless — the design's uniform-request example", () => {
    const loader = readSource("src/lib/client-corpus/use-client-corpus.ts").source;

    expect(loader).toContain("fetcher(CLIENT_CORPUS_PATH");
    expect(CLIENT_CORPUS_PATH).toBe("/kb/client-corpus.json");
    expect(CLIENT_CORPUS_PATH).not.toContain("?");
  });
});
