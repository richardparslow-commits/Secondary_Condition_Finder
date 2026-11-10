#!/usr/bin/env node
/** Research-only candidate study snapshots in Tiger DEV, with human-only review receipts. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SERVICE="m8vrpmo6ec";
const HOST="m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const SCHEMA="scf_candidate_review_dev";
const SOURCE="dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa";
const SCOPE="OFFICIAL_PUBMED_CANDIDATE_BIBLIOGRAPHY_NOT_CLINICAL_VERIFICATION";
const DEFAULT="/tmp/scf-source-specific-review/secondary-evidence-discovery/candidate-metadata-preflight/candidate-metadata.json";
const NO="NOT_GRANTED",DIGEST=/^[a-f0-9]{64}$/,PMID=/^[1-9][0-9]{3,8}$/,SLUG=/^[a-z0-9-]{2,90}$/;
const CORRECTION=/errat|retract|concern|withdraw/i;
export function canonical(x){
  if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
  if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(
    k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
  return JSON.stringify(x);
}
export const sha=x=>createHash("sha256").update(canonical(x)).digest("hex");
const without=(o,k)=>Object.fromEntries(Object.entries(o).filter(([n])=>n!==k));
const key=x=>x.sourceId+"|"+x.targetId;
const linkKey=x=>x.source_id+"|"+x.target_id+"|"+x.candidate_pmid;
function exactPublicKeys(row,keys){
  assert.ok(row && typeof row==="object" && !Array.isArray(row));
  assert.deepEqual(Object.keys(row).sort(),[...keys].sort(),
    "Unexpected research metadata fields: no private/clinical extras permitted");
}
const DOC_FIELDS=["schemaVersion","scope","sourceLedgerId","sourceCandidateRunSha256",
  "observedAt","sourcePublicationCount","publications","caseCandidateLinks",
  "clinicalApprovals","individualVaNexusApprovals","productionChanges",
  "abstractTextsStored","fullTextsReviewed","contradictionFindings","runSha256"];
const PUB_FIELDS=["pmid","title","publicationTypes","publicationYearText",
  "abstractAvailable","correctionOrRetractionTypes","publicationStatusReviewRequired",
  "bibliographicStatus","clinicalSupport","medicalReview","fullTextReviewed",
  "abstractTextStored","publicationAuthorization"];
const LINK_FIELDS=["sourceId","targetId","originalPmid","candidatePmid",
  "searchRank","studyScreening","clinicalFinding","individualVaNexus",
  "publicationAuthorization"];

export function validate(doc){
  exactPublicKeys(doc,DOC_FIELDS);
  assert.equal(doc.schemaVersion,1);
  assert.equal(doc.scope,SCOPE);
  assert.equal(doc.sourceLedgerId,SOURCE);
  assert.match(doc.sourceCandidateRunSha256,DIGEST);
  assert.match(doc.runSha256,DIGEST);
  assert.equal(sha(without(doc,"runSha256")),doc.runSha256);
  for(const f of ["clinicalApprovals","individualVaNexusApprovals",
    "productionChanges","abstractTextsStored","fullTextsReviewed","contradictionFindings"]){
    assert.equal(doc[f],0,"Research snapshots cannot carry medical approvals");
  }
  assert.ok(Number.isInteger(doc.sourcePublicationCount));
  assert.ok(doc.sourcePublicationCount>=0 && doc.sourcePublicationCount<=252);
  assert.ok(Array.isArray(doc.publications)&&doc.publications.length===doc.sourcePublicationCount);
  assert.ok(Array.isArray(doc.caseCandidateLinks)&&doc.caseCandidateLinks.length<=252);
  const pubs=new Set(),publicationIndex=new Map();
  for(const p of doc.publications){
    exactPublicKeys(p,PUB_FIELDS);
    assert.match(p.pmid,PMID);assert.ok(!pubs.has(p.pmid));pubs.add(p.pmid);
    publicationIndex.set(p.pmid,p);
    assert.ok(typeof p.title==="string"&&p.title.length>=5&&p.title.length<=1200);
    assert.ok(Array.isArray(p.publicationTypes)&&p.publicationTypes.length<=50);
    assert.ok(p.publicationTypes.every(v=>typeof v==="string"&&v.length>0&&v.length<=250));
    assert.ok(typeof p.publicationYearText==="string"&&p.publicationYearText.length<=100);
    assert.equal(typeof p.abstractAvailable,"boolean");
    assert.ok(Array.isArray(p.correctionOrRetractionTypes)&&p.correctionOrRetractionTypes.length<=50);
    assert.ok(p.correctionOrRetractionTypes.every(v=>typeof v==="string"&&v.length>0&&v.length<=75));
    assert.equal(p.publicationStatusReviewRequired,p.correctionOrRetractionTypes.some(s=>CORRECTION.test(s)));
    assert.equal(p.bibliographicStatus,"OFFICIAL_RECORD_FOUND");
    assert.equal(p.clinicalSupport,"NOT_ASSESSED");
    assert.equal(p.medicalReview,"REQUIRED");
    assert.equal(p.fullTextReviewed,false);
    assert.equal(p.abstractTextStored,false);
    assert.equal(p.publicationAuthorization,NO);
  }
  const links=new Set(),ranks=new Set(),edges=new Set();
  for(const l of doc.caseCandidateLinks){
    exactPublicKeys(l,LINK_FIELDS);
    assert.match(l.sourceId,SLUG);assert.match(l.targetId,SLUG);
    assert.match(l.originalPmid,PMID);assert.match(l.candidatePmid,PMID);
    assert.ok(pubs.has(l.candidatePmid));
    assert.ok(Number.isInteger(l.searchRank)&&l.searchRank>=1&&l.searchRank<=12);
    const k=key(l)+"|"+l.candidatePmid,r=key(l)+"|"+l.searchRank;
    assert.ok(!links.has(k)&&!ranks.has(r),"Duplicate research source mapping or search rank");
    links.add(k);ranks.add(r);edges.add(key(l));
    assert.equal(l.studyScreening,"REQUIRED");
    assert.equal(l.clinicalFinding,"NOT_ASSESSED");
    assert.equal(l.individualVaNexus,"NOT_ASSESSED");
    assert.equal(l.publicationAuthorization,NO);
  }
  assert.ok(edges.size<=21);
  assert.equal(new Set(doc.caseCandidateLinks.map(l=>l.candidatePmid)).size,pubs.size);
  return doc;
}
export function project(doc){
  validate(doc);
  const map=new Map(doc.publications.map(p=>[p.pmid,p]));
  const publications=doc.publications.map(p=>({
    pmid:p.pmid,payload:p,content_sha256:sha(p),
  }));
  const case_candidates=doc.caseCandidateLinks.map(l=>{
    const p=map.get(l.candidatePmid);
    const review_priority=p.publicationStatusReviewRequired?"P1_STATUS_NOTICE_REVIEW":
      !p.abstractAvailable?"P2_ABSTRACT_UNAVAILABLE":"P3_FULL_TEXT_SCREENING";
    const row={source_id:l.sourceId,target_id:l.targetId,candidate_pmid:l.candidatePmid,
      original_pmid:l.originalPmid,search_rank:l.searchRank,review_priority,
      review_state:"PENDING_QUALIFIED_REVIEW",claim_verification:"NOT_ASSESSED",
      publication_authorization:NO};
    return {...row,content_sha256:sha(row)};
  });
  return {publications,case_candidates};
}
export function assertDevAdmin(service,conn){
  assert.equal(service,SERVICE);
  assert.equal(conn.PGHOST,HOST);
  assert.equal(conn.PGPORT,"30902");
  assert.equal(conn.PGDATABASE,"tsdb");
  assert.equal(conn.PGUSER,"tsdbadmin");
  assert.equal(conn.TIGER_LAB_ENDPOINT,"direct");
  assert.ok(typeof conn.PGPASSWORD==="string"&&conn.PGPASSWORD.length>0);
}
export function schemaStatements(){
  const s=SCHEMA;
  return [
    "CREATE SCHEMA IF NOT EXISTS "+s,
    "CREATE TABLE IF NOT EXISTS "+s+".runs ("+
      "run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),"+
      "source_ledger text NOT NULL CHECK(source_ledger='"+SOURCE+"'),"+
      "source_candidate_run text NOT NULL CHECK(source_candidate_run ~ '^[a-f0-9]{64}$'),"+
      "official_pubmed_count integer NOT NULL CHECK(official_pubmed_count BETWEEN 0 AND 252),"+
      "candidate_link_count integer NOT NULL CHECK(candidate_link_count BETWEEN 0 AND 252),"+
      "approval_state text NOT NULL DEFAULT '"+NO+"' CHECK(approval_state='"+NO+"'),"+
      "created_at timestamptz NOT NULL DEFAULT now())",
    "CREATE TABLE IF NOT EXISTS "+s+".publications ("+
      "run_id text NOT NULL REFERENCES "+s+".runs(run_id),"+
      "pmid text NOT NULL CHECK(pmid ~ '^[1-9][0-9]{3,8}$'),"+
      "payload jsonb NOT NULL,content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),"+
      "PRIMARY KEY(run_id,pmid),"+
      "CONSTRAINT scf_candidate_pub_not_approved CHECK ("+
        "payload->>'clinicalSupport'='NOT_ASSESSED' AND "+
        "payload->>'medicalReview'='REQUIRED' AND "+
        "payload->>'fullTextReviewed'='false' AND "+
        "payload->>'abstractTextStored'='false' AND "+
        "payload->>'publicationAuthorization'='"+NO+"'))",
    "CREATE TABLE IF NOT EXISTS "+s+".case_candidates ("+
      "run_id text NOT NULL,source_id text NOT NULL CHECK(source_id ~ '^[a-z0-9-]{2,90}$'),"+
      "target_id text NOT NULL CHECK(target_id ~ '^[a-z0-9-]{2,90}$'),"+
      "candidate_pmid text NOT NULL,original_pmid text NOT NULL CHECK(original_pmid ~ '^[1-9][0-9]{3,8}$'),"+
      "search_rank integer NOT NULL CHECK(search_rank BETWEEN 1 AND 12),"+
      "review_priority text NOT NULL CHECK(review_priority IN ("+
        "'P1_STATUS_NOTICE_REVIEW','P2_ABSTRACT_UNAVAILABLE','P3_FULL_TEXT_SCREENING')),"+
      "review_state text NOT NULL DEFAULT 'PENDING_QUALIFIED_REVIEW' "+
        "CHECK(review_state='PENDING_QUALIFIED_REVIEW'),"+
      "claim_verification text NOT NULL DEFAULT 'NOT_ASSESSED' "+
        "CHECK(claim_verification='NOT_ASSESSED'),"+
      "publication_authorization text NOT NULL DEFAULT '"+NO+"' CHECK(publication_authorization='"+NO+"'),"+
      "content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),"+
      "PRIMARY KEY(run_id,source_id,target_id,candidate_pmid),"+
      "UNIQUE(run_id,source_id,target_id,search_rank),"+
      "FOREIGN KEY(run_id,candidate_pmid) REFERENCES "+s+".publications(run_id,pmid))",
    "CREATE TABLE IF NOT EXISTS "+s+".qualified_human_reviews ("+
      "review_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,"+
      "run_id text NOT NULL,source_id text NOT NULL,target_id text NOT NULL,candidate_pmid text NOT NULL,"+
      "reviewer_identifier text NOT NULL CHECK(length(trim(reviewer_identifier))>=3),"+
      "reviewer_qualification text NOT NULL CHECK(length(trim(reviewer_qualification))>=12),"+
      "qualification_verified_by text NOT NULL CHECK(length(trim(qualification_verified_by))>=3),"+
      "reviewed_at timestamptz NOT NULL,"+
      "clinical_disposition text NOT NULL CHECK(clinical_disposition IN ("+
        "'NEEDS_MORE_EVIDENCE','INSUFFICIENT_EVIDENCE','POTENTIAL_SUPPORT',"+
        "'POTENTIAL_CONTRADICTION','MIXED_OR_CONFLICTED')),"+
      "study_design_population text NOT NULL CHECK(length(trim(study_design_population))>=12),"+
      "causal_direction_limits text NOT NULL CHECK(length(trim(causal_direction_limits))>=12),"+
      "confounders_and_mediation text NOT NULL CHECK(length(trim(confounders_and_mediation))>=12),"+
      "supporting_evidence jsonb NOT NULL CHECK(jsonb_typeof(supporting_evidence)='array'),"+
      "unresolved_contradictions jsonb NOT NULL CHECK(jsonb_typeof(unresolved_contradictions)='array'),"+
      "full_text_access_basis text NOT NULL CHECK(length(trim(full_text_access_basis))>=12),"+
      "reviewer_rationale text NOT NULL CHECK(length(trim(reviewer_rationale))>=30),"+
      "production_publication_state text NOT NULL DEFAULT '"+NO+"' "+
        "CHECK(production_publication_state='"+NO+"'),"+
      "recorded_at timestamptz NOT NULL DEFAULT now(),"+
      "FOREIGN KEY(run_id,source_id,target_id,candidate_pmid) REFERENCES "+
        s+".case_candidates(run_id,source_id,target_id,candidate_pmid))",
    "CREATE OR REPLACE FUNCTION "+s+".reject_human_review_changes() RETURNS trigger "+
      "LANGUAGE plpgsql AS $$ BEGIN "+
      "RAISE EXCEPTION 'Qualified review receipts are append-only'; END $$",
    "DROP TRIGGER IF EXISTS qualified_review_append_only ON "+s+".qualified_human_reviews",
    "CREATE TRIGGER qualified_review_append_only BEFORE UPDATE OR DELETE ON "+
      s+".qualified_human_reviews FOR EACH ROW EXECUTE FUNCTION "+s+".reject_human_review_changes()",
    "REVOKE ALL ON SCHEMA "+s+" FROM PUBLIC",
    "REVOKE ALL ON ALL TABLES IN SCHEMA "+s+" FROM PUBLIC",
    "REVOKE ALL ON "+s+".qualified_human_reviews FROM scf_evidence_ci_writer",
    "GRANT USAGE ON SCHEMA "+s+" TO scf_evidence_ci_writer",
    "GRANT SELECT, INSERT ON "+s+".runs, "+s+".publications, "+s+
      ".case_candidates TO scf_evidence_ci_writer",
  ];
}
async function open(mode){
  let cfg;
  if(mode==="setup"){
    const conn=getLabConnection(SERVICE,"verify");assertDevAdmin(SERVICE,conn);
    cfg={host:HOST,port:30902,database:"tsdb",user:conn.PGUSER,password:conn.PGPASSWORD,
      ssl:{rejectUnauthorized:true},connectionTimeoutMillis:8000,query_timeout:26000,
      statement_timeout:22000,application_name:"scf_candidate_review_admin_setup"};
  }else{
    cfg=parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL);
    assert.equal(cfg.user,"scf_evidence_ci_writer");
    cfg.application_name="scf_candidate_review_research";
  }
  const db=new Client(cfg);await db.connect();return db;
}
async function insert(db,table,rows,columns,run){
  const fields=columns.map(([key])=>key);
  const typed=columns.map(([key,type])=>key+" "+type).join(",");
  const sql="INSERT INTO "+SCHEMA+"."+table+"(run_id,"+fields.join(",")+") "+
    "SELECT $1,"+fields.map(f=>"x."+f).join(",")+" FROM "+
    "jsonb_to_recordset($2::jsonb) AS x("+typed+") ON CONFLICT DO NOTHING";
  await db.query(sql,[run,JSON.stringify(rows)]);
}
export async function compare(db,doc){
  validate(doc);
  const r=await db.query("SELECT source_ledger,source_candidate_run,official_pubmed_count,"+
    "candidate_link_count,approval_state FROM "+SCHEMA+".runs WHERE run_id=$1",[doc.runSha256]);
  assert.equal(r.rows.length,1);
  assert.deepEqual(r.rows[0],{source_ledger:SOURCE,source_candidate_run:doc.sourceCandidateRunSha256,
    official_pubmed_count:doc.publications.length,candidate_link_count:doc.caseCandidateLinks.length,
    approval_state:NO});
  const expected=project(doc);
  for(const [table,columns,id] of [
    ["publications",["pmid","payload","content_sha256"],x=>x.pmid],
    ["case_candidates",["source_id","target_id","candidate_pmid","original_pmid",
      "search_rank","review_priority","review_state","claim_verification",
      "publication_authorization","content_sha256"],linkKey],
  ]){
    const q=await db.query("SELECT "+columns.join(",")+" FROM "+SCHEMA+"."+table+
      " WHERE run_id=$1",[doc.runSha256]);
    assert.equal(q.rows.length,expected[table].length,"DEV row-count mismatch");
    const left=new Map(expected[table].map(row=>[id(row),row]));
    for(const row of q.rows){
      const want=left.get(id(row));assert.ok(want,"Unexpected DEV candidate record");
      assert.equal(canonical(row),canonical(want),"DEV research row differs from original");
      left.delete(id(row));
    }
    assert.equal(left.size,0);
  }
  // NEVER select or export the private qualified_human_reviews table in CI.
  return {result:"EXACT_CANDIDATE_REVIEW_DEV_PARITY",environment:"DEV",
    runId:doc.runSha256,officialPubMedRecords:doc.publications.length,
    candidateLinks:doc.caseCandidateLinks.length,reviewReceiptWrites:0,
    clinicalApprovals:0,productionChanges:0};
}
export async function processCandidate(mode,doc,connect=open){
  assert.ok(["setup","apply","verify"].includes(mode));validate(doc);
  const db=await connect(mode);let active=false;
  try{
    await db.query(mode==="verify"?"BEGIN READ ONLY":"BEGIN");active=true;
    if(mode!=="verify"){
      await db.query("SET LOCAL lock_timeout='4000ms'");
      if(mode==="setup"){
        await db.query("SELECT pg_advisory_xact_lock(202611, 923)");
        for(const stmt of schemaStatements())await db.query(stmt);
      }
      await db.query("INSERT INTO "+SCHEMA+".runs "+
        "(run_id,source_ledger,source_candidate_run,official_pubmed_count,candidate_link_count) "+
        "VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",[
        doc.runSha256,SOURCE,doc.sourceCandidateRunSha256,
        doc.publications.length,doc.caseCandidateLinks.length]);
      const rows=project(doc);
      await insert(db,"publications",rows.publications,[
        ["pmid","text"],["payload","jsonb"],["content_sha256","text"]],doc.runSha256);
      await insert(db,"case_candidates",rows.case_candidates,[
        ["source_id","text"],["target_id","text"],["candidate_pmid","text"],
        ["original_pmid","text"],["search_rank","integer"],["review_priority","text"],
        ["review_state","text"],["claim_verification","text"],
        ["publication_authorization","text"],["content_sha256","text"]],doc.runSha256);
    }
    const result=await compare(db,doc);
    await db.query(mode==="verify"?"ROLLBACK":"COMMIT");active=false;
    return result;
  }catch{
    if(active)await db.query("ROLLBACK").catch(()=>undefined);
    throw new Error("DEV candidate research transaction failed closed; credentials withheld");
  }finally{await db.end().catch(()=>undefined);}
}
if(process.argv[1]?.endsWith("candidate-review-tiger-dev.mjs")){
  const mode=process.argv[2],flags=process.argv.slice(3);
  const valid=(["setup","apply"].includes(mode)&&flags.length===1&&
    flags[0]==="--dev-write")||(mode==="verify"&&flags.length===0);
  if(!valid){console.error("Usage: setup --dev-write | apply --dev-write | verify");process.exitCode=1;}
  else{
    try{
      const doc=JSON.parse(fs.readFileSync(process.env.SCF_CANDIDATE_METADATA_FILE||DEFAULT,"utf8"));
      console.log(JSON.stringify(await processCandidate(mode,doc)));
    }catch{console.error("DEV clinical candidate catalog operation failed; secrets withheld");process.exitCode=1;}
  }
}
