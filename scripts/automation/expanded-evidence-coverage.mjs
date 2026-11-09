#!/usr/bin/env node
/** Independent read-only Tiger DEV research-coverage report, never clinical approval. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import { Client } from "pg";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SCHEMA="scf_autonomous_evidence_dev";
const BASE="/tmp/scf-clinical-review-batch1/clinical-review-ledger.json";
const OUTPUT="/tmp/scf-autonomous-expanded-evidence/coverage.json";

export function tallyCoverage(ledger, stored) {
  assert.equal(ledger.conditionCount,819);
  assert.equal(ledger.pathwayCount,875);
  assert.equal(ledger.clinicalApproval,"NOT_GRANTED");
  assert.equal(ledger.pathways.length,875);
  const known=new Map(ledger.pathways.map(p=>[p.sourceId+"|"+p.targetId,p]));
  assert.equal(known.size,875);
  const initial=new Set(ledger.pathways.filter(p=>
    ["DIRECT_CAUSATION","AGGRAVATION"].includes(p.nexusClassification) ||
    (p.publicationState==="PUBLISHED" &&
     p.vaNexusProbabilityAlignment==="AT_LEAST_AS_LIKELY_AS_NOT")
  ).map(p=>p.sourceId+"|"+p.targetId));
  assert.equal(initial.size,48);
  const covered=new Set();
  let inInitial=0,inRemainder=0,published=0,draft=0,publishedRemainder=0;
  for (const row of stored) {
    const id=row.source_id+"|"+row.target_id;
    const original=known.get(id);
    assert.ok(original,"DB pathway absent from committed source ledger");
    assert.equal(row.publication_state,original.publicationState);
    assert.equal(row.nexus_classification,original.nexusClassification);
    assert.ok(!covered.has(id),"Duplicate pathway returned by distinct coverage query");
    covered.add(id);
    if(row.publication_state==="PUBLISHED") published++;
    else draft++;
    if(initial.has(id)) inInitial++;
    else {
      inRemainder++;
      if(row.publication_state==="PUBLISHED") publishedRemainder++;
    }
  }
  return {
    researchCoverageState:"RESEARCH_METADATA_COLLECTED_NOT_CLINICALLY_VERIFIED",
    totalAuthored:875,totalUniqueResearchCovered:covered.size,
    totalResearchPending:875-covered.size,
    originalDirectionalScope:48,originalDirectionalCovered:inInitial,
    remainingScope:827,remainingResearchCovered:inRemainder,
    remainingResearchPending:827-inRemainder,
    publishedRemainingScope:227,publishedRemainingResearchCovered:publishedRemainder,
    uniquePublishedResearchCovered:published,uniqueDraftResearchCovered:draft,
    clinicalApprovals:0,productionChanges:0,
  };
}
export async function run(out=OUTPUT) {
  const ledger=JSON.parse(fs.readFileSync(BASE,"utf8"));
  const client=new Client(parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL));
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='12000ms'");
    const query=`SELECT DISTINCT p.source_id,p.target_id,p.publication_state,p.nexus_classification
      FROM ${SCHEMA}.pathway_reviews p JOIN ${SCHEMA}.runs r ON r.run_id=p.run_id
      WHERE r.source_ledger_id=$1
      ORDER BY p.source_id,p.target_id,p.publication_state,p.nexus_classification`;
    const times=[];
    let result;
    for (let i=0;i<3;i++) {
      const start=performance.now();
      result=await client.query(query,[ledger.runId]);
      times.push(Number((performance.now()-start).toFixed(2)));
    }
    times.sort((a,b)=>a-b);
    const coverage=tallyCoverage(ledger,result.rows);
    const aggregate=await client.query(
      `SELECT COUNT(DISTINCT r.run_id)::int AS runs, COUNT(*)::int AS pathway_rows,
      (SELECT COUNT(*)::int FROM ${SCHEMA}.pubmed_articles pa
       JOIN ${SCHEMA}.runs rr ON rr.run_id=pa.run_id
       WHERE rr.source_ledger_id=$1) AS article_rows
       FROM ${SCHEMA}.runs r JOIN ${SCHEMA}.pathway_reviews p ON p.run_id=r.run_id
       WHERE r.source_ledger_id=$1`,[ledger.runId]);
    const report={...coverage,runs:aggregate.rows[0].runs,
      totalStoredPathwayObservations:aggregate.rows[0].pathway_rows,
      totalStoredPubMedObservations:aggregate.rows[0].article_rows,
      devQueryRoundTripMedianMs:times[1],devQueryRoundTripMaxMs:times[2],
      environment:"DEV",sourceLedgerId:ledger.runId,
      caveat:"Research-collection coverage, not verified support, causation or VA nexus"};
    await client.query("ROLLBACK");
    fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n",{mode:0o600});
    return report;
  } finally {
    await client.query("ROLLBACK").catch(()=>undefined);
    await client.end().catch(()=>undefined);
  }
}
if(process.argv[1]?.endsWith("expanded-evidence-coverage.mjs")) {
  run().then(result=>console.log(JSON.stringify(result))).catch(()=>{
    console.error("DEV research coverage failed; no credentials disclosed");
    process.exitCode=1;
  });
}
