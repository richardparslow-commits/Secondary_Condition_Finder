import { AccreditedRepresentativeFinder } from "./AccreditedRepresentativeFinder";
import { loadAccreditedRepresentatives } from "@/lib/va/accredited-representatives";
import { accreditedRepValidationMessage, APPROVED_RADIUS_MILES, ZIP_RE } from "@/lib/va/accredited-representative-constants";

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function PresumptiveAccreditedRepSection({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const zipParam = firstParam(searchParams?.zip)?.trim() ?? "";
  const radiusParam = firstParam(searchParams?.radius)?.trim() ?? "";
  const typeParam = firstParam(searchParams?.type)?.trim() ?? "";
  const validationMessage = accreditedRepValidationMessage(firstParam(searchParams?.error));

  let initialView: Awaited<ReturnType<typeof loadAccreditedRepresentatives>> | null = null;
  if (ZIP_RE.test(zipParam)) {
    const radiusMiles = radiusParam ? Number(radiusParam) : undefined;
    const radiusValid =
      radiusMiles === undefined ||
      (Number.isInteger(radiusMiles) && (APPROVED_RADIUS_MILES as readonly number[]).includes(radiusMiles));
    const typeValid =
      !typeParam || (["VSO", "agent", "attorney"] as const).includes(typeParam as "VSO" | "agent" | "attorney");
    if (radiusValid && typeValid) {
      initialView = await loadAccreditedRepresentatives({
        zip: zipParam,
        ...(radiusMiles !== undefined ? { radiusMiles: radiusMiles as (typeof APPROVED_RADIUS_MILES)[number] } : {}),
        ...(typeParam ? { type: typeParam as "VSO" | "agent" | "attorney" } : {}),
      });
    }
  }

  return (
    <AccreditedRepresentativeFinder
      initialView={initialView}
      returnTo="/presumptive/results"
      existingQuery=""
      initialZip={zipParam}
      initialRadius={radiusParam}
      initialType={typeParam}
      validationMessage={validationMessage}
    />
  );
}
