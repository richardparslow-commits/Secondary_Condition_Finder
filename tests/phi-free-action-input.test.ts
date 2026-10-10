/**
 * PHI-free Server Action input contract.
 *
 * The point of these tests is that the guarantee is *mechanical*: a refusal
 * names a canonical constant from the module and can never echo a caller's value
 * or key. If a future change lets input text round-trip through a refusal, the
 * refusal becomes a reflection channel and this suite fails.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  DEFAULT_MAX_INPUT_STRING_LENGTH,
  PHI_INPUT_FIELD_PREFIXES,
  conditionIdListSchema,
  findPhiInputField,
  phiFreeActionInput,
  phiInputRefusalBody,
  sanitizeActionInput,
  stripPhiFields,
} from "@/lib/security/phi-free-action-input";

const operationalSchema = phiFreeActionInput({
  conditionIds: conditionIdListSchema(),
  returnTo: z.string().max(64).optional(),
});

describe("findPhiInputField", () => {
  it("matches identifiers, clinical text, and secret material case-insensitively", () => {
    for (const field of [
      "ssn",
      "SSN",
      "FullSsn",
      "dateOfBirth",
      "rawText",
      "clinicalNotes",
      "ocrText",
      "dbqText",
      "medications",
      "accessToken",
      "authorization",
    ]) {
      expect(findPhiInputField([field]), field).not.toBeNull();
    }
  });	it("passes purely operational field names", () => {
	    for (const field of ["conditionIds", "returnTo", "radiusMiles", "type", "scope"]) {
	      expect(findPhiInputField([field]), field).toBeNull();
	    }
	  });

	  it("accepts a ZIP, the one quasi-identifier a public directory lookup needs", () => {
	    // The value is still a quasi-identifier for *logging* (it stays in the
	    // logger's PROHIBITED_LOG_FIELDS); it is accepted as input because the
	    // accredited-representative action validates `^\d{5}$` and never logs it.
	    expect(findPhiInputField(["zip"])).toBeNull();
	  });

  it("returns the canonical constant for a prefix family, never caller text", () => {
    const crafted = "rating-<img src=x onerror=alert(1)>";
    expect(findPhiInputField([crafted])).toBe("rating-");
    expect(PHI_INPUT_FIELD_PREFIXES).toContain("rating-");
    expect(findPhiInputField([crafted])).not.toContain("<img");
  });

  it("is order-insensitive: any refused name refuses the whole input", () => {
    expect(findPhiInputField(["conditionIds", "returnTo", "rawText"])).toBe("rawText");
  });
});

describe("sanitizeActionInput", () => {
  it("accepts a bounded, PHI-free input and returns typed data", () => {
    const result = sanitizeActionInput(operationalSchema, {
      conditionIds: ["tinnitus", "chronic-pain"],
      returnTo: "/secondary/suggestions",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.conditionIds).toEqual(["tinnitus", "chronic-pain"]);
  });

  it("refuses a PHI-shaped field name and never echoes its value", () => {
    const ssn = "123-45-6789";
    const result = sanitizeActionInput(operationalSchema, { conditionIds: ["tinnitus"], ssn });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.code).toBe("phi-shaped-field");
    expect(result.field).toBe("ssn");
    expect(JSON.stringify(phiInputRefusalBody(result))).not.toContain(ssn);
  });

  it("refuses an unknown key without naming that key (no reflection channel)", () => {
    const result = sanitizeActionInput(operationalSchema, {
      conditionIds: ["tinnitus"],
      "<script>alert(1)</script>": "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    const body = JSON.stringify(phiInputRefusalBody(result));
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("alert");
    expect(result.field).toBeUndefined();
  });

  it("refuses a clinical-length string even under an innocuous key", () => {
    const prose = "x".repeat(DEFAULT_MAX_INPUT_STRING_LENGTH + 1);
    const result = sanitizeActionInput(operationalSchema, { conditionIds: [prose] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.code).toBe("oversized-value");
    expect(JSON.stringify(result)).not.toContain(prose);
  });

  it("accepts a value exactly at the length ceiling", () => {
    const result = sanitizeActionInput(
      z.object({ value: z.string() }).strict(),
      { value: "y".repeat(DEFAULT_MAX_INPUT_STRING_LENGTH) },
    );
    expect(result.ok).toBe(true);
  });

  it("checks FormData keys, including across repeated entries", () => {
    const formData = new FormData();
    formData.append("conditionIds", "tinnitus");
    formData.append("rawText", "service treatment records");
    const result = sanitizeActionInput(operationalSchema, formData);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.field).toBe("rawText");
  });
});

describe("conditionIdListSchema", () => {
  it("accepts slug identifiers and refuses free text", () => {
    expect(conditionIdListSchema().safeParse(["tinnitus"]).success).toBe(true);
    expect(conditionIdListSchema().safeParse(["Diabetes mellitus type 2"]).success).toBe(false);
    expect(conditionIdListSchema().safeParse(["tinnitus; DROP TABLE"]).success).toBe(false);
  });

  it("bounds the list length", () => {
    const long = Array.from({ length: 33 }, (_, index) => `condition-${index}`);
    expect(conditionIdListSchema().safeParse(long).success).toBe(false);
    expect(conditionIdListSchema({ max: 40 }).safeParse(long).success).toBe(true);
  });

  it("enforces catalog membership when a known-id set is supplied", () => {
    const known = new Set(["tinnitus", "chronic-pain"]);
    const schema = conditionIdListSchema({ known });
    expect(schema.safeParse(["tinnitus"]).success).toBe(true);
    expect(schema.safeParse(["not-in-catalog"]).success).toBe(false);
  });
});

describe("stripPhiFields", () => {
  it("removes PHI-shaped keys and reports canonical constants", () => {
    const { data, removed } = stripPhiFields({
      conditionIds: ["tinnitus"],
      rawText: "notes",
      "rating-abc": "70",
    });
    expect(Object.keys(data)).toEqual(["conditionIds"]);
    expect([...removed].sort()).toEqual(["rating-", "rawText"]);
  });

  it("does not mutate the input record", () => {
    const input = { conditionIds: ["tinnitus"], ssn: "123-45-6789" };
    stripPhiFields(input);
    expect(Object.keys(input)).toContain("ssn");
  });
});
