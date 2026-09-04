import type { NextConfig } from "next";

const securityHeaders = [
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

const isAzureStaticWebAppsBuild = process.env.AZURE_STATIC_WEB_APPS_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isAzureStaticWebAppsBuild ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  // Do not advertise the exact Next.js version on every response.
  poweredByHeader: false,
  // The knowledge base is read from disk at runtime, so include it in server
  // output tracing for both Vercel-native and legacy Azure standalone builds.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json"],
  },
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
