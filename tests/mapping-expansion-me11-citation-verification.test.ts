import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const KB = path.join(ROOT, "data", "knowledge-base");
const MASTER_SOURCES = path.join(ROOT, "data", "evidence", "master-sources.json");
const MASTER_RELATIONSHIPS = path.join(ROOT, "data", "evidence", "master-relationships.json");
const rows = [
  {
    "primaryId": "actinomycosis",
    "targetId": "osteomyelitis",
    "pmid": "41871568",
    "doi": "10.24953/turkjpediatr.2026.6451",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/41871568/"
  },
  {
    "primaryId": "insomnia",
    "targetId": "hypertension",
    "pmid": "33360604",
    "doi": "10.1016/j.smrv.2020.101403",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/33360604/"
  },
  {
    "primaryId": "periodontal-disease",
    "targetId": "osteoporosis",
    "pmid": "36377800",
    "doi": "10.1111/cdoe.12812",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/36377800/"
  },
  {
    "primaryId": "uterine-fibroids",
    "targetId": "endometriosis",
    "pmid": "31006843",
    "doi": "10.1007/s00404-019-05153-5",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/31006843/"
  },
  {
    "primaryId": "bronchiolitis",
    "targetId": "pulmonary-hypertension",
    "pmid": "42444963",
    "doi": "10.21037/jtd-2026-0713",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/42444963/"
  }
];
function load(file: string) { return JSON.parse(fs.readFileSync(file, "utf8")); }

describe("Mapping Expansion ME-11 qualified-human citation verification", () => {
  it("promotes exactly the five approved ME-11 references to verified", () => {
    for (const row of rows) {
      const mapping = load(path.join(KB, `${row.primaryId}.json`));
      const suggestions = mapping.suggestions.filter((s: { conditionId?: string }) => s.conditionId === row.targetId);
      expect(suggestions).toHaveLength(1);
      const refs = suggestions[0].sourceReferences.filter((r: { citation?: string }) => r.citation?.includes(`PMID ${row.pmid}`));
      expect(refs).toHaveLength(1); expect(refs[0].verified).toBe(true); expect(refs[0].verificationScope).toBe("clinical-evidence");
    }
  });
  it("promotes the five matching master sources to active qualified-human-verified state", () => {
    const registry = load(MASTER_SOURCES);
    for (const row of rows) {
      const sources = registry.sources.filter((s: { sourceId?: string }) => s.sourceId === `pmid-${row.pmid}`);
      expect(sources).toHaveLength(1); expect(sources[0].status).toBe("active"); expect(sources[0].verified).toBe(true);
      expect(sources[0].verificationState?.qualifiedHumanCitationReviewDecision).toBe("approve-as-implemented");
      expect(sources[0].verificationState?.qualifiedHumanCitationReviewRequired).toBe(false);
    }
  });
  it("preserves the five ME-11 relationship identities and publication guards", () => {
    const registry = load(MASTER_RELATIONSHIPS);
    for (const row of rows) {
      const rels = registry.relationships.filter((r: { relationshipId?: string }) => r.relationshipId === `rel-${row.primaryId}-to-${row.targetId}`);
      expect(rels).toHaveLength(1); expect(rels[0].publicationGuard?.structuredGuardText).toBeTruthy();
    }
  });
});
