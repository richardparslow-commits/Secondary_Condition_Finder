import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonical, parseDevConnection, rows, sha, validate } from
  "../scripts/automation/tiger-evidence-dev.mjs";

const url = "postgresql://scf_evidence_ci_writer:synthetic-long-test-password-abcdefghijklmnop" +
  "@m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com:30902/tsdb?sslmode=require";

function fixture() {
  const article = {
    pmid:"12345678",status:"METADATA_RETRIEVED",title:"Synthetic public article",
    date:"2026",doi:"",publicationTypes:["Journal Article"],
  };
  const edge = {
    sourceId:"migraine",targetId:"anxiety-disorder",
    sourceName:"migraine",targetName:"anxiety disorder",
    publicationState:"PUBLISHED",nexusClassification:"DIRECT_CAUSATION",
    probabilityAlignment:"NOT_ASSERTED",reviewRules:["DIRECTIONAL_RELATIONSHIP_REVIEW"],
    citationPmids:["12345678"],citationCount:1,clinicalDisposition:"HUMAN_REVIEW_REQUIRED",
  };
  const doc = {
    schemaVersion:1,sourceLedgerId:"a".repeat(64),sourceCommit:"fixture",
    observedAt:"2026-11-08T00:00:00Z",clinicalApproval:"NOT_GRANTED",
    articles:[{...article,metadataHash:sha(article)}],edges:[edge],
    discoveries:[{
      sourceId:"migraine",targetId:"anxiety-disorder",
      candidatePmids:["12345678"],status:"CANDIDATES_FOUND",
      candidateClinicalSupport:"NOT_ASSESSED",
    }],
  };
  return {...doc,runId:sha(doc)};
}
test("Tiger DEV URL pins role, host, database and verified TLS", () => {
  const settings = parseDevConnection(url);
  assert.equal(settings.host,"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com");
  assert.equal(settings.user,"scf_evidence_ci_writer");
  assert.equal(settings.ssl.rejectUnauthorized,true);
  for(const changed of [
    url.replace("scf_evidence_ci_writer","tsdbadmin"),
    url.replace("m8vrpmo6ec","yc5kzxwazj"),
    url.replace("30902","37615"),
    url.replace("sslmode=require","sslmode=disable"),
    url.replace("synthetic-long-test-password-abcdefghijklmnop","short"),
  ]) assert.throws(()=>parseDevConnection(changed));
});
test("digest is deterministic across object-key ordering", () => {
  assert.equal(canonical({b:[3,1],a:1}),'{"a":1,"b":[3,1]}');
  assert.equal(sha({a:1,b:2}),sha({b:2,a:1}));
});
test("raw research is validated and assigned only review-state DB rows", () => {
  const doc = fixture();
  validate(doc);
  const p = rows(doc);
  assert.equal(p.articles.length,1);
  assert.equal(p.edges.length,1);
  assert.equal(p.edges[0].review_state,"HUMAN_REVIEW_REQUIRED");
  assert.equal(p.articles[0].clinical_support,"NOT_ASSESSED");
  assert.match(p.edges[0].content_hash,/^[a-f0-9]{64}$/);
});
test("rehashing to manufacture clinical approval is prohibited", () => {
  const doc = fixture();
  doc.clinicalApproval = "GRANTED";
  doc.runId = sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runId")));
  assert.throws(()=>validate(doc));
});
test("rehashing forged PubMed support state is prohibited", () => {
  const doc = fixture();
  doc.articles[0].status = "CAUSATION_PROVEN";
  doc.articles[0].metadataHash = sha(Object.fromEntries(
    Object.entries(doc.articles[0]).filter(([k])=>k!=="metadataHash")));
  doc.runId = sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runId")));
  assert.throws(()=>validate(doc));
});
test("removing review gate or missing PMID record is rejected", () => {
  const doc = fixture();
  doc.edges[0].clinicalDisposition = "APPROVED";
  doc.runId = sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runId")));
  assert.throws(()=>validate(doc));
  const second = fixture();
  second.articles = [];
  second.runId = sha(Object.fromEntries(Object.entries(second).filter(([k])=>k!=="runId")));
  assert.throws(()=>validate(second));
});
test("live staged public-only run is accepted when available", (t) => {
  const path="/tmp/scf-autonomous-directional-evidence/evidence-run.json";
  if(!fs.existsSync(path)) return t.skip("Live public research not staged in CI");
  const doc=JSON.parse(fs.readFileSync(path,"utf8"));
  validate(doc);
  assert.equal(doc.edges.length,48);
  assert.ok(doc.articles.length>=90 && doc.articles.length<=330);
});

test("GitHub workflow is scheduled, main-only and read-only to the repo", () => {
  const yaml = fs.readFileSync(".github/workflows/tiger-dev-directional-evidence.yml","utf8");
  assert.match(yaml,/cron: "23 2,8,14,20 \* \* \*"/);
  assert.match(yaml,/github.ref == 'refs\/heads\/main'/);
  assert.match(yaml,/environment: tiger-dev-research/);
  assert.match(yaml,/permissions:\s*contents: read/);
  assert.match(yaml,/TIGER_AUTOMATION_DEV_URL: \$\{\{ secrets.TIGER_AUTOMATION_DEV_URL \}\}/);
  assert.doesNotMatch(yaml,/pull_request:\s*|contents: write|gh pr merge|tsdbadmin/i);
  assert.match(yaml,/  track-evidence:/);
  assert.match(yaml,/needs: public-evidence-review/);
  assert.match(yaml,/issues: write/);
  assert.match(yaml,/gh issue create/);
  assert.match(yaml,/gh issue close/);
});

test("resolved PubMed sources require signed metadata fields", () => {
  const doc=fixture();
  doc.articles[0].metadataHash="";
  doc.runId=sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runId")));
  assert.throws(()=>validate(doc));
});
