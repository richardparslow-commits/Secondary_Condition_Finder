import { describe, expect, it } from "vitest";

import { parseDd214Text, assertNoFullSsn } from "@/lib/evidence/dd214-extract";
import { EVIDENCE_DEPTH_LIMITS } from "@/lib/evidence/limits";
import { dd214ToServiceHistoryFields } from "@/lib/presumptive/dd214-adapter";
import { matchPresumptives } from "@/lib/presumptive/match";
import { loadExposureCatalog } from "@/lib/presumptive/load";

/**
 * Phase 4 item D closure: the DD-214 → presumptive hand-off is one click in
 * the UI (upload → verify → "Confirm and continue"). Since 2026-10-08 that
 * confirmation persists the browser-local service-history record directly
 * (`src/lib/presumptive/browser-history.ts`); the retired Server Action that
 * used to receive it is gone. These contracts pin the headless half of the
 * hand-off: a realistic DD-214 text body parses into fields, adapts into a
 * valid ServiceHistory draft, and matches the expected presumptive category —
 * the exact chain the browser component drives.
 */

const DD214_TEXT = [
  "DEPARTMENT OF DEFENSE",
  "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
  "1. NAME: DOE, JOHN R",
  "2. DEPARTMENT, COMPONENT AND BRANCH: US ARMY",
  "3. SOCIAL SECURITY NUMBER: 123-45-6789",
  "12a. DATE ENTERED ACTIVE DUTY: 09/12/1968",
  "12b. SEPARATION DATE: 05/24/1971",
  "13. STATION / LOCATION: Republic of Vietnam",
  "REMARKS: Served with 1st Cav, Long Binh and Bien Hoa 1969-1970.",
].join("\n");

const limits = EVIDENCE_DEPTH_LIMITS.standard;

describe("DD-214 → presumptive hand-off (Phase 4 item D)", () => {
  it("extracts the expected fields from realistic DD-214 text", () => {
    const ex = parseDd214Text(DD214_TEXT, limits);
    expect(ex.fields.serviceStart).toBe("1968-09-12");
    expect(ex.fields.serviceEnd).toBe("1971-05-24");
    expect(ex.fields.locations).toContain("Republic of Vietnam");
    expect(ex.fields.serviceBranchCodes).toEqual(["ARMY"]);
    expect(ex.fields.maskedSsn).toBe("XXX-XX-6789");
    expect(() => assertNoFullSsn(ex)).not.toThrow();
    expect(ex.rawText).not.toContain("123-45-6789");
  });

  it("adapts into a valid ServiceHistory draft with no validation code", () => {
    const ex = parseDd214Text(DD214_TEXT, limits);
    const adapted = dd214ToServiceHistoryFields(ex);
    expect(adapted.validationCode).toBeNull();
    expect(adapted.history?.locations).toContain("Republic of Vietnam");
    expect(adapted.history?.serviceStart).toBe("1968-09-12");
    expect(adapted.history?.serviceEnd).toBe("1971-05-24");
  });

  it("a locations override survives the adapter (the edit form's path)", () => {
    const ex = parseDd214Text(DD214_TEXT, limits);
    const adapted = dd214ToServiceHistoryFields(ex, {
      locationsOverride: ["Korean Demilitarized Zone"],
    });
    expect(adapted.validationCode).toBeNull();
    expect(adapted.history?.locations).toEqual(["Korean Demilitarized Zone"]);
  });

  it("validates edited dates instead of the extraction's original dates", () => {
    const ex = parseDd214Text(DD214_TEXT, limits);
    const adapted = dd214ToServiceHistoryFields(ex, {
      serviceStart: "1971-05-24",
      serviceEnd: "1968-09-12",
    });
    expect(adapted.validationCode).toBe("date-order");
    expect(adapted.history).toBeNull();
  });

  it("the adapted history matches the Agent Orange presumptive category", () => {
    const ex = parseDd214Text(DD214_TEXT, limits);
    const { history } = dd214ToServiceHistoryFields(ex);
    if (!history) throw new Error("Adapter returned no history for a valid fixture");
    const result = matchPresumptives(loadExposureCatalog(), history);
    expect(result.matches.some(({ category }) => category.id === "agent-orange")).toBe(true);
    expect(result.hasUnconfirmedDates).toBe(false);
  });
});
