import { describe, expect, it } from "vitest";

import { runRegulatoryPreflight } from "@/lib/regulatory/preflight/run-preflight";
import type { RegulatoryPreflightCache } from "@/lib/regulatory/preflight/types";

const DOCUMENT_NUMBER = "2026-99999";
const RIN = "2900-TEST";

type FederalRegisterMode = "unverified" | "not-modified" | "verified" | "reclassified";

const federalRegisterPayload = (mode: FederalRegisterMode) => ({
  results: [{
    document_number: DOCUMENT_NUMBER,
    title: "Synthetic compensation final rule",
    type: mode === "reclassified" ? "Proposed Rule" : "Rule",
    action: mode === "reclassified" ? "Proposed rule." : "Final rule.",
    publication_date: "2026-11-07",
    effective_on: "2026-11-08",
    html_url: `https://www.federalregister.gov/d/${DOCUMENT_NUMBER}`,
    pdf_url: mode === "verified"
      ? `https://www.govinfo.gov/content/pkg/FR-2026/pdf/${DOCUMENT_NUMBER}.pdf`
      : null,
    regulation_id_numbers: [RIN],
    docket_ids: [],
    cfr_references: [{ title: 38, part: 3 }],
  }],
  next_page_url: null,
});

const mockFetch = (mode: () => FederalRegisterMode) => async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("federalregister.gov/api/v1/documents.json")) {
    if (mode() === "not-modified") return new Response(null, { status: 304 });
    return new Response(JSON.stringify(federalRegisterPayload(mode())), {
      status: 200,
      headers: { "content-type": "application/json", etag: `"fr-${mode()}"` },
    });
  }
  if (url.includes("govinfo.gov")) {
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    });
  }
  if (url.includes("EO_RULES_UNDER_REVIEW.xml") || url.includes("EO_RULE_COMPLETED_30_DAYS.xml")) {
    return new Response(null, { status: 304 });
  }
  if (url.includes("eAgendaXmlReport")) {
    return new Response(
      '<a href="/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_202510.xml">2026 Data</a>',
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }
  if (url.includes("XMLViewFileAction?f=REGINFO_RIN_DATA")) {
    return new Response(null, { status: 304 });
  }
  throw new Error(`Unexpected URL ${url}`);
};

const runPreflight = async (options: {
  cache: RegulatoryPreflightCache | null;
  now: string;
  mode: FederalRegisterMode;
}) => runRegulatoryPreflight({
  curatedRegistry: [],
  cache: options.cache,
  fetchImpl: mockFetch(() => options.mode) as typeof fetch,
  now: options.now,
  maxCacheAgeHours: 24,
});

const cacheFor = (
  result: Awaited<ReturnType<typeof runPreflight>>,
): RegulatoryPreflightCache => ({
  schemaVersion: 1,
  writtenAt: result.snapshot.finishedAt,
  snapshot: result.snapshot,
  registry: result.registry,
  sourceValidators: result.sourceValidators,
});

describe("regulatory preflight unresolved official-edition blockers", () => {
  it("does not clear an unresolved blocker when an unverified record is reclassified", async () => {
    const first = await runPreflight({ cache: null, now: "2026-11-08T06:00:00Z", mode: "unverified" });
    const next = await runPreflight({ cache: cacheFor(first), now: "2026-11-08T06:01:00Z", mode: "reclassified" });

    expect(next.snapshot).toMatchObject({
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
      officialEditionVerificationComplete: false,
    });
    expect(next.snapshot.changes).toContainEqual(expect.objectContaining({
      id: `fr:${DOCUMENT_NUMBER}`,
      classification: "current-law-change",
      officialEditionVerified: false,
    }));

    const unchanged = await runPreflight({ cache: cacheFor(next), now: "2026-11-08T06:02:00Z", mode: "not-modified" });
    expect(unchanged.snapshot.legalRegulatoryConclusionsAllowed).toBe(false);

    const verified = await runPreflight({ cache: cacheFor(unchanged), now: "2026-11-08T06:03:00Z", mode: "verified" });
    expect(verified.snapshot.legalRegulatoryConclusionsAllowed).toBe(true);
    expect(verified.snapshot.officialEditionVerificationComplete).toBe(true);
  });

  it("keeps legal conclusions disabled across no-change refreshes until the official edition is verified", async () => {
    const first = await runPreflight({ cache: null, now: "2026-11-08T06:00:00Z", mode: "unverified" });
    expect(first.snapshot.changes.map((change) => change.id)).toContain(`fr:${DOCUMENT_NUMBER}`);
    expect(first.snapshot).toMatchObject({
      freshness: "degraded",
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
      officialEditionVerificationComplete: false,
    });

    const second = await runPreflight({ cache: cacheFor(first), now: "2026-11-08T06:01:00Z", mode: "not-modified" });
    expect(second.snapshot.sourceResults.find((source) => source.source === "federal-register")?.status).toBe("not-modified");
    expect(second.snapshot.changes.map((change) => change.id)).toContain(`fr:${DOCUMENT_NUMBER}`);
    expect(second.snapshot).toMatchObject({
      freshness: "degraded",
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
      officialEditionVerificationComplete: false,
    });

    const repeated = await runPreflight({ cache: cacheFor(second), now: "2026-11-08T06:02:00Z", mode: "not-modified" });
    expect(repeated.snapshot.changes.map((change) => change.id)).toContain(`fr:${DOCUMENT_NUMBER}`);
    expect(repeated.snapshot).toMatchObject({
      freshness: "degraded",
      reviewMode: "medical-only",
      legalRegulatoryConclusionsAllowed: false,
      officialEditionVerificationComplete: false,
    });

    const verified = await runPreflight({ cache: cacheFor(repeated), now: "2026-11-08T06:03:00Z", mode: "verified" });
    expect(verified.snapshot).toMatchObject({
      freshness: "current",
      reviewMode: "full",
      legalRegulatoryConclusionsAllowed: true,
      officialEditionVerificationComplete: true,
    });
    expect(verified.snapshot.changes).toContainEqual(expect.objectContaining({
      id: `fr:${DOCUMENT_NUMBER}`,
      officialEditionVerified: true,
    }));
  });
});
