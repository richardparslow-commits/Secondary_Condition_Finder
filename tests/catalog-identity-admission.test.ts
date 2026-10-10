import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { inspectAdmission, prepareAdmission, dataSnapshot, ownerDecisionSchema } from "../scripts/catalog-identity-admission.ts";
import { loadConditionCatalog, resetConditionCatalogCache } from "@/lib/catalog/load";
import { resetKnowledgeBaseCache } from "@/lib/kb/load";
import { resetKbGraphCache } from "@/lib/kb/graph";

const ROOT = process.cwd();
const PROPOSAL = "docs/catalog-admissions/chronic-pain-proposal-v1.json";
const SCRIPT = path.join(ROOT, "scripts/catalog-identity-admission.ts");
const temporary: string[] = [];
let baseline: ReturnType<typeof inspectAdmission>;
let approvedRoot: string;
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-admission-"));
  temporary.push(root);
  for (const dir of ["data", "src", "scripts/lib"]) fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/catalog-admissions"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, PROPOSAL), path.join(root, PROPOSAL));
  for (const script of ["validate-knowledge-base.js", "build-client-corpus.mjs"]) fs.copyFileSync(path.join(ROOT, "scripts", script), path.join(root, "scripts", script));
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
  return root;
}
function approval(root: string) {
  const inspected = inspectAdmission(root, PROPOSAL);
  return {
    formatVersion: 1, proposalId: inspected.proposal.proposalId, proposalSha256: inspected.proposalSha256,
    baselineSha256: inspected.baselineSha256, outcome: "approved", owner: "SYNTHETIC TEST OWNER — NOT LIVE APPROVAL",
    decidedOn: "2026-10-08", decisionReference: "Synthetic fixture decision, not an owner approval of this repository",
    rationale: "Test the reviewed identity and unchanged draft restoration path only.", scope: "identity-and-draft-restoration-only",
    confirmations: { distinctIdentityReviewed: true, ratingScopeReviewed: true, unchangedDraftRestorationReviewed: true, noPublicationOrCitationVerification: true },
  };
}
function cli(root: string, ...args: string[]) {
  return spawnSync(process.execPath, ["--no-warnings", SCRIPT, ...args], { cwd: root, encoding: "utf8", timeout: 30_000 });
}
function reset() { resetConditionCatalogCache(); resetKnowledgeBaseCache(); resetKbGraphCache(); }

beforeAll(() => { baseline = inspectAdmission(ROOT, PROPOSAL); });
afterEach(() => { process.chdir(ROOT); reset(); });
// The approved candidate is used across tests and removed once this suite exits.
afterAll(() => { for (const root of temporary) fs.rmSync(root, { recursive: true, force: true }); });

describe("reviewed catalog identity admission", () => {
  it("keeps live chronic-pain pending, the frozen catalog unchanged, and the archive byte-identical", () => {
    expect(baseline.counts).toEqual({ before: 819, after: 820 });
    expect(loadConditionCatalog().some(condition => condition.id === "chronic-pain")).toBe(false);
    expect(fs.existsSync(path.join(ROOT, baseline.entry.originalPath))).toBe(false);
    expect(crypto.createHash("sha256").update(baseline.mappingBytes).digest("hex")).toBe(baseline.entry.sha256);
    const decision = ownerDecisionSchema.parse(read(path.join(ROOT, "docs/catalog-admissions/chronic-pain-review-v2/owner-decision.json")));
    expect(decision.outcome).toBe("pending");
    expect(decision.proposalSha256).toBe(baseline.proposalSha256);
    expect(decision.baselineSha256).toBe(baseline.baselineSha256);
    expect("owner" in decision).toBe(false);
  });

  it("records a pending decision through the CLI without producing runtime data", () => {
    const root = fixture();
    const before = dataSnapshot(root);
    const result = cli(root, `--proposal=${PROPOSAL}`, "--out=docs/pending");
    expect(result.status, result.stderr).toBe(0);
    const report = read(path.join(root, "docs/pending/admission-report.json"));
    expect(report.status).toBe("PENDING_OWNER_DECISION");
    expect(report.ownerDecision.outcome).toBe("pending");
    expect(report.checks[0].passed).toBe(true);
    expect(fs.existsSync(path.join(root, "docs/pending/data"))).toBe(false);
    expect(dataSnapshot(root)).toEqual(before);
  });

  it("honors an explicit rejection and never treats it as permission", () => {
    const root = fixture();
    const decision = approval(root);
    write(path.join(root, "docs/rejected.json"), {
      formatVersion: decision.formatVersion, proposalId: decision.proposalId,
      proposalSha256: decision.proposalSha256, baselineSha256: decision.baselineSha256,
      outcome: "rejected", owner: decision.owner, decidedOn: decision.decidedOn,
      decisionReference: decision.decisionReference, rationale: decision.rationale,
    });
    const report = prepareAdmission(root, PROPOSAL, "docs/rejected", "docs/rejected.json");
    expect(report.status).toBe("REJECTED");
    expect(fs.existsSync(path.join(root, "docs/rejected/data"))).toBe(false);
  });

  it("validates an approved isolated draft candidate through both real CLI checks", () => {
    approvedRoot = fixture();
    const before = dataSnapshot(approvedRoot);
    write(path.join(approvedRoot, "docs/approved.json"), approval(approvedRoot));
    const result = cli(approvedRoot, `--proposal=${PROPOSAL}`, "--out=docs/approved", "--decision=docs/approved.json");
    expect(result.status, result.stderr).toBe(0);
    const candidate = path.join(approvedRoot, "docs/approved");
    const report = read(path.join(candidate, "admission-report.json"));
    expect(report.status).toBe("VALIDATED_DRAFT_CANDIDATE_NOT_LANDED");
    expect(report.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    expect(report.checks.map((check: { name: string }) => check.name)).toContain("kb-validator");
    expect(report.checks.map((check: { name: string }) => check.name)).toContain("client-corpus");
    expect(fs.readFileSync(path.join(candidate, baseline.entry.originalPath))).toEqual(baseline.mappingBytes);
    expect(dataSnapshot(approvedRoot)).toEqual(before);
    expect(report.boundaries).toMatchObject({ liveDataWritten: false, quarantineModified: false, publicationApproved: false, citationVerificationPerformed: false, graphNodesAdded: 0 });
  });

  it("loads the new identity end-to-end and excludes its draft from published browser recommendations", async () => {
    expect(approvedRoot).toBeDefined();
    const candidate = path.join(approvedRoot, "docs/approved");
    process.chdir(candidate);
    // Runtime loaders capture process.cwd() at module initialization. Import
    // fresh modules under the candidate root, exactly as a new server does.
    vi.resetModules();
    const { loadConditionCatalog: candidateCatalog } = await import("@/lib/catalog/load");
    const { loadKnowledgeBase: candidateKb } = await import("@/lib/kb/load");
    const { loadKbGraph: candidateGraph } = await import("@/lib/kb/graph");
    const { findCondition } = await import("@/lib/catalog/lookup");
    const { buildClientCorpus, parseClientCorpus } = await import("@/lib/client-corpus/client-corpus");
    const catalog = candidateCatalog();
    const kb = candidateKb();
    const graph = candidateGraph();
    expect(catalog).toHaveLength(820);
    expect(kb).toHaveLength(820);
    expect(findCondition(catalog, "chronic pain")?.id).toBe("chronic-pain");
    expect(findCondition(catalog, "unexplained chronic pain")?.id).toBe("unexplained-chronic-pain");
    const restored = kb.find(mapping => mapping.id === "chronic-pain");
    expect(restored?.draft).toBe(true);
    expect(restored?.suggestions[0].nexusClaim.nexusClassification).toBe("AGGRAVATION");
    expect(restored?.suggestions[0].sourceReferences[0].verified).toBe(false);
    expect(graph.size).toBe(5);
    expect(graph.has("chronic-pain")).toBe(false);
    const built = buildClientCorpus(catalog, kb, [...graph.values()]);
    const fetched = parseClientCorpus(read(path.join(candidate, "public/kb/client-corpus.json")));
    expect(fetched).toEqual(built);
    expect(fetched.conditions.some(condition => condition.id === "chronic-pain")).toBe(true);
    expect(fetched.publishedMappings.some(mapping => mapping.id === "chronic-pain")).toBe(false);
  });

  it("refuses stale approvals, absent signoff and scope/provenance mutation", () => {
    const root = fixture();
    const approved = approval(root);
    for (const [index, decision] of [
      { ...approved, owner: "" },
      { ...approved, confirmations: { ...approved.confirmations, ratingScopeReviewed: false } },
      { ...approved, scope: "publish" },
      { ...approved, proposalSha256: "0".repeat(64) },
      { ...approved, baselineSha256: "0".repeat(64) },
      { ...approved, decidedOn: "2099-01-01" },
    ].entries()) {
      write(path.join(root, "docs/decision.json"), decision);
      expect(() => prepareAdmission(root, PROPOSAL, `docs/refused-${index}`, "docs/decision.json")).toThrow();
      expect(fs.existsSync(path.join(root, `docs/refused-${index}`))).toBe(false);
    }
    write(path.join(root, "docs/decision.json"), approved);
    const proposal = read(path.join(root, PROPOSAL));
    proposal.scope.definition += " Edited after signoff.";
    write(path.join(root, PROPOSAL), proposal);
    expect(() => prepareAdmission(root, PROPOSAL, "docs/stale", "docs/decision.json")).toThrow(/proposalSha256/);
    fs.copyFileSync(path.join(ROOT, PROPOSAL), path.join(root, PROPOSAL));
    fs.appendFileSync(path.join(root, "data/knowledge-base/hypertension.json"), "\n");
    expect(() => prepareAdmission(root, PROPOSAL, "docs/stale-data", "docs/decision.json")).toThrow(/baselineSha256/);
  });

  it("refuses alias capture, invented verification and re-rooting", () => {
    const root = fixture();
    const source = read(path.join(root, PROPOSAL));
    for (const [index, mutation] of [
      (proposal: typeof source) => { proposal.condition.aliases = ["unexplained chronic pain"]; },
      (proposal: typeof source) => { proposal.condition.ratingSchedule = [{ citation: "38 CFR test", note: "invented", verified: true }]; },
      (proposal: typeof source) => { proposal.condition.id = "new-id"; },
      (proposal: typeof source) => { proposal.restore.sha256 = "0".repeat(64); },
    ].entries()) {
      const changed = structuredClone(source);
      mutation(changed);
      write(path.join(root, PROPOSAL), changed);
      expect(() => inspectAdmission(root, PROPOSAL), `case ${index}`).toThrow();
    }
  });

  it("records a validator failure without calling the candidate admitted", () => {
    const root = fixture();
    write(path.join(root, "docs/approved.json"), approval(root));
    fs.writeFileSync(path.join(root, "scripts/validate-knowledge-base.js"), "console.error('synthetic validator failure'); process.exit(1);\n");
    expect(() => prepareAdmission(root, PROPOSAL, "docs/failed", "docs/approved.json")).toThrow(/kb-validator failed/);
    const report = read(path.join(root, "docs/failed/admission-report.json"));
    expect(report.status).toBe("VALIDATION_FAILED_NOT_LANDED");
    expect(report.checks.some((check: { passed: boolean }) => !check.passed)).toBe(true);
    expect(fs.existsSync(path.join(root, baseline.entry.originalPath))).toBe(false);
  });

  it("refuses archive tampering, existing targets and unsafe output paths", () => {
    const root = fixture();
    const proposal = read(path.join(root, PROPOSAL));
    fs.appendFileSync(path.join(root, proposal.restore.quarantinePath), "\n");
    expect(() => inspectAdmission(root, PROPOSAL)).toThrow(/hash\/size/);
    fs.copyFileSync(path.join(ROOT, proposal.restore.quarantinePath), path.join(root, proposal.restore.quarantinePath));
    fs.symlinkSync(path.join(root, "data"), path.join(root, "docs/escape"), "dir");
    for (const out of ["data/new", "docs/../data/new", "docs/escape/new", "docs/catalog-admissions"]) {
      expect(() => prepareAdmission(root, PROPOSAL, out)).toThrow();
    }
    const report = prepareAdmission(root, PROPOSAL, "docs/fresh");
    expect(report.status).toBe("PENDING_OWNER_DECISION");
    expect(() => prepareAdmission(root, PROPOSAL, "docs/fresh")).toThrow(/never overwritten/);
  });
});
