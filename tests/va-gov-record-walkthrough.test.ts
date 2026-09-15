import { describe, expect, it } from "vitest";
import fs from "node:fs";

import {
  VA_GOV_WALKTHROUGH_DISCLAIMER,
  VA_GOV_WALKTHROUGH_STEPS,
  formatVaGovRecordWalkthrough,
} from "@/lib/secondary-workflow/va-gov-record-walkthrough";
import {
  secondaryWorkflowLocalStorageKeys,
  vaGovRecordWalkthroughStorageKey,
} from "@/lib/secondary-workflow/local-state";

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(`${process.cwd()}/${relativePath}`, "utf8");
}

const EXPECTED_URL_FRAGMENTS: ReadonlyArray<{ id: string; fragment: string }> = [
  { id: "sign-in-start", fragment: "https://www.va.gov/?next=loginModal&oauth=true" },
  { id: "post-login", fragment: "https://www.va.gov/my-va/?postLogin=true" },
  { id: "my-health", fragment: "https://www.va.gov/my-health" },
  { id: "medical-records", fragment: "https://www.va.gov/my-health/medical-records/" },
  { id: "download-tool", fragment: "https://www.va.gov/my-health/medical-records/download" },
  { id: "date-range", fragment: "https://www.va.gov/my-health/medical-records/download/date-range" },
  { id: "record-type", fragment: "https://www.va.gov/my-health/medical-records/download/record-type" },
  { id: "file-type", fragment: "https://www.va.gov/my-health/medical-records/download/file-type" },
];

describe("VA.gov medical records download walkthrough", () => {
  it("authors the full VA.gov → ID.me → MFA → my-va → my-health → download flow in order", () => {
    const ids = VA_GOV_WALKTHROUGH_STEPS.map((step) => step.id);
    expect(ids).toEqual([
      "sign-in-start",
      "idme-email",
      "idme-password",
      "idme-mfa",
      "idme-mfa-phone",
      "idme-mfa-code",
      "post-login",
      "my-health",
      "medical-records",
      "download-tool",
      "date-range",
      "record-type",
      "file-type",
      "download-report",
    ]);

    for (const { id, fragment } of EXPECTED_URL_FRAGMENTS) {
      const step = VA_GOV_WALKTHROUGH_STEPS.find((candidate) => candidate.id === id);
      expect(step, `step ${id} should exist`).toBeDefined();
      expect(step?.url, `step ${id} should carry the real VA.gov URL`).toContain(fragment);
    }

    // ID.me steps are described but never linked — users are already inside
    // the VA.gov-initiated flow at that point, and ID.me URLs include
    // session/event identifiers that must not be authored as stable links.
    for (const id of ["idme-email", "idme-password", "idme-mfa", "idme-mfa-phone", "idme-mfa-code"]) {
      const step = VA_GOV_WALKTHROUGH_STEPS.find((candidate) => candidate.id === id);
      expect(step, `step ${id} should exist`).toBeDefined();
      expect(step?.url, `step ${id} should not carry a hard-coded ID.me URL`).toBeUndefined();
    }

    // Selections the user described, pinned in the step details.
    const joinedDetails = VA_GOV_WALKTHROUGH_STEPS.map((step) => step.detail).join(" ");
    expect(joinedDetails).toMatch(/All time/);
    expect(joinedDetails).toMatch(/Select all VA records/);
    expect(joinedDetails).toMatch(/PDF/);
    expect(joinedDetails).toMatch(/Download report/);

    const downloadStep = VA_GOV_WALKTHROUGH_STEPS.at(-1);
    expect(downloadStep?.final).toBe(true);
  });

  it("covers alternate MFA methods without inventing new steps, and tells the user where the PDF lands", () => {
    const mfaStep = VA_GOV_WALKTHROUGH_STEPS.find((step) => step.id === "idme-mfa");
    expect(mfaStep?.note).toBeDefined();
    expect(mfaStep?.note).toMatch(/authenticator app/i);
    expect(mfaStep?.note).toMatch(/security key|passkey/i);
    expect(mfaStep?.note).toMatch(/PIV\/CAC/i);
    // The note is variation guidance only — the authored step list must not grow.
    expect(VA_GOV_WALKTHROUGH_STEPS.filter((step) => step.id.startsWith("idme-mfa"))).toHaveLength(3);

    const downloadStep = VA_GOV_WALKTHROUGH_STEPS.at(-1);
    expect(downloadStep?.note).toMatch(/Can't find the file\?/);
    expect(downloadStep?.note).toMatch(/Downloads \(Ctrl\+J|Desktop/);

    const component = readRepoFile("src/components/secondary/VaGovRecordWalkthrough.tsx");
    expect(component).toContain("{step.note && (");
  });

  it("never collects credentials, MFA codes, or session data — the sign-in happens on VA.gov", () => {
    const dataModule = readRepoFile("src/lib/secondary-workflow/va-gov-record-walkthrough.ts");
    const component = readRepoFile("src/components/secondary/VaGovRecordWalkthrough.tsx");
    const page = readRepoFile("src/app/secondary/upload/page.tsx");

    for (const source of [dataModule, component, page]) {
      expect(source).not.toMatch(/type=["']password["']/);
      expect(source).not.toContain("autoComplete=\"current-password\"");
      expect(source).not.toContain("sendBeacon");
    }

    expect(component).not.toContain("fetch(");
    expect(dataModule).not.toContain("fetch(");
    expect(component).not.toContain("XMLHttpRequest");
    expect(component).not.toContain("WebSocket");

    // Copy is explicit that credentials never reach this app.
    expect(component).toContain("the app never sees your credentials");
    expect(dataModule).toContain("never collects, transmits, or stores");
    expect(component).toContain('target="_blank"');
    expect(component).toContain('rel="noreferrer"');
  });

  it("keeps progress in the registered tab-scoped sessionStorage store and nowhere else", () => {
    expect(vaGovRecordWalkthroughStorageKey).toBe(
      "secondary-condition-finder:va-gov-record-walkthrough:v1",
    );
    expect(secondaryWorkflowLocalStorageKeys).toContain(vaGovRecordWalkthroughStorageKey);

    const component = readRepoFile("src/components/secondary/VaGovRecordWalkthrough.tsx");
    expect(component).toContain('"use client"');
    expect(component).toContain("vaGovRecordWalkthroughStorageKey");
    expect(component).toContain("useSyncExternalStore");
    expect(component).toContain("window.sessionStorage.setItem");
    expect(component).toContain("window.sessionStorage.removeItem");
    expect(component).not.toContain("localStorage");
    expect(component).not.toContain("document.cookie");
  });

  it("provides a Clear progress reset that removes the tab-local store", () => {
    const component = readRepoFile("src/components/secondary/VaGovRecordWalkthrough.tsx");
    expect(component).toContain("Clear progress");
    expect(component).toContain("disabled={checkedCount === 0}");
  });

  it("wires the walkthrough onto the Step 4 documents page above the local evidence analyzer", () => {
    const page = readRepoFile("src/app/secondary/upload/page.tsx");
    expect(page).toContain('import { VaGovRecordWalkthrough } from "@/components/secondary/VaGovRecordWalkthrough";');
    expect(page.indexOf("<VaGovRecordWalkthrough />")).toBeGreaterThan(-1);
    expect(page.indexOf("<VaGovRecordWalkthrough />")).toBeLessThan(page.indexOf("<LocalEvidenceAnalyzer"));
  });

  it("formats a text export with numbered steps, links, and the disclaimer", () => {
    const exported = formatVaGovRecordWalkthrough();
    expect(exported).toContain("VA.GOV MEDICAL RECORDS DOWNLOAD WALKTHROUGH");
    expect(exported).toContain("1. Sign in on VA.gov");
    expect(exported).toContain(`14. Download report`);
    expect(exported).toContain("Link: https://www.va.gov/my-health/medical-records/download/file-type");
    expect(exported).toContain("DISCLAIMER");
    expect(exported).toContain(VA_GOV_WALKTHROUGH_DISCLAIMER);
  });

  it("does not overstate the aid: disclaims VA guidance and VA.gov flow drift", () => {
    expect(VA_GOV_WALKTHROUGH_DISCLAIMER).toContain("not VA guidance");
    expect(VA_GOV_WALKTHROUGH_DISCLAIMER).toContain("VA.gov may change");
    expect(VA_GOV_WALKTHROUGH_DISCLAIMER).toContain("never sees or stores");
  });
});
