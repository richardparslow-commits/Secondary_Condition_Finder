import "server-only";

import { z } from "zod";

import { ACCREDITED_REP_TYPE_VALUES, APPROVED_RADIUS_MILES } from "./accredited-representative-constants";
import { VA_FORMS_MAX_ITEMS } from "./forms-finder-search";
import { vaProvenanceCopy, type VaReferenceSurface } from "./provenance";
import { liveSource, type VaApiEnvironment } from "./sandbox";
import { isTrustedHttpsUrl, isTrustedVaOfficialUrl } from "./trusted-link";

/**
 * Read-side trust guard for cached VA reference views (audit item 12:
 * "invalid cache values cannot set trusted links/source labels").
 *
 * Envelope versioning in `reference-shared-cache.ts` checks the storage format,
 * not authorship or that the value still looks like what this loader produces. A cached hit is served as a **live VA-labelled**
 * view, so the cached value must carry this deployment's provenance (source +
 * environment), bounded labels, and only credential-free HTTPS links. A value
 * that fails the guard is treated as a miss — the caller refetches instead of
 * displaying it. The structural helpers below retain the original crash-path
 * checks. Loaders use the stricter per-loader Zod cache DTOs at the end of this
 * module: exact provenance copy, bounded fields/items/dates, and lookup binding
 * without storing raw search text or a lookup ZIP. Envelope versions/epochs and
 * lookup hashes establish consistency, not cryptographic writer authenticity.
 *
 * **Where the DTO is applied (audit A04).** `withVaReferenceCache` runs the
 * loader's trust policy at every tier, not only on a shared read: a
 * process-local hit, an ordinary shared hit, a contender-published hit, and the
 * loader's own fresh view before either tier is written. An invalid cached
 * candidate is a miss; an invalid fresh view becomes the loader's labelled
 * local fallback instead of being rendered as live VA data. The structural
 * helpers exported below are the coarse layer used by the guard tests and by
 * any future caller without a loader DTO — they cannot know which surface a
 * list belongs to.
 *
 * **Loader-specific link rules.** `isTrustedHttpsUrl` (credential-free HTTPS,
 * any host) is the structural rule: it is what a directory record may need,
 * because a VSO's or attorney's own site is legitimately outside va.gov. The
 * per-loader DTOs add the host rule where the surface's own data is expected to
 * be VA-hosted: a VA Forms item URL and the single-form reference URL must be
 * on `va.gov` (see `isTrustedVaOfficialUrl`), while a representative `website`
 * keeps the structural rule.
 */

const MAX_LABEL_LENGTH = 200;
const MAX_NOTICE_LENGTH = 400;
const MAX_TIMESTAMP_LENGTH = 40;
const MAX_ITEMS = 200;
const MAX_SCANNED_NODES = 5_000;
const LINK_KEYS = new Set(["url", "link", "href", "website"]);

/**
 * Every link-like field anywhere in the view must be a credential-free HTTPS
 * URL. The walk is iterative and node-capped so a hostile nesting cannot turn
 * validation into a CPU sink; exceeding the cap rejects the value.
 */
function hasTrustedLinks(root: unknown): boolean {
  const stack: unknown[] = [root];
  let scanned = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    scanned += 1;
    if (scanned > MAX_SCANNED_NODES) return false;
    if (Array.isArray(current)) {
      if (current.length > MAX_ITEMS) return false;
      for (const entry of current) {
        if (entry && typeof entry === "object") stack.push(entry);
      }
      continue;
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (LINK_KEYS.has(key.toLowerCase())) {
        if (typeof value !== "string" || !isTrustedHttpsUrl(value)) return false;
        continue;
      }
      if (typeof value === "object") stack.push(value);
    }
  }
  return true;
}

function isBoundedText(value: unknown, maxLength: number): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

/**
 * Provenance common to every cached live view: the source must be the live
 * source for this deployment's environment (a sandbox deployment must not
 * serve a value labelled `va-production-api`), with bounded display copy.
 */
function hasTrustedProvenance(
  view: Record<string, unknown>,
  environment: VaApiEnvironment,
): boolean {
  if (view.source !== liveSource(environment)) return false;
  if (!isBoundedText(view.sourceLabel, MAX_LABEL_LENGTH)) return false;
  if (!isBoundedText(view.notice, MAX_NOTICE_LENGTH)) return false;
  return true;
}

/**
 * `VaReferenceSourceStatus`-shaped views: Forms Finder, disability reference,
 * service branches, accredited representatives.
 */
export function isTrustedCachedLiveView(
  candidate: unknown,
  environment: VaApiEnvironment,
): boolean {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const view = candidate as Record<string, unknown>;
  if (!hasTrustedProvenance(view, environment)) return false;
  if (view.live !== true) return false;
  if (view.environment !== environment) return false;
  // A04: a non-array `items` passes every check above and then crashes the
  // UI's list rendering — the exact `items: "NOT_AN_ARRAY"` repro.
  if (!Array.isArray(view.items)) return false;
  if (view.retrievedAt !== null) {
    if (!isBoundedText(view.retrievedAt, MAX_TIMESTAMP_LENGTH)) return false;
    // `isBoundedText` is a plain boolean (not a narrowing predicate), so the
    // string check below is what lets `Date.parse` type-check.
    if (typeof view.retrievedAt !== "string" || Number.isNaN(Date.parse(view.retrievedAt))) {
      return false;
    }
  }
  return hasTrustedLinks(view);
}

/**
 * `ClaimFormReference`-shaped view (single-form metadata; no `live` /
 * `environment` fields).
 */
export function isTrustedCachedClaimFormReference(
  candidate: unknown,
  environment: VaApiEnvironment,
): boolean {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const view = candidate as Record<string, unknown>;
  if (!hasTrustedProvenance(view, environment)) return false;
  if (!isBoundedText(view.formName, MAX_LABEL_LENGTH)) return false;
  if (!isBoundedText(view.title, MAX_LABEL_LENGTH)) return false;
  // Single-form metadata is VA-hosted by definition (A04 link-origin policy).
  if (typeof view.url !== "string" || !isTrustedVaOfficialUrl(view.url)) return false;
  if (
    view.lastRevisionOn !== null &&
    !isBoundedText(view.lastRevisionOn, MAX_TIMESTAMP_LENGTH)
  ) {
    return false;
  }
  return hasTrustedLinks(view);
}

/** App cache DTO limits, not VA API limits. Keep validation work bounded. */
export const VA_CACHE_DTO_MAX_ITEMS = 200;
/** Established import site; the bound itself lives with the finder contract. */
export const VA_FORMS_CACHE_MAX_ITEMS = VA_FORMS_MAX_ITEMS;
const boundedText = (max: number) => z.string().min(1).max(max);
/** Directory records may point at an external site; see the module note above. */
const cachedUrl = boundedText(2_048).refine(isTrustedHttpsUrl);
/** VA Forms payloads are expected to be VA-hosted. */
const vaHostedUrl = boundedText(2_048).refine(isTrustedVaOfficialUrl);
const revisionDate = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }).max(MAX_TIMESTAMP_LENGTH),
]).nullable();

function provenanceDto(surface: VaReferenceSurface, environment: VaApiEnvironment) {
  const copy = vaProvenanceCopy(surface, environment);
  return {
    source: z.literal(liveSource(environment)),
    sourceLabel: z.literal(copy.sourceLabel),
    notice: z.literal(copy.notice),
  };
}

function liveStatusDto(surface: VaReferenceSurface, environment: VaApiEnvironment) {
  return {
    ...provenanceDto(surface, environment),
    live: z.literal(true),
    environment: z.literal(environment),
    retrievedAt: z.iso.datetime({ offset: true }).max(MAX_TIMESTAMP_LENGTH),
    cacheStatus: z.enum(["hit", "miss"]),
  };
}

const formItemDto = z.strictObject({
  formName: boundedText(MAX_LABEL_LENGTH),
  title: boundedText(MAX_LABEL_LENGTH),
  url: vaHostedUrl,
  lastRevisionOn: revisionDate,
  pages: z.number().int().min(0).max(1_000).nullable(),
  validPdf: z.boolean().nullable(),
});

/**
 * Bind redacted lookup DTOs to the exact cache key requested. The key already
 * hashes normalized text/ZIP; never restore those inputs to the stored value.
 * Old/unbound entries deliberately miss until refreshed (five-minute TTL).
 */
export function formsFinderCacheDto(environment: VaApiEnvironment, lookupKey: string) {
  return z.strictObject({
    ...liveStatusDto("forms-finder", environment),
    lookupKey: z.literal(lookupKey),
    query: z.literal(""),
    items: z.array(formItemDto).max(VA_FORMS_CACHE_MAX_ITEMS),
  });
}

export function claimFormReferenceCacheDto(environment: VaApiEnvironment) {
  return z.strictObject({
    ...provenanceDto("form-reference", environment),
    formName: boundedText(MAX_LABEL_LENGTH).refine((name) => name.toUpperCase() === "21-526EZ"),
    title: boundedText(MAX_LABEL_LENGTH),
    url: vaHostedUrl,
    lastRevisionOn: revisionDate,
  });
}

export function serviceBranchCacheDto(environment: VaApiEnvironment) {
  return z.strictObject({
    ...liveStatusDto("service-branches", environment),
    items: z.array(z.strictObject({
      code: boundedText(50),
      description: boundedText(MAX_LABEL_LENGTH),
    })).min(1).max(VA_CACHE_DTO_MAX_ITEMS),
  });
}

export function disabilityReferenceCacheDto(environment: VaApiEnvironment) {
  return z.strictObject({
    ...liveStatusDto("disability-reference", environment),
    items: z.array(z.strictObject({
      id: boundedText(20).regex(/^-?\d+$/),
      name: boundedText(MAX_LABEL_LENGTH),
    })).min(1).max(VA_CACHE_DTO_MAX_ITEMS),
  });
}

const accreditedRepresentativeCacheItemDto = z.strictObject({
  id: boundedText(MAX_LABEL_LENGTH),
  name: boundedText(MAX_LABEL_LENGTH),
  organization: boundedText(MAX_LABEL_LENGTH).nullable().optional(),
  accreditationType: z.enum(ACCREDITED_REP_TYPE_VALUES),
  specializations: z.array(boundedText(MAX_LABEL_LENGTH)).max(20).nullable().optional(),
  phone: boundedText(50).nullable().optional(),
  website: cachedUrl.nullable().optional(),
  address: boundedText(500).nullable().optional(),
  // Must match the upstream item rule, ZIP+4 included. A cache DTO that
  // refused the plus-four would reject an otherwise valid live view on read
  // and degrade it to the empty fallback, hiding the same representatives a
  // second time (Heal s3-one-odd-rep-hides-all-reps-1).
  zip: z.string().regex(/^\d{5}(?:-\d{4})?$/),
  distanceMiles: z.number().min(0).max(10_000).nullable().optional(),
});

export function accreditedRepresentativeCacheDto(
  environment: VaApiEnvironment,
  lookupKey: string,
  params: { radiusMiles?: number; type?: "VSO" | "agent" | "attorney" },
) {
  return z.strictObject({
    ...liveStatusDto("accredited-representatives", environment),
    lookupKey: z.literal(lookupKey),
    params: z.strictObject({
      zip: z.literal(""),
      radiusMiles: z.literal(APPROVED_RADIUS_MILES)
        .refine((radius) => radius === (params.radiusMiles ?? 50)),
      type: params.type === undefined ? z.undefined().optional() : z.literal(params.type),
    }),
    items: z.array(accreditedRepresentativeCacheItemDto).max(VA_CACHE_DTO_MAX_ITEMS),
  });
}
