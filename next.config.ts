import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The knowledge base is read from disk at runtime, so it must be traced into
  // the standalone output rather than bundled.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
  serverExternalPackages: ["better-sqlite3"],
  // Pin the workspace root to this project so Turbopack ignores the nested
  // Secondary_Condition_Finder clone and any lockfile above the repo when it
  // infers the root directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
