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
 * Two rules, chosen per surface (audit A04): `isTrustedHttpsUrl` requires only a
 * credential-free HTTPS URL, and `isTrustedVaOfficialUrl` additionally requires
 * an official VA host. Form metadata uses the second; directory records — which
 * legitimately point at a VSO's own site — use the first. Host approval is
 * otherwise the calling surface's responsibility, not a rewrite here.
 */
export {
  isTrustedHttpsUrl,
  isTrustedVaOfficialUrl,
  TRUSTED_LINK_REQUIREMENT,
  VA_OFFICIAL_LINK_REQUIREMENT,
  VA_OFFICIAL_LINK_HOSTS,
} from "./public-reference-schemas.mjs";
