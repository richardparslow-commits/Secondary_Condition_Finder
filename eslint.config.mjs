import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import phiBoundary from "./eslint-rules/no-unsafe-logging.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // PHI boundary: a direct `console.*` call bypasses every redaction rule in
    // src/lib/observability/logger.ts, so the runtime serializes the argument
    // (an Error, a response body, a Zod error, a workflow object) straight into
    // the platform log sink. The rule requires exactly one argument and requires
    // it to be provably a bounded string. See eslint-rules/no-unsafe-logging.mjs
    // for why it deliberately permits interpolated template literals.
    //
    // Scoped to `src/` because that is the shipped application surface — the only
    // code that runs inside the process serving a veteran's request, and therefore
    // the only place a `console` argument can become a platform log line.
    // `scripts/` (build, audit, and CI tooling), `tests/`, and `eslint-rules/`
    // execute on a workstation or a CI runner against repository data and never in
    // the request path; the gate that governs them is review, not this rule.
    // Widening this scope would mean rewriting unrelated tooling to satisfy a
    // boundary it does not participate in.
    files: ["src/**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: { "phi-boundary": phiBoundary },
    rules: { "phi-boundary/no-unsafe-logging": "error" },
  },
  {
    // Sanctioned sinks. Each emits one pre-serialized JSON line whose fields
    // have already passed the logger's PROHIBITED_LOG_FIELDS blocklist and
    // value-shape allowlist, so the single-argument invariant is satisfied by
    // construction (`line` is the serialized string, not a live object).
    files: [
      "src/lib/observability/logger.ts",
      "src/lib/engine/metrics.ts",
    ],
    rules: { "phi-boundary/no-unsafe-logging": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested self-contained clone (see .gitignore); it has its own eslint
    // surface and is not part of this checkout.
    "Secondary_Condition_Finder/**",
    // Generated verbatim from the pinned pdfjs-dist package during postinstall.
    "public/pdf.worker.min.mjs",
    // Generated verbatim from the pinned tesseract.js packages during postinstall.
    "public/tesseract/**",
  ]),
]);

export default eslintConfig;
