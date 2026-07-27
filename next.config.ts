import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The knowledge base is read from disk at runtime, so it must be traced into
  // the standalone output rather than bundled.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
