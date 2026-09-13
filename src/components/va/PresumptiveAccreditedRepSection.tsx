import { AccreditedRepresentativeFinder } from "./AccreditedRepresentativeFinder";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function PresumptiveAccreditedRepSection({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const zipParam = firstParam(searchParams?.zip)?.trim() ?? "";

  const initialView =
    /^\d{5}$/.test(zipParam)
      ? await loadAccreditedRepresentatives({
          zip: zipParam,
          radiusMiles: (() => {
            const raw = firstParam(searchParams?.radius);
            const n = raw ? Number(raw) : 50;
            return Number.isFinite(n) ? n : 50;
          })(),
          type: firstParam(searchParams?.type) as "VSO" | "agent" | "attorney" | undefined,
        })
      : null;

  return (
    <AccreditedRepresentativeFinder
      initialView={initialView}
      returnTo="/presumptive/results"
    />
  );
}
