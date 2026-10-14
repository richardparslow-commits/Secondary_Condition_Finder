import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * H-02 gate B (issue #538) — OAuth callback surface inventory and the
 * no-code-in-a-log-sink contract, checked against the real source tree.
 *
 * Gate B asks two questions the repository *can* answer about its own code:
 * which callback surfaces actually ship, and whether an authorization `code`
 * or `state` can reach a retained sink. The operator half (whether the hosting
 * provider's own access/runtime logs retain the callback request line) stays
 * externally operated and is NOT proven here — no test can inspect a hosting
 * account. What is pinned here is the code-side half:
 *
 * 1. **Inventory.** The surfaces that redeem a code, start a login, or
 *    disconnect are exactly the reviewed set, discovered by the reviewed
 *    entry points (`completeAccountLogin`, `startAccountLogin`,
 *    `disconnectAccount`). A new callback/initiator route fails this suite
 *    instead of shipping unreviewed, and the inventory in
 *    `docs/hosting-log-and-callback-inventory.md` must be updated with it.
 * 2. **No sink on the callback path.** The callback-path modules (the route
 *    handlers plus the account OAuth/config/store/transport modules) contain
 *    no logging sink at all: no `console.*`, no `createLogger`, no `auditLog`.
 *    The exchange cannot log a code because it cannot log.
 * 3. **No request-derived text in any sink, corpus-wide.** Every logging call
 *    site under `src/` is inspected: an argument that mentions a request URL,
 *    the query string, or an OAuth `code`/`state` read fails, so a future
 *    route cannot add `logger.info(request.url)` and call it reviewed.
 * 4. **Response hygiene.** Callback outcomes are fixed notice codes, failure
 *    bodies never carry an error message, and every callback response is
 *    `no-store` + `Referrer-Policy: no-referrer` so the code-bearing request
 *    URL cannot leak onward through a `Referer` header.
 *
 * The detector is deliberately falsified below with planted violations: a
 * fence that cannot fail is decoration, and this repository treats an
 * unfalsifiable check as no check at all.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function listSourceFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
        return listSourceFiles(absolute);
      }
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [absolute] : [];
    });
}

const SOURCE_FILES = listSourceFiles(SRC);
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Code with comments and string/template contents blanked (offsets preserved).
 * Reused from the shared PHI-logging scanner so this suite and the pre-commit
 * gate reason about the same text.
 */
function maskCode(source: string): string {
  const characters = [...source];
  const blank = (from: number, to: number) => {
    for (let index = from; index < to && index < characters.length; index += 1) {
      if (characters[index] !== "\n") characters[index] = " ";
    }
  };
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "/" && next === "/") {
      const stop = source.indexOf("\n", index);
      const end = stop === -1 ? source.length : stop;
      blank(index, end);
      index = end;
      continue;
    }
    if (character === "/" && next === "*") {
      const stop = source.indexOf("*/", index + 2);
      const end = stop === -1 ? source.length : stop + 2;
      blank(index, end);
      index = end;
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
      blank(index + 1, cursor);
      index = cursor + 1;
      continue;
    }
    index += 1;
  }
  return characters.join("");
}

/**
 * Logging sinks whose arguments this suite inspects: `console.<method>`, the
 * reviewed `auditLog` helper, and logger-object calls (`log.info`,
 * `auditLogger[level]`, `logger.error`, …). Names are matched by convention
 * rather than by import graph so a new sink module is inspected the moment it
 * calls something log-shaped.
 */
const SINK_CALL_PATTERN =
  /console\s*\.\s*(?:log|error|warn|info|debug|trace|dir|dirxml|table)\s*\(|\b(?:auditLog|logger|log|auditLogger|audit)(?:\s*\.\s*(?:info|warn|error|debug|trace)|\s*\[[^\]]{1,40}\])?\s*\(/g;

/** Argument text of every call site matching `pattern`, via balanced parens. */
function callArguments(source: string, pattern: RegExp): string[] {
  const masked = maskCode(source);
  const argumentsList: string[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let quote: string | null = null;
    let endIndex = -1;
    for (let index = openIndex; index < masked.length; index += 1) {
      const character = masked[index];
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
    if (endIndex !== -1) argumentsList.push(source.slice(openIndex + 1, endIndex));
    pattern.lastIndex = openIndex + 1;
  }
  return argumentsList;
}

/**
 * Text that must never reach a sink argument: a request URL or query string,
 * or an OAuth authorization `code`/`state` read off one.
 */
const REQUEST_DERIVED_MARKERS = [
  "request.url",
  "req.url",
  ".nextUrl",
  "url.search",
  "searchParams",
  "location.href",
  'get("code")',
  "get('code')",
  'get("state")',
  "get('state')",
];

/** Sink call sites whose arguments mention request-derived text. */
function findRequestDerivedSinkArguments(source: string): string[] {
  return callArguments(source, new RegExp(SINK_CALL_PATTERN.source, "g")).filter((argument) =>
    REQUEST_DERIVED_MARKERS.some((marker) => argument.includes(marker)),
  );
}

/**
 * Files that *call* `name(` as a reviewed entry point, sorted. Declarations are
 * stripped first: the module that defines the entry point is not a caller, and
 * counting it would let a second real caller hide behind it.
 */
function callersOf(name: string): string[] {
  const pattern = new RegExp(`\\b${name}\\s*\\(`);
  const withoutDeclarations = (source: string) =>
    maskCode(source).replace(
      /(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)/g,
      "",
    );
  return SOURCE_FILES.map(relative)
    .filter((file) => pattern.test(withoutDeclarations(read(file))))
    .sort();
}

/**
 * The callback path: the route handlers that can see a code or state, plus the
 * account modules that perform the exchange and hold the session store.
 */
const CALLBACK_PATH_MODULES = [
  "src/app/api/auth/callback/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/va-account/oauth/[service]/[operation]/route.ts",
  "src/lib/va/account/config.ts",
  "src/lib/va/account/oauth.ts",
  "src/lib/va/account/store.ts",
  "src/lib/va/account/transport.ts",
] as const;

const CALLBACK_ROUTE_FILES = [
  "src/app/api/auth/callback/route.ts",
  "src/app/va-account/oauth/[service]/[operation]/route.ts",
] as const;

describe("OAuth callback surface inventory (H-02 gate B)", () => {
  it("redeems an authorization code in exactly the reviewed callback surfaces", () => {
    expect(callersOf("completeAccountLogin")).toEqual([
      "src/app/api/auth/callback/route.ts",
      "src/app/va-account/oauth/[service]/[operation]/route.ts",
    ]);
  });

  it("starts a login or disconnects from exactly the reviewed surfaces", () => {
    expect(callersOf("startAccountLogin")).toEqual([
      "src/app/api/auth/login/route.ts",
      "src/app/va-account/oauth/[service]/[operation]/route.ts",
    ]);
    expect(callersOf("disconnectAccount")).toEqual([
      "src/app/va-account/oauth/[service]/[operation]/route.ts",
    ]);
  });

  it("keeps every callback-path module free of logging sinks", () => {
    // The strongest form of "codes are never logged here": there is no sink in
    // the module to log through. `oauth.ts` also has no logger import, so the
    // exchange cannot acquire one without failing this assertion.
    for (const file of CALLBACK_PATH_MODULES) {
      const source = read(file);
      expect(source, `${file} must not call console directly`).not.toContain("console.");
      expect(source, `${file} must not construct the logger`).not.toContain("observability/logger");
      expect(source, `${file} must not emit an audit event`).not.toContain("auditLog(");
      expect(
        callArguments(source, new RegExp(SINK_CALL_PATTERN.source, "g")),
        `${file} must not call a log-shaped sink`,
      ).toEqual([]);
    }
  });

  it("never passes a request URL, query string, or OAuth code/state into any logging sink", () => {
    const offenders = SOURCE_FILES.map(relative)
      .map((file) => ({ file, argumentsList: findRequestDerivedSinkArguments(read(file)) }))
      .filter((entry) => entry.argumentsList.length > 0);
    expect(offenders).toEqual([]);
  });

  it("detects planted violations, so the sink fence is falsifiable", () => {
    // Planting a violation in a string is enough: the detector reads text.
    const planted = [
      'logger.info(request.url);',
      'console.error(url.searchParams.get("code"));',
      'auditLog("callback", { url: request.nextUrl });',
      'log.warn(`callback failed for ${request.url}`);',
    ];
    for (const snippet of planted) {
      expect(findRequestDerivedSinkArguments(snippet), snippet).not.toEqual([]);
    }

    // A benign operational sink call must not be flagged, or the fence would
    // push reviewers toward deleting useful logging instead of sensitive text.
    const benign = [
      'log.info("audit:admin-cache-clear-triggered", { status: "success", cleared });',
      'console.error("Failed to parse bundled JSON asset.");',
    ];
    for (const snippet of benign) {
      expect(findRequestDerivedSinkArguments(snippet), snippet).toEqual([]);
    }

    // Non-vacuousness on the real tree: the detector does see the repository's
    // own reviewed sink call sites.
    expect(findRequestDerivedSinkArguments(read("src/lib/observability/audit.ts"))).toEqual([]);
    expect(callArguments(read("src/lib/observability/audit.ts"), new RegExp(SINK_CALL_PATTERN.source, "g")).length)
      .toBeGreaterThan(0);
  });

  it("never reads or echoes a code or state in a callback route", () => {
    for (const file of CALLBACK_ROUTE_FILES) {
      const source = maskCode(read(file));
      // The exchange receives the whole parameter set; no route reads a code or
      // state by name, so neither value can be echoed, stored, or serialized.
      expect(source, `${file} must not read a code parameter`).not.toMatch(/get\(\s*["']code["']\s*\)/);
      expect(source, `${file} must not read a state parameter`).not.toMatch(/get\(\s*["']state["']\s*\)/);
      // A thrown error is swallowed into a fixed notice, never serialized.
      expect(source, `${file} must not serialize an error`).not.toMatch(/error\.message|String\(error\)/);
      // The temporary transaction cookie is cleared on every path.
      expect(source, `${file} must clear the transaction cookie`).toContain("maxAge: 0");
    }
  });

  it("keeps every callback response private and referrer-free", () => {
    for (const file of CALLBACK_ROUTE_FILES) {
      const source = read(file);
      const privateHeaders = source.split("const PRIVATE")[1]?.split("}")[0] ?? "";
      expect(privateHeaders, `${file} must answer no-store`).toContain("no-store");
      expect(privateHeaders, `${file} must answer Referrer-Policy: no-referrer`).toContain(
        "Referrer-Policy",
      );
      expect(privateHeaders, `${file} must answer no-referrer`).toContain("no-referrer");
    }
  });

  it("maps every callback outcome to a fixed, reviewed notice code", () => {
    // A new outcome code is a review decision: it is the only text a callback
    // failure can put in front of a browser, so it must stay a constant.
    const multiRoute = read("src/app/va-account/oauth/[service]/[operation]/route.ts");
    // Literal strings inside each `notice(...)` call, in call order: an outcome
    // code is written as a literal at every call site, so a new or renamed code
    // changes this multiset and has to be reviewed.
    const codes = callArguments(multiRoute, /\bnotice\s*\(/g)
      .flatMap((argument) => [...argument.matchAll(/"([^"]+)"/g)].map((match) => match[1]))
      .sort();
    expect(codes).toEqual(
      [
        "cleanup-unconfirmed",
        "connected",
        "connection-failed",
        "disconnected",
        "revocation-unconfirmed",
        "unavailable",
        "unavailable",
      ].sort(),
    );

    const adapter = read("src/app/api/auth/callback/route.ts");
    const paths = [...adapter.matchAll(/const (?:SUCCESS|FAILURE)_PATH = "([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(paths.sort()).toEqual(
      ["/va-account?notice=connected", "/va-account?notice=connection-failed"].sort(),
    );
  });
});
