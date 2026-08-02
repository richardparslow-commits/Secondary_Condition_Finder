import type { Recommendation } from "@/lib/engine/types";

export const PREVALENCE_LABEL: Record<Recommendation["prevalence"], string> = {
  "commonly-explored": "Commonly explored",
  "sometimes-explored": "Sometimes explored",
  "occasionally-explored": "Occasionally explored",
};

export const PREVALENCE_EXPLANATION: Record<Recommendation["prevalence"], string> = {
  "commonly-explored":
    "Commonly explored means this secondary relationship appears frequently in authored mappings.",
  "sometimes-explored":
    "Sometimes explored means this secondary relationship appears in a moderate number of authored mappings.",
  "occasionally-explored":
    "Occasionally explored means this secondary relationship appears less often in authored mappings.",
};
