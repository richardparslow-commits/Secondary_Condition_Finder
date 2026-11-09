import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  assertDevAdmin,sha,validate,
} from "../scripts/automation/clinical-accuracy-tiger-dev.mjs";

const FIXTURE="./scripts/automation/fixtures/mondo-v2026-10-06/identity-review-candidates.json";
const RUN="/tmp/scf-clinical-accuracy-triage/triage-run.json";
const data=()=>({
  identity:JSON.parse(fs.readFileSync(FIXTURE,"utf8")),
  run:JSON.parse(fs.readFileSync(RUN,"utf8")),
});
const recalc=(obj,key)=>sha(Object.fromEntries(
  Object.entries(obj).filter(([k])=>k!==key)));

test("DEV database admin accepts only the pinned, non-production endpoint",()=>{
  const fake={
    PGHOST:"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
    PGPORT:"30902",PGUSER:"tsdbadmin",PGDATABASE:"tsdb",
    TIGER_LAB_ENDPOINT:"direct",PGPASSWORD:"synthetic-test",
  };
  assertDevAdmin("m8vrpmo6ec",fake);
  assert.throws(()=>assertDevAdmin("yc5kzxwazj",fake));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{
    ...fake,PGHOST:"yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com",
  }));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{
    ...fake,PGUSER:"scf_evidence_ci_writer",
  }));
});

test("full pinned 375-condition fixture validates with zero approved mappings",()=>{
  const {identity}=data();
  assert.equal(identity.records.length,375);
  assert.equal(identity.automaticOntologyDecisions,0);
  assert.ok(identity.records.every(r=>r.humanIdentityReviewState==="NOT_ASSESSED"));
  assert.equal(recalc(identity,"snapshotSha256"),identity.snapshotSha256);
});

test("21 real authored high-priority cases and 20 PubMed records have unapproved states",t=>{
  if(!fs.existsSync(RUN))return t.skip("Live public research not staged in CI");
  const {identity,run}=data();
  assert.equal(validate(identity,run),true);
  assert.equal(run.priorityPathways.length,21);
  assert.equal(run.publicationMetadata.length,20);
  assert.equal(run.automaticClinicalApprovals,0);
  assert.equal(run.productionChanges,0);
});

test("tampering with bibliography or ontology evidence fails",t=>{
  if(!fs.existsSync(RUN))return t.skip("Live public research not staged in CI");
  const {identity,run}=data();
  run.priorityPathways[0].authoredNexusClassification="NOT_A_REAL_CLASS";
  assert.throws(()=>validate(identity,run));
  const other=data();
  other.identity.records[0].authoredLabel="tampered";
  assert.throws(()=>validate(other.identity,other.run));
});

test("even with recomputed digests, approvals fail closed",t=>{
  if(!fs.existsSync(RUN))return t.skip("Live public research not staged in CI");
  const {identity,run}=data();
  run.priorityPathways[0].medicalClaimVerification="VERIFIED";
  run.priorityPathways[0].rowSha256=recalc(run.priorityPathways[0],"rowSha256");
  run.runSha256=recalc(run,"runSha256");
  assert.throws(()=>validate(identity,run));
  const other=data();
  other.identity.records[0].humanIdentityReviewState="APPROVED";
  other.identity.records[0].rowSha256=recalc(
    other.identity.records[0],"rowSha256");
  other.identity.snapshotSha256=recalc(other.identity,"snapshotSha256");
  other.run.ontologyReviewFixtureSha256=other.identity.snapshotSha256;
  other.run.runSha256=recalc(other.run,"runSha256");
  assert.throws(()=>validate(other.identity,other.run));
});

test("run metadata records do not store any PubMed abstract text",t=>{
  if(!fs.existsSync(RUN))return t.skip("Live public research not staged in CI");
  const {identity,run}=data();
  validate(identity,run);
  assert.ok(run.publicationMetadata.every(r=>r.originalAbstractStored===false));
  assert.ok(run.publicationMetadata.every(r=>
    r.sourceClaimVerification==="NOT_ASSESSED"));
});

test("weekly protected DEV workflow preserves human review and least privilege",()=>{
  const yaml=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  assert.match(yaml,/cron: "41 4 \* \* 1"/);
  assert.match(yaml,/environment: tiger-dev-research/);
  assert.match(yaml,/github.ref == 'refs\/heads\/main'/);
  assert.match(yaml,/permissions:\s*contents: read/);
  assert.match(yaml,/TIGER_AUTOMATION_DEV_URL: \$\{\{ secrets.TIGER_AUTOMATION_DEV_URL \}\}/);
  assert.match(yaml,/clinical_accuracy_triage.py/);
  assert.match(yaml,/clinical-accuracy-tiger-dev.mjs verify/);
  assert.match(yaml,/issues: write/);
  assert.doesNotMatch(yaml,/gh pr merge|contents: write|TIGER_DATABASE_URL|PRODUCTION_DATABASE_URL/i);
});

test("clinical triage engineering notification shell is syntactically complete",()=>{
  const yaml=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  const section=yaml.match(/      - name: Maintain single failure or source-status issue[\s\S]*?        run: \|\n([\s\S]*)$/);
  assert.ok(section,"Notification script must be present");
  const script=section[1].split("\n").map(line=>
    line.startsWith("          ")?line.slice(10):line).join("\n");
  const check=spawnSync("bash",["-n"],{input:script,encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
  const broken=script.replace(/\nfi\s*$/,"");
  const negative=spawnSync("bash",["-n"],{input:broken,encoding:"utf8"});
  assert.notEqual(negative.status,0,"A missing outer fi must fail the syntax gate");
});
