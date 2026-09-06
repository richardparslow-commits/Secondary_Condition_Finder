import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated verbatim from the pinned pdfjs-dist package during postinstall.
    "public/pdf.worker.min.mjs",
    // Generated verbatim from the pinned tesseract.js packages during postinstall.
    "public/tesseract/**",
  ]),
]);

export default eslintConfig;
