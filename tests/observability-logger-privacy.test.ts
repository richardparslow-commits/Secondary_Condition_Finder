import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROHIBITED_LOG_FIELDS,
  createLogger,
  redactLogFields,
} from "@/lib/observability/logger";

/**
 * Privacy contract for the only first-party log sink in the application.
 *
 * The Zero-PII rule requires that raw evidence text, identifiers, and workflow
 * payloads never reach stdout, because stdout is collected by platform log
 * ingest. These tests pin the redactor's *structure* (recursive,
 * case-insensitive) rather than a single flat key list, since a shallow
 * top-level blocklist is defeated by nesting or renaming.
 */
describe("observability logger privacy redaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a governance list covering the Zero-PII field names", () => {
    for (const required of ["freeText", "rawNotes", "patientName", "ssn", "zip", "cookie"]) {
      expect(PROHIBITED_LOG_FIELDS).toContain(required);
    }
  });

  it("suppresses prohibited fields at the top level", () => {
    const out = redactLogFields({
      service: "va-api",
      freeText: "veteran reports tinnitus onset in 2003",
    }) as Record<string, unknown>;

    expect(out.service).toBe("va-api");
    expect(out.freeText).toBe("[redacted]");
    expect(JSON.stringify(out)).not.toContain("tinnitus");
  });

  it("drops arbitrary free-form strings even under a non-prohibited key", () => {
    const out = redactLogFields({
      service: "va-api",
      error: "upstream said: veteran records attached at https://va.test/x?ssn=999-88-7777",
      message: "raw upstream body",
      route: "/secondary/suggestions?diagnosed=ptsd&rating-ptsd=70",
      zip: "90210",
    }) as Record<string, unknown>;

    const serialized = JSON.stringify(out);
    expect(out.service).toBe("va-api");
    expect(out.error).toBe("[redacted]");
    expect(out.message).toBe("[redacted]");
    expect(out.route).toBe("[redacted]");
    expect(serialized).not.toContain("999-88-7777");
    expect(serialized).not.toContain("diagnosed=ptsd");
    expect(serialized).not.toContain("upstream said");
  });

  it("keeps shape-validated operational values so observability is not a blanket wipe", () => {
    const out = redactLogFields({
      path: "/services/veteran/v1/status",
      requestId: "3f2c9a5e-6b1d-4c8f-9a0e-2d7b4c1f8e6a",
      outcome: "http-error",
      status: 503,
    }) as Record<string, unknown>;

    expect(out.path).toBe("/services/veteran/v1/status");
    expect(out.outcome).toBe("http-error");
    expect(out.status).toBe(503);
  });

  it("drops a non-allowlisted message and sanitizes the component label", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("privacy-probe");

    logger.info("veteran reported tinnitus at 90210", { service: "va-api" });

    const written = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(written).toContain("OPERATIONAL_EVENT");
    expect(written).not.toContain("tinnitus");
    expect(written).not.toContain("90210");
  });

  it("suppresses prohibited fields nested in objects and arrays", () => {
    const out = redactLogFields({
      meta: { attempt: 2, inner: { ssn: "123-45-6789", patientName: "Jane Doe" } },
      items: [{ zip: "90210" }, { status: 200 }],
    }) as Record<string, unknown>;
    const serialized = JSON.stringify(out);

    expect(serialized).not.toContain("123-45-6789");
    expect(serialized).not.toContain("Jane Doe");
    expect(serialized).not.toContain("90210");
    // Non-sensitive siblings survive, so the control is not a blanket wipe.
    expect(serialized).toContain('"status":200');
    expect(serialized).toContain('"attempt":2');
  });

  it("matches prohibited keys case-insensitively", () => {
    const serialized = JSON.stringify(
      redactLogFields({ SSN: "111-22-3333", RawNotes: "clinical note body" }),
    );

    expect(serialized).not.toContain("111-22-3333");
    expect(serialized).not.toContain("clinical note body");
  });

  it("preserves the operational correlation fields the VA client relies on", () => {
    const out = redactLogFields({
      requestId: "req-1",
      service: "va-api",
      path: "/services/veteran/v1/status",
      attempt: 1,
      outcome: "success",
      status: 200,
      durationMs: 42,
      component: "va-sandbox",
      environment: "production",
    }) as Record<string, unknown>;

    expect(out.path).toBe("/services/veteran/v1/status");
    expect(out.requestId).toBe("req-1");
    expect(out.status).toBe(200);
    expect(out.durationMs).toBe(42);
    expect(out.environment).toBe("production");
  });

  it("serializes Date values instead of collapsing them to an empty object", () => {
    const out = redactLogFields({ checkedAt: new Date("2026-09-25T00:00:00.000Z") }) as Record<
      string,
      unknown
    >;

    expect(out.checkedAt).toBe("2026-09-25T00:00:00.000Z");
  });

  it("terminates on cyclic structures instead of overflowing the stack", () => {
    const cyclic: Record<string, unknown> = { service: "va-api" };
    cyclic.self = cyclic;

    expect(() => JSON.stringify(redactLogFields(cyclic))).not.toThrow();
  });

  it("never writes a prohibited value through to the console sink", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("privacy-probe");

    logger.info("request handled", {
      service: "va-api",
      freeText: "SSN 999-88-7777 noted in upload",
    });

    const written = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(written).toContain('"service":"va-api"');
    expect(written).toContain("[redacted]");
    expect(written).not.toContain("999-88-7777");
    expect(written).not.toContain("noted in upload");
  });
});