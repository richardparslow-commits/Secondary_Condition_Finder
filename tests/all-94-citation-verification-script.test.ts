import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scriptPath = path.join(root, "scripts", "apply-all-94-citation-verification.js");

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(): string {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "all-94-promotion-"));
  const kbDir = path.join(fixtureRoot, "data", "knowledge-base");
  const evidenceDir = path.join(fixtureRoot, "data", "evidence");
  const docsDir = path.join(fixtureRoot, "docs");
  fs.mkdirSync(kbDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const promotedSourceIds = Array.from({ length: 91 }, (_, index) => `pmid-${10000001 + index}`);
  const promotedRelationshipUses = Array.from({ length: 94 }, (_, index) => {
    const primaryId = `approved-primary-${String(index + 1).padStart(3, "0")}`;
    const targetId = `approved-target-${String(index + 1).padStart(3, "0")}`;
    const pmid = String(10000001 + (index % 91));
    return { primaryId, targetId, pmid };
  });

  for (let index = 0; index < 817; index += 1) {
    const primaryId = index < 94
      ? promotedRelationshipUses[index].primaryId
      : `placeholder-${String(index - 93).padStart(3, "0")}`;
    const suggestion = index < 94
      ? {
          conditionId: promotedRelationshipUses[index].targetId,
          sourceReferences: [{
            citation: `Synthetic clinical source PMID ${promotedRelationshipUses[index].pmid}.`,
            verificationScope: "clinical-evidence",
            sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${promotedRelationshipUses[index].pmid}/`,
            verified: false,
          }],
        }
      : undefined;
    writeJson(path.join(kbDir, `${primaryId}.json`), {
      id: primaryId,
      draft: index >= 139,
      suggestions: suggestion ? [suggestion] : [],
      unrelatedMetadata: { verified: false },
    });
  }

  const sources = promotedSourceIds.map((sourceId) => ({
    sourceId,
    status: "pending-verification",
    kind: "clinical-evidence",
    verified: false,
    verificationState: { qualifiedHumanCitationReviewRequired: true },
  }));
  for (let index = 0; index < 9; index += 1) {
    sources.push({
      sourceId: `lineage-${index + 1}`,
      status: "retired-only",
      kind: "clinical-evidence",
      verified: true,
      verificationState: { qualifiedHumanCitationReviewRequired: false },
    });
  }
  writeJson(path.join(evidenceDir, "master-sources.json"), {
    counts: {
      activeSourceEntities: 238,
      pendingVerificationSourceEntities: 91,
      activeClinicalSourceEntities: 237,
      pendingClinicalSourceEntities: 91,
    },
    sources,
  });
  writeJson(path.join(evidenceDir, "master-relationships.json"), { relationships: [] });
  fs.writeFileSync(path.join(docsDir, "kb-coverage-tracker.md"), "# Fixture tracker\n");
  writeJson(path.join(docsDir, "all-94-citation-verification-approved-ledger.json"), {
    ledgerStatus: "APPROVED-AND-APPLIED-LOCALLY — 94/94 VERIFIED",
    approvalDate: "2026-09-04",
    authorization: {
      liveReferencePromotions: 94,
      masterSourcePromotions: 91,
    },
    promotedSourceIds,
    promotedRelationshipUses,
  });

  return fixtureRoot;
}

function run(fixtureRoot: string, ...args: string[]): Record<string, unknown> {
  const output = execFileSync(process.execPath, [scriptPath, "--root", fixtureRoot, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return JSON.parse(output) as Record<string, unknown>;
}

describe("all-94 promotion script", () => {
  it("promotes only ledger-listed references and leaves unrelated verified fields unchanged", () => {
    const fixtureRoot = createFixture();
    try {
      const dryRun = run(fixtureRoot, "--dry-run");
      expect(dryRun).toMatchObject({
        status: "PASS",
        mode: "dry-run",
        approvedLiveReferences: 94,
        referencesToPromote: 94,
        sourceEntitiesToPromote: 91,
      });

      const beforeApply = JSON.parse(fs.readFileSync(
        path.join(fixtureRoot, "data", "knowledge-base", "approved-primary-001.json"),
        "utf8",
      )) as { suggestions: Array<{ sourceReferences: Array<{ verified: boolean }> }>; unrelatedMetadata: { verified: boolean } };
      expect(beforeApply.suggestions[0].sourceReferences[0].verified).toBe(false);
      expect(beforeApply.unrelatedMetadata.verified).toBe(false);

      const applied = run(fixtureRoot);
      expect(applied).toMatchObject({ status: "PASS", mode: "apply", referencesToPromote: 94, sourceEntitiesToPromote: 91 });

      const afterApply = JSON.parse(fs.readFileSync(
        path.join(fixtureRoot, "data", "knowledge-base", "approved-primary-001.json"),
        "utf8",
      )) as { suggestions: Array<{ sourceReferences: Array<{ verified: boolean }> }>; unrelatedMetadata: { verified: boolean } };
      expect(afterApply.suggestions[0].sourceReferences[0].verified).toBe(true);
      expect(afterApply.unrelatedMetadata.verified).toBe(false);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("is non-mutating in dry-run mode and accepts an already-promoted rerun", () => {
    const fixtureRoot = createFixture();
    try {
      const sourcePath = path.join(fixtureRoot, "data", "evidence", "master-sources.json");
      const beforeDryRun = fs.readFileSync(sourcePath, "utf8");
      const dryRun = run(fixtureRoot, "--dry-run");
      expect(dryRun).toMatchObject({ mode: "dry-run", referencesToPromote: 94, sourceEntitiesToPromote: 91 });
      expect(fs.readFileSync(sourcePath, "utf8")).toBe(beforeDryRun);

      run(fixtureRoot);
      const rerun = run(fixtureRoot);
      expect(rerun).toMatchObject({
        status: "PASS",
        mode: "apply",
        idempotent: true,
        referencesToPromote: 0,
        sourceEntitiesToPromote: 0,
      });
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("fails closed when an unverified reference is outside the approved ledger", () => {
    const fixtureRoot = createFixture();
    try {
      const filePath = path.join(fixtureRoot, "data", "knowledge-base", "approved-primary-001.json");
      const mapping = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        suggestions: Array<{ sourceReferences: unknown[] }>;
      };
      mapping.suggestions[0].sourceReferences.push({
        citation: "Synthetic unrelated PMID 19999999.",
        verificationScope: "clinical-evidence",
        verified: false,
      });
      writeJson(filePath, mapping);

      expect(() => run(fixtureRoot, "--dry-run")).toThrow(/outside the approved ledger/);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
