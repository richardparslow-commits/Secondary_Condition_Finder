import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

type SourceReference = {
  citation?: string;
  sourceUrl?: string;
  verified?: boolean;
  verificationScope?: string;
};

type Suggestion = {
  conditionId: string;
  sourceReferences?: SourceReference[];
};

type Mapping = {
  id: string;
  draft: boolean;
  suggestions: Suggestion[];
};

type ApprovedRelationship = {
  primaryId: string;
  targetId: string;
  pmid: string;
  sourceVerificationStateAfterImplementation: string;
};

type ConditionDisposition = {
  id: string;
  finalDisposition: string;
};

type MasterPayload = {
  parentHead: string;
  approvedRelationships: ApprovedRelationship[];
  conditionDispositions: ConditionDisposition[];
};

type WaveIdentity = {
  id: string;
  disposition: string;
};

type WaveLedger = {
  waves: Array<{ identities: WaveIdentity[] }>;
};

const root = process.cwd();
const artifactPath = join(root, "docs", "clinical-mapping-master-2026-approved-disposition.json");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadMappings(): Mapping[] {
  const dir = join(root, "data", "knowledge-base");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => readJson<Mapping>(join(dir, name)));
}

export function isMaster2026Active(): boolean {
  if (!existsSync(artifactPath)) return false;
  const master = readJson<MasterPayload>(artifactPath);
  return (
    master.parentHead === "7b3848066b36b186f20ffe0170a3aa0489d578ea" &&
    master.approvedRelationships.length === 68 &&
    new Set(master.approvedRelationships.map((edge) => edge.primaryId)).size === 48 &&
    master.conditionDispositions.length === 245
  );
}

export function assertMaster2026CurrentState(): void {
  expect(isMaster2026Active()).toBe(true);

  const master = readJson<MasterPayload>(artifactPath);
  const mappings = loadMappings();
  const byId = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const approvedByPrimary = new Map<string, ApprovedRelationship[]>();

  for (const edge of master.approvedRelationships) {
    const current = approvedByPrimary.get(edge.primaryId) ?? [];
    current.push(edge);
    approvedByPrimary.set(edge.primaryId, current);
    expect(edge.sourceVerificationStateAfterImplementation).toBe("verified:false");
  }

  expect(mappings).toHaveLength(300);
  expect(mappings.filter((mapping) => !mapping.draft)).toHaveLength(103);
  expect(mappings.filter((mapping) => mapping.draft)).toHaveLength(197);
  expect(approvedByPrimary.size).toBe(48);

  for (const [primaryId, edges] of approvedByPrimary) {
    const mapping = byId.get(primaryId);
    expect(mapping, `${primaryId} must exist`).toBeDefined();
    expect(mapping?.draft, `${primaryId} must be published`).toBe(false);

    const expectedTargets = edges.map((edge) => edge.targetId).sort();
    const actualTargets = (mapping?.suggestions ?? []).map((entry) => entry.conditionId).sort();
    expect(actualTargets, `${primaryId} targets`).toEqual(expectedTargets);

    for (const edge of edges) {
      const suggestion = mapping?.suggestions.find((entry) => entry.conditionId === edge.targetId);
      expect(suggestion, `${primaryId} -> ${edge.targetId}`).toBeDefined();
      const source = suggestion?.sourceReferences?.find((ref) =>
        ref.citation?.includes(`PMID ${edge.pmid}`),
      );
      expect(source, `${primaryId} -> ${edge.targetId} PMID ${edge.pmid}`).toBeDefined();
      expect(source?.verified).toBe(false);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.sourceUrl).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
    }
  }

  const approvedIds = new Set(approvedByPrimary.keys());
  const held = master.conditionDispositions.filter(
    (entry) => !approvedIds.has(entry.id),
  );
  expect(held).toHaveLength(197);
  for (const disposition of held) {
    const mapping = byId.get(disposition.id);
    expect(mapping, `${disposition.id} must exist`).toBeDefined();
    expect(mapping?.draft, `${disposition.id} must remain draft`).toBe(true);
  }

  const mildTbi = byId.get("mild-tbi");
  const mildTbiSource = mildTbi?.suggestions
    .flatMap((entry) => entry.sourceReferences ?? [])
    .find((ref) => ref.citation?.includes("PMID 38568491"));
  expect(mildTbiSource).toBeDefined();
  expect(mildTbiSource?.verified).toBe(false);

  const refs = mappings.flatMap((mapping) =>
    mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
  );
  expect(refs).toHaveLength(141);
  expect(refs.filter((ref) => ref.verified === true)).toHaveLength(68);
  expect(refs.filter((ref) => ref.verified === false)).toHaveLength(73);

  const clinicalRefs = refs.filter((ref) => ref.verificationScope === "clinical-evidence");
  expect(clinicalRefs).toHaveLength(136);
  expect(
    clinicalRefs.filter((ref) => typeof ref.sourceUrl === "string" && ref.sourceUrl.length > 0),
  ).toHaveLength(136);

  const ledger = readJson<WaveLedger>(join(root, "data", "expansion-dispositions.json"));
  const entries = ledger.waves.flatMap((wave) => wave.identities);
  expect(entries).toHaveLength(107);
  expect(entries.filter((entry) => entry.disposition === "published-evidence-led")).toHaveLength(44);
  expect(entries.filter((entry) => entry.disposition === "safe-draft")).toHaveLength(63);
  expect(entries.filter((entry) => entry.disposition === "promotion-candidate")).toHaveLength(0);

  const status = readFileSync(join(root, "docs", "clinical-program-status.md"), "utf8");
  expect(status).toContain("48 primaries / 68 relationship edges");
  expect(status).toContain("103 published / 197 draft");
  expect(status).toContain("44 published-evidence-led / 0 promotion-candidate / 63 safe-draft");
  expect(status).toContain("all `verified:false`");

  const tracker = readFileSync(join(root, "docs", "kb-coverage-tracker.md"), "utf8");
  expect(tracker).toContain("Clinical Mapping Master Batch 2026 coverage");
  expect(tracker).toContain("Published mappings: **103**");
  expect(tracker).toContain("Remaining explicit drafts/holds: **197**");
  expect(tracker).toContain("Approved master edges: **68 across 48 primaries**");
  expect(tracker).toContain("Wave-ledger promotions: **13**");

  const queue = readFileSync(
    join(root, "docs", "qualified-human-citation-verification-queue.md"),
    "utf8",
  );
  expect(queue).toContain("Clinical Mapping Master Batch 2026 — pending citation verification");
  expect(queue).toContain("68 new live source rows");
  expect(queue).toContain("60 unique PMIDs");
  expect(queue).toContain("remain `verified:false`");
}
