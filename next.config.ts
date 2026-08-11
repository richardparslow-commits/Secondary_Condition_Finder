import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The knowledge base is read from disk at runtime, so it must be traced into
  // the standalone output rather than bundled.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
