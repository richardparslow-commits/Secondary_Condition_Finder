import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKbGraphFromDir } from "@/lib/kb/graph";
import { conditionMappingSchema, KbNodeMappingSchema, suggestionSchema } from "@/lib/kb/schema";
import { assertNoForbiddenPhrases, assertNoQuarantinedPointerGraphNodes, validateKnowledgeBaseAgainstCatalog } from "@/lib/kb/validate";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { assertAcyclic, assertSafeOutput, buildStaging, convertRow, parseProjection, sha256, writeStaging } from "../scripts/convert-crg-packets";
import { CRG_PACKET_PLAN } from "../scripts/lib/crg-packet-plan";

const root = process.cwd();
const result = buildStaging(root);
const temporary = mkdtempSync(path.join(os.tmpdir(), "crg-converter-test-"));
const output = path.relative(root, mkdtempSync(path.join(root, "docs/crg-converter-test-")));
const freshOutput = `${output}/staged`;
afterAll(() => {
  rmSync(temporary, { recursive: true });
  rmSync(path.join(root, output), { recursive: true });
});

function converted(proposal: (typeof result.manifest.proposals)[number]) {
  const mapping = result.authored.find((entry) => entry.id === proposal.primaryId)!;
  return mapping.suggestions.find((entry) => entry.conditionId === proposal.secondaryId)!;
}

const first = result.manifest.proposals[0];
const clone = <T,>(value: T): T => structuredClone(value);

function assertInputsUnchanged() {
  for (const input of result.manifest.inputFiles) expect(sha256(readFileSync(path.join(root, input.path), "utf8")), input.path).toBe(input.sha256);
}

describe("CRG packet staging converter", () => {
  it("converts all 13 waves, 65 rows and 195 clinical reference uses", () => {
    expect(result.manifest.counts).toMatchObject({ waves: 13, proposals: 65, uniqueSecondaryIds: 64, hosts: 28, clinicalReferenceUses: 195, uniqueClinicalUrls: 195, graphEdges: 64, publicationReady: 0 });
    expect(result.authored.flatMap((mapping) => mapping.suggestions)).toHaveLength(65);
    for (const mapping of result.authored) {
      expect(conditionMappingSchema.safeParse(mapping).success).toBe(true);
      expect(mapping.draft).toBe(true);
      expect(mapping.todo.length).toBeGreaterThan(0);
      expect(mapping.suggestions.map((suggestion) => suggestion.rank)).toEqual(mapping.suggestions.map((_, index) => index + 1));
      for (const suggestion of mapping.suggestions) expect(suggestionSchema.safeParse(suggestion).success).toBe(true);
    }
  });

  it("preserves every raw field and ordered evidence item without rewriting the original packets", () => {
    for (const proposal of result.manifest.proposals) {
      const raw = JSON.parse(readFileSync(path.join(root, proposal.packet), "utf8"))[proposal.row - 1];
      expect(proposal.originalRow).toEqual(raw);
      const suggestion = converted(proposal);
      for (const key of ["secondaryCondition", "secondaryDiagnosticCode", "primaryCondition", "primaryDiagnosticCode", "nexusTheory", "etiologicalMechanism"] as const) expect(suggestion.rationale).toContain(raw[key]);
      expect(suggestion.rationale).toContain(JSON.stringify(raw.cfrCitations, null, 2));
      raw.medicalEvidence.forEach((evidence: { title: string; authors: string; summary: string; url: string }, index: number) => {
        const reference = suggestion.sourceReferences[index];
        expect(reference.citation).toContain(evidence.title);
        expect(reference.citation).toContain(evidence.authors);
        expect(reference.note).toBe(evidence.summary);
        expect(reference.sourceUrl).toBe(evidence.url);
      });
    }
    assertInputsUnchanged();
  });

  it("normalizes all patient-level probability while recording each of the 25 changed labels", () => {
    expect(result.manifest.probabilityNormalizations).toHaveLength(25);
    for (const suggestion of result.authored.flatMap((mapping) => mapping.suggestions)) {
      expect(suggestion.evidentiaryProfile.vaNexusProbabilityAlignment).toBe("NOT_ASSERTED");
      expect(suggestion.rationale).toContain("No individual probability is asserted here.");
      for (const reference of suggestion.sourceReferences) {
        expect(reference.verified).toBe(false);
        expect(reference.authorityCategory).toBe("medical-scientific-evidence");
        expect(reference.propositionRole).toBe("clinical-evidence");
        expect(reference).not.toHaveProperty("sourceCheckedOn");
        expect(reference).not.toHaveProperty("contentDigest");
      }
    }
  });

  it("keeps aggravation arms separate and conditional, with no invented patient baseline", () => {
    const aggravations = result.authored.flatMap((mapping) => mapping.suggestions).filter((suggestion) => suggestion.nexusClaim.nexusClassification === "AGGRAVATION");
    expect(aggravations).toHaveLength(3);
    for (const suggestion of aggravations) {
      expect(suggestion.nexusClaim.baselineProgression).toContain("No patient baseline has been supplied.");
      expect(suggestion.nexusClaim.aggravatingFactor).toContain("Proposed, not patient-established:");
      expect(suggestion.nexusClaim).not.toHaveProperty("etiologicalTrigger");
      expect(suggestion.claimTheories).toContain("secondary-aggravation");
    }
  });

  it("preserves contested tiers and requires specific DBQ evidence and distinct alternatives", () => {
    const contested = result.authored.flatMap((mapping) => mapping.suggestions).filter((suggestion) => suggestion.evidentiaryProfile.etiologicalConsensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE");
    expect(contested).toHaveLength(6);
    for (const suggestion of contested) {
      expect(suggestion.evidentiaryProfile.requiresSpecificDbqEvidence).toBe(true);
      expect(new Set(suggestion.evidentiaryProfile.alternativeEtiologiesToRuleOut).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports live publication, draft-selection, governance and registered-source conflicts", () => {
    expect(result.manifest.holdCounts).toMatchObject({ QUALIFIED_REVIEW_REQUIRED: 65, PUBLISHED_HOST_UNVERIFIED_REFERENCES: 45, TARGET_NOT_DRAFT: 7, HOST_GOVERNANCE_REVIEW: 4, TARGET_GOVERNANCE_REVIEW: 22, QUARANTINED_IDENTITY: 1, REGISTRY_IDENTIFIER_MATCH: 3 });
    const sourceHolds = result.manifest.proposals.flatMap((proposal) => proposal.holds).filter((hold) => hold.code === "REGISTRY_IDENTIFIER_MATCH");
    expect(sourceHolds.map((hold) => hold.detail).join(" ")).toContain("19233461 (superseded-unverified)");
    expect(sourceHolds.map((hold) => hold.detail).join(" ")).toContain("21509040 (pending-verification)");
    expect(sourceHolds.map((hold) => hold.detail).join(" ")).toContain("19439958 (pending-verification)");
    expect(result.manifest.proposals.every((proposal) => proposal.holds.length > 0)).toBe(true);
  });

  it("retains but quarantines the invalid identity rather than silently rehoming it", () => {
    const proposal = result.manifest.proposals.find((entry) => entry.secondaryId === "rotator-cuff-tear")!;
    expect(converted(proposal).conditionId).toBe("rotator-cuff-tear");
    expect(proposal.graphIncluded).toBe(false);
    expect(proposal.holds.find((hold) => hold.code === "QUARANTINED_IDENTITY")?.detail).toContain("rotator-cuff-injury");
    // The real validator finds pointers from the complete KB, not a additions-only subset.
    const combined = [...loadKnowledgeBase().filter((mapping) => !result.authored.some((staged) => staged.id === mapping.id)), ...result.authored];
    expect(() => validateKnowledgeBaseAgainstCatalog(loadConditionCatalog(), combined)).toThrow(/quarantined pointer/i);
    assertNoQuarantinedPointerGraphNodes(loadKnowledgeBase(), result.graph);
    assertNoForbiddenPhrases(result.authored);
  });

  it("runs staged graphs through the actual graph loader and cycle-audit CLI", () => {
    writeStaging(root, freshOutput, result);
    const nodes = loadKbGraphFromDir(path.join(root, freshOutput, "graph"));
    expect(nodes.size).toBe(28);
    expect([...nodes.values()].flatMap((node) => node.outgoingEdges)).toHaveLength(64);
    for (const node of nodes.values()) expect(KbNodeMappingSchema.safeParse(node).success).toBe(true);
    expect(execFileSync(process.execPath, ["--no-warnings", "scripts/audit-crg.ts", `--kb-dir=${freshOutput}/graph`], { cwd: root, encoding: "utf8" })).toContain("PASS");
    assertInputsUnchanged();
    const manifest = JSON.parse(readFileSync(path.join(root, freshOutput, "manifest.json"), "utf8"));
    for (const artifact of manifest.outputFiles) expect(sha256(readFileSync(path.join(root, freshOutput, artifact.path), "utf8"))).toBe(artifact.sha256);
  });

  it("rejects extra flat keys, noncanonical sources, duplicate evidence and identity/theory mismatches", () => {
    expect(() => convertRow({ ...first.originalRow, extra: "not permitted" }, first.projection, CRG_PACKET_PLAN[0][0], 1)).toThrow();
    const malformed = clone(first.originalRow);
    malformed.medicalEvidence[0].url = "https://example.com/unverified";
    expect(() => convertRow(malformed, first.projection, CRG_PACKET_PLAN[0][0], 1)).toThrow();
    const duplicate = clone(first.originalRow);
    duplicate.medicalEvidence[1] = clone(duplicate.medicalEvidence[0]);
    expect(() => convertRow(duplicate, first.projection, CRG_PACKET_PLAN[0][0], 1)).toThrow(/Duplicate clinical sources/);
    expect(() => convertRow(first.originalRow, first.projection, { ...CRG_PACKET_PLAN[0][0], target: "wrong-target" }, 1)).toThrow(/Identity plan mismatch/);
    expect(() => convertRow(first.originalRow, { ...first.projection, nexusClassification: "AGGRAVATION" }, CRG_PACKET_PLAN[0][0], 1)).toThrow(/theory/);
    const aggravation = result.manifest.proposals.find((proposal) => proposal.wave === 2 && proposal.row === 1)!;
    expect(() => convertRow(aggravation.originalRow, aggravation.projection, { ...CRG_PACKET_PLAN[1][0], baselineProgression: undefined }, 1)).toThrow(/separately authored/);
  });

  it("rejects reordered rows, edited clinical identities and reassigned hosts", () => {
    const sameHostRow = result.manifest.proposals.find((proposal) => proposal.wave === 1 && proposal.row === 4)!;
    expect(() => convertRow(sameHostRow.originalRow, first.projection, CRG_PACKET_PLAN[0][0], 1)).toThrow(/Packet identity binding mismatch/);
    for (const field of ["primaryCondition", "secondaryCondition"] as const) {
      expect(() => convertRow({ ...first.originalRow, [field]: "Different clinical identity" }, first.projection, CRG_PACKET_PLAN[0][0], 1)).toThrow(/Packet identity binding mismatch/);
    }
    expect(() => convertRow(first.originalRow, first.projection, { ...CRG_PACKET_PLAN[0][0], host: "rheumatoid-arthritis" }, 1)).toThrow(/Packet identity binding mismatch/);
  });

  it("preserves both separately authored aggravation narratives in canonical graph rationales", () => {
    const aggravations = result.authored.flatMap((mapping) => mapping.suggestions.map((suggestion) => ({ host: mapping.id, suggestion }))).filter(({ suggestion }) => suggestion.nexusClaim.nexusClassification === "AGGRAVATION");
    expect(aggravations).toHaveLength(3);
    for (const { host, suggestion } of aggravations) {
      const edge = result.graph.find((node) => node.nodeId === host)!.outgoingEdges.find((entry) => entry.targetConditionId === suggestion.conditionId)!;
      expect(edge.rationale).toContain(suggestion.nexusClaim.baselineProgression);
      expect(edge.rationale).toContain(suggestion.nexusClaim.aggravatingFactor);
      expect(edge.nexusClaim).not.toHaveProperty("baselineProgression");
      expect(edge.nexusClaim).not.toHaveProperty("aggravatingFactor");
      expect(KbNodeMappingSchema.safeParse(result.graph.find((node) => node.nodeId === host)).success).toBe(true);
    }
  });

  it("accepts annotated enums but refuses malformed, missing or extra projection rows", () => {
    const text = readFileSync(path.join(root, first.validationRecord), "utf8");
    expect(parseProjection(text)).toHaveLength(5);
    expect(() => parseProjection(text.replace("| MULTIFACTORIAL |", "| NOT_AN_ENUM |"))).toThrow();
    expect(() => parseProjection(text.replace("| MULTIFACTORIAL |", "| MULTIFACTORIAL (bad | annotation) |"))).toThrow();
    const missingRow = text.replace(/^\| PTH ← TBI \|.*\n/m, "");
    expect(missingRow).not.toBe(text);
    expect(() => parseProjection(missingRow)).toThrow(/five projection rows/);
    expect(() => parseProjection(`${text}\n${text}`)).toThrow(/exactly one/);
  });

  it("refuses live corpus output, existing destinations and symlink escapes", () => {
    expect(() => assertSafeOutput(root, "data/knowledge-base/new-output")).toThrow(/live corpus/);
    expect(() => assertSafeOutput(root, "docs")).toThrow();
    expect(() => assertSafeOutput(root, output)).toThrow(/never overwritten/);
    symlinkSync(temporary, path.join(root, output, "escape"));
    expect(() => assertSafeOutput(root, `${output}/escape/new-output`)).toThrow(/symlink/);
    const refusal = spawnSync(process.execPath, ["--no-warnings", "scripts/convert-crg-packets.ts", "--out=data/knowledge-base/forbidden-output"], { cwd: root, encoding: "utf8" });
    expect(refusal.status).toBe(1);
    expect(refusal.stderr).toContain("live corpus writes are refused");
    expect(existsSync(path.join(root, "data/knowledge-base/forbidden-output"))).toBe(false);
    assertInputsUnchanged();
  });

  it("fails if any captured input changed before writing", () => {
    const fixture = path.join(temporary, "changed-input");
    mkdirSync(path.join(fixture, "docs"), { recursive: true });
    writeFileSync(path.join(fixture, "input.json"), "changed");
    const changed = { ...result, manifest: { ...result.manifest, inputFiles: [{ path: "input.json", sha256: sha256("original") }] } };
    expect(() => writeStaging(fixture, "docs/output", changed)).toThrow(/Input changed/);
    expect(existsSync(path.join(fixture, "docs/output"))).toBe(false);
  });

  it("rejects graph cycles rather than pruning or weakening a proposed edge", () => {
    const node = clone(result.graph.find((entry) => entry.outgoingEdges.length > 0)!);
    const target = node.outgoingEdges[0].targetConditionId;
    const reverse = { nodeId: target, outgoingEdges: [{ ...clone(node.outgoingEdges[0]), sourceConditionId: target, targetConditionId: node.nodeId, rank: 1 }] };
    expect(() => assertAcyclic([node, reverse])).toThrow(/Staged graph cycle/);
  });

  it("tests the delivered converter CLI and fresh serialized artifacts", () => {
    const cliOutput = `${output}/cli-output`;
    const stdout = execFileSync(process.execPath, ["--no-warnings", "scripts/convert-crg-packets.ts", `--out=${cliOutput}`], { cwd: root, encoding: "utf8" });
    expect(JSON.parse(stdout).proposals).toBe(65);
    const authored = JSON.parse(readFileSync(path.join(root, cliOutput, "authored-mappings.json"), "utf8"));
    expect(authored).toEqual(result.authored);
    expect(readdirSync(path.join(root, cliOutput, "graph"))).toHaveLength(28);
    const deliveredDir = path.join(root, "docs/crg-staging-2026-10-06");
    expect(JSON.parse(readFileSync(path.join(deliveredDir, "authored-mappings.json"), "utf8"))).toEqual(result.authored);
    const delivered = JSON.parse(readFileSync(path.join(deliveredDir, "manifest.json"), "utf8"));
    const { outputFiles, ...deliveredManifest } = delivered;
    expect(deliveredManifest).toEqual(result.manifest);
    for (const artifact of outputFiles) expect(sha256(readFileSync(path.join(deliveredDir, artifact.path), "utf8"))).toBe(artifact.sha256);
    assertInputsUnchanged();
  });
});
