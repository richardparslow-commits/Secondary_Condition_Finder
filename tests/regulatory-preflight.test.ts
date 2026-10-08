import fs from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { normalizeFederalRegisterApiDocument } from "@/lib/regulatory/adapters";
import { diffRegulatoryPreflight } from "@/lib/regulatory/preflight/diff";
import { buildFederalRegisterVaSearchUrl, fetchFederalRegisterVaChanges } from "@/lib/regulatory/preflight/federal-register";
import { decideRegulatoryFreshness } from "@/lib/regulatory/preflight/freshness";
import { fetchTextWithTimeout } from "@/lib/regulatory/preflight/http";
import { mergeRegulatoryDiscoveries } from "@/lib/regulatory/preflight/merge";
import { htmlText, parseXml } from "@/lib/regulatory/preflight/xml";
import { __oiraParserTestSeams } from "@/lib/regulatory/preflight/oira";
import type {
  FederalRegisterDiscovery,
  RegulatoryPreflightSnapshot,
  RegulatoryPreflightSourceResult,
} from "@/lib/regulatory/preflight/types";
import type { RegulatoryAction } from "@/lib/regulatory/schema";

const source = (name: RegulatoryPreflightSourceResult["source"], status: RegulatoryPreflightSourceResult["status"] = "success"): RegulatoryPreflightSourceResult => ({
  source: name,
  status,
  checkedAt: "2026-08-18T21:00:00.000Z",
  recordCount: 0,
});

const baseAction = (): RegulatoryAction => ({
  rin: "2900-AQ73",
  title: "Example VA rating action",
  agency: { department: "Department of Veterans Affairs" },
  relatedRins: [],
  cfrReferences: [{ title: 38, part: 4 }],
  legalAuthorities: [],
  agenda: [],
  oiraReviews: [],
  oiraMeetingAvailability: "unknown",
  oiraMeetings: [],
  federalRegisterDocuments: [],
  impact: {
    currentLawChanged: false,
    pendingChange: true,
    affectedConditionIds: ["migraine"],
    affectedClaimTheories: ["increased-rating"],
    affectedDiagnosticCodes: ["8100"],
    affectedPresumptions: [],
    affectedEffectiveDateRules: [],
    affectedCfrReferences: [{ title: 38, part: 4 }],
    summary: "Potential rating-schedule change.",
  },
});

const previousSnapshot = (): RegulatoryPreflightSnapshot => ({
  schemaVersion: 1,
  snapshotId: "reg-previous-12345678",
  startedAt: "2026-08-18T10:00:00.000Z",
  finishedAt: "2026-08-18T10:00:00.000Z",
  asOfDate: "2026-08-18",
  registryDigest: "abc",
  sourceResults: [],
  changes: [],
  relevantChangeIds: [],
  freshness: "current",
  reviewMode: "full",
  legalRegulatoryConclusionsAllowed: true,
  officialEditionVerificationComplete: true,
  usedCachedRegistry: false,
  warnings: [],
});

describe("Federal Register preflight query", () => {
  it("normalizes human-readable Federal Register type labels without treating proposals as final rules", () => {
    const proposed = normalizeFederalRegisterApiDocument({
      document_number: "2026-11111",
      title: "Example proposed rule",
      type: "Proposed Rule",
      publication_date: "2026-08-18",
      html_url: "https://www.federalregister.gov/d/2026-11111",
      pdf_url: "https://www.govinfo.gov/content/pkg/example.pdf",
    }, { asOf: "2026-08-18" });
    const rule = normalizeFederalRegisterApiDocument({
      document_number: "2026-22222",
      title: "Example final rule",
      type: "Rule",
      publication_date: "2026-08-18",
      effective_on: "2026-09-18",
      html_url: "https://www.federalregister.gov/d/2026-22222",
      pdf_url: "https://www.govinfo.gov/content/pkg/example.pdf",
    }, { asOf: "2026-08-18" });
    expect(proposed.type).toBe("proposed-rule");
    expect(proposed.legalStatus).toBe("nonbinding-proposal");
    expect(rule.type).toBe("rule");
    expect(rule.legalStatus).toBe("published-not-effective");
  });


  it("fails closed when a potentially operative GovInfo link does not return a PDF signature", async () => {
    const payload = {
      results: [{
        document_number: "2026-33333", title: "VA final compensation rule", type: "Rule", action: "Final rule.",
        publication_date: "2026-08-17", effective_on: "2026-08-18",
        html_url: "https://www.federalregister.gov/d/2026-33333",
        pdf_url: "https://www.govinfo.gov/content/pkg/FR-2026/pdf/2026-33333.pdf",
        regulation_id_numbers: ["2900-ABCD"], docket_ids: [], cfr_references: [{ title: 38, part: 3 }],
      }],
      next_page_url: null,
    };
    const mockFetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/documents.json")) return new Response(JSON.stringify(payload), { status: 200 });
      if (url.includes("govinfo.gov")) return new Response("not-pdf", { status: 200, headers: { "content-type": "text/plain" } });
      throw new Error(`Unexpected URL ${url}`);
    };
    const result = await fetchFederalRegisterVaChanges({
      fetchImpl: mockFetch as typeof fetch, since: "2026-08-16", asOfDate: "2026-08-18", checkedAt: "2026-08-18T21:00:00.000Z",
    });
    expect(result.discoveries[0]).toMatchObject({
      officialEditionVerificationRequired: true, officialEditionVerified: false, normalizedDocument: undefined,
    });
  });

  it("scopes discovery to VA and a bounded publication-date overlap", () => {
    const url = new URL(buildFederalRegisterVaSearchUrl({ since: "2026-08-16" }));
    expect(url.hostname).toBe("www.federalregister.gov");
    expect(url.searchParams.getAll("conditions[agencies][]")).toEqual(["veterans-affairs-department"]);
    expect(url.searchParams.get("conditions[publication_date][gte]")).toBe("2026-08-16");
  });
});


describe("preflight HTTP safety", () => {
  it("rejects responses whose declared size exceeds the configured bound before reading the body", async () => {
    const mockFetch = async () => new Response("small", { status: 200, headers: { "content-length": "9999" } });
    await expect(fetchTextWithTimeout(mockFetch as typeof fetch, "https://example.test/data", { maxBytes: 100 })).rejects.toThrow(/declared 9999 bytes/);
  });

  it("refuses to follow a source redirect so an API key cannot be replayed to another origin", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://attacker.example/collect" },
      }),
    );

    await expect(
      fetchTextWithTimeout(fetchImpl as unknown as typeof fetch, "https://api.regulations.gov/v4/dockets", {
        headers: { "X-Api-Key": "test-key" },
      }),
    ).rejects.toThrow("HTTP 302 from https://api.regulations.gov/v4/dockets");

    // One request to the configured source; the redirect is not followed.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.regulations.gov/v4/dockets",
      expect.objectContaining({ redirect: "error" }),
    );
  });
});

describe("Reginfo XML normalization", () => {
  it("keeps OIRA review records non-authoritative", () => {
    const xml = `<?xml version="1.0"?><ROOT><REVIEW><RIN>2900-AQ73</RIN><TITLE>Neurological conditions</TITLE><AGENCY>Department of Veterans Affairs</AGENCY><STAGE>Final Rule</STAGE><RECEIVED_DATE>08/01/2026</RECEIVED_DATE><REVIEW_ID>12345</REVIEW_ID></REVIEW></ROOT>`;
    const rows = __oiraParserTestSeams.parseOiraReviewXml(xml, "pending", "https://www.reginfo.gov/public/do/XMLViewFileAction?f=EO_RULES_UNDER_REVIEW.xml");
    expect(rows).toHaveLength(1);
    expect(rows[0].review.authorityUse).toBe("review-metadata-only");
    expect(rows[0].review.authenticity.legalEditionStatus).toBe("planning-review-metadata");
  });

  it("rejects an Agenda XML download link that escapes the Reginfo allowlist", () => {
    const html = `<a href="https://evil.example/XMLViewFileAction?f=REGINFO_RIN_DATA_202510.xml">2026 Data</a>`;
    expect(() => __oiraParserTestSeams.discoverAgendaXml(html)).toThrow(/Could not discover/);
  });

  it("preserves Unified Agenda month precision", () => {
    const xml = `<ROOT><ENTRY><RIN>2900-AQ73</RIN><TITLE>Neurological conditions</TITLE><AGENCY>Department of Veterans Affairs</AGENCY><STAGE>Final Rule Stage</STAGE><TIMETABLE><ACTION>Final Action</ACTION><DATE>04/00/2027</DATE></TIMETABLE></ENTRY></ROOT>`;
    const rows = __oiraParserTestSeams.parseAgendaXml(xml, {
      url: "https://mobile.reginfo.gov/public/do/XMLViewFileAction?f=REGINFO_RIN_DATA_202510.xml",
      edition: "2026 Data",
      publicationId: "202510",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status.plannedActions[0].date).toMatchObject({ value: "2027-04", precision: "month" });
  });
});

describe("freshness fail-safe", () => {
  it("allows full review only when required live sources are current and official verification is complete", () => {
    const decision = decideRegulatoryFreshness({
      sourceResults: [source("federal-register"), source("oira-pending"), source("oira-completed"), source("unified-agenda")],
      changes: [],
      finishedAt: "2026-08-18T21:00:00.000Z",
    });
    expect(decision).toMatchObject({ freshness: "current", reviewMode: "full", legalRegulatoryConclusionsAllowed: true });
  });

  it("uses a recent verified snapshot when one required source is unavailable", () => {
    const decision = decideRegulatoryFreshness({
      sourceResults: [source("federal-register", "failed"), source("oira-pending"), source("oira-completed"), source("unified-agenda")],
      changes: [],
      finishedAt: "2026-08-18T21:00:00.000Z",
      previousSnapshot: previousSnapshot(),
      maxCacheAgeHours: 24,
    });
    expect(decision.freshness).toBe("degraded");
    expect(decision.reviewMode).toBe("full-with-warning");
  });

  it("fails to medical-only when the regulatory snapshot is stale", () => {
    const decision = decideRegulatoryFreshness({
      sourceResults: [source("federal-register", "failed"), source("oira-pending"), source("oira-completed"), source("unified-agenda")],
      changes: [],
      finishedAt: "2026-08-20T21:00:00.000Z",
      previousSnapshot: previousSnapshot(),
      maxCacheAgeHours: 24,
    });
    expect(decision).toMatchObject({ freshness: "stale", reviewMode: "medical-only", legalRegulatoryConclusionsAllowed: false });
  });

  it("disables legal conclusions when a potentially operative rule cannot be officially verified", () => {
    const decision = decideRegulatoryFreshness({
      sourceResults: [source("federal-register"), source("oira-pending"), source("oira-completed"), source("unified-agenda")],
      changes: [{
        id: "fr:2026-99999",
        rin: "2900-AQ73",
        title: "Final rule",
        classification: "current-law-change",
        source: "federal-register",
        detectedAt: "2026-08-18T21:00:00.000Z",
        reason: "Official edition unavailable.",
        documentNumbers: ["2026-99999"],
        requiresOfficialEditionVerification: true,
        officialEditionVerified: false,
        impact: { affectedConditionIds: [], affectedClaimTheories: [], affectedDiagnosticCodes: [], affectedPresumptions: [], affectedEffectiveDateRules: [] },
      }],
      finishedAt: "2026-08-18T21:00:00.000Z",
    });
    expect(decision).toMatchObject({ freshness: "degraded", reviewMode: "medical-only", legalRegulatoryConclusionsAllowed: false });
  });
});

describe("regulatory change classification", () => {
  it("classifies a new proposed Federal Register rule as pending, not current law", () => {
    const action = baseAction();
    const proposed = normalizeFederalRegisterApiDocument({
      document_number: "2026-12345",
      title: "Schedule for Rating Disabilities: Neurological Conditions",
      type: "PRORULE",
      publication_date: "2026-08-18",
      comments_close_on: "2026-10-18",
      regulation_id_numbers: ["2900-AQ73"],
      cfr_references: [{ title: 38, part: 4 }],
      html_url: "https://www.federalregister.gov/documents/2026/08/18/2026-12345/example",
    }, { asOf: "2026-08-18" });
    const discovery: FederalRegisterDiscovery = {
      documentNumber: proposed.documentNumber,
      title: proposed.title,
      rin: proposed.rin,
      relatedRins: [],
      type: proposed.type,
      publicationDate: proposed.publicationDate,
      signals: ["rating-schedule"],
      normalizedDocument: proposed,
      officialEditionVerificationRequired: false,
      officialEditionVerified: false,
    };
    const next = mergeRegulatoryDiscoveries({
      baseRegistry: [action],
      federalRegister: [discovery],
      agenda: [],
      oiraReviews: [],
      oiraMeetings: [],
      dockets: [],
      checkedOn: "2026-08-18",
    });
    const changes = diffRegulatoryPreflight({ previousRegistry: [action], nextRegistry: next, federalRegisterDiscoveries: [discovery], detectedAt: "2026-08-18T21:00:00.000Z", asOfDate: "2026-08-18" });
    expect(changes[0]).toMatchObject({ classification: "pending-regulatory-change", source: "federal-register" });
  });

  it("keeps OIRA final-stage activity as a development signal rather than law", () => {
    const action = baseAction();
    const next = mergeRegulatoryDiscoveries({
      baseRegistry: [action],
      federalRegister: [],
      agenda: [],
      oiraReviews: [{
        rin: "2900-AQ73",
        title: action.title,
        agencyDepartment: "Department of Veterans Affairs",
        review: {
          reviewId: "12345",
          rin: "2900-AQ73",
          status: "pending",
          stage: "final-rule",
          receivedOn: "2026-08-18",
          legalDeadline: "none",
          regulatoryFlexibilityAnalysisRequired: "unknown",
          sourceUrl: "https://www.reginfo.gov/public/do/eoDetails?rrid=12345",
          authorityUse: "review-metadata-only",
          authenticity: { publisher: "reginfo-oira", legalEditionStatus: "planning-review-metadata", officialEditionVerified: false },
        },
      }],
      oiraMeetings: [],
      dockets: [],
      checkedOn: "2026-08-18",
    });
    const changes = diffRegulatoryPreflight({ previousRegistry: [action], nextRegistry: next, federalRegisterDiscoveries: [], detectedAt: "2026-08-18T21:00:00.000Z", asOfDate: "2026-08-18" });
    expect(changes[0]).toMatchObject({ classification: "regulatory-development-signal", source: "oira-pending" });
  });
});


describe("workflow preflight integration", () => {
  it("prepares a scope-free Step 5 snapshot in the uniform shell and filters relevance in the browser", () => {
    // PRIV-01 stage 2: the shell prepares the snapshot with NO review scope
    // (identical public artifact for every visitor); the client step filters
    // relevance against the browser-local selections and only then runs the
    // engine. The snapshot id still locks Step 6 into the same basis.
    const shell = fs.readFileSync("src/app/secondary/suggestions/page.tsx", "utf8");
    const step = fs.readFileSync("src/components/secondary/steps/SuggestionsStep.tsx", "utf8");

    expect(shell).toContain("prepareRegulatoryReview()");
    expect(shell).not.toContain("reviewScope");
    expect(shell).toContain("loadLockedRegulatorySnapshot");
    expect(shell).toContain("missingLockedRegulatorySnapshot");

    const relevance = step.indexOf("relevantChangesForConditionIds");
    const recommendCall = step.indexOf("recommend(");
    expect(relevance).toBeGreaterThanOrEqual(0);
    expect(recommendCall).toBeGreaterThan(relevance);
    expect(step).toContain("regSnapshot=${encodeURIComponent(snapshot.snapshotId)}");
  });

  it("keeps Step 6 on the locked snapshot and fails closed if that lock disappears", () => {
    const shell = fs.readFileSync("src/app/secondary/evidence/page.tsx", "utf8");
    const step = fs.readFileSync("src/components/secondary/steps/EvidenceStep.tsx", "utf8");

    expect(shell).toContain("loadLockedRegulatorySnapshot");
    expect(shell).toContain("missingLockedRegulatorySnapshot(lockedSnapshotId)");
    expect(shell).not.toContain("reviewScope");
    expect(step).toContain("recommend(");
    expect(step).toContain("/secondary/suggestions?regSnapshot=");
  });
});

describe("regulatory preflight XML entity decoding", () => {
  it("decodes valid decimal and hex character references", () => {
    expect(parseXml("<r><t>&#65;&#x42;</t></r>").children[0].children[0].text).toBe("AB");
  });

  it("degrades out-of-range numeric references to literal text instead of throwing", () => {
    expect(() => parseXml("<r><t>&#99999999999;</t></r>")).not.toThrow();
    expect(parseXml("<r><t>&#99999999999;</t></r>").children[0].children[0].text).toContain("&#99999999999;");
  });

  it("degrades surrogate code points to literal text instead of throwing", () => {
    expect(() => parseXml("<r><t>&#xD800;</t></r>")).not.toThrow();
    expect(parseXml("<r><t>&#x2F;</t></r>").children[0].children[0].text).toBe("/");
  });

  it("keeps htmlText safe for malformed numeric entities", () => {
    expect(() => htmlText("title &#x110000; excerpt")).not.toThrow();
  });
});
