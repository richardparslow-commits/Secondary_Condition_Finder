#!/usr/bin/env node
/** Repeatable source-only research ingest/verify against dedicated Tiger DEV schema. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";

const SCHEMA = "scf_autonomous_evidence_dev";
const HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const ROLE = "scf_evidence_ci_writer";
const INPUT = "/tmp/scf-autonomous-directional-evidence/evidence-run.json";

export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" +
    Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
export function sha(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function parseDevConnection(raw) {
  if (!raw) throw new Error("Missing Tiger Cloud DEV-only secret");
  const url = new URL(raw);
  assert.ok(["postgres:","postgresql:"].includes(url.protocol));
  assert.equal(url.hostname, HOST, "Reject non-DEV database");
  assert.equal(url.port, "30902");
  assert.equal(url.pathname, "/tsdb");
  assert.equal(decodeURIComponent(url.username), ROLE, "Reject admin DB credentials");
  assert.equal(url.searchParams.get("sslmode"), "require");
  const password = decodeURIComponent(url.password);
  assert.ok(password.length >= 24);
  return {
    host: HOST, port: 30902, database: "tsdb", user: ROLE, password,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 7000, query_timeout: 20000,
    statement_timeout: 15000, application_name: "scf_autonomous_evidence_dev",
  };
}
export function validate(doc) {
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.clinicalApproval, "NOT_GRANTED");
  assert.match(doc.sourceLedgerId, /^[a-f0-9]{64}$/);
  assert.match(doc.runId, /^[a-f0-9]{64}$/);
  const without = Object.fromEntries(Object.entries(doc).filter(([key]) => key !== "runId"));
  assert.equal(doc.runId, sha(without), "Reference research manifest modified");
  assert.ok(Array.isArray(doc.edges) && doc.edges.length >= 1 && doc.edges.length <= 350);
  assert.ok(Array.isArray(doc.articles) && doc.articles.length <= 1000);
  assert.ok(Array.isArray(doc.discoveries) && doc.discoveries.length === doc.edges.length);
  const ids = new Set();
  for (const edge of doc.edges) {
    assert.match(edge.sourceId, /^[a-z0-9-]{2,90}$/);
    assert.match(edge.targetId, /^[a-z0-9-]{2,90}$/);
    const id = edge.sourceId + "|" + edge.targetId;
    assert.ok(!ids.has(id));
    ids.add(id);
    assert.equal(edge.clinicalDisposition, "HUMAN_REVIEW_REQUIRED");
    assert.ok(["DRAFT","PUBLISHED"].includes(edge.publicationState));
    assert.ok(["ASSOCIATION_ONLY","DIRECT_CAUSATION","AGGRAVATION"].includes(edge.nexusClassification));
    assert.ok(Array.isArray(edge.citationPmids) && Array.isArray(edge.reviewRules));
  }
  assert.equal(new Set(doc.articles.map((x) => x.pmid)).size, doc.articles.length);
  const cited = new Set(doc.articles.map((x) => x.pmid));
  for (const article of doc.articles) {
    assert.match(article.pmid, /^\d{4,9}$/);
    assert.ok(["METADATA_RETRIEVED","PUBLICATION_STATUS_REVIEW",
               "UNRESOLVED","PROVIDER_UNAVAILABLE"].includes(article.status));
    if (article.metadataHash) {
      assert.equal(article.metadataHash, sha(Object.fromEntries(
        Object.entries(article).filter(([key]) => key !== "metadataHash"))));
    }
  }
  for (const edge of doc.edges) {
    assert.ok(edge.citationPmids.every((p) => cited.has(p)));
  }
  const found = new Set();
  for (const row of doc.discoveries) {
    const id = row.sourceId + "|" + row.targetId;
    assert.ok(ids.has(id) && !found.has(id));
    found.add(id);
    assert.ok(Array.isArray(row.candidatePmids) && row.candidatePmids.length <= 5);
    assert.equal(row.candidateClinicalSupport,"NOT_ASSESSED");
    assert.ok(["CANDIDATES_FOUND","NO_TEXT_MATCH","SEARCH_UNAVAILABLE"].includes(row.status));
  }
  return doc;
}
export function rows(doc) {
  const discovery = new Map(doc.discoveries.map((r) =>
    [r.sourceId + "|" + r.targetId,r]));
  const edges = doc.edges.map((r) => {
    const d = discovery.get(r.sourceId + "|" + r.targetId);
    assert.ok(d);
    const item = {
      source_id:r.sourceId,target_id:r.targetId,publication_state:r.publicationState,
      nexus_classification:r.nexusClassification,cited_pmids:r.citationPmids,
      review_rules:r.reviewRules,discovery_pmids:d.candidatePmids,
      discovery_status:d.status,review_state:"HUMAN_REVIEW_REQUIRED",
    };
    return { ...item, content_hash:sha(item) };
  });
  const articles = doc.articles.map((r) => ({
    pmid:r.pmid,status:r.status,title:r.title,publication_date:r.date,
    doi:r.doi,publication_types:r.publicationTypes,
    metadata_hash:r.metadataHash,clinical_support:"NOT_ASSESSED",
  }));
  return { edges, articles };
}
async function open() {
  const client = new Client(parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL));
  await client.connect();
  return client;
}
async function compare(db,doc) {
  const meta = await db.query("SELECT * FROM "+SCHEMA+".runs WHERE run_id=$1",[doc.runId]);
  assert.equal(meta.rows.length,1);
  const run=meta.rows[0];
  assert.equal(run.source_ledger_id,doc.sourceLedgerId);
  assert.equal(run.pathway_count,doc.edges.length);
  assert.equal(run.article_count,doc.articles.length);
  assert.equal(run.clinical_approval,"NOT_GRANTED");
  assert.equal(run.report_state,"RESEARCH_REVIEW_ONLY");
  const expected = rows(doc);
  for (const [table, projection, keyFn, cols] of [
    ["pubmed_articles",expected.articles,(r)=>r.pmid,
      ["pmid","status","title","publication_date","doi","publication_types","metadata_hash","clinical_support"]],
    ["pathway_reviews",expected.edges,(r)=>r.source_id+"|"+r.target_id,
      ["source_id","target_id","publication_state","nexus_classification","cited_pmids",
       "review_rules","discovery_pmids","discovery_status","review_state","content_hash"]],
  ]) {
    const result = await db.query(
      "SELECT "+cols.join(",")+" FROM "+SCHEMA+"."+table+" WHERE run_id=$1",[doc.runId]);
    assert.equal(result.rows.length,projection.length);
    const remaining=new Map(projection.map((r)=>[keyFn(r),r]));
    for (const row of result.rows) {
      const match=remaining.get(keyFn(row));
      assert.ok(match, "Unrecognized saved research row");
      assert.equal(canonical(row),canonical(match),"Metadata mismatch");
      remaining.delete(keyFn(row));
    }
    assert.equal(remaining.size,0);
  }
  return {status:"EXACT_DEV_EVIDENCE_PARITY",runId:doc.runId,
    pathways:doc.edges.length,articles:doc.articles.length,
    clinicalApproval:"NOT_GRANTED"};
}
async function ingest(db,doc) {
  await db.query("SELECT pg_advisory_xact_lock(202611, 1108)");
  await db.query("INSERT INTO "+SCHEMA+".runs (run_id,source_ledger_id,source_commit,"+
    "observed_at,pathway_count,article_count) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
    [doc.runId,doc.sourceLedgerId,doc.sourceCommit,doc.observedAt,
     doc.edges.length,doc.articles.length]);
  const data=rows(doc);
  for (const row of data.articles) await db.query(
    "INSERT INTO "+SCHEMA+".pubmed_articles(run_id,pmid,status,title,publication_date,"+
      "doi,publication_types,metadata_hash) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) "+
      "ON CONFLICT DO NOTHING",
    [doc.runId,row.pmid,row.status,row.title,row.publication_date,row.doi,
     JSON.stringify(row.publication_types),row.metadata_hash]);
  for (const row of data.edges) await db.query(
    "INSERT INTO "+SCHEMA+".pathway_reviews(run_id,source_id,target_id,publication_state,"+
    "nexus_classification,cited_pmids,review_rules,discovery_pmids,discovery_status,"+
    "content_hash) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10) "+
    "ON CONFLICT DO NOTHING",
    [doc.runId,row.source_id,row.target_id,row.publication_state,
     row.nexus_classification,JSON.stringify(row.cited_pmids),
     JSON.stringify(row.review_rules),JSON.stringify(row.discovery_pmids),
     row.discovery_status,row.content_hash]);
}
async function historicalDiff(db,doc) {
  const prior=await db.query("SELECT run_id FROM "+SCHEMA+
    ".runs WHERE run_id<>$1 ORDER BY inserted_at DESC,run_id DESC LIMIT 1",[doc.runId]);
  if(!prior.rows.length) return {comparison:"FIRST_RUN",changedMetadata:0,newlyResolved:0};
  const previous=prior.rows[0].run_id;
  const results=await db.query("SELECT "+
    "COUNT(*) FILTER (WHERE a.metadata_hash IS DISTINCT FROM b.metadata_hash)::int AS changed,"+
    "COUNT(*) FILTER (WHERE a.status='METADATA_RETRIEVED' AND "+
      "b.status IN ('UNRESOLVED','PROVIDER_UNAVAILABLE'))::int AS newly_resolved "+
    "FROM "+SCHEMA+".pubmed_articles a LEFT JOIN "+SCHEMA+".pubmed_articles b "+
      "ON b.run_id=$2 AND b.pmid=a.pmid WHERE a.run_id=$1",[doc.runId,previous]);
  return {comparison:"PREVIOUS_RUN",changedMetadata:results.rows[0].changed,
    newlyResolved:results.rows[0].newly_resolved};
}
export async function execute(mode,doc) {
  validate(doc);
  assert.ok(["apply","verify"].includes(mode));
  const db=await open();
  let tx=false;
  try {
    await db.query(mode==="apply"?"BEGIN":"BEGIN READ ONLY");
    tx=true;
    if (mode==="apply") {
      await db.query("SET LOCAL lock_timeout='3000ms'");
      await ingest(db,doc);
    }
    const status=await compare(db,doc);
    const diff=await historicalDiff(db,doc);
    await db.query(mode==="apply"?"COMMIT":"ROLLBACK");
    tx=false;
    return {...status,...diff,environment:"DEV"};
  } catch {
    if(tx) await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("Research-only DEV import/verification failed; inspect before retry");
  } finally {
    await db.end().catch(()=>undefined);
  }
}
if (process.argv[1]?.endsWith("tiger-evidence-dev.mjs")) {
  const mode=process.argv[2],flags=process.argv.slice(3);
  if (!["apply","verify"].includes(mode) ||
    (mode==="apply" && (flags.length!==1 || flags[0]!=="--dev-write")) ||
    (mode==="verify" && flags.length!==0)) {
    console.error("Usage: apply --dev-write | verify");
    process.exitCode=1;
  } else {
    try {
      const input=process.env.SCF_EVIDENCE_FILE || INPUT;
      const doc=JSON.parse(fs.readFileSync(input,"utf8"));
      const result=await execute(mode,doc);
      console.log(JSON.stringify(result));
    } catch {
      console.error("DEV evidence operation failed. Credentials and patient data withheld.");
      process.exitCode=1;
    }
  }
}
