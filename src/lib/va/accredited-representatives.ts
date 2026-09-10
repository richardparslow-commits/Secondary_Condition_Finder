import "server-only";

import { z } from "zod";

import {
  clearVaReferenceCache,
  readVaReferenceCache,
  type VaReferenceSourceStatus,
  writeVaReferenceCache,
} from "./reference-cache";
import {
  fetchVaAccreditedRepresentatives,
  loadVaApiConfig,
  type VaApiResult,
} from "./sandbox";
import {
  ACCREDITED_REP_TYPE_VALUES,
  APPROVED_RADIUS_MILES,
  ZIP_RE,
  type AccreditedRepType,
} from "./accredited-representative-constants";

export const accreditedRepSearchParamsSchema = z.object({
  zip: z.string().regex(ZIP_RE, "Zip must be 5 digits."),
  radiusMiles: z
    .number()
    .int()
    .refine((v) => (APPROVED_RADIUS_MILES as readonly number[]).includes(v), {
      message: `Radius must be one of ${APPROVED_RADIUS_MILES.join(", ")}.`,
    })
    .optional(),
  type: z.enum(ACCREDITED_REP_TYPE_VALUES).optional(),
});

export type AccreditedRepSearchParams = z.infer<typeof accreditedRepSearchParamsSchema>;

export interface AccreditedRepresentative {
  id: string;
  name: string;
  organization: string | null;
  accreditationType: AccreditedRepType | string;
  phone: string | null;
  website: string | null;
  address: string | null;
  zip: string | null;
  city: string | null;
  state: string | null;
  distanceMiles: number | null;
}

export interface AccreditedRepresentativeView extends VaReferenceSourceStatus {
  params: AccreditedRepSearchParams;
  items: AccreditedRepresentative[];
}

// ---------------------------------------------------------------------------
// Local fallback
// ---------------------------------------------------------------------------

function localFallback(params: AccreditedRepSearchParams): AccreditedRepresentativeView {
  return {
    params,
    items: [],
    source: "local-fallback",
    sourceLabel: "Local reference fallback",
    notice:
      "Accredited representative directory is unavailable or disabled. No local directory is bundled; search VA's OGC directory on va.gov. Your workflow selections and evidence are not sent with this lookup.",
    live: false,
    environment: null,
    retrievedAt: null,
    cacheStatus: "miss",
  };
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheKey(params: AccreditedRepSearchParams, env: string): string {
  return `accredited-rep:${env}:${params.zip}:${params.radiusMiles ?? ""}:${params.type ?? ""}`;
}

// ---------------------------------------------------------------------------
// Loader — mirrors disability-reference / forms-finder pattern
// ---------------------------------------------------------------------------

type AccreditedRepFetcher = (
  params: AccreditedRepSearchParams,
) => Promise<
  VaApiResult<{
    data: Array<{
      id: string;
      type?: string;
      attributes: {
        name: string;
        organization?: string | null;
        accreditation_type: string;
        phone?: string | null;
        website?: string | null;
        address?: string | null;
        zip?: string | null;
        city?: string | null;
        state?: string | null;
        distance?: number | null;
      };
    }>;
  }>
>;

function defaultFetcher(
  params: AccreditedRepSearchParams,
): Promise<
  VaApiResult<{
    data: Array<{
      id: string;
      type?: string;
      attributes: {
        name: string;
        organization?: string | null;
        accreditation_type: string;
        phone?: string | null;
        website?: string | null;
        address?: string | null;
        zip?: string | null;
        city?: string | null;
        state?: string | null;
        distance?: number | null;
      };
    }>;
  }>
> {
  return fetchVaAccreditedRepresentatives(params);
}

export async function loadAccreditedRepresentatives(
  params: AccreditedRepSearchParams,
  fetcher: AccreditedRepFetcher = defaultFetcher,
): Promise<AccreditedRepresentativeView> {
  const parsed = accreditedRepSearchParamsSchema.safeParse(params);
  if (!parsed.success) {
    return localFallback(params);
  }
  const normalized = parsed.data;
  const config = loadVaApiConfig();
  const environment = config.environment ?? "sandbox";
  const useSharedCache = fetcher === defaultFetcher;
  const key = cacheKey(normalized, environment);

  if (useSharedCache) {
    const cached = readVaReferenceCache<AccreditedRepresentativeView>(key);
    if (cached) return { ...cached, cacheStatus: "hit" };
  }

  const result = await fetcher(normalized);

  if (!result.success || !result.data) {
    return localFallback(normalized);
  }

  const items: AccreditedRepresentative[] = result.data.data.map((entry) => ({
    id: entry.id,
    name: entry.attributes.name,
    organization: entry.attributes.organization ?? null,
    accreditationType: entry.attributes.accreditation_type,
    phone: entry.attributes.phone ?? null,
    website: entry.attributes.website ?? null,
    address: entry.attributes.address ?? null,
    zip: entry.attributes.zip ?? null,
    city: entry.attributes.city ?? null,
    state: entry.attributes.state ?? null,
    distanceMiles: entry.attributes.distance ?? null,
  }));

  const resolvedEnv =
    result.environment ?? (result.source === "va-production-api" ? "production" : environment);

  const view: AccreditedRepresentativeView = {
    params: normalized,
    items: [...items].sort((a, b) => {
      if (a.distanceMiles !== null && b.distanceMiles !== null) return a.distanceMiles - b.distanceMiles;
      if (a.distanceMiles !== null) return -1;
      if (b.distanceMiles !== null) return 1;
      return a.name.localeCompare(b.name);
    }),
    source: result.source,
    sourceLabel:
      resolvedEnv === "production"
        ? "VA accredited-representative production"
        : "VA accredited-representative sandbox",
    notice:
      resolvedEnv === "production"
        ? "Results came from the VA accredited-representative directory. Confirm accreditation and contact details on va.gov before relying on this listing."
        : "Results came from the VA accredited-representative sandbox. Sandbox data is for testing and may not be current; confirm on va.gov before relying on this listing.",
    live: true,
    environment: resolvedEnv,
    retrievedAt: new Date().toISOString(),
    cacheStatus: "miss",
  };

  if (useSharedCache) writeVaReferenceCache(key, view);
  return view;
}

export function clearAccreditedRepresentativesCache(): void {
  clearVaReferenceCache("accredited-rep:");
}
