import { describe, expect, it } from "vitest";

import { parseDd214Text } from "@/lib/evidence/dd214-extract";
import { EVIDENCE_DEPTH_LIMITS, STANDARD_LIMITS, type EvidenceLimits } from "@/lib/evidence/limits";

/**
 * Audit A06 parser residue, all three parts:
 *
 * 1. the parser ignored the caller's `textChars` and sliced at a private
 *    200,000-character constant — silently below the analyzer's own 500,000
 *    character Standard budget, and with no disclosure that a tail existed;
 * 2. date validation accepted any day ≤ 31, so `02/31/2020` was emitted as an
 *    ISO-shaped date;
 * 3. SSN minimization covered only hyphen, space, and bare-digit layouts, so
 *    `123.45.6789`, `123–45–6789`, and `123_45_6789` survived into the raw
 *    preview and no masked value was produced.
 *
 * These are behavioural assertions against the real parser, not a source
 * contract: each one fails if the bound, the calendar check, or the redaction
 * regresses.
 */

const limits = STANDARD_LIMITS;
const withBudget = (textChars: number): EvidenceLimits => ({ ...STANDARD_LIMITS, textChars });

const DD214_TEMPLATE = [
  "DEPARTMENT OF DEFENSE",
  "CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY",
  "2. DEPARTMENT, COMPONENT AND BRANCH: US ARMY",
  "3. SOCIAL SECURITY NUMBER: 123-45-6789",
  "12a. DATE ENTERED ACTIVE DUTY: 09/12/1968",
  "12b. SEPARATION DATE: 05/24/1971",
  "13. STATION / LOCATION: Republic of Vietnam",
].join("\n");

describe("parseDd214Text honors the caller's character budget", () => {
  it("analyzes the tail the caller's budget covers instead of stopping at a private constant", () => {
    // The date sits past the retired 200,000-character slice. Standard depth
    // covers 500,000 characters, so it must be found now.
    const text = `${"x".repeat(250_000)}\n12a. DATE ENTERED ACTIVE DUTY: 09/12/1968`;
    expect(limits.textChars).toBe(500_000);

    const found = parseDd214Text(text, limits);
    expect(found.fields.serviceStart).toBe("1968-09-12");
    expect(found.fields.warnings.join(" ")).not.toMatch(/characters were analyzed/);
  });

  it("stops exactly at the caller's budget and says so", () => {
    const text = `${"x".repeat(250_000)}\n12a. DATE ENTERED ACTIVE DUTY: 09/12/1968`;
    const bounded = parseDd214Text(text, withBudget(100_000));
    expect(bounded.fields.serviceStart).toBeNull();
    expect(bounded.rawText.length).toBe(100_000);
    expect(bounded.fields.warnings.join(" ")).toMatch(/first 100,000 characters were analyzed/);
  });

  it("applies a tiny budget literally — the probe that exposed the ignored argument", () => {
    const tiny = parseDd214Text("SOCIAL SECURITY NUMBER 123-45-6789", withBudget(10));
    expect(tiny.rawText).toBe("SOCIAL SEC");
    expect(tiny.fields.maskedSsn).toBeUndefined();
    expect(tiny.fields.warnings.join(" ")).toMatch(/first 10 characters were analyzed/);

    // Same input, full budget: the SSN is masked as before.
    expect(parseDd214Text("SOCIAL SECURITY NUMBER 123-45-6789", limits).fields.maskedSsn).toBe(
      "XXX-XX-6789",
    );
  });

  it("treats a nonsensical budget as no text rather than as unlimited", () => {
    for (const textChars of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = parseDd214Text(DD214_TEMPLATE, { ...STANDARD_LIMITS, textChars });
      expect(result.rawText).toBe("");
      expect(result.fields.serviceStart).toBeNull();
    }
  });
});

describe("parseDd214Text validates real calendar dates", () => {
  const dates = (start: string, end: string) =>
    [
      `12a. DATE ENTERED ACTIVE DUTY: ${start}`,
      `12b. SEPARATION DATE: ${end}`,
    ].join("\n");

  it("drops impossible days instead of emitting an ISO-shaped date", () => {
    // 2021 is not a leap year, and February/April/June/November have 28/30 days.
    for (const impossible of ["02/29/2021", "02/31/2020", "04/31/2021", "06/31/1999", "11/31/1970"]) {
      const result = parseDd214Text(`12a. DATE ENTERED ACTIVE DUTY: ${impossible}`, limits);
      expect(result.fields.serviceStart, impossible).toBeNull();
      expect(result.fields.serviceEnd, impossible).toBeNull();
      expect(result.fields.warnings.join(" ")).toContain("Service dates not detected");
    }

    // An impossible day is dropped while a real one in the same document still
    // parses — the check rejects the date, not the whole document.
    const mixed = parseDd214Text(dates("02/31/2020", "05/24/1971"), limits);
    expect(mixed.fields.serviceStart).toBe("1971-05-24");
    // A single surviving date becomes the start only; an end needs two dates.
    expect(mixed.fields.serviceEnd).toBeNull();
  });

  it("accepts a real leap day and the month boundaries", () => {
    expect(parseDd214Text(dates("02/29/2020", "05/24/2021"), limits).fields.serviceStart).toBe("2020-02-29");
    expect(parseDd214Text(dates("02/28/2021", "02/28/2021"), limits).fields.serviceStart).toBe("2021-02-28");
    expect(parseDd214Text(dates("04/30/2021", "12/31/2021"), limits).fields.serviceEnd).toBe("2021-12-31");
    // 1900 is not a leap year (century rule); 2000 is.
    expect(
      parseDd214Text("12a. DATE ENTERED ACTIVE DUTY: 02/29/1900", limits).fields.serviceStart,
    ).toBeNull();
    expect(
      parseDd214Text("12a. DATE ENTERED ACTIVE DUTY: 02/29/2000", limits).fields.serviceStart,
    ).toBe("2000-02-29");
  });

  it("keeps the realistic DD-214 fixture parsing unchanged", () => {
    const result = parseDd214Text(DD214_TEMPLATE, limits);
    expect(result.fields.serviceStart).toBe("1968-09-12");
    expect(result.fields.serviceEnd).toBe("1971-05-24");
    expect(result.fields.locations).toContain("Republic of Vietnam");
    expect(result.fields.serviceBranchCodes).toEqual(["ARMY"]);
  });
});

describe("parseDd214Text minimizes SSN layouts", () => {
  const LAYOUTS = [
    "123-45-6789",
    "123 45 6789",
    "123.45.6789",
    "123–45–6789", // en dash
    "123—45—6789", // em dash
    "123_45_6789",
    "123  45  6789", // OCR double spacing
    "123456789",
  ];

  for (const layout of LAYOUTS) {
    it(`redacts ${JSON.stringify(layout)} and still masks the last four`, () => {
      const result = parseDd214Text(`3. SOCIAL SECURITY NUMBER: ${layout}\nREMARKS: none`, limits);
      expect(result.fields.maskedSsn).toBe("XXX-XX-6789");
      expect(result.rawText).toContain("XXX-XX-6789");
      // Nothing survives outside the mask itself: not the digit groups, and
      // not the grouped run with its original separators.
      const withoutMask = result.rawText.split("XXX-XX-6789").join("");
      expect(withoutMask).not.toContain("6789");
      expect(withoutMask.replace(/\D/g, "")).not.toContain("12345");
    });
  }

  it("keeps phone numbers, dates, and service numbers readable", () => {
    const text = [
      "CONTACT: (555) 123-4567",
      "12a. DATE ENTERED ACTIVE DUTY: 09/12/1968",
      "12b. SEPARATION DATE: 1971-05-24",
      "13. STATION / LOCATION: Republic of Vietnam",
    ].join("\n");
    const result = parseDd214Text(text, limits);
    expect(result.fields.maskedSsn).toBeUndefined();
    expect(result.rawText).toContain("(555) 123-4567");
    expect(result.rawText).toContain("09/12/1968");
    expect(result.rawText).toContain("1971-05-24");
    expect(result.fields.warnings.join(" ")).toContain("No SSN pattern detected");
  });

  it("leaves no full SSN in the retained preview even when several layouts appear", () => {
    const result = parseDd214Text(
      `SSN: 123-45-6789\nALT: 987.65.4321\nDIGITS: 111223333`,
      limits,
    );
    expect(result.rawText).not.toMatch(/\d{3}[-. _–—]{0,3}\d{2}[-. _–—]{0,3}\d{4}/);
    expect(result.fields.maskedSsn).toBe("XXX-XX-6789");
  });
});

describe("extended depth keeps its own headroom", () => {
  it("analyzes the extended budget rather than the standard one", () => {
    const text = `${"y".repeat(600_000)}\n12a. DATE ENTERED ACTIVE DUTY: 09/12/1968`;
    expect(parseDd214Text(text, EVIDENCE_DEPTH_LIMITS.standard).fields.serviceStart).toBeNull();
    expect(parseDd214Text(text, EVIDENCE_DEPTH_LIMITS.extended).fields.serviceStart).toBe("1968-09-12");
  });
});
