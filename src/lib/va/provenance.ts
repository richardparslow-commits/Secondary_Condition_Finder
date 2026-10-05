import "server-only";

import type { VaReferenceSourceStatus } from "./reference-cache";
import type { VaApiEnvironment, VaApiResult, VaApiSource } from "./sandbox";

/**
 * The single owner of VA reference provenance copy.
 *
 * Every public-reference loader must tell the user two things alongside the
 * data: how trustworthy it is, and what it is *not*. Each loader used to build
 * that pair itself — 20 label/notice strings across five modules, selected by a
 * hand-written ternary per module. The copies were therefore edited in five
 * places, and the modules had already drifted on the thing the copy depends on:
 * how the environment is resolved.
 *
 * Resolution had three implementations:
 *   - `service-branches`, `disability-reference`, `accredited-representatives`:
 *     `result.environment ?? (source === production ? production : configured)`
 *   - `form-reference`: the raw `source === "va-production-api"` check
 *   - `forms-finder`: the *configured* environment only, ignoring what the
 *     result reported
 *
 * Those three rules were extensionally *equivalent* — but only because the
 * adapter derives both `environment` and `source` from one
 * `resolveEnvironment(config)` call, so all three expressions happen to agree
 * for every result it can return today. That is agreement by coincidence, not
 * by construction: a result whose reported environment differed from the one
 * requested (a production request downgraded to sandbox, a retry routed
 * elsewhere) would have made three modules disagree with each other, and
 * `forms-finder`/`form-reference` disagree with all of them, with nothing to
 * catch it.
 *
 * `resolveVaResultEnvironment` is now the one implementation. It prefers the
 * environment the result itself reports, falls back to the source it came from,
 * and only then to configuration — never inventing production. Preferring the
 * result also makes the agreement structural rather than incidental, and
 * honours an *under-claiming* result, which is the fail-safe direction.
 *
 * Wording rules for this table:
 *   - `production*` copy may state the value came from VA. `sandbox*` copy must
 *     say the data is test data and may not be current.
 *   - Every live notice must end in a check-it-yourself instruction; the app is
 *     a research aid, never an authority.
 *   - `fallback*` copy must make clear the fallback is local and not VA data.
 */

export type VaReferenceSurface =
  | "service-branches"
  | "forms-finder"
  | "form-reference"
  | "disability-reference"
  | "accredited-representatives";

interface VaSurfaceCopy {
  productionLabel: string;
  sandboxLabel: string;
  productionNotice: string;
  sandboxNotice: string;
  fallbackLabel: string;
  fallbackNotice: string;
}

const SURFACE_COPY: Record<VaReferenceSurface, VaSurfaceCopy> = {
  "service-branches": {
    productionLabel: "VA service-branch production reference",
    sandboxLabel: "VA service-branch sandbox reference",
    productionNotice:
      "These standardized branch names came from VA Benefits Reference Data and are used only as administrative reference context.",
    sandboxNotice:
      "These standardized branch names came from VA sandbox reference data and may not be current. They are used only as administrative reference context.",
    fallbackLabel: "Local branch fallback",
    fallbackNotice:
      "VA service-branch reference data is unavailable or disabled.",
  },
  "forms-finder": {
    productionLabel: "VA Forms production",
    sandboxLabel: "VA Forms sandbox",
    productionNotice:
      "Results came from the VA Forms production API. Confirm the form on VA.gov before filing because forms and revisions can change.",
    sandboxNotice:
      "Results came from the VA Forms sandbox. Sandbox data is for testing and may not be current; confirm forms on VA.gov before filing.",
    fallbackLabel: "Local reference fallback",
    fallbackNotice:
      "VA Forms search is unavailable or disabled. Only matching local references can be shown; confirm current forms on VA.gov.",
  },
  "form-reference": {
    productionLabel: "VA production reference",
    sandboxLabel: "VA sandbox reference",
    productionNotice:
      "This metadata came from the VA Forms production API. Confirm the form on VA.gov before filing because forms and revisions can change.",
    sandboxNotice:
      "This metadata came from the VA sandbox environment. Sandbox data is for testing and may not be current; confirm the form on VA.gov before filing.",
    fallbackLabel: "Local reference",
    fallbackNotice:
      "VA Forms API data is unavailable or disabled. Confirm the current form and revision on VA.gov before filing.",
  },
  "disability-reference": {
    productionLabel: "VA production reference",
    sandboxLabel: "VA sandbox reference",
    productionNotice:
      "These public reference values came from VA Benefits Reference Data. A matching name is not a diagnosis, eligibility decision, rating, or proof of service connection.",
    sandboxNotice:
      "These public reference values came from the VA Benefits Reference Data sandbox. Sandbox data is test data and may not be current. A matching name is not a diagnosis, eligibility decision, rating, or proof of service connection.",
    fallbackLabel: "Local catalog fallback",
    fallbackNotice:
      "VA reference data is unavailable or disabled. These names come from this app's local condition catalog, not from VA Benefits Reference Data. Do not treat this fallback as an official VA list.",
  },
  "accredited-representatives": {
    productionLabel: "VA accredited-representative production directory",
    sandboxLabel: "VA accredited-representative sandbox directory",
    productionNotice:
      "Results came from VA's accredited-representative directory. Verify accreditation on va.gov/ogc/apps/accreditation before sharing personal information.",
    sandboxNotice:
      "Results came from the VA accredited-representative sandbox. Sandbox data is test data and may not be current; verify on va.gov/ogc/apps/accreditation.",
    fallbackLabel: "Local directory fallback",
    fallbackNotice:
      "Accredited-representative directory is unavailable or disabled. Search VA's OGC directory on va.gov/ogc/apps/accreditation.",
  },
};

/** The surfaces this module owns copy for. Exported for coverage tests. */
export const VA_REFERENCE_SURFACES = Object.keys(
  SURFACE_COPY,
) as VaReferenceSurface[];

/**
 * The environment a result should be attributed to.
 *
 * Prefers what the result reports, then the source it actually came from, then
 * the configured environment. Never guesses production.
 */
export function resolveVaResultEnvironment(
  result: Pick<VaApiResult<unknown>, "environment" | "source">,
  configuredEnvironment: VaApiEnvironment,
): VaApiEnvironment {
  if (result.environment) return result.environment;
  return result.source === "va-production-api" ? "production" : configuredEnvironment;
}

/** Live-source label + notice for a surface and environment. */
export function vaProvenanceCopy(
  surface: VaReferenceSurface,
  environment: VaApiEnvironment,
): { sourceLabel: string; notice: string } {
  const copy = SURFACE_COPY[surface];
  return environment === "production"
    ? { sourceLabel: copy.productionLabel, notice: copy.productionNotice }
    : { sourceLabel: copy.sandboxLabel, notice: copy.sandboxNotice };
}

/** Degraded-fallback label + notice for a surface. */
export function vaFallbackCopy(surface: VaReferenceSurface): {
  sourceLabel: string;
  notice: string;
} {
  const copy = SURFACE_COPY[surface];
  return { sourceLabel: copy.fallbackLabel, notice: copy.fallbackNotice };
}

/**
 * Full provenance block for a live upstream view.
 *
 * For the four views that extend `VaReferenceSourceStatus`. Callers spread this
 * and add their own payload fields.
 */
export function vaLiveStatus(
  surface: VaReferenceSurface,
  environment: VaApiEnvironment,
  source: VaApiSource,
): VaReferenceSourceStatus {
  return {
    source,
    ...vaProvenanceCopy(surface, environment),
    live: true,
    environment,
    retrievedAt: new Date().toISOString(),
    cacheStatus: "miss",
  };
}

/**
 * Full provenance block for a degraded local fallback.
 *
 * `live: false` and a `null` environment are what distinguish a fallback from
 * VA data; the notice carries the user-facing explanation. Callers spread this
 * and add their own locally-derived payload fields.
 */
export function vaFallbackStatus(
  surface: VaReferenceSurface,
): VaReferenceSourceStatus {
  return {
    source: "local-fallback",
    ...vaFallbackCopy(surface),
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
  };
}
