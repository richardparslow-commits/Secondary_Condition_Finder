/**
 * Text-level scanner behind the pre-commit PHI-logging gate.
 *
 * Enforces the same invariant as the ESLint rule in `eslint-rules/`
 * (`console.<method>` takes exactly one argument, and that argument is provably
 * a bounded string), but without an AST. Two independent implementations of one
 * rule is deliberate: the pre-commit script must run on a staged file before
 * `npm run lint` has a chance to, and
 * `tests/phi-logging-boundary.test.ts` runs both against the real source tree so
 * a change that satisfies one and not the other fails CI rather than silently
 * weakening the gate.
 *
 * Scope, stated honestly: this is a lexical check, so it reasons about argument
 * *shape* only. It cannot know whether an interpolated template expression holds
 * request-derived text. That question is answered elsewhere and by different
 * means — the edge guard refuses private workflow parameters before any loader
 * runs, and the structured logger's value-shape allowlist governs the sanctioned
 * sink. The scanner's job is the mechanical part: no wholesale object dumps, and
 * no direct `console` calls from request-derived code.
 */

/**
 * Files allowed to call `console` directly.
 *
 * The single source of truth for the exemption: `eslint.config.mjs` disables the
 * equivalent rule for these paths, and `tests/phi-logging-boundary.test.ts`
 * asserts the two lists are identical, so an exemption cannot be granted in one
 * enforcement point without the other.
 *
 * Both entries emit exactly one pre-serialized JSON line whose fields have
 * already passed the logger's `PROHIBITED_LOG_FIELDS` blocklist and value-shape
 * allowlist — the invariant holds by construction, so the rule (which reasons
 * about the argument expression alone) cannot see that.
 */
export const SANCTIONED_SINKS = [
  "src/lib/observability/logger.ts",
  "src/lib/engine/metrics.ts",
];

/** `console` methods that serialize their arguments. */
export const CONSOLE_METHODS = new Set([
  "log",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "dir",
  "dirxml",
  "table",
]);

const CONSOLE_PATTERN = /console\s*\.\s*([A-Za-z]+)\s*\(/g;

/** Textual prefixes whose result is a bounded primitive, not an object. */
const BOUNDED_PREFIXES = [
  "JSON.stringify",
  "String(",
  "Number(",
  "Boolean(",
  "String.raw",
];

/** Method calls on an unknown receiver that still yield a string. */
const BOUNDED_SUFFIXES = [
  ".toString(",
  ".toISOString(",
  ".toFixed(",
  ".join(",
  ".trim(",
  ".slice(",
  ".padStart(",
  ".padEnd(",
  ".toUpperCase(",
  ".toLowerCase(",
];

/**
 * Split an argument list on top-level commas, ignoring commas inside nested
 * brackets and inside string/template literals.
 *
 * Tracking quote state matters for the realistic false-negative: a comma inside
 * a template literal or URL would otherwise be read as an argument boundary and
 * turn a one-argument call into a reported two-argument call.
 */
function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  let quote = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === "\\") {
        current += character + (text[index + 1] ?? "");
        index += 1;
        continue;
      }
      if (character === quote) quote = null;
      current += character;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

/** True when the argument text is provably a bounded primitive. */
export function isBoundedArgument(text) {
  const value = text.trim();
  if (value.length === 0) return false;
  if (value.startsWith("`")) return true;
  if (value.startsWith('"') || value.startsWith("'")) {
    // A concatenation of literals is still a literal; a literal followed by an
    // identifier is not provably bounded.
    const rest = value.replace(/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/, "").trim();
    if (rest.length === 0) return true;
    if (rest.startsWith("+")) return true;
    return false;
  }
  if (/^-?\d[\d_.eE+-]*$/.test(value.replace(/[()\s]/g, ""))) return true;
  if (value === "true" || value === "false" || value === "null") return true;
  if (BOUNDED_PREFIXES.some((prefix) => value.startsWith(prefix))) return true;
  if (BOUNDED_SUFFIXES.some((suffix) => value.includes(suffix))) return true;
  return false;
}

/**
 * Blank the contents of comments and string/template literals, preserving every
 * character offset (newlines are kept) so line numbers survive.
 *
 * Without this the scanner reports its own test fixtures and documentation: a
 * planted snippet inside a string literal and a `console.error(msg, obj)` example
 * inside a doc comment both look like real call sites, which made the `--all`
 * mode useless for exactly the files that describe the rule. Quote characters
 * themselves are left in place — the argument-shape check keys off the opening
 * quote, and `splitArguments` needs both ends to track string state correctly.
 *
 * Known limitation: regex literals are not masked. A regex containing the text
 * `console.<method>(` would be misread; that shape does not occur in this
 * repository, and masking regex literals requires a tokenizer rather than a
 * scanner.
 */
export function maskNonCode(source) {
  const characters = [...source];
  const blank = (from, to) => {
    for (let index = from; index < to && index < characters.length; index += 1) {
      if (characters[index] !== "\n") characters[index] = " ";
    }
  };

  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === "/" && next === "/") {
      const endOfLine = source.indexOf("\n", index);
      const stop = endOfLine === -1 ? source.length : endOfLine;
      blank(index, stop);
      index = stop;
      continue;
    }

    if (character === "/" && next === "*") {
      const endOfBlock = source.indexOf("*/", index + 2);
      const stop = endOfBlock === -1 ? source.length : endOfBlock + 2;
      blank(index, stop);
      index = stop;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      const spansLines = quote === "`";
      let cursor = index + 1;
      let terminated = false;
      while (cursor < source.length) {
        if (source[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        // A single- or double-quoted string cannot contain a raw newline, so
        // running into one means this quote was not a string delimiter. That is
        // the sound way to tell a real string from an apostrophe or quote
        // character inside a regex literal (`/^\s*["']use server["']/m`), and it
        // is what stops one such character from opening a phantom string that
        // swallows every following line and hides a genuine violation.
        if (!spansLines && (source[cursor] === "\n" || source[cursor] === "\r")) break;
        if (source[cursor] === quote) {
          terminated = true;
          break;
        }
        cursor += 1;
      }
      if (!terminated) {
        index += 1;
        continue;
      }
      // Keep the opening and closing quote; blank the interior.
      blank(index + 1, cursor);
      index = cursor + 1;
      continue;
    }

    index += 1;
  }

  return characters.join("");
}

/**
 * Every `console.<method>` call site in `source`, with its argument list and any
 * violation code. `index` is the offset of the `console` token, so a caller can
 * map it back to a line number.
 */
export function scanConsoleSites(source) {
  const sites = [];
  CONSOLE_PATTERN.lastIndex = 0;
  let match;
  while ((match = CONSOLE_PATTERN.exec(source)) !== null) {
    const method = match[1];
    if (!CONSOLE_METHODS.has(method)) continue;

    // Walk the balanced argument list from the opening parenthesis.
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let quote = null;
    let endIndex = -1;
    for (let index = openIndex; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === "\\") {
          index += 1;
          continue;
        }
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          endIndex = index;
          break;
        }
      }
    }

    const argumentText =
      endIndex === -1 ? "" : source.slice(openIndex + 1, endIndex);
    const args = splitArguments(argumentText);

    let violation = null;
    if (args.length > 1) violation = "too-many-arguments";
    else if (args.length === 1 && !isBoundedArgument(args[0])) violation = "object-dump";

    sites.push({ index: match.index, method, args, violation });
    // Continue scanning after the call's opening so nested calls are still seen.
    CONSOLE_PATTERN.lastIndex = openIndex + 1;
  }
  return sites;
}

/** 1-based line number of a character offset. */
export function lineOf(source, index) {
  let line = 1;
  for (let position = 0; position < index && position < source.length; position += 1) {
    if (source[position] === "\n") line += 1;
  }
  return line;
}

/**
 * Scan one file. `isServerAction` flags a `"use server"` module, where any
 * direct `console` call is request-adjacent by construction.
 */
export function scanSource(source, { isServerAction = false } = {}) {
  const findings = [];
  // Scan the masked text so a call site quoted in a comment or a string literal
  // is not reported as a real one. Offsets are preserved, so `line` below still
  // refers to the original line.
  const masked = maskNonCode(source);
  for (const site of scanConsoleSites(masked)) {
    if (site.violation) {
      findings.push({
        line: lineOf(source, site.index),
        method: site.method,
        code: site.violation,
        detail: site.violation === "too-many-arguments"
          ? `${site.args.length} arguments`
          : "argument is not provably a bounded string",
      });
      continue;
    }
    if (isServerAction) {
      findings.push({
        line: lineOf(source, site.index),
        method: site.method,
        code: "console-in-server-action",
        detail: "request-derived module must not write to console directly",
      });
    }
  }
  return findings;
}
