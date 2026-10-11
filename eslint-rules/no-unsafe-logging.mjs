/**
 * Local ESLint plugin: the PHI-safe logging boundary.
 *
 * Why this exists: the structured logger (`src/lib/observability/logger.ts`)
 * redacts at the emit site, but it is *opt-in*. Calling `console` directly
 * bypasses every redaction rule — the argument is serialized by the runtime with
 * `util.inspect`, so an Error, a response body, a Zod error, or a workflow
 * object reaches the platform log ingest exactly as it sits in memory. On a
 * hosted runtime that is a durable, out-of-process copy of whatever the value
 * held, which is what "PHI never leaks into server logs" has to mean in
 * practice.
 *
 * The rule enforces one absolute invariant, chosen because it is mechanical
 * rather than judgemental:
 *
 *   `console.<method>` receives **exactly one argument**, and that argument is
 *   provably a bounded string — a string/number/boolean literal, a template
 *   literal, a `+` concatenation of those, or an explicit serialization call
 *   (`JSON.stringify(...)`, `String(...)`, `.toString()`, …).
 *
 * A single-argument rule is decidable, cannot be argued around in review, and
 * removes the two shapes that actually leak: `console.error(msg, obj)` (the
 * object is dumped) and `console.error(obj)` (the object is dumped). Note what
 * it deliberately does NOT do: it permits interpolation inside a template
 * literal, because the loaders legitimately log authored-data diagnostics that
 * way, and a rule that banned interpolation would be switched off within a
 * week. Interpolated *request-derived* text is handled elsewhere and by
 * different means — the edge guard refuses private parameters before any loader
 * runs, and the logger's value-shape allowlist governs anything that goes
 * through the sanctioned sink.
 *
 * The sanctioned sinks are configured off in `eslint.config.mjs`, not
 * special-cased here: `logger.ts` emits one pre-serialized JSON line and
 * `engine/metrics.ts` emits a debug-only serialized line.
 *
 * The same invariant is enforced independently (text-level) by
 * `scripts/lib/phi-logging-scan.mjs`, which backs the pre-commit gate; the two
 * are cross-checked against the real source tree by
 * `tests/phi-logging-boundary.test.ts` so neither can drift.
 */

/** `console` methods that serialize their arguments. */
const CONSOLE_METHODS = new Set([
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

/** Property accesses whose result is a string, whatever the receiver holds. */
const SERIALIZING_METHODS = new Set([
  "toString",
  "toISOString",
  "stringify",
  "join",
  "toFixed",
  "trim",
]);

/** Globals whose call result is a bounded primitive rather than an object. */
const SERIALIZING_GLOBALS = new Set(["String", "Number", "Boolean"]);

function isConsoleMember(callee) {
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "console" &&
    callee.property.type === "Identifier" &&
    CONSOLE_METHODS.has(callee.property.name)
  );
}

/**
 * True when the expression provably evaluates to a bounded primitive.
 *
 * Anything not on this list — identifiers, member expressions, object and array
 * literals, spreads, `await`/`yield`, conditionals, new expressions — is treated
 * as an object dump. Erring toward refusal is correct here: the fix is always to
 * serialize explicitly, and a false positive is a one-line change rather than a
 * silent leak.
 */
function isBoundedPrimitive(node) {
  if (!node) return false;
  switch (node.type) {
    case "Literal":
      return (
        typeof node.value === "string" ||
        typeof node.value === "number" ||
        typeof node.value === "boolean" ||
        node.value === null
      );
    case "TemplateLiteral":
      return true;
    case "BinaryExpression":
      // Concatenation stays a primitive; comparisons produce booleans.
      return (
        node.operator === "+" ||
        node.operator === "==" ||
        node.operator === "===" ||
        node.operator === "!=" ||
        node.operator === "!=="
      );
    case "UnaryExpression":
      return node.operator === "typeof" || node.operator === "void" || node.operator === "!";
    case "LogicalExpression":
      return isBoundedPrimitive(node.left) && isBoundedPrimitive(node.right);
    case "CallExpression": {
      if (node.callee.type === "Identifier") {
        return SERIALIZING_GLOBALS.has(node.callee.name);
      }
      if (node.callee.type === "MemberExpression" && !node.callee.computed) {
        return (
          node.callee.property.type === "Identifier" &&
          SERIALIZING_METHODS.has(node.callee.property.name)
        );
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Typed as a `RuleModule` so TypeScript infers `meta.type` as the literal
 * `"problem"` rather than widening it to `string` at the consumer
 * (`eslint.config.mjs`), which is what makes the exported plugin assignable to
 * ESLint's `Plugin` type during `npm run typecheck`.
 *
 * @type {import("eslint").Rule.RuleModule}
 */
const noUnsafeLogging = {
  meta: {
    type: "problem",
    docs: {
      description:
        "require every console.<method> call to take exactly one argument that is provably a bounded string",
    },
    schema: [],
    messages: {
      tooManyArguments:
        "console.{{method}} receives {{count}} arguments; every extra argument is serialized wholesale (an Error, response body or workflow object reaches the log sink). Emit one bounded string instead — prefer the structured logger in @/lib/observability/logger.",
      objectDump:
        "console.{{method}} is passed an expression that is not provably a bounded string, so the runtime serializes whatever it holds into the log sink. Serialize explicitly (e.g. JSON.stringify) or route through the structured logger in @/lib/observability/logger.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isConsoleMember(node.callee)) return;
        const method = node.callee.property.name;

        if (node.arguments.length > 1) {
          context.report({
            node,
            messageId: "tooManyArguments",
            data: { method, count: String(node.arguments.length) },
          });
          return;
        }

        if (node.arguments.length === 0) return;
        if (isBoundedPrimitive(node.arguments[0])) return;

        context.report({ node, messageId: "objectDump", data: { method } });
      },
    };
  },
};

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: "phi-boundary", version: "1.0.0" },
  rules: { "no-unsafe-logging": noUnsafeLogging },
};

export default plugin;

export { isBoundedPrimitive, isConsoleMember, CONSOLE_METHODS };
