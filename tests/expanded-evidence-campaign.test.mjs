import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sha, validate } from "../scripts/automation/tiger-evidence-dev.mjs";
import { tallyCoverage } from "../scripts/automation/expanded-evidence-coverage.mjs";

const LEDGER="/tmp/scf-clinical-review-batch1/clinical-review-ledger.json";
function fixture() {
  const edges=Array.from({length:100},(_,n)=>({
    sourceId:"synthetic-source-"+n,targetId:"synthetic-target-"+n,
    sourceName:"synthetic source",targetName:"synthetic target",
    publicationState:"PUBLISHED",nexusClassification:"ASSOCIATION_ONLY",
    probabilityAlignment:"NOT_ASSERTED",reviewRules:[],
    citationPmids:["12345678"],citationCount:1,
    clinicalDisposition:"HUMAN_REVIEW_REQUIRED",
  }));
  const article={pmid:"12345678",status:"METADATA_RETRIEVED",
    title:"Synthetic metadata only",date:"2026",doi:"",
    publicationTypes:["Journal Article"]};
  const doc={
    schemaVersion:1,sourceLedgerId:"a".repeat(64),sourceCommit:"fixture",
    observedAt:"2026-11-09T00:00:00Z",clinicalApproval:"NOT_GRANTED",
    campaignScope:"REMAINDER_RESEARCH_ONLY",batchIndex:0,batchCount:9,
    batchSize:100,totalRemainder:827,priorDirectional:48,fullInventory:875,
    selectionDigest:"b".repeat(64),edges,
    articles:[{...article,metadataHash:sha(article)}],
    discoveries:edges.map(e=>({
      sourceId:e.sourceId,targetId:e.targetId,candidatePmids:[],
      status:"NO_TEXT_MATCH",candidateClinicalSupport:"NOT_ASSESSED",
    })),
  };
  return {...doc,runId:sha(doc)};
}
function rehash(doc) {
  doc.runId=sha(Object.fromEntries(Object.entries(doc).filter(([k])=>k!=="runId")));
  return doc;
}

test("valid synthetic 100-row continuation is constrained to research-only state",()=>{
  const doc=fixture();
  assert.equal(validate(doc),doc);
  assert.equal(doc.edges.length,100);
  assert.ok(doc.edges.every(e=>e.clinicalDisposition==="HUMAN_REVIEW_REQUIRED"));
});

test("refuses rehashed altered campaign scope, batch count, batch index and inventory",()=>{
  const changes=[
    ["campaignScope","AUTO_PUBLISH"],
    ["batchIndex",9],
    ["batchCount",10],
    ["totalRemainder",826],
    ["priorDirectional",0],
    ["fullInventory",900],
    ["selectionDigest","not-a-digest"],
  ];
  for(const [key,value] of changes) {
    const doc=fixture();
    doc[key]=value;
    assert.throws(()=>validate(rehash(doc)),key);
  }
});

test("refuses partial campaign metadata or attempts to approve medical causation",()=>{
  const partial=fixture();
  delete partial.selectionDigest;
  assert.throws(()=>validate(rehash(partial)));
  const approved=fixture();
  approved.clinicalApproval="GRANTED";
  assert.throws(()=>validate(rehash(approved)));
  const invented=fixture();
  invented.discoveries[0].candidateClinicalSupport="CLINICALLY_VERIFIED";
  assert.throws(()=>validate(rehash(invented)));
});

test("rejects undersized nonfinal and oversized final batches",()=>{
  const incomplete=fixture();
  incomplete.edges.pop();
  incomplete.discoveries.pop();
  assert.throws(()=>validate(rehash(incomplete)));
  const last=fixture();
  last.batchIndex=8;
  assert.throws(()=>validate(rehash(last)));
  last.edges=last.edges.slice(0,27);
  last.discoveries=last.discoveries.slice(0,27);
  assert.equal(validate(rehash(last)),last);
});

test("remaining coverage distinguishes research collection from clinical verification",t=>{
  if (!fs.existsSync(LEDGER)) return t.skip("Pinned clinical ledger absent in CI");
  const ledger=JSON.parse(fs.readFileSync(LEDGER,"utf8"));
  const empty=tallyCoverage(ledger,[]);
  assert.equal(empty.remainingResearchPending,827);
  assert.equal(empty.clinicalApprovals,0);
  assert.equal(empty.totalResearchPending,875);
  const p=ledger.pathways[0];
  const row={source_id:p.sourceId,target_id:p.targetId,
    publication_state:p.publicationState,nexus_classification:p.nexusClassification};
  const one=tallyCoverage(ledger,[row]);
  assert.equal(one.totalUniqueResearchCovered,1);
  assert.equal(one.totalResearchPending,874);
  assert.equal(one.clinicalApprovals,0);
  assert.throws(()=>tallyCoverage(ledger,[row,row]),/Duplicate/);
  assert.throws(()=>tallyCoverage(ledger,[{...row,source_id:"invented"}]));
});

test("scope is documented and workflow uses a protected DEV-only environment",()=>{
  const yaml=fs.readFileSync(".github/workflows/tiger-dev-expanded-evidence.yml","utf8");
  assert.match(yaml,/cron: "11 3,9,15,21 \* \* \*"/);
  assert.match(yaml,/environment: tiger-dev-research/);
  assert.match(yaml,/github.ref == 'refs\/heads\/main'/);
  assert.match(yaml,/permissions:\s*contents: read/);
  assert.match(yaml,/TIGER_AUTOMATION_DEV_URL: \$\{\{ secrets.TIGER_AUTOMATION_DEV_URL \}\}/);
  assert.match(yaml,/expanded_evidence_campaign.py/);
  assert.match(yaml,/expanded-evidence-coverage.mjs/);
  assert.doesNotMatch(yaml,/gh pr merge|contents: write|tsdbadmin|PRODUCTION_DATABASE_URL/i);
  assert.match(yaml,/issues: write/);
});
