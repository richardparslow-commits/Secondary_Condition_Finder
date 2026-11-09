import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canonical, sha, validate, assertDevAdmin } from
  "../scripts/automation/source-specific-tiger-dev.mjs";

const PATH="/tmp/scf-source-specific-review/source-claim-21-run.json";
const hasFixture=()=>fs.existsSync(PATH);
const source=()=>JSON.parse(fs.readFileSync(PATH,"utf8"));
const rehash=doc=>{
  doc.runSha256=sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runSha256")));
  return doc;
};

test("DEV administrator setup rejects any Production host or alternate service",()=>{
  const safe={PGHOST:"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
    PGPORT:"30902",PGDATABASE:"tsdb",PGUSER:"tsdbadmin",
    TIGER_LAB_ENDPOINT:"direct",PGPASSWORD:"synthetic-test-credential"};
  assertDevAdmin("m8vrpmo6ec",safe);
  assert.throws(()=>assertDevAdmin("yc5kzxwazj",safe));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...safe,
    PGHOST:"yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com"}));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...safe,PGDATABASE:"prod"}));
  assert.throws(()=>assertDevAdmin("m8vrpmo6ec",{...safe,TIGER_LAB_ENDPOINT:"pooled"}));
});

test("canonical metadata digest is deterministic",()=>{
  assert.equal(canonical({b:[1],a:{z:3}}),'{"a":{"z":3},"b":[1]}');
  assert.equal(sha({a:1,b:"x"}),sha({b:"x",a:1}));
  assert.notEqual(sha({a:1}),sha({a:2}));
});

test("original 21-case/20 PMID report has no approval and no copied abstracts",t=>{
  if(!hasFixture())return t.skip("Official source preflight not staged");
  const doc=source();assert.equal(validate(doc),doc);
  assert.equal(doc.humanReviewCases.length,21);
  assert.equal(new Set(doc.humanReviewCases.map(x=>x.source.pmid)).size,20);
  assert.ok(doc.humanReviewCases.every(x=>
    x.medicalClaimVerification==="NOT_ASSESSED" &&
    x.publicationAuthorization==="NOT_GRANTED" &&
    x.source.abstractRetainedInArtifact===false));
});

test("tampering with original source identity, metadata and case hashes fails closed",t=>{
  if(!hasFixture())return t.skip("Official source preflight not staged");
  for(const mutate of [
    d=>{d.humanReviewCases[0].source.pmid="00000000";},
    d=>{d.humanReviewCases[0].source.title="Invented title";},
    d=>{d.humanReviewCases[0].source.abstractRetainedInArtifact=true;},
    d=>{d.humanReviewCases[0].abstractContext.humanFullTextReview="COMPLETED";},
  ]){
    const doc=source();mutate(doc);
    assert.throws(()=>validate(doc));
  }
});

test("even rehashed unauthorized clinical approval is rejected",t=>{
  if(!hasFixture())return t.skip("Official source preflight not staged");
  const doc=source();
  const r=doc.humanReviewCases[0];
  r.humanReviewerDecision="APPROVED";
  r.medicalClaimVerification="VERIFIED";
  r.contentSha256=sha(Object.fromEntries(Object.entries(r).filter(([k])=>k!=="contentSha256")));
  assert.throws(()=>validate(rehash(doc)));
});

test("weekly DEV workflow uses protected role, independent parity, no Production edits",()=>{
  const yaml=fs.readFileSync(".github/workflows/tiger-dev-clinical-accuracy-triage.yml","utf8");
  assert.match(yaml,/environment: tiger-dev-research/);
  assert.match(yaml,/source_specific_preflight\.py/);
  assert.match(yaml,/source-specific-tiger-dev\.mjs apply --dev-write/);
  assert.match(yaml,/source-specific-tiger-dev\.mjs verify/);
  assert.match(yaml,/TIGER_AUTOMATION_DEV_URL: \$\{\{ secrets.TIGER_AUTOMATION_DEV_URL \}\}/);
  assert.doesNotMatch(yaml,/gh pr merge|tsdbadmin|contents: write|PRODUCTION_DATABASE_URL/i);
});
