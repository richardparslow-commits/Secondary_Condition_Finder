#!/usr/bin/env node
/** Read-only DEV export of public-only ontology identity and pathway research review queues. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "pg";
import { getLabConnection } from "./lib/tiger-lab-client.mjs";

const SNAP = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
const CIT = "c420c158e39900af777e11a233b19873c8cda08edd2e22bd6c1da88c52117704";
const RESEARCH = "f9f6a8c742973d90ae42bde74faa055e761240241abbc418a225cc3f1a6eb6d1";
const PREFIX = "scf_medical_ontology_dev";
const OUT = "/tmp/scf-mondo-20261006/review-queue";
const conn = getLabConnection("m8vrpmo6ec", "verify");
assert.equal(conn.PGHOST, "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com");
assert.equal(conn.PGPORT, "30902");
assert.equal(conn.PGUSER, "tsdbadmin");
assert.equal(conn.TIGER_LAB_ENDPOINT, "direct");
const db = new Client({
  host: conn.PGHOST, port: 30902, database: "tsdb",
  user: conn.PGUSER, password: conn.PGPASSWORD,
  ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 7000,
  query_timeout: 20000, statement_timeout: 15000,
  application_name: "scf_ontology_dev_review_export",
});
function csvCell(s) {
  return '"' + String(s ?? "").replaceAll('"', '""').replaceAll("\r", " ").replaceAll("\n", " ") + '"';
}
function writeCsv(path, keys, rows) {
  fs.writeFileSync(path,
    keys.map(csvCell).join(",") + "\n" +
    rows.map((r) => keys.map((k) => csvCell(r[k])).join(",")).join("\n") + "\n", { mode: 0o600 });
}
try {
  await db.connect();
  await db.query("BEGIN READ ONLY");
  const audit = await db.query(
    "SELECT a.condition_id, a.audit_status, a.candidate_count, " +
    "COALESCE(string_agg(c.concept_id, '; ' ORDER BY c.concept_id),'') AS candidate_ids " +
    "FROM " + PREFIX + ".app_audits a LEFT JOIN " + PREFIX +
    ".app_candidates c ON c.snapshot=a.snapshot AND c.condition_id=a.condition_id " +
    "WHERE a.snapshot=$1 GROUP BY a.condition_id,a.audit_status,a.candidate_count " +
    "ORDER BY CASE a.audit_status WHEN 'NO_EXACT_ONTOLOGY_MATCH' THEN 0 " +
    "WHEN 'AMBIGUOUS_LEXICAL_CANDIDATES' THEN 1 ELSE 2 END, a.condition_id",
    [SNAP],
  );
  const pathways = await db.query(
    "SELECT a.source_id,a.target_id,a.rank,a.audit_status,c.nexus_classification," +
    "c.refs,c.declared_verified, c.clinical_refs,c.clinical_declared_verified, " +
    "array_to_string(ARRAY(SELECT jsonb_array_elements_text(c.flags)), '; ') AS review_flags " +
    "FROM " + PREFIX + ".app_pathways a JOIN " + PREFIX +
    ".pathway_citation_audits c ON c.source_id=a.source_id AND c.target_id=a.target_id " +
    "AND c.digest=$2 WHERE a.snapshot=$1 ORDER BY a.source_id,a.target_id",
    [SNAP, CIT],
  );
  const research = await db.query(
    "SELECT provider,condition_id,ordinal,candidate_id,label,relation,record_status " +
    "FROM " + PREFIX + ".research_candidates WHERE source_digest=$1 " +
    "ORDER BY condition_id,provider,ordinal",
    [RESEARCH],
  );
  assert.equal(audit.rows.length, 819);
  assert.equal(pathways.rows.length, 875);
  assert.equal(research.rows.length, 186);
  fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
  writeCsv(OUT + "/condition-identity-review.csv",
    ["condition_id","audit_status","candidate_count","candidate_ids"], audit.rows);
  writeCsv(OUT + "/pathway-evidence-review.csv",
    ["source_id","target_id","rank","audit_status","nexus_classification",
      "refs","declared_verified","clinical_refs","clinical_declared_verified","review_flags"],
    pathways.rows);
  writeCsv(OUT + "/external-research-candidates.csv",
    ["provider","condition_id","ordinal","candidate_id","label","relation","record_status"],
    research.rows);
  const statusCounts = Object.fromEntries([
    "NO_EXACT_ONTOLOGY_MATCH", "AMBIGUOUS_LEXICAL_CANDIDATES",
    "UNIQUE_LEXICAL_CANDIDATE_REVIEW",
  ].map((x) => [x,audit.rows.filter((r) => r.audit_status === x).length]));
  const summary = {
    source: "MONDO v2026-10-06; NLM ICD-10-CM; OLS4; Monarch; PubTator3; HPO; Open Targets",
    snapshot: SNAP, conditionRows: 819, pathwayRows: 875,
    externalResearchRows: 186, conditionCoverage: statusCounts,
    flagsNotClinicalVerdicts: true, approvedClinicalMappings: 0,
    files: ["condition-identity-review.csv", "pathway-evidence-review.csv",
      "external-research-candidates.csv"],
  };
  fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  await db.query("COMMIT");
  console.log(JSON.stringify({ result: "DEV_REVIEW_EXPORT_READY", directory: OUT, ...summary }));
} catch {
  console.error("DEV review export failed; no medical or personal information logged");
  process.exitCode = 1;
} finally {
  await db.query("ROLLBACK").catch(() => {});
  await db.end().catch(() => {});
}
