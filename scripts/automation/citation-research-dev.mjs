#!/usr/bin/env node
/** Public bibliography export, Tiger DEV read-only; never validates clinical support. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { Client } from "pg";
import { parseDevConnection } from "./tiger-evidence-dev.mjs";

const SOURCE="dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa";
const OUTPUT="/tmp/scf-clinical-accuracy-triage/citation-research-metadata.json";
export function assertRows(rows) {
  assert.ok(Array.isArray(rows) && rows.length<=12000);
  for(const row of rows) {
    assert.match(row.pmid,/^\d{4,9}$/);
    assert.ok(["METADATA_RETRIEVED","PUBLICATION_STATUS_REVIEW",
      "UNRESOLVED","PROVIDER_UNAVAILABLE"].includes(row.status));
    assert.equal(row.clinicalSupport,"NOT_ASSESSED");
  }
}
async function main() {
  const db=new Client(parseDevConnection(process.env.TIGER_AUTOMATION_DEV_URL));
  await db.connect();
  try {
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout='12000ms'");
    const res=await db.query(
      "SELECT DISTINCT ON (a.pmid) a.pmid,a.status,a.clinical_support AS \"clinicalSupport\" "+
      "FROM scf_autonomous_evidence_dev.pubmed_articles a "+
      "JOIN scf_autonomous_evidence_dev.runs r ON r.run_id=a.run_id "+
      "WHERE r.source_ledger_id=$1 ORDER BY a.pmid,r.inserted_at DESC,a.run_id DESC",[SOURCE]);
    assertRows(res.rows);
    fs.mkdirSync("/tmp/scf-clinical-accuracy-triage",{recursive:true});
    fs.writeFileSync(OUTPUT,JSON.stringify({
      sourceLedgerId:SOURCE,articles:res.rows})+"\n",{mode:0o600});
    await db.query("ROLLBACK");
    console.log(JSON.stringify({result:"READ_ONLY_DEV_METADATA_EXPORT",
      observations:res.rows.length,clinicalApprovals:0}));
  } finally {
    await db.query("ROLLBACK").catch(()=>undefined);
    await db.end().catch(()=>undefined);
  }
}
if(process.argv[1]?.endsWith("citation-research-dev.mjs")) {
  main().catch(()=>{console.error("DEV bibliographic export failed");process.exitCode=1;});
}
