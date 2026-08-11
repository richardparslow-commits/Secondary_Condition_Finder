import "server-only";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { fetchVaDisabilityReference, type VaSandboxResult } from "./sandbox";

export interface DisabilityReferenceItem {
  id: string;
  name: string;
}

export interface DisabilityReferenceView {
  items: DisabilityReferenceItem[];
  source: "va-sandbox-api" | "local-fallback";
  sourceLabel: string;
  notice: string;
}

type DisabilityFetcher = () => Promise<
  VaSandboxResult<{
    items: Array<{
      id: number;
      name: string;
      endDateTime?: string | null;
    }>;
  }>
>;

function localFallback(): DisabilityReferenceView {
  const items = loadConditionCatalog()
    .map((condition) => ({ id: condition.id, name: condition.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    items,
    source: "local-fallback",
    sourceLabel: "Local catalog fallback",
    notice:
      "VA sandbox reference data is unavailable or disabled. These names come from this app's local condition catalog, not from VA Benefits Reference Data. Do not treat this fallback as an official VA list.",
  };
}

export async function loadDisabilityReference(
  fetcher: DisabilityFetcher = fetchVaDisabilityReference,
): Promise<DisabilityReferenceView> {
  const result = await fetcher();
  if (!result.success || !result.data) return localFallback();

  const currentItems = result.data.items
    .filter((item) => !item.endDateTime)
    .map((item) => ({ id: String(item.id), name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (currentItems.length === 0) return localFallback();

  return {
    items: currentItems,
    source: "va-sandbox-api",
    sourceLabel: "VA sandbox reference",
    notice:
      "These public reference values came from the VA Benefits Reference Data sandbox. Sandbox data is test data and may not be current. A matching name is not a diagnosis, eligibility decision, rating, or proof of service connection.",
  };
}
