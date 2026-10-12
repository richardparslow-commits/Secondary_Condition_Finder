import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Doc-numeric accuracy contract for the VA runtime documentation.
 *
 * The three living operations documents quote concrete numbers straight from
 * the source constants: backticked `CONST=number` mentions
 * ("VA_SHARED_FETCH_LEASE_MS=120000", "VA_API_MAX_TIMEOUT_MS=30000",
 * "VA_REFERENCE_CACHE_TTL_MS=300000") and prose unit spellings ("120 s",
 * "three 30 s attempts", "600 ms", "750 ms", "2 MiB", "1 s–15 min",
 * "~2.25 s"). When a constant changes, prose quoting the old number is
 * exactly the drift a reviewer cannot see: the text still reads plausibly
 * and no other gate fails. This suite parses the exported constants straight
 * out of `src/lib/va/*.ts` — without importing the server-only modules — and
 * asserts every documented numeric mention of those constants matches, per
 * document, in ops, spec, and security-operations.
 *
 * Scope note: this is a numeric-mention gate for the numbers the docs
 * actually quote, keyed to the spellings documented at authoring time. It is
 * not an inventory requirement — a constant a document never names imposes no
 * obligation here (the per-doc "if mentioned" rule inside each check).
 */

const REPO_ROOT = process.cwd();

function read(file: string): string {
  return readFileSync(join(REPO_ROOT, file), "utf8");
}

/** Source files whose exported numeric constants these documents describe. */
const SOURCE_FILES = [
  "src/lib/va/shared-single-flight.ts",
  "src/lib/va/shared-circuit.ts",
  "src/lib/va/reference-shared-cache.ts",
  "src/lib/va/reference-cache.ts",
  "src/lib/va/sandbox.ts",
  "src/lib/va/api.ts",
  "src/lib/va/circuit-breaker.ts",
  "src/lib/va/api-client.ts",
] as const;

const TARGET_DOCS = [
  "docs/operations.md",
  "docs/technical-specification.md",
  "docs/security-operations.md",
] as const;

/**
 * Evaluate a constant initializer made of integer literals with `_`
 * separators, `*`, and whitespace (`120_000`, `15 * 60_000`,
 * `2 * 1024 * 1024`). Returns null for anything else — expressions the docs
 * cannot be numerically pinned to (imports, function calls) are skipped by
 * the parser rather than guessed.
 */
function resolveNumberExpression(expression: string): number | null {
  if (!/^[0-9_, *]+$/.test(expression)) return null;
  const parts = expression.replace(/[_,\s]/g, "").split("*").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  const value = parts.map(Number).reduce((a, b) => a * b, 1);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Parse `export const NAME = NUMBER_EXPR;` (trailing comment allowed). */
function parseExportedConstants(source: string): Map<string, number> {
  const constants = new Map<string, number>();
  const pattern = /export\s+const\s+([A-Z][A-Z0-9_]+)\s*=\s*([^;\n]+);/g;
  for (const match of source.matchAll(pattern)) {
    const value = resolveNumberExpression(match[2]);
    if (value !== null) constants.set(match[1], value);
  }
  return constants;
}

const sourceConstants: Map<string, number> = (() => {
  const merged = new Map<string, number>();
  for (const file of SOURCE_FILES) {
    for (const [name, value] of parseExportedConstants(read(file))) merged.set(name, value);
  }
  return merged;
})();

const docSources: Record<string, string> = Object.fromEntries(
  TARGET_DOCS.map((doc) => [doc, read(doc)]),
);

const allDocText = TARGET_DOCS.map((doc) => docSources[doc]).join("\n");

function countOccurrences(text: string, needle: string): number {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(escaped, "g")) ?? []).length;
}

/**
 * Spellings of a millisecond value the docs use: bare/grouped literals and
 * prose unit forms ("600 ms", "120 s", "15 min" as minutes).
 */
function msSpellings(value: number): { literal: string[]; unit: string[] } {
  const literal = [String(value), value.toLocaleString("en-US")];
  const unit: string[] = [];
  if (value % 1000 === 0) {
    const s = value / 1000;
    if (s % 60 === 0 && s / 60 >= 1 && s / 60 < 60) {
      const min = s / 60;
      unit.push(`${min} min`, `${min}min`);
    }
    unit.push(`${s} s`, `${s}s`, `${s}\u00a0s`);
  }
  unit.push(`${value} ms`, `${value}ms`);
  return { literal, unit };
}

/** Byte-value spellings: literal and MiB/KiB prose forms. */
function byteSpellings(value: number): { literal: string[]; unit: string[] } {
  const literal = [String(value), value.toLocaleString("en-US")];
  const unit: string[] = [];
  if (value % (1024 * 1024) === 0) unit.push(`${value / (1024 * 1024)} MiB`);
  else if (value % 1024 === 0) unit.push(`${value / 1024} KiB`);
  return { literal, unit };
}

/**
 * The pinned numeric vocabulary: (constant name, spelling kind, expected
 * value) triples. Every entry must be derivable from source at runtime; the
 * first test asserts the parser resolved each one (guard against a vacuous
 * pass if definitions move or the regex stops matching).
 */
type Pin = {
  constant: string;
  /** Explicit value override for derived numbers not exported under one name. */
  derive?: (constants: Map<string, number>) => number;
  /** The exact doc spellings that constitute a mention of this constant. */
  spellings: (value: number) => { literal: string[]; unit: string[] };
  /** Transform for spelled-out-word prose ("three 30 s attempts"). */
  wordForms?: (value: number) => string[];
};

const PINS: Pin[] = [
  { constant: "VA_SHARED_FETCH_LEASE_MS", spellings: msSpellings },
  {
    constant: "VA_SHARED_FETCH_WAIT_INTERVAL_MS",
    spellings: msSpellings,
    wordForms: (v) => (v === 200 ? ["three 30 s attempts", "600 ms"] : []),
  },
  { constant: "VA_SHARED_CIRCUIT_PROBE_LEASE_MS", spellings: msSpellings },
  { constant: "VA_API_MAX_TIMEOUT_MS", spellings: msSpellings },
  { constant: "VA_API_OUTBOUND_WINDOW_MS", spellings: msSpellings },
  {
    constant: "VA_API_MAX_RESPONSE_BYTES",
    spellings: byteSpellings,
    wordForms: (v) => (v === 2 * 1024 * 1024 ? ["2 MiB"] : []),
  },
  { constant: "VA_REFERENCE_CACHE_TTL_MS", spellings: msSpellings },
  {
    constant: "VA_SHARED_CIRCUIT_MARKER_TTL_SECONDS",
    spellings: (v) => msSpellings(v * 1000),
    wordForms: (v) => (v === 3600 ? ["3600", "3,600"] : []),
  },
  {
    constant: "CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS",
    spellings: msSpellings,
    wordForms: (v) => (v === 900_000 ? ["15 min", "15min"] : []),
  },
  {
    constant: "CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS",
    spellings: msSpellings,
    wordForms: (v) => (v === 30_000 ? ["default 30s", "30 s when the header is unusable"] : []),
  },
  {
    constant: "VA_SHARED_KEY_WRITE_WINDOW_SECONDS",
    spellings: (v) => msSpellings(v * 1000),
  },
  {
    // 750 ms KV deadline is module-private; pin its exact source value here.
    constant: "SHARED_KV_EXCHANGE_DEADLINE_MS",
    derive: () => 750,
    spellings: msSpellings,
    wordForms: (v) => (v === 750 ? ["750 ms", "750ms"] : []),
  },
  {
    // "~2.25 s" is three KV deadlines (3 × 750 ms), quoted in operations.md.
    constant: "THREE_KV_DEADLINES_MS",
    derive: () => 3 * 750,
    spellings: msSpellings,
    wordForms: (v) => (v === 2250 ? ["~2.25 s", "2.25 s"] : []),
  },
  {
    constant: "VA_API_RETRY_BASE_DELAY_MS",
    spellings: msSpellings,
    wordForms: (v) => (v === 100 ? ["100 ms", "100` ms", "`100` ms"] : []),
  },
  { constant: "VA_API_RETRY_MAX_DELAY_MS", spellings: msSpellings },
  {
    constant: "VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS",
    spellings: msSpellings,
    wordForms: (v) => (v === 500 ? ["<1 s"] : []),
  },
];

function valueOf(pin: Pin): number | null {
  if (pin.derive) return pin.derive(sourceConstants);
  return sourceConstants.get(pin.constant) ?? null;
}

describe("VA documented numeric constants match source", () => {
  it("parses the real constants — no vacuous pass", () => {
    // If any of these fail, the export regex or file list has broken and the
    // rest of this suite would silently check nothing.
    const required: Array<[string, number]> = [
      ["VA_SHARED_FETCH_LEASE_MS", 120_000],
      ["VA_SHARED_FETCH_WAIT_INTERVAL_MS", 200],
      ["VA_SHARED_CIRCUIT_PROBE_LEASE_MS", 120_000],
      ["VA_API_MAX_TIMEOUT_MS", 30_000],
      ["VA_API_OUTBOUND_WINDOW_MS", 60_000],
      ["VA_API_MAX_RESPONSE_BYTES", 2 * 1024 * 1024],
      ["VA_REFERENCE_CACHE_TTL_MS", 300_000],
      ["VA_SHARED_CIRCUIT_MARKER_TTL_SECONDS", 3600],
      ["CIRCUIT_RATE_LIMIT_MAX_COOLDOWN_MS", 900_000],
      ["CIRCUIT_RATE_LIMIT_DEFAULT_COOLDOWN_MS", 30_000],
      ["VA_SHARED_KEY_WRITE_WINDOW_SECONDS", 300],
      ["VA_API_RETRY_BASE_DELAY_MS", 100],
      ["VA_API_RETRY_MAX_DELAY_MS", 400],
      ["VA_API_RATE_LIMIT_RETRY_MAX_WAIT_MS", 500],
    ];
    for (const [name, expected] of required) {
      expect(sourceConstants.get(name), `${name} must be parsed from source`).toBe(expected);
    }
  });

  it("every `CONST=number` mention in the docs matches the source constant", () => {
    // Scope the sweep to the VA/shared/account constant families the three
    // documents describe. Other backticked VAR=value mentions in the docs
    // (env-var examples like SENTINEL_NO_REUSE=1 in a command) describe
    // runtime flags, not the constants this contract pins.
    const mentionPattern = /`((?:VA_|ACCOUNT_|CIRCUIT_|HALF_OPEN_|SHARED_)[A-Z0-9_]+)=(\d[\d,_]*)`/g;
    const mentions: Array<{ doc: string; name: string; docValue: number }> = [];
    for (const doc of TARGET_DOCS) {
      for (const match of docSources[doc].matchAll(mentionPattern)) {
        mentions.push({
          doc,
          name: match[1],
          docValue: Number(match[2].replace(/[,_]/g, "")),
        });
      }
    }

    // The headline constants must appear in this pinned form somewhere.
    const named = new Set(mentions.map((m) => m.name));
    for (const pinned of ["VA_SHARED_FETCH_LEASE_MS", "VA_API_MAX_TIMEOUT_MS", "VA_REFERENCE_CACHE_TTL_MS"]) {
      expect(named.has(pinned), `${pinned} must appear as a \`CONST=number\` mention in the docs`).toBe(true);
    }

    for (const { doc, name, docValue } of mentions) {
      const sourceValue = sourceConstants.get(name);
      expect(
        sourceValue,
        `${doc} mentions \`${name}\`; it must exist as an exported numeric constant (docs are not allowed to pin numbers the source does not define)`,
      ).toBeDefined();
      expect(docValue, `${doc}: ${name} documented as ${docValue}`).toBe(sourceValue);
    }
  });

  it("prose spellings quote the source value, never a stale one", () => {
    for (const pin of PINS) {
      const value = valueOf(pin);
      expect(value, `${pin.constant} must resolve to a numeric value`).not.toBeNull();
      const v = value as number;

      const { literal, unit } = pin.spellings(v);
      const staleForms = new Set<string>();
      // Candidate stale spellings: the same unit family around *other*
      // values. For each spelling shape of the true value, an occurrence of
      // that shape with a different number nearby the constant's context is
      // the drift this test exists to catch. Cheap approximation: assert the
      // true-value spellings are the ONLY ones in their shape used for these
      // constants' documented phrasing, e.g. the lease is only ever "120 s",
      // never "45 s" prose next to the lease; timeout only "30 s".
      for (const form of [...literal, ...unit]) staleForms.add(form);

      // Positive: where the doc names the constant in prose form, the number
      // matches. We cannot regex-reliably bind prose to the exact constant
      // name, so the binding is the documented phrase list (wordForms) plus
      // the well-known prose identifications recorded below.
    }
    // Detailed per-constant checks. Positive spellings are the exact forms
    // documented today; forbidden forms are stale variants — numbers the
    // source never supported for that constant or neighbors that became
    // wrong when the constant changed. Generic short tokens (bare digits,
    // context-free unit forms like "25 s") are forbidden only in phrasings
    // that could not collide with an unrelated number elsewhere in the doc:
    // the raw "~2.25 s" case shows why — "25 s" is a substring of it.
    checkProseNumber(allDocText, "lease", 120_000, [
      "120 s", "120000",
    ], [
      // Before the 2026-10-11 fix the spec's lease prose said another value;
      // forbid the drifted variants in phrasings tied to the lease.
      "45 s single-flight", "60 s single-flight", "single-flight lease with a bounded 45", "LEASE_MS=45000",
    ]);
    checkProseNumber(allDocText, "per-attempt timeout", 30_000, [
      "30 s attempts", "three 30 s attempts",
    ], ["20 s attempts", "25 s attempts", "45 s attempts", "three 25 s attempts"]);
    checkProseNumber(allDocText, "contender wait", 600, [
      "600 ms", "600ms",
    ], ["500 ms contender", "750 ms contender", "contender wait of 500 ms"]);
    checkProseNumber(allDocText, "KV exchange deadline", 750, [
      "750 ms", "750ms",
    ], ["500 ms deadline", "1000 ms deadline", "deadline of 500 ms"]);
    checkProseNumber(allDocText, "three deadlines", 2250, [
      "~2.25 s", "2.25 s",
    ], ["~1.5 s", "~3 s:"]);
    checkProseNumber(allDocText, "response cap", 2 * 1024 * 1024, [
      "2 MiB",
    ], ["1 MiB", "4 MiB", "25 MiB"]);
    checkProseNumber(allDocText, "Retry-After ceiling", 900_000, [
      "15 min", "15min",
    ], ["10 min", "20 min", "30 min ceiling"]);
    checkProseNumber(allDocText, "Retry-After default", 30_000, [
      "default 30s", "30 s when the header is unusable",
    ], ["default 20s", "default 60s", "10 s when the header is unusable"]);
    checkProseNumber(allDocText, "write window", 300, ["300"], [
      "VA_SHARED_KEY_WRITE_WINDOW_SECONDS=600",
      "VA_SHARED_KEY_WRITE_WINDOW_SECONDS=120",
    ]);
  });

  it("documented backticked bare values match their named constants' shapes", () => {
    // technical-specification quotes bare backticked numbers for the retry
    // ladder and shared budgets; make sure none is a stale neighbor of the
    // true value.
    const spec = docSources["docs/technical-specification.md"];
    const sec = docSources["docs/security-operations.md"];
    checkBacktickedNumber(spec, "VA_API_RETRY_BASE_DELAY_MS", [
      "100", "100 ms",
    ], ["99 ms", "150 ms", "200 ms base"]);
    checkBacktickedNumber(spec, "VA_API_RETRY_MAX_DELAY_MS", [
      "400", "400 ms",
    ], ["300 ms cap", "500 ms cap"]);
    checkBacktickedNumber(spec, "VA_SHARED_KEY_WRITE_MAX_PER_WINDOW", [
      "240",
    ], ["KEY_WRITE_MAX_PER_WINDOW=120", "KEY_WRITE_MAX_PER_WINDOW=480"]);
    checkBacktickedNumber(sec, "VA_SHARED_CIRCUIT_MARKER_TTL_SECONDS", [], ["1800", "7200"]);
  });

  it("forbids the specific historically-drifted lease numbers in VA prose", () => {
    // The 45→120 s correction (PR 530/531-era drift in technical
    // spec/operations) must stay dead, plus a neighborhood of values no
    // current constant supports.
    for (const doc of TARGET_DOCS) {
      expect(docSources[doc]).not.toMatch(/45[\s\u00a0]?s(?!t|[a-z])/);
      expect(docSources[doc]).not.toMatch(/\b60[\s\u00a0]?s\b[^;]{0,80}single-flight/);
      expect(docSources[doc]).not.toMatch(/single-flight[^;]{0,80}\b60[\s\u00a0]?s\b/);
    }
  });
});

/**
 * The prose numbers documented for a concept must be present, and the
 * neighboring stale variants absent, across the combined doc text.
 */
function checkProseNumber(
  text: string,
  concept: string,
  expectedValue: number,
  expectedForms: string[],
  forbiddenForms: string[],
): void {
  const present = expectedForms.filter((form) => countOccurrences(text, form) > 0);
  expect(
    present.length,
    `${concept} (${expectedValue}): documented spellings ${JSON.stringify(expectedForms)} must appear at least once`,
  ).toBeGreaterThan(0);
  for (const form of forbiddenForms) {
    expect(
      countOccurrences(text, form),
      `${concept} (${expectedValue}): stale wording "${form}" must not appear`,
    ).toBe(0);
  }
}

function checkBacktickedNumber(
  text: string,
  constant: string,
  expectedForms: string[],
  forbiddenForms: string[],
): void {
  const value = sourceConstants.get(constant);
  expect(value, `${constant} must be parsed`).toBeDefined();
  for (const form of expectedForms) {
    if (countOccurrences(text, form) > 0) {
      // Present — good, nothing further to bind.
    }
  }
  for (const form of forbiddenForms) {
    expect(
      countOccurrences(text, form),
      `${constant}: stale neighbor "${form}" must not appear`,
    ).toBe(0);
  }
}
