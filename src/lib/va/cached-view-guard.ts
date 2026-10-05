import "server-only";

import { liveSource, type VaApiEnvironment } from "./sandbox";
import { isTrustedHttpsUrl } from "./trusted-link";

/**
 * Read-side trust guard for cached VA reference views (audit item 12:
 * "invalid cache values cannot set trusted links/source labels").
 *
 * Envelope versioning in `reference-shared-cache.ts` proves the bytes came
 * from an application write, but not that the value still looks like what this
 * loader would have produced. A shared hit is served as a **live VA-labelled**
 * view, so the cached value must carry this deployment's provenance (source +
 * environment), bounded labels, and only credential-free HTTPS links. A value
 * that fails the guard is treated as a miss — the caller refetches instead of
 * displaying it. Process-local entries are written only through this same path
 * (validated shared hit or the loader's own freshly built view), so the
 * process-local tier does not need a second guard.
 *
 * Deliberately structural, not schema-per-loader: it constrains the fields
 * that decide labels, links, and trust (`source`, `sourceLabel`, `notice`,
 * `live`, `environment`, `retrievedAt`, link-like keys anywhere in the value)
 * while leaving the loader's own reference data fields to the loader.
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
  if (view.retrievedAt !== null && !isBoundedText(view.retrievedAt, MAX_TIMESTAMP_LENGTH)) {
    return false;
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
  if (typeof view.url !== "string" || !isTrustedHttpsUrl(view.url)) return false;
  if (
    view.lastRevisionOn !== null &&
    !isBoundedText(view.lastRevisionOn, MAX_TIMESTAMP_LENGTH)
  ) {
    return false;
  }
  return hasTrustedLinks(view);
}
