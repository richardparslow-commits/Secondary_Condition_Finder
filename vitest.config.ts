import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws outside a React Server Component graph. Tests
      // exercise the same modules directly, so it is stubbed here.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // Shared accessibility helpers (the axe critical/serious gate). This file
    // runs for every test file, so it must stay inert without a DOM: axe-core is
    // imported lazily inside the helper rather than at module scope. Tests that
    // need a DOM opt in per file with the `// @vitest-environment jsdom`
    // docblock, which keeps the default node environment for the 300+ data and
    // contract suites that neither need nor want jsdom.
    setupFiles: ["./tests/setup/accessibility.ts"],
    // `.tsx` is listed because the accessibility suite mounts components with
    // JSX; every other suite stays `.ts`.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    // Data-integrity suites that read large JSON catalogs from disk sit
    // below 10s after consolidation (data-preload ~8s, citation-verify ~6s).
    // Lowered from 20s to catch regressions earlier; individual slow tests
    // are documented in tests/data-preload.test.ts.
    testTimeout: 10_000,
  },
});
