#!/usr/bin/env node
/** Read-only Tiger DEV review dashboard. Exports only public authored metadata. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { openDev, validateLedger } from "./clinical-review-tiger-dev.mjs";

const INPUT = "/tmp/scf-clinical-review-batch1/clinical-review-ledger.json";
const OUTPUT = "/tmp/scf-clinical-review-batch1";
const SCHEMA = "scf_clinical_review_dev";
export function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""').replaceAll("\r", " ")
    .replaceAll("\n", " ") + '"';
}

async function main() {
  const ledger = validateLedger(JSON.parse(fs.readFileSync(INPUT, "utf8")));
  const db = await openDev();
  try {
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout='10000ms'");
    const [conditions, pathways] = await Promise.all([
      db.query(`SELECT id,name,publication_state,ontology_status,candidate_count,review_state
        FROM ${SCHEMA}.conditions WHERE run_id=$1 ORDER BY id`,[ledger.runId]),
      db.query(`SELECT p.source_id,p.target_id,p.publication_state,p.nexus_classification,
        p.probability,p.citation_count,p.declared_verified,p.findings,p.review_state,
        c1.name AS source_name,c2.name AS target_name
        FROM ${SCHEMA}.pathways p
        JOIN ${SCHEMA}.conditions c1 ON c1.run_id=p.run_id AND c1.id=p.source_id
        JOIN ${SCHEMA}.conditions c2 ON c2.run_id=p.run_id AND c2.id=p.target_id
        WHERE p.run_id=$1 ORDER BY p.source_id,p.target_id`,[ledger.runId]),
    ]);
    assert.equal(conditions.rows.length, 819);
    assert.equal(pathways.rows.length, 875);
    assert.equal(conditions.rows.filter((c)=>c.publication_state==="PUBLISHED").length,140);
    assert.equal(pathways.rows.filter((c)=>c.publication_state==="PUBLISHED").length,248);
    const high = pathways.rows.filter((p)=>p.findings.some((f)=>f.severity==="HIGH"));
    assert.equal(high.length,30);
    assert.equal(high.filter((p)=>p.publication_state==="PUBLISHED").length,21);
    const statuses = Object.fromEntries(
      [...new Set(conditions.rows.map((r)=>r.ontology_status))].sort().map((s)=>[
        s,conditions.rows.filter((r)=>r.ontology_status===s).length,
      ]));
    assert.equal(statuses.UNIQUE_LEXICAL_CANDIDATE_REVIEW,444);
    assert.equal(statuses.AMBIGUOUS_LEXICAL_CANDIDATES,51);
    assert.equal(statuses.NO_EXACT_ONTOLOGY_MATCH,324);

    const summary = {
      runId:ledger.runId,source:"Tiger Cloud PostgreSQL DEV",
      ontology:ledger.ontologySnapshot, conditions:819,publishedConditions:140,
      pathways:875,publishedPathways:248,referenceLinks:1704,
      ontologyReview:statuses,highReviewPathways:30,publishedHighReviewPathways:21,
      independentlyClinicallyApproved:0,clinicalConclusions:"NOT_ASSESSED",
      reviewerStatus:"HUMAN_REVIEW_REQUIRED",
      reportNotMedicalAdvice:true,
    };
    fs.mkdirSync(OUTPUT,{recursive:true,mode:0o700});
    fs.writeFileSync(OUTPUT+"/dashboard-summary.json",JSON.stringify(summary,null,2)+"\n",
      {mode:0o600});
    const ranked = high.toSorted((a,b)=>{
      const ap=a.publication_state==="PUBLISHED"?0:1;
      const bp=b.publication_state==="PUBLISHED"?0:1;
      return ap-bp || a.source_id.localeCompare(b.source_id) ||
        a.target_id.localeCompare(b.target_id);
    });
    const rows=ranked.map((p)=>({
      source:p.source_id,target:p.target_id,from:p.source_name,to:p.target_name,
      publication:p.publication_state,nexus:p.nexus_classification,
      probability:p.probability,
      rules:[...new Set(p.findings.filter((f)=>f.severity==="HIGH").map((f)=>f.rule))].sort(),
    }));
    const columns=["source","target","from","to","publication","nexus","probability","rules"];
    fs.writeFileSync(OUTPUT+"/high-priority-review.csv",
      columns.map(csvCell).join(",")+"\n"+rows.map((r)=>
        columns.map((c)=>csvCell(Array.isArray(r[c])?r[c].join("; "):r[c])).join(",")).join("\n")+"\n",
      {mode:0o600});

    const body = rows.map((r,i)=>
      "<tr><td>"+(i+1)+"</td><td>"+escapeHtml(r.from)+"<div class='muted'>"+
      escapeHtml(r.source)+"</div></td><td>"+escapeHtml(r.to)+"<div class='muted'>"+
      escapeHtml(r.target)+"</div></td><td>"+escapeHtml(r.publication)+
      "</td><td>"+escapeHtml(r.nexus)+"</td><td>"+
      r.rules.map((rule)=>"<div class='tag'>"+escapeHtml(rule)+"</div>").join("")+"</td></tr>").join("\n");

    const html = [
      "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
      "<meta name='viewport' content='width=device-width, initial-scale=1'>",
      "<title>Secondary Condition Finder — DEV Clinical Mapping Review</title>",
      "<style>",
      "body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f4f7fb;color:#152438}",
      "main{max-width:1180px;margin:auto;padding:30px 20px 60px}",
      "h1{font-size:28px}h2{font-size:20px;margin-top:30px}p{line-height:1.55}",
      ".sub{color:#567} .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}",
      ".tile{background:white;border:1px solid #d9e2ee;padding:16px;border-radius:12px}",
      ".num{font-size:32px;font-weight:750;display:block;margin-top:4px}",
      ".tablewrap{overflow:auto;border:1px solid #d9e2ee;border-radius:12px;background:white}",
      "table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}",
      "th,td{padding:11px;border-bottom:1px solid #e8eef5;vertical-align:top}",
      "th{background:#e7f0fa;white-space:nowrap}",
      ".muted{color:#617389;font-size:11px;margin-top:4px}",
      ".tag{background:#f2e9dd;border-radius:5px;padding:3px 5px;margin:3px 0}",
      ".notice{background:white;border-left:4px solid #365f87;padding:14px 20px}",
      "</style></head><body><main>",
      "<h1>Clinical Mapping Verification — Batch 1</h1>",
      "<p class='sub'>Tiger Cloud DEV • versioned condition and pathway audit • source snapshot "+
        escapeHtml(ledger.runId.slice(0,16))+"</p>",
      "<div class='notice'><strong>Research-review only.</strong> All findings are heuristic review signals, not medical error determinations, clinical verification, individual VA nexus findings or approval to change the live application.</div>",
      "<h2>Coverage and outstanding review</h2><div class='stats'>",
      ...[
        ["Conditions inventoried","819"],
        ["Pathways inventoried","875"],
        ["Published pathways","248"],
        ["High-priority review pathways","30"],
        ["High-priority published","21"],
        ["Unique lexical candidates","444"],
        ["Ambiguous identities","51"],
        ["No exact lexical candidate","324"],
      ].map(([label,value])=>"<div class='tile'>"+escapeHtml(label)+
        "<span class='num'>"+escapeHtml(value)+"</span></div>"),
      "</div><h2>Thirty high-priority pathway review items</h2>",
      "<p>Sorted with published mappings first. The rule identifies language or metadata requiring qualified-human review, not a verified clinical contradiction.</p>",
      "<div class='tablewrap'><table><thead><tr><th>#</th><th>Primary</th><th>Secondary</th><th>Published</th><th>Authored nexus</th><th>Review rules</th></tr></thead><tbody>",
      body,
      "</tbody></table></div>",
      "<p class='sub'>Other review queues: 507 clinical reference-state flags, 592 ontology-endpoint flags and 48 authored directionality flags. Counts overlap and are not necessarily errors.</p>",
      "<p class='sub'>No automated medical approvals. Review medical evidence, legal criteria, possible alternate causes and individual facts independently before any publication.</p>",
      "</main></body></html>",
    ].join("\n");
    fs.writeFileSync(OUTPUT+"/review-dashboard.html",html,{mode:0o600});
    await db.query("ROLLBACK");
    return {result:"REVIEW_DASHBOARD_EXPORTED",environment:"DEV",
      report:OUTPUT+"/review-dashboard.html",csv:OUTPUT+"/high-priority-review.csv",...summary};
  } finally {
    await db.query("ROLLBACK").catch(()=>undefined);
    await db.end().catch(()=>undefined);
  }
}
if(process.argv[1]?.endsWith("report-clinical-review-dev.mjs")) {
  main().then((r)=>console.log(JSON.stringify(r))).catch(()=>{
    console.error("DEV review report failed (no sensitive details logged)");
    process.exitCode=1;
  });
}
