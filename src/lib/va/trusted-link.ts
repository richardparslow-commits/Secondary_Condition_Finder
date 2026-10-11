import "server-only";

/**
 * Trusted-link policy for VA-provided URLs (audit A-03 "approved HTTPS links").
 *
 * VA Forms and directory payloads feed `<a href>` directly, and Zod's `url()`
 * accepts `javascript:`, `data:`, `http:`, and credential-bearing URLs — all of
 * which must never become a rendered link. Shared by the upstream payload
 * schemas (`sandbox.ts`) and the cached-view guard so a value written to the
 * cache and a value read back are held to the same rule.
 *
 * Only the scheme is constrained: legitimate directory data can point outside
 * va.gov (for example a VSO's own website), so host approval is the VA
 * payload's responsibility, not a rewrite here.
 */
export { isTrustedHttpsUrl, TRUSTED_LINK_REQUIREMENT } from "./public-reference-schemas.mjs";
