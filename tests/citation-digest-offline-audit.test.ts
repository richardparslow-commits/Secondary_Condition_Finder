import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { volatileEntry } from "./helpers/citation-digest-exemption-fixtures";

const root = process.cwd();
const script = path.join(root, "scripts/audit-citation-verification.js");

type Audit = {
  verified: number;
  verifiedDigestExemptCount: number;
  verifiedDigestExemptionPendingCount: number;
  verifiedUndigestedActionableCount: number;
  hardFindings: string[];
};

function runAudit(mutate?: (directory: string) => void) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "citation-518-"));
  try {
    cpSync(path.join(root, "data"), path.join(directory, "data"), { recursive: true });
    mutate?.(directory);
    const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8", timeout: 15_000 });
    if (result.error) throw result.error;
    expect(result.stderr).toBe("");
    return { status: result.status, report: JSON.parse(result.stdout) as Audit };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function approveFixtureRegister(directory: string) {
  const file = path.join(directory, "data/citation-digest-exemptions.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  for (const entry of data.exemptions) {
    entry.review = { status: "approved", reviewer: "Synthetic test approval only", reviewedOn: new Date().toISOString().slice(0, 10) };
  }
  writeFileSync(file, JSON.stringify(data));
}

describe("offline citations:audit digest enforcement (#518)", () => {
  it("fails the real CLI for unapproved exemptions, rather than merely importing unused counters", () => {
    const { status, report } = runAudit();
    expect(status).toBe(1);
    expect(report.verified).toBe(398);
    expect(report.verifiedDigestExemptCount).toBe(0);
    expect(report.verifiedDigestExemptionPendingCount).toBe(394);
    expect(report.verifiedUndigestedActionableCount).toBe(398);
    expect(report.hardFindings.some((finding) => finding.includes("awaiting qualified-human approval"))).toBe(true);
  });

  it("passes only with approved fixture exemptions and the remaining four legacy digests outstanding", () => {
    const { status, report } = runAudit(approveFixtureRegister);
    expect(status).toBe(0);
    expect(report.verifiedDigestExemptCount).toBe(394);
    expect(report.verifiedUndigestedActionableCount).toBe(4);
    expect(report.hardFindings).toEqual([]);
  });

  it("fails at PR time when one additional verified source creates digest debt", () => {
    const { status, report } = runAudit((directory) => {
      approveFixtureRegister(directory);
      const file = path.join(directory, "data/knowledge-base/ocd.json");
      const mapping = JSON.parse(readFileSync(file, "utf8"));
      mapping.suggestions[0].sourceReferences.push({
        citation: "Synthetic source used only in a temporary test corpus",
        sourceUrl: "https://example.gov/new-stable-source",
        verified: true, sourceCheckedOn: new Date().toISOString().slice(0, 10),
        sourceLocator: "Test fixture", verificationScope: "legal-framework",
      });
      writeFileSync(file, JSON.stringify(mapping));
    });
    expect(status).toBe(1);
    expect(report.verifiedUndigestedActionableCount).toBe(5);
    expect(report.hardFindings.some((finding) => finding.includes("content-drift observability regressed"))).toBe(true);
  });

  it("does not grant waivers from an invalid register", () => {
    const { status, report } = runAudit((directory) => {
      writeFileSync(path.join(directory, "data/citation-digest-exemptions.json"), JSON.stringify({
        version: 99, exemptions: [volatileEntry()],
      }));
    });
    expect(status).toBe(1);
    expect(report.verifiedDigestExemptCount).toBe(0);
    expect(report.hardFindings.some((finding) => finding.includes("unsupported register version"))).toBe(true);
  });
});
