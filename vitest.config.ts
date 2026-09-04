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
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Render-heavy page tests and data-integrity suites sit close to the 5s
    // default when the suite runs in parallel; observed flakes were timeout
    // artifacts, not failures. A higher ceiling only affects slow tests.
    testTimeout: 20_000,
  },
});
