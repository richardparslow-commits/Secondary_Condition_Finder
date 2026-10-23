/* eslint-disable @typescript-eslint/no-require-imports */
// Qualified-human citation-verification dashboard generator.
//
// Emits a self-contained interactive HTML dashboard over every pending
// (`verified` is not `true`) sourceReference in data/knowledge-base — the same
// extraction rule as scripts/report-citation-verification-queue.js. Rows are
// packed into reviewer-ready batches, oldest first:
//
//   * rows sort by `sourceCheckedOn` ascending (oldest source-check first),
//     with a deterministic mappingId / conditionId / citation tie-break;
//   * rows of one edge (primary -> secondary) stay together — a batch boundary
//     never splits a worksheet, so a batch may exceed the size cap only by the
//     remainder of its final edge;
//   * edges pack greedily until the cap would be exceeded.
//
// The dashboard prepares review and only prepares review: it records
// reviewer decisions in the browser (localStorage) and exports SOP decision
// records, but it never changes repository source records. Only a qualified
// human reviewer may flip a reference to `verified: true`, per
// docs/citation-verification-sop.md.
//
// Usage:
//   node scripts/generate-citation-verification-dashboard.js
//   node scripts/generate-citation-verification-dashboard.js --batch-size 30
//   node scripts/generate-citation-verification-dashboard.js --out /tmp/x.html

const fs = require("fs");
const path = require("path");

const KB_DIR = path.join("data", "knowledge-base");
const DEFAULT_OUT = path.join("docs", "citation-verification-dashboard.html");
const DEFAULT_BATCH_SIZE = 25;

const args = process.argv.slice(2);
const readFlag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const OUT = readFlag("--out", DEFAULT_OUT);
const BATCH_SIZE = Math.max(1, Number(readFlag("--batch-size", String(DEFAULT_BATCH_SIZE))) || DEFAULT_BATCH_SIZE);

const pmidOf = (citation) => {
  const match = /PMID[:\s#]*(\d{6,9})/i.exec(citation || "");
  return match ? match[1] : "";
};

// ---- row extraction (mirrors report-citation-verification-queue.js) ----

const rows = [];
const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith(".json")).sort();
for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(KB_DIR, file), "utf8"));
  const isDraft = mapping.draft === true;
  for (const suggestion of mapping.suggestions || []) {
    const nexus = suggestion.nexusClaim || {};
    const claim = nexus.associationBasis || suggestion.rationale || "";
    const boundary = nexus.causationStatus || "";
    (suggestion.sourceReferences || []).forEach((reference, sourceIndex) => {
      if (reference.verified === true) return;
      rows.push({
        rowId: `${mapping.id}::${suggestion.conditionId}::${pmidOf(reference.citation) || sourceIndex}`,
        mappingId: mapping.id,
        conditionId: suggestion.conditionId,
        publicationState: isDraft ? "draft-quarantined" : "published",
        nexusClassification: nexus.nexusClassification || "",
        claim,
        boundary,
        citation: reference.citation || "",
        pmid: pmidOf(reference.citation),
        verificationScope: reference.verificationScope || "",
        sourceUrl: reference.sourceUrl || "",
        sourceCheckedOn: reference.sourceCheckedOn || "",
        sourceLocator: reference.sourceLocator || "",
        note: reference.note || "",
      });
    });
  }
}

rows.sort((a, b) =>
  a.sourceCheckedOn.localeCompare(b.sourceCheckedOn) ||
  a.mappingId.localeCompare(b.mappingId) ||
  a.conditionId.localeCompare(b.conditionId) ||
  a.citation.localeCompare(b.citation)
);

// ---- batch packing (whole edges, oldest first, soft row cap) ----

const edgeKey = (row) => `${row.mappingId}::${row.conditionId}`;
const edges = new Map();
for (const row of rows) {
  const key = edgeKey(row);
  if (!edges.has(key)) edges.set(key, []);
  edges.get(key).push(row);
}
const orderedEdges = [...edges.entries()].sort((a, b) =>
  a[1][0].sourceCheckedOn.localeCompare(b[1][0].sourceCheckedOn) ||
  a[0].localeCompare(b[0])
);

const batches = [];
let current = { rows: [] };
for (const [, edgeRows] of orderedEdges) {
  if (current.rows.length > 0 && current.rows.length + edgeRows.length > BATCH_SIZE) {
    batches.push(current);
    current = { rows: [] };
  }
  current.rows.push(...edgeRows);
}
if (current.rows.length > 0) batches.push(current);

batches.forEach((batch, index) => {
  const dates = batch.rows.map((r) => r.sourceCheckedOn).sort();
  const sources = new Set(batch.rows.map((r) => r.citation));
  batch.id = `batch-${String(index + 1).padStart(2, "0")}`;
  batch.number = index + 1;
  batch.cohortFrom = dates[0];
  batch.cohortTo = dates[dates.length - 1];
  batch.sourceCount = sources.size;
});

// shared-use counts across the whole queue (a reviewer opens a shared source once)
const usesPerCitation = new Map();
for (const row of rows) {
  usesPerCitation.set(row.citation, (usesPerCitation.get(row.citation) || 0) + 1);
}
for (const batch of batches) {
  for (const row of batch.rows) row.totalUses = usesPerCitation.get(row.citation);
}

const summary = {
  generatedFrom: "data/knowledge-base published and draft-quarantined mappings",
  extractionRule: "every sourceReference whose verified is not true — identical to scripts/report-citation-verification-queue.js --include-drafts",
  qualificationRule: "Only a qualified human reviewer may change repository source records to verified:true.",
  batchSizeCap: BATCH_SIZE,
  pendingRows: rows.length,
  distinctSources: usesPerCitation.size,
  sharedSources: [...usesPerCitation.values()].filter((n) => n > 1).length,
  batches: batches.length,
  cohorts: [...new Set(rows.map((r) => r.sourceCheckedOn))].sort(),
  draftQuarantinedRows: rows.filter((r) => r.publicationState === "draft-quarantined").length,
  publishedRows: rows.filter((r) => r.publicationState === "published").length,
  clinicalEvidenceRows: rows.filter((r) => r.verificationScope === "clinical-evidence").length,
  legalFrameworkRows: rows.filter((r) => r.verificationScope === "legal-framework").length,
};

// ---- HTML emission ----

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const data = JSON.stringify({ summary, batches }, null, 1);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qualified-Human Citation Verification Dashboard</title>
<style>
  :root {
    --ink: #1c2430; --muted: #5a6675; --line: #d7dde5; --panel: #ffffff;
    --bg: #eef1f5; --accent: #1f4f8f; --accent-soft: #e7eef8;
    --warn-bg: #fdf3e3; --warn-line: #e0b566; --ok: #1c6b3e;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  header.page { background: var(--accent); color: #fff; padding: 20px 28px; }
  header.page h1 { margin: 0 0 6px; font-size: 22px; }
  header.page p { margin: 2px 0; font-size: 13.5px; opacity: .93; }
  main { max-width: 1220px; margin: 0 auto; padding: 20px 28px 80px; }
  .banner { background: var(--warn-bg); border: 1px solid var(--warn-line); border-radius: 8px; padding: 12px 16px; margin: 0 0 18px; font-size: 13.5px; }
  .banner strong { display: block; margin-bottom: 4px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 0 0 18px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
  .card .num { font-size: 24px; font-weight: 700; }
  .card .lbl { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .toolbar { position: sticky; top: 0; z-index: 5; background: var(--bg); padding: 10px 0; margin: 0 0 12px; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .toolbar .progress { flex: 1 1 220px; background: var(--line); border-radius: 999px; height: 10px; overflow: hidden; }
  .toolbar .progress > div { height: 100%; width: 0; background: var(--ok); }
  button, select, input { font: inherit; }
  button { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent); border-radius: 6px; padding: 6px 12px; cursor: pointer; }
  button:hover { background: var(--accent); color: #fff; }
  nav.jump { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 18px; }
  nav.jump a { font-size: 12.5px; padding: 4px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--ink); text-decoration: none; }
  nav.jump a.done { border-color: var(--ok); color: var(--ok); }
  details.batch { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin: 0 0 16px; overflow: hidden; }
  details.batch > summary { cursor: pointer; padding: 12px 16px; font-weight: 600; display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  details.batch .meta { font-weight: 400; color: var(--muted); font-size: 12.5px; }
  .row { border-top: 1px solid var(--line); padding: 14px 16px; }
  .row.hidden { display: none; }
  .row h3 { margin: 0 0 2px; font-size: 14.5px; }
  .row .cite { font-size: 13px; color: var(--muted); margin: 2px 0 6px; }
  .row a { color: var(--accent); }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .badge { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
  .badge.warn { background: var(--warn-bg); color: #8a5a00; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px 12px; margin-top: 10px; }
  .fields label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; display: block; }
  .fields input, .fields select { width: 100%; padding: 5px 7px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  details.notes { margin-top: 10px; font-size: 13px; }
  details.notes summary { cursor: pointer; color: var(--accent); font-size: 12.5px; }
  details.notes p { margin: 6px 0; }
  .lbl-inline { font-weight: 600; font-size: 12px; }
  footer { max-width: 1220px; margin: 0 auto; padding: 0 28px 40px; color: var(--muted); font-size: 12.5px; }
  @media print {
    .toolbar, nav.jump, button { display: none !important; }
    details.batch > summary { list-style: none; }
    .row.hidden { display: block; }
  }
</style>
</head>
<body>
<header class="page">
  <h1>Qualified-Human Citation Verification Dashboard</h1>
  <p>Reviewer-ready batches, oldest source-check first. ${esc(summary.pendingRows)} pending reference rows across ${esc(summary.distinctSources)} distinct sources in ${esc(summary.batches)} batches.</p>
  <p>${esc(summary.generatedFrom)} — generated, not transcribed. Regenerate with <code>npm run citations:dashboard</code>.</p>
</header>
<main>
  <div class="banner">
    <strong>Scope of this dashboard</strong>
    This dashboard prepares — and only prepares — the qualified-human review under
    <code>docs/citation-verification-sop.md</code>. Repository automation can assemble review rows and
    record source-check metadata; it <strong>cannot</strong> make the verification decision. Approving a row
    asserts that the source supports the bounded proposition as authored —
    <code>ASSOCIATION_ONLY</code> at <code>NOT_ESTABLISHED</code> etiological consensus — and nothing
    stronger: not mapping approval, not publication (a separate gate), not causation or aggravation, and
    <strong>not an individual VA</strong> medical nexus determination. Only a qualified human reviewer may
    change repository source records to <code>verified: true</code>, recording a contentDigest for
    fetchable bodies and advancing the debt baseline in
    <code>scripts/audit-citation-verification.js</code>. Decisions typed here stay in this browser until
    exported; they change no repository record.
  </div>

  <div class="cards" id="cards"></div>

  <div class="toolbar">
    <strong id="progress-label">0 / 0 decided</strong>
    <div class="progress"><div id="progress-bar"></div></div>
    <label><input type="checkbox" id="hide-decided"> Hide decided rows</label>
    <button id="export-json">Export decisions (JSON)</button>
    <button id="export-csv">Export decisions (CSV)</button>
    <button id="reset-all">Reset all decisions</button>
    <button onclick="window.print()">Print</button>
  </div>

  <nav class="jump" id="jump"></nav>

  <div id="batches"></div>
</main>
<footer>
  Extraction rule: ${esc(summary.extractionRule)}.
  Cohort order is the recorded <code>sourceCheckedOn</code> date of each row (oldest first), which tracks
  the authoring wave that entered the row. Batch ${esc(summary.batchSizeCap)}-row cap is soft: an edge's
  rows are never split across batches. Shared sources (${esc(summary.sharedSources)} of
  ${esc(summary.distinctSources)} carry more than one pending use) need one open of the source per use —
  the proposition differs per row even when the source repeats.
</footer>

<script id="dashboard-data" type="application/json">
${data}
</script>
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("dashboard-data").textContent);
  var STORE_KEY = "citation-verification-decisions-v1"; // gitleaks:allow (localStorage key name, not a credential)
  var state = {};
  try { state = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { state = {}; }

  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function rowState(rowId) {
    if (!state[rowId]) state[rowId] = { decision: "PENDING", reviewer: "", role: "", reviewedOn: "", sourceSection: "", limitations: "" };
    return state[rowId];
  }
  function isDecided(rowId) {
    return (state[rowId] && state[rowId].decision && state[rowId].decision !== "PENDING") || false;
  }

  // summary cards
  var cards = document.getElementById("cards");
  var cardData = [
    ["Pending rows", DATA.summary.pendingRows],
    ["Distinct sources", DATA.summary.distinctSources],
    ["Shared sources", DATA.summary.sharedSources],
    ["Batches", DATA.summary.batches],
    ["Cohort dates", DATA.summary.cohorts.length],
    ["Draft-quarantined rows", DATA.summary.draftQuarantinedRows],
    ["Published rows", DATA.summary.publishedRows],
    ["Legal-framework rows", DATA.summary.legalFrameworkRows]
  ];
  cards.innerHTML = cardData.map(function (c) {
    return '<div class="card"><div class="num">' + esc(c[1]) + '</div><div class="lbl">' + esc(c[0]) + '</div></div>';
  }).join("");

  // jump nav
  document.getElementById("jump").innerHTML = DATA.batches.map(function (b) {
    return '<a id="jump-' + b.id + '" href="#' + b.id + '">B' + b.number + ' · ' + esc(b.cohortFrom) + '</a>';
  }).join("");

  function decisionOptions(value) {
    return ["PENDING", "approve", "approve-with-narrowing", "reject", "hold"].map(function (opt) {
      return '<option value="' + opt + '"' + (opt === value ? " selected" : "") + '>' + opt + "</option>";
    }).join("");
  }

  var batchesRoot = document.getElementById("batches");
  batchesRoot.innerHTML = DATA.batches.map(function (b, batchIndex) {
    var rowsHtml = b.rows.map(function (r) {
      var st = rowState(r.rowId);
      var shared = r.totalUses > 1
        ? '<span class="badge warn">shared source · ' + esc(r.totalUses) + " pending uses</span>"
        : "";
      return '<div class="row" data-row="' + esc(r.rowId) + '">' +
        "<h3>" + esc(r.mappingId) + " &rarr; " + esc(r.conditionId) + "</h3>" +
        '<div class="cite">' + esc(r.citation) +
          (r.sourceUrl ? ' — <a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.sourceUrl) + "</a>" : "") +
        "</div>" +
        '<div class="badges">' +
          '<span class="badge">' + esc(r.verificationScope) + "</span>" +
          '<span class="badge">' + esc(r.publicationState) + "</span>" +
          '<span class="badge">checked ' + esc(r.sourceCheckedOn) + "</span>" +
          (r.pmid ? '<span class="badge">PMID ' + esc(r.pmid) + "</span>" : "") +
          shared +
        "</div>" +
        '<div><span class="lbl-inline">Locator:</span> ' + esc(r.sourceLocator) + "</div>" +
        '<details class="notes"><summary>Proposition, causation boundary, and note under review</summary>' +
          '<p><span class="lbl-inline">Claim reviewed (' + esc(r.nexusClassification) + "):</span> " + esc(r.claim) + "</p>" +
          '<p><span class="lbl-inline">Causation boundary:</span> ' + esc(r.boundary) + "</p>" +
          '<p><span class="lbl-inline">Note under review:</span> ' + esc(r.note) + "</p>" +
        "</details>" +
        '<div class="fields">' +
          '<div><label>Decision</label><select data-field="decision">' + decisionOptions(st.decision) + "</select></div>" +
          '<div><label>Reviewer</label><input data-field="reviewer" value="' + esc(st.reviewer) + '"></div>' +
          '<div><label>Role</label><input data-field="role" value="' + esc(st.role) + '"></div>' +
          '<div><label>Reviewed on</label><input data-field="reviewedOn" type="date" value="' + esc(st.reviewedOn) + '"></div>' +
          '<div><label>Source section reviewed</label><input data-field="sourceSection" value="' + esc(st.sourceSection) + '"></div>' +
          '<div><label>Unresolved limitations</label><input data-field="limitations" value="' + esc(st.limitations) + '"></div>' +
        "</div>" +
      "</div>";
    }).join("");
    return '<details class="batch" id="' + b.id + '"' + (batchIndex === 0 ? " open" : "") + ">" +
      "<summary><span>Batch " + b.number + " of " + DATA.batches.length + "</span>" +
      '<span class="meta">' + esc(b.cohortFrom) + (b.cohortTo !== b.cohortFrom ? " – " + esc(b.cohortTo) : "") +
      " · " + b.rows.length + " rows · " + b.sourceCount + " sources · <span data-progress-for='" + b.id + "'>0 decided</span></span></summary>" +
      rowsHtml + "</details>";
  }).join("");

  function refreshProgress() {
    var total = 0, decided = 0;
    DATA.batches.forEach(function (b) {
      var bTotal = b.rows.length, bDone = 0;
      b.rows.forEach(function (r) {
        total++;
        if (isDecided(r.rowId)) { decided++; bDone++; }
      });
      var el = document.querySelector("[data-progress-for='" + b.id + "']");
      if (el) el.textContent = bDone + " / " + bTotal + " decided";
      var jump = document.getElementById("jump-" + b.id);
      if (jump) jump.classList.toggle("done", bDone === bTotal);
    });
    document.getElementById("progress-label").textContent = decided + " / " + total + " decided";
    document.getElementById("progress-bar").style.width = (total ? (decided / total) * 100 : 0) + "%";
  }

  batchesRoot.addEventListener("input", function (event) {
    var field = event.target.getAttribute("data-field");
    if (!field) return;
    var rowEl = event.target.closest("[data-row]");
    if (!rowEl) return;
    var st = rowState(rowEl.getAttribute("data-row"));
    st[field] = event.target.value;
    save();
    if (field === "decision") refreshProgress();
  });

  document.getElementById("hide-decided").addEventListener("change", function (event) {
    var hide = event.target.checked;
    document.querySelectorAll("[data-row]").forEach(function (el) {
      el.classList.toggle("hidden", hide && isDecided(el.getAttribute("data-row")));
    });
  });

  function decisionRecords() {
    var records = [];
    DATA.batches.forEach(function (b) {
      b.rows.forEach(function (r) {
        var st = state[r.rowId] || {};
        if (!st.decision || st.decision === "PENDING") return;
        records.push({
          batchId: b.id,
          rowId: r.rowId,
          claimReviewed: r.mappingId + " -> " + r.conditionId + " (" + r.nexusClassification + ")",
          mappingId: r.mappingId,
          conditionId: r.conditionId,
          citation: r.citation,
          sourceUrl: r.sourceUrl,
          sourceCheckedOn: r.sourceCheckedOn,
          sourceLocator: r.sourceLocator,
          decision: st.decision,
          reviewer: st.reviewer || "",
          reviewerRole: st.role || "",
          reviewedOn: st.reviewedOn || "",
          sourceSectionReviewed: st.sourceSection || "",
          unresolvedLimitations: st.limitations || ""
        });
      });
    });
    return records;
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById("export-json").addEventListener("click", function () {
    download("citation-verification-decisions.json", JSON.stringify({
      qualificationRule: DATA.summary.qualificationRule,
      sop: "docs/citation-verification-sop.md",
      exportedDecisions: decisionRecords()
    }, null, 2), "application/json");
  });

  document.getElementById("export-csv").addEventListener("click", function () {
    var cols = ["batchId", "rowId", "claimReviewed", "mappingId", "conditionId", "citation", "sourceUrl",
      "sourceCheckedOn", "sourceLocator", "decision", "reviewer", "reviewerRole", "reviewedOn",
      "sourceSectionReviewed", "unresolvedLimitations"];
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var lines = [cols.join(",")].concat(decisionRecords().map(function (rec) {
      return cols.map(function (c) { return q(rec[c]); }).join(",");
    }));
    download("citation-verification-decisions.csv", lines.join("\\n"), "text/csv");
  });

  document.getElementById("reset-all").addEventListener("click", function () {
    if (!window.confirm("Clear every recorded decision in this browser?")) return;
    state = {};
    save();
    window.location.reload();
  });

  // Printing must not hide closed details: open everything around the print.
  var printOpenState = [];
  window.addEventListener("beforeprint", function () {
    printOpenState = Array.prototype.map.call(document.querySelectorAll("details"), function (d) { return d.open; });
    document.querySelectorAll("details").forEach(function (d) { d.open = true; });
  });
  window.addEventListener("afterprint", function () {
    document.querySelectorAll("details").forEach(function (d, i) { d.open = printOpenState[i]; });
  });

  refreshProgress();
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT}: ${summary.pendingRows} pending rows in ${summary.batches} batches (${summary.distinctSources} distinct sources, cohort dates ${summary.cohorts[0]}..${summary.cohorts[summary.cohorts.length - 1]}).`);
