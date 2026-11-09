import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  assertDev, canonical, digest, validateLedger,
} from "../scripts/clinical-review-tiger-dev.mjs";

const DEV = {
  PGHOST:"m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
  PGPORT:"30902",PGUSER:"tsdbadmin",PGDATABASE:"tsdb",
  TIGER_LAB_ENDPOINT:"direct",PGPASSWORD:"synthetic-test-only",
};
const STAGED = "/tmp/scf-clinical-review-batch1/clinical-review-ledger.json";
const sample = () => JSON.parse(fs.readFileSync(STAGED,"utf8"));

test("isolated DEV connection refuses unexpected Production hosts and pooled writes", () => {
  assertDev("m8vrpmo6ec", DEV);
  assert.throws(() => assertDev("yc5kzxwazj", DEV));
  assert.throws(() => assertDev("m8vrpmo6ec", {...DEV,
    PGHOST:"yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com"}));
  assert.throws(() => assertDev("m8vrpmo6ec", {...DEV,TIGER_LAB_ENDPOINT:"pooled"}));
  assert.throws(() => assertDev("m8vrpmo6ec", {...DEV,PGPASSWORD:""}));
});

test("content digest canonicalizes key order and rejects edits", () => {
  assert.equal(canonical({b:2,a:{z:[3,1],x:false}}),
    '{"a":{"x":false,"z":[3,1]},"b":2}');
  assert.equal(digest({a:1,b:"ok"}),digest({b:"ok",a:1}));
  assert.notEqual(digest({a:1,b:"ok"}),digest({a:2,b:"ok"}));
});

test("full staged ledger covers every condition and pathway and forbids clinical approval", (t) => {
  if (!fs.existsSync(STAGED)) return t.skip("Official ontology review snapshot not staged in CI");
  const ledger = sample();
  assert.equal(validateLedger(ledger), ledger);
  assert.equal(ledger.conditions.length,819);
  assert.equal(ledger.pathways.length,875);
  assert.ok(ledger.conditions.every((r) => r.clinicalApproval==="NOT_GRANTED"));
  assert.ok(ledger.pathways.every((r) => r.clinicalApproval==="NOT_GRANTED"));
  assert.ok(ledger.pathways.every((r) => r.reviewState==="HUMAN_CLINICAL_REVIEW_REQUIRED"));
});

test("tampering with an identity, nexus classification or flag without recomputing hashes fails", (t) => {
  if (!fs.existsSync(STAGED)) return t.skip("Official ontology review snapshot not staged in CI");
  for (const target of ["identity","classification","flag"]) {
    const ledger = sample();
    if (target==="identity") ledger.conditions[0].ontologyStatus="APPROVED";
    if (target==="classification") ledger.pathways[0].nexusClassification="DIRECT_CAUSATION";
    if (target==="flag") ledger.pathways[0].findings.push({
      rule:"UNSUPPORTED",severity:"HIGH",field:"nexus",signal:"fake",
    });
    assert.throws(() => validateLedger(ledger));
  }
});

test("even rehashed attempt to mark a pathway medically approved fails", (t) => {
  if (!fs.existsSync(STAGED)) return t.skip("Official ontology review snapshot not staged in CI");
  const ledger = sample();
  const row = ledger.pathways[0];
  row.clinicalApproval="GRANTED";
  row.contentSha256=digest(Object.fromEntries(Object.entries(row)
    .filter(([key])=>key!=="contentSha256")));
  ledger.runId=digest(Object.fromEntries(Object.entries(ledger)
    .filter(([key])=>key!=="runId")));
  assert.throws(() => validateLedger(ledger));
});

test("published sleep apnea to anxiety pathway generates explicit high-priority consistency flags", (t) => {
  if (!fs.existsSync(STAGED)) return t.skip("Official ontology review snapshot not staged in CI");
  const row = sample().pathways.find((r) =>
    r.sourceId==="sleep-apnea" && r.targetId==="anxiety-disorder");
  assert.ok(row);
  assert.equal(row.publicationState,"PUBLISHED");
  assert.equal(row.nexusClassification,"DIRECT_CAUSATION");
  assert.ok(row.findings.some((f) =>
    f.rule==="CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE" &&
    f.severity==="HIGH"));
  assert.ok(row.findings.some((f) =>
    f.rule==="INDIVIDUAL_NEXUS_ASSERTION_IN_GENERIC_KNOWLEDGE_BASE"));
});

test("ledger flags are never treated as qualified clinical adjudications", (t) => {
  if (!fs.existsSync(STAGED)) return t.skip("Official ontology review snapshot not staged in CI");
  const ledger=sample();
  const high=ledger.pathways.filter((r)=>r.findings.some((f)=>f.severity==="HIGH"));
  assert.equal(high.length,30);
  assert.equal(high.filter((r)=>r.publicationState==="PUBLISHED").length,21);
  assert.equal(ledger.pathways.reduce((n,r)=>n+r.citationCount,0),1704);
});
