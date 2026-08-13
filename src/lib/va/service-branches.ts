import "server-only";

import { z } from "zod";

import { loadVaSandboxConfig } from "./sandbox";

export interface ServiceBranchReferenceItem {
  code: string;
  description: string;
}

export interface ServiceBranchReferenceView {
  items: ServiceBranchReferenceItem[];
  sourceLabel: string;
  notice: string;
  live: boolean;
}

const responseSchema = z.object({
  items: z.array(
    z.object({
      code: z.string().min(1),
      description: z.string().min(1),
    }).passthrough(),
  ),
}).passthrough();

const LOCAL_BRANCHES: ServiceBranchReferenceItem[] = [
  { code: "ARMY", description: "Army" },
  { code: "NAVY", description: "Navy" },
  { code: "AIR_FORCE", description: "Air Force" },
  { code: "MARINE_CORPS", description: "Marine Corps" },
  { code: "COAST_GUARD", description: "Coast Guard" },
  { code: "SPACE_FORCE", description: "Space Force" },
];

export async function loadServiceBranchReference(): Promise<ServiceBranchReferenceView> {
  const config = loadVaSandboxConfig();
  if (!config.enabled || !config.benefitsReferenceDataApiKey) {
    return {
      items: LOCAL_BRANCHES,
      sourceLabel: "Local branch fallback",
      notice: "VA service-branch reference data is unavailable or disabled.",
      live: false,
    };
  }

  try {
    const endpoint = new URL(
      "service-branches",
      `${config.benefitsReferenceDataBaseUrl.replace(/\/$/, "")}/`,
    );
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        apikey: config.benefitsReferenceDataApiKey,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) throw new Error("reference request failed");
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.items.length === 0) throw new Error("invalid reference response");

    return {
      items: parsed.data.items.sort((a, b) => a.description.localeCompare(b.description)),
      sourceLabel: "VA service-branch sandbox reference",
      notice: "These standardized branch names came from VA sandbox reference data and may not be current.",
      live: true,
    };
  } catch {
    return {
      items: LOCAL_BRANCHES,
      sourceLabel: "Local branch fallback",
      notice: "VA service-branch reference data is temporarily unavailable.",
      live: false,
    };
  }
}
