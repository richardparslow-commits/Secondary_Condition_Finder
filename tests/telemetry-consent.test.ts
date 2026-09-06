import { describe, expect, it } from "vitest";

import {
  readTelemetryConsent,
  storeTelemetryConsent,
  TELEMETRY_CONSENT_KEY,
} from "../src/lib/telemetry-consent";

function createStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("telemetry consent storage", () => {
  it("returns null when no choice has been made", () => {
    expect(readTelemetryConsent(createStorage())).toBeNull();
  });

  it("round-trips a stored consent value", () => {
    const storage = createStorage();
    storeTelemetryConsent(storage, "granted");
    expect(readTelemetryConsent(storage)).toBe("granted");
    expect(storage.getItem(TELEMETRY_CONSENT_KEY)).toBe("granted");
  });

  it("can store a declined choice", () => {
    const storage = createStorage();
    storeTelemetryConsent(storage, "declined");
    expect(readTelemetryConsent(storage)).toBe("declined");
  });

  it("treats unknown or corrupted values as no choice", () => {
    const storage = createStorage();
    storage.setItem(TELEMETRY_CONSENT_KEY, "maybe");
    expect(readTelemetryConsent(storage)).toBeNull();
  });
});
