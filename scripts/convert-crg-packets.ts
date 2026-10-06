#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  conditionMappingSchema,
  etiologicalConsensusSchema,
  KbNodeMappingSchema,
  mechanismCategorySchema,
  nexusClassificationSchema,
  suggestionSchema,
  vaNexusProbabilityAlignmentSchema,
  type ConditionMapping,
  type KbNodeMapping,
  type Suggestion,
} from "../src/lib/kb/schema.ts";
import { CRG_PACKET_PLAN, type PacketRowPlan } from "./lib/crg-packet-plan.ts";

const evidenceSchema = z.object({
  title: z.string().trim().min(1),
  authors: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  url: z.string().regex(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/[1-9]\d*\/$/),
}).strict();

export const flatPacketRowSchema = z.object({
  secondaryCondition: z.string().trim().min(1),
  secondaryDiagnosticCode: z.string().trim().min(1),
  primaryCondition: z.string().trim().min(1),
  primaryDiagnosticCode: z.string().trim().min(1),
  nexusTheory: z.enum(["Causation", "Aggravation", "Medication Side Effect"]),
  etiologicalMechanism: z.string().min(50),
  medicalEvidence: z.array(evidenceSchema).length(3),
  cfrCitations: z.array(z.string().trim().min(1)).min(1),
}).strict();

type FlatRow = z.infer<typeof flatPacketRowSchema>;
export type Projection = {
  mapping: string;
  conditionId: string;
  nexusClassification: z.infer<typeof nexusClassificationSchema>;
  mechanismCategory: z.infer<typeof mechanismCategorySchema>;
  etiologicalConsensus: z.infer<typeof etiologicalConsensusSchema>;
  originalProbability: z.infer<typeof vaNexusProbabilityAlignmentSchema>;
  rawCells: string[];
};

type Hold = { code: string; detail: string };
type Proposal = {
  wave: number;
  row: number;
  primaryId: string;
  secondaryId: string;
  stagedRank: number;
  packet: string;
  validationRecord: string;
  originalRow: FlatRow;
  projection: Projection;
  holds: Hold[];
  graphIncluded: boolean;
};

export const STAGING_NOTICE = "Staging-only research proposal, not a signed medical opinion or publication approval. No patient records were supplied. No individual probability is asserted here. Population associations and mechanism plausibility do not establish an individual nexus.";
const REVIEW_GAP = "Qualified clinical/legal and claim-versus-source review, citation verification, source-status preflight and synchronized registry/graph authoring remain required; no automated verification or publication is performed.";
const INDIVIDUAL_GAP = "Obtain confirmed diagnoses, exposure/onset chronology, objective findings and treatment history; assess competing causes and the individual's evidence before any at least as likely as not conclusion.";
const AGGRAVATION_GAP = "For § 3.310(b), establish a qualifying medical baseline and an actual attributable increase beyond natural progression; no baseline or aggravation increment is fabricated here.";
const RATING_GAP = "Qualified-human review must establish claim-period Part 4 criteria, diagnostic-code applicability, analogous-rating scope where needed, and § 4.14 nonpyramiding.";

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function parseProjection(text: string): Projection[] {
  const sections = text.split(/^## /m).filter((section) => section.startsWith("Schema projection"));
  if (sections.length !== 1) throw new Error("Expected exactly one Schema projection section.");
  const table = sections[0].split("\n").filter((line) => line.startsWith("|"));
  const expected = ["Mapping", "conditionId (secondary)", "nexusClassification", "mechanismCategory", "etiologicalConsensus", "vaNexusProbabilityAlignment"];
  const cells = (line: string) => line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (JSON.stringify(cells(table[0] ?? "")) !== JSON.stringify(expected)) throw new Error("Unexpected projection table header.");
  if (!/^\|\s*---/.test(table[1] ?? "")) throw new Error("Missing projection table separator.");
  if (table.length !== 7) throw new Error("Expected exactly five projection rows.");
  const token = (cell: string) => {
    const match = /^([A-Z_]+)(?:\s+\(.+\))?$/.exec(cell);
    if (!match) throw new Error(`Malformed projection token: ${cell}`);
    return match[1];
  };
  return table.slice(2).map((line) => {
    const c = cells(line);
    if (c.length !== 6 || c.some((cell) => !cell)) throw new Error("Malformed six-column projection row.");
    return {
      mapping: c[0],
      conditionId: z.string().regex(/^[a-z0-9-]+$/).parse(c[1]),
      nexusClassification: nexusClassificationSchema.parse(token(c[2])),
      mechanismCategory: mechanismCategorySchema.parse(token(c[3])),
      etiologicalConsensus: etiologicalConsensusSchema.parse(token(c[4])),
      originalProbability: vaNexusProbabilityAlignmentSchema.parse(token(c[5])),
      rawCells: c,
    };
  });
}

export function convertRow(input: unknown, projection: Projection, plan: PacketRowPlan, rank: number): Suggestion {
  const row = flatPacketRowSchema.parse(input);
  if (projection.conditionId !== plan.target) throw new Error(`Identity plan mismatch: ${projection.conditionId} != ${plan.target}`);
  if (plan.host === plan.target) throw new Error("A proposal cannot target its own primary.");
  const expectedNexus = row.nexusTheory === "Aggravation" ? "AGGRAVATION" : "DIRECT_CAUSATION";
  if (projection.nexusClassification !== expectedNexus) throw new Error("Packet theory and projected nexus classification disagree.");
  if (row.nexusTheory === "Medication Side Effect" && !["PHARMACOLOGICAL_IATROGENIC", "POST_SURGICAL_OR_TREATMENT"].includes(projection.mechanismCategory)) {
    throw new Error("Medication/treatment theory requires an iatrogenic mechanism category.");
  }
  if (plan.alternatives.length < 2 || new Set(plan.alternatives).size !== plan.alternatives.length) throw new Error("Provide at least two distinct packet-grounded alternative etiologies.");
  if (new Set(row.medicalEvidence.map((evidence) => evidence.url)).size !== 3) throw new Error("Duplicate clinical sources within a proposal.");

  let nexusClaim: Suggestion["nexusClaim"];
  if (expectedNexus === "AGGRAVATION") {
    if (!plan.baselineProgression || !plan.aggravatingFactor) throw new Error("Aggravation requires separately authored baselineProgression and aggravatingFactor.");
    nexusClaim = { nexusClassification: "AGGRAVATION", baselineProgression: plan.baselineProgression, aggravatingFactor: plan.aggravatingFactor };
  } else {
    nexusClaim = { nexusClassification: "DIRECT_CAUSATION", etiologicalTrigger: `Proposed route from ${row.primaryCondition} to ${row.secondaryCondition}; individual attribution is not established.\n\n${row.etiologicalMechanism}` };
  }

  const evidenceGaps = [REVIEW_GAP, INDIVIDUAL_GAP, AGGRAVATION_GAP, RATING_GAP];
  const treatment = row.nexusTheory === "Medication Side Effect" || projection.mechanismCategory === "POST_SURGICAL_OR_TREATMENT";
  if (treatment) evidenceGaps.push("Verify the actual treatment indication linking the exposure to the service-connected primary, agent/procedure, dose/duration where applicable, pre-exposure status and latency; no rechallenge or unsupervised treatment change is recommended.");
  if (projection.originalProbability === "LEGALLY_PRESUMED") evidenceGaps.push("The original projection contains a conditional § 3.310(d) presumption proposal. Confirm the listed phenotype, TBI severity, onset window and regulatory applicability; no individual presumption eligibility is asserted by conversion.");
  const contested = projection.etiologicalConsensus === "CONTESTED_REQUIRES_SPECIFIC_EVIDENCE";
  if (contested) evidenceGaps.push("Contested nexus: retain the packet's direction, confounding and disease-scope limitations; specific DBQ/clinical evidence and at least two competing-etiology assessments are required.");

  const primaryVector = row.etiologicalMechanism.split(/\n\s*\n/)[0];
  return suggestionSchema.parse({
    conditionId: plan.target,
    rank,
    nexusClaim,
    causalMechanism: {
      mechanismCategory: projection.mechanismCategory,
      primaryVector,
      ...(treatment ? { iatrogenicFactor: `Treatment-related proposal; verify the actual indication and exposure described in: ${row.primaryCondition}` } : {}),
      hypothesizedOnly: false,
    },
    evidentiaryProfile: {
      etiologicalConsensus: projection.etiologicalConsensus,
      vaNexusProbabilityAlignment: "NOT_ASSERTED",
      conservativeRationale: `${STAGING_NOTICE} The projected etiological consensus describes the proposed literature-level relationship, not this veteran's probability. Original projection annotations: ${projection.rawCells.slice(2).join("; ")}. Original probability/presumption labels are retained only in provenance; converted probability is NOT_ASSERTED.`,
      evidenceGaps: evidenceGaps.join("\n\n"),
      alternativeEtiologiesToRuleOut: plan.alternatives,
      requiresSpecificDbqEvidence: contested,
    },
    rationale: `${STAGING_NOTICE}\n\nOriginal proposal mechanism (preserved verbatim):\n${row.etiologicalMechanism}\n\nPrimary condition: ${row.primaryCondition}\nPrimary diagnostic-code proposal: ${row.primaryDiagnosticCode}\nSecondary condition: ${row.secondaryCondition}\nSecondary diagnostic-code proposal: ${row.secondaryDiagnosticCode}\nOriginal nexus theory: ${row.nexusTheory}\nCFR citations (preserved in order):\n${JSON.stringify(row.cfrCitations, null, 2)}\n\nLegal boundary: § 3.310(a) concerns proximate causation; § 3.310(b) concerns attributable worsening beyond natural progression against a qualifying baseline. The at least as likely as not standard requires individual evidence and competing causes to be weighed. Apply claim-period rating criteria and § 4.14 nonpyramiding.`,
    claimTheories: [expectedNexus === "AGGRAVATION" ? "secondary-aggravation" : "secondary-causation", ...(projection.originalProbability === "LEGALLY_PRESUMED" ? ["presumptive"] : [])],
    nexusRequirement: projection.originalProbability === "LEGALLY_PRESUMED" ? "theory-dependent" : "individual-medical-opinion",
    pathwayIntelligence: {
      pathways: [expectedNexus === "AGGRAVATION" ? "aggravation" : projection.mechanismCategory === "POST_SURGICAL_OR_TREATMENT" ? "treatment-complication" : row.nexusTheory === "Medication Side Effect" ? "medication-related" : "direct-secondary"],
      developmentQuestions: ["Are both diagnoses confirmed and is the proposed temporal sequence documented?", "Which competing etiologies and packet-specific limitations have been assessed?"],
      issuesToResolve: ["Citation verification and governed publication approval remain open."],
    },
    evidenceGaps,
    sourceReferences: row.medicalEvidence.map((evidence) => ({
      citation: `${evidence.authors}. ${evidence.title} PMID ${evidence.url.split("/").at(-2)}.`,
      note: evidence.summary,
      verificationScope: "clinical-evidence",
      authorityCategory: "medical-scientific-evidence",
      propositionRole: "clinical-evidence",
      sourceUrl: evidence.url,
      verified: false,
    })),
  });
}

function readJsonFiles(dir: string): Array<{ file: string; content: string; value: unknown }> {
  return readdirSync(dir).filter((name) => name.endsWith(".json") && statSync(path.join(dir, name)).isFile()).sort().map((file) => {
    const content = readFileSync(path.join(dir, file), "utf8");
    return { file, content, value: JSON.parse(content) };
  });
}

export function assertAcyclic(nodes: readonly KbNodeMapping[]): void {
  const adjacency = new Map(nodes.map((node) => [node.nodeId, node.outgoingEdges.map((edge) => edge.targetConditionId)]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`Staged graph cycle: ${[...stack.slice(stack.indexOf(id)), id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of adjacency.get(id) ?? []) visit(target);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of [...adjacency.keys()].sort()) visit(id);
}

export function buildStaging(root: string = process.cwd()) {
  const inputs: Array<{ path: string; sha256: string }> = [];
  const capture = (relative: string) => {
    const content = readFileSync(path.join(root, relative), "utf8");
    inputs.push({ path: relative, sha256: sha256(content) });
    return content;
  };
  const corpusFiles = readJsonFiles(path.join(root, "data/knowledge-base"));
  const corpus = new Map(corpusFiles.map(({ file, value }) => {
    const mapping = conditionMappingSchema.parse(value);
    if (file !== `${mapping.id}.json`) throw new Error(`KB filename/identity mismatch: ${file}`);
    return [mapping.id, mapping] as const;
  }));
  const catalogFiles = readJsonFiles(path.join(root, "data/conditions"));
  const catalog = new Set(catalogFiles.flatMap(({ value }) => z.object({ conditions: z.array(z.object({ id: z.string() })) }).parse(value).conditions.map((condition) => condition.id)));
  for (const { file, content } of corpusFiles) inputs.push({ path: `data/knowledge-base/${file}`, sha256: sha256(content) });
  for (const { file, content } of catalogFiles) inputs.push({ path: `data/conditions/${file}`, sha256: sha256(content) });
  const sourceRegistry = capture("data/evidence/master-sources.json");
  const relationshipRegistry = capture("data/evidence/master-relationships.json");
  capture("src/lib/kb/schema.ts");
  capture("scripts/lib/crg-packet-plan.ts");
  capture("scripts/convert-crg-packets.ts");
  const mappings = new Map<string, ConditionMapping>();
  const proposals: Proposal[] = [];
  const pairs = new Set<string>();
  const registrySources = z.object({ sources: z.array(z.object({ sourceId: z.string(), pmid: z.string().nullable(), status: z.string() })) }).parse(JSON.parse(sourceRegistry)).sources;
  const registryPmids = new Map(registrySources.filter((source) => source.pmid !== null).map((source) => [source.pmid!, source]));
  const relationshipPmids = new Set(relationshipRegistry.match(/\b\d{6,9}\b/g) ?? []); // Supplemental identifier-level screen, not a source-status verdict.

  for (const [index, plans] of CRG_PACKET_PLAN.entries()) {
    const wave = index + 1;
    if (plans.length !== 5) throw new Error(`Wave ${wave} must have five identity plans.`);
    const packet = `docs/crg-draft-identity-mapping-packet${wave === 1 ? "" : `-wave${wave}`}-2026-10-05.json`;
    const validationRecord = `docs/crg-mapping-validation-2026-10-05${wave === 1 ? "" : `-wave-${wave}`}.md`;
    const rawRows: unknown = JSON.parse(capture(packet));
    // Preserve the unparsed JSON too; Zod's trim transformations must not change provenance.
    const rows = z.array(flatPacketRowSchema).length(5).parse(rawRows);
    const originalRows = z.array(z.unknown()).length(5).parse(rawRows) as FlatRow[];
    const recordText = capture(validationRecord);
    const projections = parseProjection(recordText);
    for (const [rowIndex, row] of rows.entries()) {
      const plan = plans[rowIndex];
      const host = corpus.get(plan.host);
      const target = corpus.get(plan.target);
      if (!host || !target || !catalog.has(plan.host) || !catalog.has(plan.target)) throw new Error(`Unknown catalog/KB identity in wave ${wave}, row ${rowIndex + 1}.`);
      const hostLine = recordText.split("\n").find((line) => line.startsWith(`| ${plan.target} |`) && /Chosen host primary/.test(recordText));
      if (wave >= 8 && (!hostLine || hostLine.split("|").at(-2)?.trim().split(/\s/)[0] !== plan.host)) throw new Error(`Host selection table disagrees with identity plan: wave ${wave}, row ${rowIndex + 1}.`);
      const pair = `${plan.host}->${plan.target}`;
      if (pairs.has(pair)) throw new Error(`Duplicate proposed relationship: ${pair}`);
      pairs.add(pair);
      let mapping = mappings.get(plan.host);
      if (!mapping) {
        mapping = { id: plan.host, draft: true, todo: [REVIEW_GAP, "This file contains staged additions only, not a replacement for the live host. Preserve existing suggestions and publication state; reconcile ranks at landing."], governanceNotes: ["STAGING ONLY. All references remain verified:false. No live KB, graph, registry or publication-state changes are authorized by this artifact."], suggestions: [] };
        mappings.set(plan.host, mapping);
      }
      const rank = mapping.suggestions.length + 1;
      const suggestion = convertRow(originalRows[rowIndex], projections[rowIndex], plan, rank);
      mapping.suggestions.push(suggestion);
      const holds: Hold[] = [{ code: "QUALIFIED_REVIEW_REQUIRED", detail: REVIEW_GAP }];
      if (!host.draft) holds.push({ code: "PUBLISHED_HOST_UNVERIFIED_REFERENCES", detail: "The live host is published; these verified:false additions cannot pass its citation-purity gate. Do not flip its draft state or replace the live file." });
      if (host.suggestions.some((existing) => existing.conditionId === plan.target)) holds.push({ code: "EXISTING_HOST_TARGET", detail: "The live authored host already contains this target; reconciliation is required, not append." });
      if (host.governanceNotes?.length) holds.push({ code: "HOST_GOVERNANCE_REVIEW", detail: "Review the current host governanceNotes; their presence is not automatically cleared or classified as a deferral." });
      if (target.governanceNotes?.length) holds.push({ code: "TARGET_GOVERNANCE_REVIEW", detail: "Review the current target governanceNotes; no governance disposition is overridden." });
      if (!target.draft) holds.push({ code: "TARGET_NOT_DRAFT", detail: "The original draft-target selection requirement was not met for this live identity; preserve that discrepancy for review." });
      const pointer = host.quarantine ?? target.quarantine;
      if (pointer) holds.push({ code: "QUARANTINED_IDENTITY", detail: `No graph inclusion or live claim is permitted for this pointer. Canonical identity is ${pointer.canonicalId}; changing the proposed target requires reviewed scope reconciliation.` });
      const reused = row.medicalEvidence.map((evidence) => evidence.url.split("/").at(-2)!).filter((pmid) => registryPmids.has(pmid) || relationshipPmids.has(pmid));
      if (reused.length) holds.push({ code: "REGISTRY_IDENTIFIER_MATCH", detail: `Identifier-level registry matches require evidence/redundancy and source-status review: ${reused.map((pmid) => `${pmid} (${registryPmids.get(pmid)?.status ?? "relationship-registry match"})`).join(", ")}.` });
      proposals.push({ wave, row: rowIndex + 1, primaryId: plan.host, secondaryId: plan.target, stagedRank: rank, packet, validationRecord, originalRow: originalRows[rowIndex], projection: projections[rowIndex], holds, graphIncluded: !pointer });
    }
  }
  if (proposals.length !== 65) throw new Error("Expected all 65 proposals from 13 waves.");
  const authored = [...mappings.values()].sort((a, b) => a.id.localeCompare(b.id)).map((mapping) => conditionMappingSchema.parse(mapping));
  const graph = authored.map((mapping) => KbNodeMappingSchema.parse({
    nodeId: mapping.id,
    outgoingEdges: mapping.suggestions.filter((suggestion) => proposals.find((proposal) => proposal.primaryId === mapping.id && proposal.secondaryId === suggestion.conditionId)?.graphIncluded).map((suggestion, index) => ({
      sourceConditionId: mapping.id,
      targetConditionId: suggestion.conditionId,
      rank: index + 1,
      nexusClaim: { nexusClassification: suggestion.nexusClaim.nexusClassification },
      causalMechanism: suggestion.causalMechanism,
      evidentiaryProfile: suggestion.evidentiaryProfile,
      rationale: suggestion.rationale,
      evidenceGaps: suggestion.evidenceGaps,
    })),
  }));
  assertAcyclic(graph);
  const holdCounts: Record<string, number> = {};
  for (const proposal of proposals) for (const hold of proposal.holds) holdCounts[hold.code] = (holdCounts[hold.code] ?? 0) + 1;
  const clinicalUrls = proposals.flatMap((proposal) => proposal.originalRow.medicalEvidence.map((evidence) => evidence.url));
  return {
    authored,
    graph,
    manifest: {
      formatVersion: 1,
      status: "STAGING_ONLY_NOT_PUBLISHABLE",
      authorityBoundary: STAGING_NOTICE,
      schemaValidation: "All nested suggestions and staging-only host mappings pass the actual strict authored schemas. Catalog/quarantine publication approval is separate; the quarantined proposal is intentionally retained only for review and excluded from the staged graph.",
      counts: { waves: 13, proposals: proposals.length, uniqueSecondaryIds: new Set(proposals.map((proposal) => proposal.secondaryId)).size, hosts: authored.length, clinicalReferenceUses: clinicalUrls.length, uniqueClinicalUrls: new Set(clinicalUrls).size, graphEdges: graph.reduce((sum, node) => sum + node.outgoingEdges.length, 0), publicationReady: 0 },
      probabilityNormalizations: proposals.filter((proposal) => proposal.projection.originalProbability !== "NOT_ASSERTED").map((proposal) => ({ wave: proposal.wave, row: proposal.row, from: proposal.projection.originalProbability, to: "NOT_ASSERTED", reason: "No patient records or individual presumption eligibility were supplied." })),
      holdCounts,
      inputFiles: inputs.sort((a, b) => a.path.localeCompare(b.path)),
      proposals,
    },
  };
}

// Only create a fresh docs/ subdirectory. Resolve its ancestor so symlinked
// paths cannot redirect writes into data/, source files or an existing artifact.
export function assertSafeOutput(root: string, out: string): void {
  const docs = realpathSync(path.join(root, "docs"));
  const resolved = path.resolve(root, out);
  if (existsSync(resolved)) throw new Error("Output must be a new directory; existing artifacts are never overwritten.");
  const relative = path.relative(path.join(root, "docs"), resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new Error("Output must be a new subdirectory under docs/; live corpus writes are refused.");
  let ancestor = path.dirname(resolved);
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realAncestor = realpathSync(ancestor);
  const realRelative = path.relative(docs, realAncestor);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) throw new Error("Output ancestor escapes docs/ through a symlink.");
}

export function writeStaging(root: string, out: string, result: ReturnType<typeof buildStaging>): void {
  assertSafeOutput(root, out);
  const destination = path.resolve(root, out);
  // Verify the read snapshot before creating anything, including packet/record hashes.
  for (const input of result.manifest.inputFiles) {
    if (sha256(readFileSync(path.join(root, input.path), "utf8")) !== input.sha256) throw new Error(`Input changed during conversion: ${input.path}`);
  }
  mkdirSync(path.join(destination, "graph"), { recursive: true });
  const outputHashes: Array<{ path: string; sha256: string }> = [];
  const write = (relative: string, value: unknown) => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(path.join(destination, relative), content, { flag: "wx" });
    outputHashes.push({ path: relative, sha256: sha256(content) });
  };
  write("authored-mappings.json", result.authored);
  for (const node of result.graph) write(`graph/${node.nodeId}.json`, node);
  write("manifest.json", { ...result.manifest, outputFiles: outputHashes });
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] !== undefined && !args[0].startsWith("--out="))) throw new Error("Usage: node scripts/convert-crg-packets.ts [--out=docs/<new-staging-directory>]");
  const root = process.cwd();
  const out = args[0]?.slice("--out=".length) ?? "docs/crg-staging-2026-10-06";
  assertSafeOutput(root, out);
  const result = buildStaging(root);
  writeStaging(root, out, result);
  console.log(JSON.stringify({ output: out, status: result.manifest.status, ...result.manifest.counts, holdCounts: result.manifest.holdCounts }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`convert-crg-packets: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
