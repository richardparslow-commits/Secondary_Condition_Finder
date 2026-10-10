#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { catalogConditionSchema, catalogFileSchema, type ConditionCatalog } from "../src/lib/catalog/schema.ts";
import { normalizeConditionName } from "../src/lib/catalog/lookup.ts";
import { conditionMappingSchema, KbNodeMappingSchema } from "../src/lib/kb/schema.ts";
import { assertNoForbiddenPhrases, assertNoQuarantinedPointerGraphNodes, validateKnowledgeBaseAgainstCatalog } from "../src/lib/kb/validate.ts";
import { assertGraphEvidenceJoins } from "../src/lib/kb/graph-evidence-joins.mts";

const text = z.string().trim().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z.iso.date();
export const admissionProposalSchema = z.object({
  formatVersion: z.literal(1),
  proposalId: id,
  condition: catalogConditionSchema,
  scope: z.object({
    definition: text,
    ratingRationale: text,
    distinctFrom: z.array(z.object({ conditionId: id, rationale: text }).strict()).min(1),
  }).strict(),
  restore: z.object({ manifestPath: text, quarantinePath: text, sha256: hash }).strict(),
}).strict();

const decisionBinding = { formatVersion: z.literal(1), proposalId: id, proposalSha256: hash, baselineSha256: hash };
export const ownerDecisionSchema = z.discriminatedUnion("outcome", [
  z.object({ ...decisionBinding, outcome: z.literal("pending"), reason: text }).strict(),
  z.object({ ...decisionBinding, outcome: z.literal("rejected"), owner: text, decidedOn: date, decisionReference: text, rationale: text }).strict(),
  z.object({
    ...decisionBinding, outcome: z.literal("approved"), owner: text, decidedOn: date,
    decisionReference: text, rationale: text,
    scope: z.literal("identity-and-draft-restoration-only"),
    confirmations: z.object({
      distinctIdentityReviewed: z.literal(true), ratingScopeReviewed: z.literal(true),
      unchangedDraftRestorationReviewed: z.literal(true), noPublicationOrCitationVerification: z.literal(true),
    }).strict(),
  }).strict(),
]);

const manifestSchema = z.object({ files: z.array(z.object({
  originalPath: text, quarantinePath: text, sha256: hash, bytes: z.number().int().nonnegative(), reason: text,
})) });
export function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Relative, regular files only: no traversal or symlink-mediated reads/writes. */
function safeFile(root: string, relative: string, prefix?: string): string {
  if (path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === "..") || (prefix && !relative.startsWith(prefix))) {
    throw new Error(`Unsafe repository path: ${relative}`);
  }
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Symlink refused: ${relative}`);
  }
  return current;
}

export function dataSnapshot(root: string): Array<{ path: string; sha256: string }> {
  const files: Array<{ path: string; sha256: string }> = [];
  function walk(relative: string) {
    const directory = safeFile(root, relative);
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      // macOS Finder metadata: gitignored, machine-local, never a runtime
      // input. Pinning it makes the baseline depend on which workstation
      // prepared the review, so checkouts without the file fail the bind.
      if (entry.name === ".DS_Store") continue;
      const name = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${name}`);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) files.push({ path: name, sha256: sha256(readFileSync(safeFile(root, name))) });
      else throw new Error(`Non-regular input refused: ${name}`);
    }
  }
  walk("data");
  return files;
}

function json(file: string): unknown { return JSON.parse(readFileSync(file, "utf8")); }
function jsonFiles(root: string, directory: string) {
  return readdirSync(safeFile(root, directory)).filter(name => name.endsWith(".json")).sort().map(name => ({
    name, value: json(safeFile(root, `${directory}/${name}`)),
  }));
}

/** Check new lookup tokens against every existing id/name/alias (including spaces). */
export function assertNewLookupIdentity(catalog: ConditionCatalog, candidate: ConditionCatalog[number]): void {
  const tokens = (condition: ConditionCatalog[number]) => [condition.id, condition.id.replace(/-/g, " "), condition.name, ...condition.aliases].map(normalizeConditionName);
  const existing = new Map<string, string>();
  for (const condition of catalog) for (const token of tokens(condition)) existing.set(token, condition.id);
  for (const token of tokens(candidate)) {
    if (existing.has(token)) throw new Error(`Identity lookup collision: ${candidate.id} with ${existing.get(token)} (${token})`);
  }
  const aliases = candidate.aliases.map(normalizeConditionName);
  if (aliases.some(alias => !alias) || new Set(aliases).size !== aliases.length) throw new Error("Blank or duplicate candidate aliases.");
}

/** Validate the actual schema/runtime contract, not a permissive metadata projection. */
export function validateCandidateData(root: string) {
  const catalog = jsonFiles(root, "data/conditions").flatMap(({ value }) => catalogFileSchema.parse(value).conditions);
  const catalogIds = new Set(catalog.map(condition => condition.id));
  if (catalogIds.size !== catalog.length) throw new Error("Duplicate catalog identity.");
  const kb = jsonFiles(root, "data/knowledge-base").map(({ name, value }) => {
    const mapping = conditionMappingSchema.parse(value);
    if (name !== `${mapping.id}.json`) throw new Error(`Mapping filename mismatch: ${name}`);
    return mapping;
  });
  const mappingIds = new Set(kb.map(mapping => mapping.id));
  if (mappingIds.size !== kb.length || catalog.length !== kb.length || catalog.some(condition => !mappingIds.has(condition.id))) {
    throw new Error("Catalog/KB must have exactly one matching mapping per identity.");
  }
  validateKnowledgeBaseAgainstCatalog(catalog, kb);
  assertNoForbiddenPhrases(kb);
  const nodes = jsonFiles(root, "data/knowledge-base/graph").map(({ name, value }) => {
    const node = KbNodeMappingSchema.parse(value);
    if (name !== `${node.nodeId}.json`) throw new Error(`Graph filename mismatch: ${name}`);
    if (!catalogIds.has(node.nodeId) || node.outgoingEdges.some(edge => !catalogIds.has(edge.targetConditionId))) throw new Error("Unknown graph identity.");
    return node;
  });
  assertNoQuarantinedPointerGraphNodes(kb, nodes);
  assertGraphEvidenceJoins(kb, nodes);
  return { catalog, kb, nodes };
}

export function inspectAdmission(root: string, proposalPath: string) {
  root = realpathSync(root);
  const proposalBytes = readFileSync(safeFile(root, proposalPath, "docs/"));
  const proposal = admissionProposalSchema.parse(JSON.parse(proposalBytes.toString("utf8")));
  // The condition uses the existing contract; the stricter admission id avoids
  // slashes/dot segments in the generated file names.
  id.parse(proposal.condition.id);
  if (proposal.condition.ratingSchedule.some(reference => reference.verified)) throw new Error("Admission cannot mark rating references verified.");
  if (!proposal.condition.reviewNotes.length) throw new Error("Candidate must carry scope/rating review notes.");
  const inputs = dataSnapshot(root);
  const baselineSha256 = sha256(JSON.stringify(inputs));
  const current = validateCandidateData(root);
  assertNewLookupIdentity(current.catalog, proposal.condition);
  const distinctions = proposal.scope.distinctFrom.map(item => item.conditionId);
  if (new Set(distinctions).size !== distinctions.length || distinctions.some(other => !current.catalog.some(condition => condition.id === other))) throw new Error("Distinct-from identities must be unique existing catalog IDs.");
  const manifestPath = safeFile(root, proposal.restore.manifestPath, "data/knowledge-base-quarantine/");
  const manifest = manifestSchema.parse(json(manifestPath));
  const matches = manifest.files.filter(entry => entry.quarantinePath === proposal.restore.quarantinePath);
  if (matches.length !== 1) throw new Error("Restore must select exactly one quarantine manifest entry.");
  const entry = matches[0];
  const originalPath = `data/knowledge-base/${proposal.condition.id}.json`;
  if (entry.originalPath !== originalPath) throw new Error("Restore cannot re-root or activate an adjacency copy.");
  const mappingBytes = readFileSync(safeFile(root, entry.quarantinePath, "data/knowledge-base-quarantine/"));
  if (entry.sha256 !== proposal.restore.sha256 || sha256(mappingBytes) !== entry.sha256 || mappingBytes.length !== entry.bytes) throw new Error("Quarantine hash/size mismatch.");
  if (existsSync(safeFile(root, originalPath))) throw new Error("Restore would overwrite an existing runtime mapping.");
  const mapping = conditionMappingSchema.parse(JSON.parse(mappingBytes.toString("utf8")));
  if (mapping.id !== proposal.condition.id || !mapping.draft || mapping.quarantine) throw new Error("Only an unchanged draft with the elected identity may be restored.");
  validateKnowledgeBaseAgainstCatalog([...current.catalog, proposal.condition], [...current.kb, mapping]);
  assertNoForbiddenPhrases([...current.kb, mapping]);
  return { proposal, proposalBytes, proposalSha256: sha256(proposalBytes), baselineSha256, inputs, mappingBytes, entry,
    counts: { before: current.catalog.length, after: current.catalog.length + 1 }, graphNodes: current.nodes.length };
}

function safeOutput(root: string, output: string): string {
  const destination = safeFile(root, output, "docs/");
  if (existsSync(destination)) throw new Error("Output must be a fresh docs/ directory; artifacts are never overwritten.");
  return destination;
}

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

/** The approved artifact is an isolated candidate, NEVER an automatic live write. */
export function prepareAdmission(root: string, proposalPath: string, output: string, decisionPath?: string) {
  root = realpathSync(root);
  const destination = safeOutput(root, output);
  const inspected = inspectAdmission(root, proposalPath);
  const binding = { formatVersion: 1 as const, proposalId: inspected.proposal.proposalId,
    proposalSha256: inspected.proposalSha256, baselineSha256: inspected.baselineSha256 };
  const decisionBytes = decisionPath ? readFileSync(safeFile(root, decisionPath, "docs/")) : null;
  const decision = ownerDecisionSchema.parse(decisionBytes ? JSON.parse(decisionBytes.toString("utf8")) : {
    ...binding, outcome: "pending", reason: "Owner has requested process and a pending proposal only; no identity or restoration approval has been granted.",
  });
  for (const key of ["proposalId", "proposalSha256", "baselineSha256"] as const) {
    if (decision[key] !== binding[key]) throw new Error(`Stale or mismatched owner decision: ${key}`);
  }
  if (decision.outcome === "approved" && decision.decidedOn > new Date().toISOString().slice(0, 10)) throw new Error("Owner decision cannot be future-dated.");
  if (sha256(JSON.stringify(dataSnapshot(root))) !== binding.baselineSha256) throw new Error("Data changed during review preparation.");
  mkdirSync(destination, { recursive: true });
  writeFileSync(path.join(destination, "proposal.json"), inspected.proposalBytes, { flag: "wx" });
  writeJson(path.join(destination, "owner-decision.json"), decision);
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [
    { name: "proposal-preflight", passed: true, detail: "Shared catalog/mapping schemas, unique lookup identity, explicit scope distinctions, quarantine hash/size, draft state, targets and pointer guards passed. No owner approval inferred." },
  ];
  const report = {
    formatVersion: 1, status: decision.outcome === "approved" ? "CANDIDATE_VALIDATING" : decision.outcome === "rejected" ? "REJECTED" : "PENDING_OWNER_DECISION",
    identity: inspected.proposal.condition.id, ownerDecision: decision,
    inputs: inspected.inputs, restoredFrom: inspected.entry, counts: inspected.counts,
    boundaries: { liveDataWritten: false, quarantineModified: false, mappingBytesPreserved: true, publicationApproved: false, citationVerificationPerformed: false, graphNodesAdded: 0 },
    checks,
    landingRequirements: ["Owner decision is an attestation, not a cryptographic identity check; reviewed PR provenance must establish who approved it.",
      "Coordinate the versioned identity-count pins, coverage ledger and historical/current-state documents before landing the two candidate additions in a reviewed PR.",
      "Run the full test suite, citation audit, client corpus build and deployment-artifact checks on the landing commit. No automatic pin rewrite or promotion is authorized."],
  };
  try {
    if (decision.outcome === "approved") {
      // Full public authored data snapshot for existing validators; quarantine
      // remains archival input here, not an instruction to ship the candidate.
      cpSync(path.join(root, "data"), path.join(destination, "data"), { recursive: true, errorOnExist: true, force: false });
      const catalogPath = `data/conditions/admission-${inspected.proposal.condition.id}.json`;
      writeJson(path.join(destination, catalogPath), { bodySystem: inspected.proposal.condition.bodySystem, conditions: [inspected.proposal.condition] });
      writeFileSync(path.join(destination, inspected.entry.originalPath), inspected.mappingBytes, { flag: "wx" });
      validateCandidateData(destination);
      checks.push({ name: "shared-runtime-schemas-and-joins", passed: true, detail: "One-to-one catalog/KB, targets, pointers, copy guardrails and unchanged adjacency evidence joins passed." });
      for (const [name, script] of [["kb-validator", "scripts/validate-knowledge-base.js"], ["client-corpus", "scripts/build-client-corpus.mjs"]]) {
        const result = spawnSync(process.execPath, [path.join(root, script)], { cwd: destination, encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
        writeFileSync(path.join(destination, `${name}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}`, { flag: "wx" });
        const passed = !result.error && result.status === 0;
        checks.push({ name, passed, detail: passed ? "Real CLI passed on isolated candidate data." : `exit=${result.status}; ${result.error?.message ?? "see log"}` });
        if (!passed) throw new Error(`${name} failed; see candidate log.`);
      }
      const corpus = json(path.join(destination, "public/kb/client-corpus.json")) as { conditions: Array<{ id: string }>; publishedMappings: Array<{ id: string }>; graph: unknown[] };
      if (corpus.conditions.filter(condition => condition.id === inspected.proposal.condition.id).length !== 1 || corpus.publishedMappings.some(mapping => mapping.id === inspected.proposal.condition.id) || corpus.graph.length !== inspected.graphNodes) throw new Error("Client corpus identity/draft/graph boundary failed.");
      const candidateInputs = dataSnapshot(destination);
      const newPaths = new Set([catalogPath, inspected.entry.originalPath]);
      const originals = candidateInputs.filter(input => !newPaths.has(input.path));
      if (JSON.stringify(originals) !== JSON.stringify(inspected.inputs)) throw new Error("Candidate changed pre-existing data.");
      report.status = "VALIDATED_DRAFT_CANDIDATE_NOT_LANDED";
      checks.push({ name: "restoration-and-publication-boundary", passed: true, detail: "Only catalog and draft mapping added; all original hashes unchanged; new identity visible, draft unpublished and graph unchanged." });
      writeJson(path.join(destination, "candidate-files.json"), { files: candidateInputs, clientCorpusSha256: sha256(readFileSync(path.join(destination, "public/kb/client-corpus.json"))), additions: [...newPaths] });
    }
    if (sha256(JSON.stringify(dataSnapshot(root))) !== binding.baselineSha256) throw new Error("Live inputs changed; regenerate the review and decision.");
    writeJson(path.join(destination, "admission-report.json"), report);
    return report;
  } catch (error) {
    report.status = "VALIDATION_FAILED_NOT_LANDED";
    checks.push({ name: "admission", passed: false, detail: error instanceof Error ? error.message : String(error) });
    writeJson(path.join(destination, "admission-report.json"), report);
    throw error;
  }
}

function main() {
  const args = process.argv.slice(2);
  const flags = new Map<string, string>();
  for (const arg of args) {
    const match = /^--(proposal|decision|out)=(.+)$/.exec(arg);
    if (!match || flags.has(match[1])) throw new Error("Usage: npm run catalog:admission -- --proposal=docs/<proposal.json> --out=docs/<fresh-directory> [--decision=docs/<owner-decision.json>]");
    flags.set(match[1], match[2]);
  }
  if (!flags.has("proposal") || !flags.has("out")) throw new Error("--proposal and --out are required.");
  const report = prepareAdmission(process.cwd(), flags.get("proposal")!, flags.get("out")!, flags.get("decision"));
  console.log(JSON.stringify({ status: report.status, identity: report.identity, counts: report.counts, checks: report.checks, output: flags.get("out") }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(`catalog-identity-admission: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
