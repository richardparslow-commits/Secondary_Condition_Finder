#!/usr/bin/env node
/** Public official legal authority metadata, DEV-only review stage.
 * Inputs: curated official citations only. No claimants, PHI, nexus, or Production.
 * Commands: prepare | check | apply --dev-write | verify
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { DEV_SERVICE, assertDevTarget } from "../lib/medical-reference-tiger-dev.mjs";

const SOURCE=fileURLToPath(new URL("../fixtures/va-authorities-initial-20261110.json",import.meta.url));
const OUTPUT=fileURLToPath(new URL("../../docs/research-dev/",import.meta.url));
const SCHEMA="scf_va_legal_authorities_dev";
const LEGAL_STATUS="LEGAL_HUMAN_REVIEW_REQUIRED";
const HOSTS=new Set(["uscode.house.gov","www.ecfr.gov","www.knowva.ebenefits.va.gov",
  "www.cafc.uscourts.gov","www.uscourts.cavc.gov","www.supremecourt.gov"]);
const KINDS=new Set(["statute","regulation","manual","court_case"]);
const sha=s=>createHash("sha256").update(s).digest("hex");
function canonical(x) {
 if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";
 if(x&&typeof x==="object")return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";
 return JSON.stringify(x);
}
const hash=x=>sha(canonical(x));
function snapshot() {
 const input=JSON.parse(readFileSync(SOURCE,"utf8"));
 assert.equal(input.schemaVersion,1);assert.equal(input.approval,"NOT_GRANTED");
 assert.equal(input.environment,"DEV_ONLY");
 assert.equal(input.seedId,"scf-va-authorities-initial-20261110");
 assert.ok(Array.isArray(input.records)&&input.records.length===11);
 const ids=new Set();
 const rows=input.records.map(r=>{
   assert.match(r.id,/^[a-z0-9-]{6,100}$/);
   assert.ok(!ids.has(r.id));ids.add(r.id);
   assert.ok(KINDS.has(r.kind)&&r.authorityStatus===LEGAL_STATUS);
   assert.ok(typeof r.title==="string"&&r.title.length>8&&r.title.length<300);
   assert.ok(typeof r.citation==="string"&&r.citation.length<230);
   assert.ok(typeof r.summary==="string"&&r.summary.length<800);
   assert.ok(typeof r.sourceDate==="string"&&r.sourceDate.length<32);
   const url=new URL(r.sourceUrl);
   assert.equal(url.protocol,"https:");assert.ok(HOSTS.has(url.hostname));
   assert.equal(url.username,"");assert.equal(url.password,"");
   assert.ok(Array.isArray(r.reviewFlags)&&r.reviewFlags.includes(LEGAL_STATUS));
   assert.ok(["PRIMARY_OFFICIAL","OFFICIAL_COURT_SECONDARY_CITATION"].includes(r.sourceRole));
   if(r.kind==="court_case"){
     assert.ok(["CAVC","Federal Circuit","Supreme Court"].includes(r.court));
     assert.ok(r.precedentialStatus!=="NOT_APPLICABLE");
   }else assert.equal(r.precedentialStatus,"NOT_APPLICABLE");
   if(r.id==="cavc-allen-1995") {
     assert.equal(r.sourceRole,"OFFICIAL_COURT_SECONDARY_CITATION");
     assert.ok(r.reviewFlags.includes("ORIGINAL_OPINION_URL_NOT_YET_VERIFIED"));
   }
   return {...r,recordHash:hash(r)};
 });
 assert.ok(rows.some(r=>r.reviewFlags.includes("CFR_M21_SPICER_AGGRAVATION_RECONCILIATION")));
 const content={schemaVersion:1,seedId:input.seedId,observedAt:input.observedAt,
  approval:input.approval,records:rows};
 return {...content,runId:hash(content)};
}
function render(s) {
 const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
 const field=["id","kind","citation","title","sourceUrl","sourceDate","court","docket",
   "decisionDate","precedentialStatus","sourceRole","authorityStatus","reviewFlags","recordHash"];
 const lines=[field.map(quote).join(",")];
 for(const r of s.records)lines.push(field.map(k=>quote(k==="reviewFlags"?r.reviewFlags.join(";"):r[k])).join(","));
 const counts={};
 for(const r of s.records)counts[r.kind]=(counts[r.kind]??0)+1;
 const flags={};
 for(const r of s.records)for(const flag of r.reviewFlags)flags[flag]=(flags[flag]??0)+1;
 const coverage={
   "workstream":"official-va-legal-authorities","environment":"DEV_ONLY",
   "source_run":s.runId,"observed_at":s.observedAt,
   "records":s.records.length,"records_by_kind":counts,"flags":flags,
   "official_primary_source_records":s.records.filter(r=>r.sourceRole==="PRIMARY_OFFICIAL").length,
   "indirect_official_case_citations":s.records.filter(r=>r.sourceRole!=="PRIMARY_OFFICIAL").length,
   "legal_human_approvals":0,"production_changes":0,
   "case_law_completeness":"NOT_CLAIMED","authority_effective_dates":"HUMAN_REVIEW_PENDING"
 };
 const md=[
 "# First VA legal-authority research snapshot — DEV ONLY","",
 "This stores official statutes, regulation links, dated M21-1 materials and court case references as unverified metadata. NO claimant-specific advice, eligibility conclusion, court holding sign-off, automatic precedent interpretation or Production publication.",
 "",
 "Source digest: "+s.runId,"Records: "+s.records.length+
 " (by kind: "+JSON.stringify(counts)+").","Official primary source links: "+
 coverage.official_primary_source_records+
 "; indirect official citation that needs original case opinion: "+
 coverage.indirect_official_case_citations+".",
 "Human legal approvals: ZERO; Production changes: ZERO.","",
 "Caution: current 38 CFR 3.310(b) text and updated May 1 2026 M21-1 guidance about Spicer/secondary aggravation must be reconciled by legally qualified review; do not silently favor a manual statement over a controlling statute, regulation or holding.",
 "BVA decisions ordinarily do not have precedential effect for other veterans under 38 CFR 20.1303. These first records do not exhaust BVA, SCOTUS, CAVC or Federal Circuit case law.",
 "Case Allen is linked to an official later CAVC opinion citing it, not falsely presented as an independently verified original opinion.",
 "",
 "Human queue: validate exact holding, jurisdiction, precedential status, later treatment, effective/applicability dates, M21 edition, source URL access, overrules/conflicts and veteran-safe phrasing before any public use."
 ].join("\n")+"\n";
 return {"va-legal-review-queue.csv":lines.join("\n")+"\n",
   "va-legal-coverage.json":JSON.stringify(coverage,null,2)+"\n",
   "va-legal-authorities-report.md":md};
}
function files(s,check=false) {
 const rendered=render(s);
 if(!check)mkdirSync(OUTPUT,{recursive:true});
 for(const [name,body] of Object.entries(rendered)){
  const dst=OUTPUT+name;
  if(check)assert.equal(readFileSync(dst,"utf8"),body,"Out-of-date "+name);
  else writeFileSync(dst,body,{encoding:"utf8"});
 }
}
async function connect() {
 const conn=getLabConnection(DEV_SERVICE,"verify");
 assertDevTarget(DEV_SERVICE,conn);
 const c=new Client({host:conn.PGHOST,port:Number(conn.PGPORT),database:conn.PGDATABASE,
  user:conn.PGUSER,password:conn.PGPASSWORD,ssl:{rejectUnauthorized:true},
  connectionTimeoutMillis:8000,query_timeout:20000,statement_timeout:18000,
  application_name:"scf_va_legal_research_DEV"});
 await c.connect();
 const id=await c.query("SELECT current_database() AS db,current_user AS role");
 assert.equal(id.rows[0].db,"tsdb");assert.equal(id.rows[0].role,"tsdbadmin");
 return c;
}
async function parity(c,s){
 const run=await c.query("SELECT run_id,observed_at::text,review_status,record_count FROM "+
  SCHEMA+".runs WHERE run_id=$1",[s.runId]);
 assert.equal(run.rows.length,1);
 assert.equal(run.rows[0].review_status,LEGAL_STATUS);
 assert.equal(run.rows[0].record_count,s.records.length);
 const rows=await c.query("SELECT record_id,record_hash,source_url,authority_status,details FROM "+
   SCHEMA+".records WHERE run_id=$1 ORDER BY record_id",[s.runId]);
 assert.equal(rows.rows.length,s.records.length);
 const expected=new Map(s.records.map(r=>[r.id,r]));
 for(const item of rows.rows){
  const x=expected.get(item.record_id);
  assert.ok(x,"Unexpected source record");
  assert.equal(item.record_hash,x.recordHash);
  assert.equal(item.source_url,x.sourceUrl);
  assert.equal(item.authority_status,LEGAL_STATUS);
  assert.deepEqual(item.details,x);
  expected.delete(item.record_id);
 }
 assert.equal(expected.size,0,"Missing legal source record");
}
async function runDb(mode,s){
 const c=await connect();let tx=false;
 try{
  await c.query(mode==="verify"?"BEGIN READ ONLY":"BEGIN");tx=true;
  await c.query("SET LOCAL statement_timeout='18000ms'");
  if(mode==="apply"){
   await c.query("SET LOCAL lock_timeout='3000ms'");
   await c.query("SELECT pg_advisory_xact_lock(202611,933)");
   await c.query("CREATE SCHEMA IF NOT EXISTS "+SCHEMA);
   await c.query("CREATE TABLE IF NOT EXISTS "+SCHEMA+".runs ("+
     "run_id text PRIMARY KEY CHECK(run_id ~ '^[a-f0-9]{64}$'),"+
     "observed_at date NOT NULL,record_count integer NOT NULL CHECK(record_count BETWEEN 1 AND 50),"+
     "review_status text NOT NULL CHECK(review_status='"+LEGAL_STATUS+"'),"+
     "created_at timestamptz NOT NULL DEFAULT now())");
   await c.query("CREATE TABLE IF NOT EXISTS "+SCHEMA+".records ("+
     "run_id text NOT NULL REFERENCES "+SCHEMA+".runs(run_id),record_id text NOT NULL,"+
     "record_hash text NOT NULL CHECK(record_hash ~ '^[a-f0-9]{64}$'),"+
     "source_url text NOT NULL,authority_status text NOT NULL CHECK(authority_status='"+LEGAL_STATUS+"'),"+
     "details jsonb NOT NULL CHECK(details->>'authorityStatus'='"+LEGAL_STATUS+"'),"+
     "PRIMARY KEY(run_id,record_id))");
   await c.query("REVOKE ALL ON SCHEMA "+SCHEMA+" FROM PUBLIC");
   await c.query("REVOKE ALL ON ALL TABLES IN SCHEMA "+SCHEMA+" FROM PUBLIC");
   await c.query("INSERT INTO "+SCHEMA+".runs(run_id,observed_at,record_count,review_status) "+
     "VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",[s.runId,s.observedAt,s.records.length,LEGAL_STATUS]);
   for(const r of s.records){
     await c.query("INSERT INTO "+SCHEMA+".records"+
       "(run_id,record_id,record_hash,source_url,authority_status,details) "+
       "VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING",
       [s.runId,r.id,r.recordHash,r.sourceUrl,LEGAL_STATUS,JSON.stringify(r)]);
   }
  }
  await parity(c,s);
  await c.query("COMMIT");tx=false;
  return {result:mode==="apply"?"DEV_LEGAL_IMPORT_PARITY":"DEV_LEGAL_READ_ONLY_PARITY",
    service:DEV_SERVICE,schema:SCHEMA,records:s.records.length,runId:s.runId,
    legallyApproved:0,productionWrites:0};
 }catch(e){if(tx)await c.query("ROLLBACK").catch(()=>{});throw e}
 finally{await c.end().catch(()=>{})}
}
async function main(){
 const mode=process.argv[2],args=process.argv.slice(3);
 assert.ok(["prepare","check","apply","verify"].includes(mode));
 assert.deepEqual(args,mode==="apply"?["--dev-write"]:[]);
 const s=snapshot();
 if(mode==="prepare"||mode==="check"){
   files(s,mode==="check");
   console.log(JSON.stringify({result:mode==="check"?"LEGAL_QUEUE_PARITY":"LEGAL_QUEUE_GENERATED",
     runId:s.runId,records:s.records.length,legalApprovals:0}));return;
 }
 console.log(JSON.stringify(await runDb(mode,s)));
}
main().catch((error)=>{if(["prepare","check"].includes(process.argv[2]))console.error("Seed validation: "+String(error.message).slice(0,200));else console.error("DEV legal metadata operation refused or parity failed; no credentials displayed.");process.exitCode=1});
