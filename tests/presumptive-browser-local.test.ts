import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  clearPresumptiveHistory,
  clearPresumptiveLocalState,
  normalizeServiceHistoryDraft,
  persistServiceHistory,
  presumptiveHistoryIsEmpty,
  presumptiveHistoryStorageKey,
  presumptiveLocalStorageKeys,
  readPresumptiveHistory,
  SERVICE_HISTORY_MESSAGES,
  validateServiceHistoryDraft,
  writePresumptiveHistory,
} from "@/lib/presumptive/browser-history";
import { matchPresumptives, type ServiceHistory } from "@/lib/presumptive/match";
import { loadExposureCatalog } from "@/lib/presumptive/load";

/**
 * PRIV-01 follow-on (2026-10-08): the presumptive DD-214 flow is browser-local.
 *
 * Confirmed service locations, branches and dates are stored in the browser,
 * read back by the results view, and matched there. Nothing about them reaches
 * the server — no Server Action, no cookie, no request. These contracts pin the
 * record's bounds and fail-safe reads, the validation taxonomy that survived
 * the retired action, and the absence of any server transport in the flow.
 */

const catalog = loadExposureCatalog();
const knownLocations = [
  ...new Set(
    catalog.flatMap((category) =>
      category.qualifyingService.flatMap((period) => period.locations),
    ),
  ),
];

const VIETNAM = "Republic of Vietnam";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    get size() {
      return data.size;
    },
    raw: data,
  };
}

function vietnamHistory(): ServiceHistory {
  return {
    serviceBranchCodes: ["ARMY"],
    locations: [VIETNAM],
    serviceStart: "1968-09-12",
    serviceEnd: "1971-05-24",
  };
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("browser-local presumptive service history", () => {
  it("round-trips through browser storage and is what matching reads", () => {
    const storage = fakeStorage();
    writePresumptiveHistory(storage, vietnamHistory());

    const stored = storage.getItem(presumptiveHistoryStorageKey);
    expect(stored).toBeTruthy();
    expect(stored).toContain(VIETNAM);

    const history = readPresumptiveHistory(storage);
    expect(history).toEqual(vietnamHistory());
    expect(presumptiveHistoryIsEmpty(history)).toBe(false);

    const result = matchPresumptives(catalog, history!);
    expect(result.matches.some(({ category }) => category.id === "agent-orange")).toBe(true);
  });

  it("treats missing, corrupt, out-of-version and out-of-bounds records as absent", () => {
    expect(readPresumptiveHistory(fakeStorage())).toBeNull();
    expect(
      readPresumptiveHistory(
        fakeStorage({ [presumptiveHistoryStorageKey]: "{not json" }),
      ),
    ).toBeNull();
    expect(
      readPresumptiveHistory(
        fakeStorage({
          [presumptiveHistoryStorageKey]: JSON.stringify({
            version: 99,
            locations: [VIETNAM],
          }),
        }),
      ),
    ).toBeNull();
    expect(
      readPresumptiveHistory(
        fakeStorage({
          [presumptiveHistoryStorageKey]: JSON.stringify({
            version: 1,
            locations: Array.from({ length: 51 }, (_, index) => `${VIETNAM} ${index}`),
          }),
        }),
      ),
    ).toBeNull();
  });

  it("rejects an out-of-bounds write instead of truncating it", () => {
    const storage = fakeStorage();
    writePresumptiveHistory(storage, vietnamHistory());
    const before = storage.getItem(presumptiveHistoryStorageKey);

    expect(() =>
      writePresumptiveHistory(storage, {
        ...vietnamHistory(),
        locations: Array.from({ length: 51 }, (_, index) => `location-${index}`),
      }),
    ).toThrow();
    expect(storage.getItem(presumptiveHistoryStorageKey)).toBe(before);

    expect(() =>
      writePresumptiveHistory(storage, {
        ...vietnamHistory(),
        serviceBranchCodes: ["army"],
      }),
    ).toThrow();
    expect(storage.getItem(presumptiveHistoryStorageKey)).toBe(before);
  });

  it("clears the record directly and through the track's clear-all registry", () => {
    const storage = fakeStorage();
    writePresumptiveHistory(storage, vietnamHistory());
    clearPresumptiveHistory(storage);
    expect(readPresumptiveHistory(storage)).toBeNull();

    writePresumptiveHistory(storage, vietnamHistory());
    expect(storage.size).toBe(1);
    clearPresumptiveLocalState(storage);
    expect(storage.size).toBe(0);
    expect(readPresumptiveHistory(storage)).toBeNull();

    for (const key of presumptiveLocalStorageKeys) {
      expect(key.startsWith("presumptive-condition-finder:")).toBe(true);
    }
  });
});

describe("service-history intake (the retired action's contract, client-side)", () => {
  it("maps schema failures to the fixed validation taxonomy", () => {
    expect(
      validateServiceHistoryDraft(
        normalizeServiceHistoryDraft({ locations: [] }),
        knownLocations,
      ),
    ).toEqual({ ok: false, code: "select-location" });

    expect(
      validateServiceHistoryDraft(
        normalizeServiceHistoryDraft({
          locations: [VIETNAM],
          serviceStart: "1971-05-24",
          serviceEnd: "1968-09-12",
        }),
        knownLocations,
      ),
    ).toEqual({ ok: false, code: "date-order" });

    expect(
      validateServiceHistoryDraft(
        normalizeServiceHistoryDraft({
          locations: [VIETNAM],
          serviceStart: "not-a-date",
        }),
        knownLocations,
      ),
    ).toEqual({ ok: false, code: "invalid-date" });
  });

  it("keeps the authored-catalog membership allowlist before any write", () => {
    const storage = fakeStorage();
    const result = persistServiceHistory(
      storage,
      normalizeServiceHistoryDraft({
        locations: ["Fort Liberty, NC"],
        serviceStart: "2003-01-01",
      }),
      knownLocations,
    );

    expect(result).toEqual({ ok: false, code: "select-location" });
    expect(readPresumptiveHistory(storage)).toBeNull();
  });

  it("normalizes blanks and writes only on success", () => {
    const storage = fakeStorage();
    const result = persistServiceHistory(
      storage,
      normalizeServiceHistoryDraft({
        locations: [`  ${VIETNAM}  `, ""],
        serviceBranchCodes: ["ARMY", "  "],
        serviceStart: "",
        serviceEnd: "1971-05-24",
      }),
      knownLocations,
    );

    expect(result.ok).toBe(true);
    expect(readPresumptiveHistory(storage)).toEqual({
      serviceBranchCodes: ["ARMY"],
      locations: [VIETNAM],
      serviceStart: null,
      serviceEnd: "1971-05-24",
    });
  });

  it("reports a refused local write instead of pretending it saved", () => {
    const result = persistServiceHistory(
      {
        setItem: () => {
          throw new Error("quota");
        },
      },
      normalizeServiceHistoryDraft({ locations: [VIETNAM] }),
      knownLocations,
    );

    expect(result).toEqual({ ok: false, code: "storage-unavailable" });
  });

  it("gives every failure code user-facing copy", () => {
    for (const code of [
      "select-location",
      "date-order",
      "invalid-date",
      "storage-unavailable",
    ] as const) {
      expect(SERVICE_HISTORY_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe("presumptive flow has no server transport left", () => {
  const clientFiles = [
    "src/components/ServiceHistoryForm.tsx",
    "src/components/presumptive/Dd214LocalAnalyzer.tsx",
    "src/components/presumptive/PresumptiveResults.tsx",
    "src/lib/presumptive/browser-history.ts",
    "src/lib/presumptive/use-browser-history.ts",
    "src/lib/presumptive/cross-link.ts",
    "src/app/presumptive/results/secondary-cross-link.ts",
  ];

  it("never posts service history, sets a cookie, or reads a session", () => {
    for (const file of clientFiles) {
      const source = readSource(file);
      expect(source, `${file}: no fetch`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file}: no beacon`).not.toContain("sendBeacon");
      expect(source, `${file}: no cookie writes`).not.toMatch(/document\.cookie/);
      expect(source, `${file}: no server headers`).not.toMatch(
        /["']next\/headers["']/,
      );
      expect(source, `${file}: no Server Action import`).not.toMatch(
        /@\/lib\/actions\//,
      );
    }
  });

  it("keeps the confirmed history out of every URL", () => {
    for (const file of clientFiles) {
      const source = readSource(file);
      expect(source, `${file}: no URL search access`).not.toMatch(
        /location\.search|URLSearchParams|window\.location/,
      );
    }
    const resultsView = readSource("src/components/presumptive/PresumptiveResults.tsx");
    expect(resultsView).not.toMatch(/router\.(push|replace)\([^)]*(location|service)/);
  });

  it("keeps the results shell free of any session read", () => {
    const shell = readSource("src/app/presumptive/results/page.tsx");
    expect(shell).not.toMatch(/next\/headers/);
    expect(shell).not.toMatch(/cookies\s*\(/);
    expect(shell).not.toMatch(/readPresumptive/);
    // The only query value it honours is the public accredited-rep directory lookup.
    expect(shell).toContain("zip");
  });
});
