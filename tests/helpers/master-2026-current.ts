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

type MappingMaster = {
  parentHead: string;
  approvedRelationships: Array<{ primaryId: string; targetId: string }>;
  conditionDispositions: Array<{ id: string; finalDisposition: string }>;
};

type CitationDisposition = {
  status: string;
  parentRepositoryHead: string;
  summary: {
    relationshipRowsReviewed: number;
    verifyAsWritten: number;
    verifyWithNarrowing: number;
    replaceSource: number;
  };
  relationshipDispositions: Array<{
    primaryId: string;
    targetId: string;
    finalPmid: string;
    verifiedAfterImplementation: boolean;
  }>;
};

type WaveIdentity = { id: string; disposition: string };
type WaveLedger = { waves: Array<{ identities: WaveIdentity[] }> };

const root = process.cwd();
const mappingArtifact = join(
  root,
  "docs",
  "clinical-mapping-master-2026-approved-disposition.json",
);
const citationArtifact = join(
  root,
  "docs",
  "clinical-mapping-master-2026-master-citation-verification-disposition.json",
);

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
  if (!existsSync(mappingArtifact)) return false;
  const master = readJson<MappingMaster>(mappingArtifact);
  return (
    master.parentHead === "7b3848066b36b186f20ffe0170a3aa0489d578ea" &&
    master.approvedRelationships.length === 68 &&
    new Set(master.approvedRelationships.map((row) => row.primaryId)).size === 48 &&
    master.conditionDispositions.length === 245
  );
}

export function assertMaster2026CurrentState(): void {
  expect(isMaster2026Active()).toBe(true);
  expect(existsSync(citationArtifact)).toBe(true);

  const citation = readJson<CitationDisposition>(citationArtifact);
  expect(citation.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
  expect(citation.parentRepositoryHead).toBe(
    "42d95d16d742d6a9e057579c54eac085efbc4a4a",
  );
  expect(citation.summary.relationshipRowsReviewed).toBe(68);
  expect(citation.summary.verifyAsWritten).toBe(55);
  expect(citation.summary.verifyWithNarrowing).toBe(8);
  expect(citation.summary.replaceSource).toBe(5);

  const mappings = loadMappings();
  expect(mappings).toHaveLength(301);
  expect(mappings.filter((mapping) => !mapping.draft)).toHaveLength(103);
  expect(mappings.filter((mapping) => mapping.draft)).toHaveLength(198);
  const byId = new Map(mappings.map((mapping) => [mapping.id, mapping]));

  for (const row of citation.relationshipDispositions) {
    const mapping = byId.get(row.primaryId);
    expect(mapping, `${row.primaryId} must exist`).toBeDefined();
    expect(mapping?.draft).toBe(false);
    const suggestion = mapping?.suggestions.find(
      (item) => item.conditionId === row.targetId,
    );
    expect(suggestion).toBeDefined();
    expect(suggestion?.sourceReferences).toHaveLength(1);
    const source = suggestion?.sourceReferences?.[0];
    expect(source?.verified).toBe(true);
    expect(source?.verificationScope).toBe("clinical-evidence");
    expect(source?.sourceUrl).toContain(`/${row.finalPmid}/`);
    expect(source?.citation).toContain(`PMID ${row.finalPmid}`);
    expect(row.verifiedAfterImplementation).toBe(true);
  }

  const refs = mappings.flatMap((mapping) =>
    mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
  );
  expect(refs).toHaveLength(141);
  expect(refs.filter((ref) => ref.verified === true)).toHaveLength(141);
  expect(refs.filter((ref) => ref.verified === false)).toHaveLength(0);
  const clinical = refs.filter(
    (ref) => ref.verificationScope === "clinical-evidence",
  );
  expect(clinical).toHaveLength(136);
  expect(clinical.every((ref) => Boolean(ref.sourceUrl))).toBe(true);

  const mildTbi = byId.get("mild-tbi");
  const mtbi = mildTbi?.suggestions
    .flatMap((item) => item.sourceReferences ?? [])
    .find((ref) => ref.citation?.includes("PMID 38568491"));
  expect(mtbi).toBeDefined();
  expect(mtbi?.verified).toBe(true);

  const ledger = readJson<WaveLedger>(
    join(root, "data", "expansion-dispositions.json"),
  );
  const rows = ledger.waves.flatMap((wave) => wave.identities);
  expect(
    rows.filter((row) => row.disposition === "published-evidence-led"),
  ).toHaveLength(44);
  expect(
    rows.filter((row) => row.disposition === "safe-draft"),
  ).toHaveLength(63);
  expect(
    rows.filter((row) => row.disposition === "promotion-candidate"),
  ).toHaveLength(0);
}
