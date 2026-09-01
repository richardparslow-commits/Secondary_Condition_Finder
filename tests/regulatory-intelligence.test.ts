import { describe, expect, it } from "vitest";

import {
  authorityStatusAsOf,
  buildRegulatoryLineage,
  deriveCommentStatus,
  deriveLifecycleState,
  normalizeFederalRegisterApiDocument,
  normalizeOiraMeetingRecord,
  normalizeOiraReviewRecord,
  normalizeReginfoAgendaRecord,
  parseAgendaPlannedDate,
  regulatoryActionSchema,
  sourceAuthenticitySchema,
} from "@/lib/regulatory";

const reginfoAuthenticity = {
  publisher: "reginfo-oira" as const,
  legalEditionStatus: "planning-review-metadata" as const,
  officialEditionVerified: false,
};

const officialFrAuthenticity = {
  publisher: "federalregister-gov" as const,
  legalEditionStatus: "informational-unofficial" as const,
  officialEditionVerified: true,
  officialEditionSource: "govinfo" as const,
  officialEditionUrl: "https://www.govinfo.gov/content/pkg/FR-2026-01-01/pdf/example.pdf",
  verifiedOn: "2026-08-18",
};

const baseAction = {
  rin: "2900-AQ73",
  title: "Example VA rating schedule action",
  agency: { department: "Department of Veterans Affairs" },
  relatedRins: [],
  cfrReferences: [{ title: 38, part: 4 }],
  legalAuthorities: ["38 U.S.C. 1155"],
  agenda: [],
  oiraReviews: [],
  oiraMeetingAvailability: "unknown" as const,
  oiraMeetings: [],
  federalRegisterDocuments: [],
};

describe("regulatory date precision", () => {
  it("preserves month-only Unified Agenda dates instead of inventing a day", () => {
    expect(parseAgendaPlannedDate("04/00/2027")).toMatchObject({ value: "2027-04", precision: "month", status: "anticipated" });
    expect(parseAgendaPlannedDate("00/00/2027")).toMatchObject({ value: "2027", precision: "year" });
  });
});

describe("OIRA/Reginfo normalization", () => {
  it("keeps Unified Agenda and OIRA review metadata non-authoritative", () => {
    const agenda = normalizeReginfoAgendaRecord({
      rin: "2900-AQ73",
      publicationId: "2026",
      edition: "2026 Unified Agenda",
      stage: "Final Rule Stage",
      plannedActions: [{ action: "Final Action", date: "04/00/2027" }],
      sourceUrl: "https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=2900-AQ73",
    });
    expect(agenda.authenticity.legalEditionStatus).toBe("planning-review-metadata");
    expect(agenda.plannedActions[0].date.precision).toBe("month");

    const review = normalizeOiraReviewRecord({
      reviewId: "123456",
      rin: "2900-AQ73",
      status: "concluded",
      stage: "Final Rule",
      receivedOn: "2026-06-01",
      concludedOn: "2026-07-01",
      conclusion: "Consistent with Change",
      sourceUrl: "https://www.reginfo.gov/public/do/eoDetails?rrid=123456",
    });
    expect(review.authorityUse).toBe("review-metadata-only");
    expect(review.authenticity.legalEditionStatus).toBe("planning-review-metadata");
  });

  it("marks EO 12866 stakeholder meetings as context only", () => {
    const meeting = normalizeOiraMeetingRecord({
      meetingId: "m-1",
      rin: "2900-AQ73",
      scheduledOn: "2026-07-15",
      status: "completed",
      sourceUrl: "https://www.reginfo.gov/public/do/eo/neweomeeting",
    });
    expect(meeting.authorityUse).toBe("policy-development-context-only");
  });
});

describe("source authenticity", () => {
  it("rejects FederalRegister.gov as the official legal edition", () => {
    const result = sourceAuthenticitySchema.safeParse({
      publisher: "federalregister-gov",
      legalEditionStatus: "official-legal-edition",
      officialEditionVerified: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects Reginfo metadata promoted to binding legal status", () => {
    const result = sourceAuthenticitySchema.safeParse({
      publisher: "reginfo-oira",
      legalEditionStatus: "official-legal-edition",
      officialEditionVerified: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("Federal Register normalization and authority-as-of", () => {
  it("keeps proposed rules nonbinding and tracks comment status", () => {
    const document = normalizeFederalRegisterApiDocument({
      document_number: "2026-12345",
      title: "Example VA proposed rule",
      type: "PRORULE",
      publication_date: "2026-06-01",
      comments_close_on: "2026-08-01",
      regulation_id_numbers: ["2900-AQ73"],
      docket_ids: ["VA-2026-VBA-0001"],
      html_url: "https://www.federalregister.gov/documents/2026/06/01/2026-12345/example",
    }, { asOf: "2026-07-01" });

    expect(document.legalStatus).toBe("nonbinding-proposal");
    expect(deriveCommentStatus(document.publicParticipation, "2026-07-01")).toBe("open");
    expect(authorityStatusAsOf(document, "2026-07-01").binding).toBe(false);
  });

  it("requires official-edition verification for binding final-rule records", () => {
    const action = regulatoryActionSchema.safeParse({
      ...baseAction,
      federalRegisterDocuments: [{
        documentNumber: "2026-22222",
        title: "Example final rule",
        type: "rule",
        publicationDate: "2026-07-01",
        effectiveDate: "2026-08-01",
        applicability: [],
        legalStatus: "effective",
        rin: "2900-AQ73",
        relatedRins: [],
        docketIds: [],
        cfrReferences: [{ title: 38, part: 4 }],
        federalRegisterUrl: "https://www.federalregister.gov/documents/2026/07/01/2026-22222/example",
        authenticity: {
          publisher: "federalregister-gov",
          legalEditionStatus: "informational-unofficial",
          officialEditionVerified: false,
        },
        correctsDocumentNumbers: [],
        supersedesDocumentNumbers: [],
        notes: [],
      }],
    });
    expect(action.success).toBe(false);
  });
});

describe("lifecycle and lineage", () => {
  it("does not treat a Final Rule Stage Agenda entry as current law", () => {
    const action = regulatoryActionSchema.parse({
      ...baseAction,
      agenda: [{
        publicationId: "2026",
        edition: "2026",
        stage: "final-rule",
        includedInRegulatoryPlan: true,
        plannedActions: [{ action: "Final Action", date: { value: "2027-04", precision: "month", status: "anticipated" } }],
        sourceUrl: "https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=2900-AQ73",
        authenticity: reginfoAuthenticity,
      }],
    });
    expect(deriveLifecycleState(action, "2026-08-18")).toBe("agenda-planned");
  });

  it("becomes effective only on the final rule effective date", () => {
    const action = regulatoryActionSchema.parse({
      ...baseAction,
      federalRegisterDocuments: [{
        documentNumber: "2026-22222",
        title: "Example final rule",
        type: "rule",
        publicationDate: "2026-07-01",
        effectiveDate: "2026-09-01",
        applicability: [],
        legalStatus: "published-not-effective",
        rin: "2900-AQ73",
        relatedRins: [],
        docketIds: [],
        cfrReferences: [{ title: 38, part: 4 }],
        federalRegisterUrl: "https://www.federalregister.gov/documents/2026/07/01/2026-22222/example",
        govinfoPdfUrl: officialFrAuthenticity.officialEditionUrl,
        authenticity: officialFrAuthenticity,
        correctsDocumentNumbers: [],
        supersedesDocumentNumbers: [],
        notes: [],
      }],
    });
    expect(deriveLifecycleState(action, "2026-08-18")).toBe("final-published");
  });

  it("links corrections and related regulatory records into one graph", () => {
    const graph = buildRegulatoryLineage([regulatoryActionSchema.parse({ ...baseAction })]);
    expect(graph.nodes.some((node) => node.id === "rin:2900-AQ73")).toBe(true);
  });
});
