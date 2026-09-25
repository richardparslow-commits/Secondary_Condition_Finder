/* eslint-disable @typescript-eslint/no-require-imports */
// Citation source-status preflight.
//
// The D1 batch-57 pre-verification step caught PMID 17895057 (a retracted
// post-stroke osteopenia study) by hand before it reached the knowledge base.
// This script automates that guard: for every drafted reference it checks the
// PubMed record for publication-status events and blocks the draft when any
// anchor is retracted, withdrawn, or carries an expression of concern.
//
// Flag classes (all block; exit code 1):
//   RETRACTED              — publication type "Retracted Publication" /
//                            "Retraction of Publication", or a linked
//                            retraction notice (RefType RetractionIn /
//                            RetractionOf / RetractedAndRepublishedIn)
//   WITHDRAWN              — publication type or title marker indicating a
//                            withdrawn publication
//   EXPRESSION_OF_CONCERN  — publication type "Expression of Concern", or a
//                            linked expression-of-concern notice
//   UNRESOLVED             — the reference's PMID does not resolve in PubMed,
//                            so no status check is possible
//
// Non-blocking notes: linked errata ("Published Erratum", ErratumIn) are
// reported for reviewer awareness but do not fail the preflight.
//
// Non-PubMed references (no PMID in sourceUrl or citation) are skipped and
// counted, because this guard can only speak to indexed PubMed records.
//
// Usage:
//   node scripts/preflight-source-status.js
//       check every unverified reference in every draft mapping
//   node scripts/preflight-source-status.js --since 2026-09-25
//       restrict to references with sourceCheckedOn on/after the given date
//       (the authoring-time case: only this batch's refs)
//   node scripts/preflight-source-status.js --file data/knowledge-base/x.json
//       check only the given knowledge-base file(s) (comma-separated)
//   node scripts/preflight-source-status.js --pmids 123,456
//       check explicit PMIDs before a draft file exists
//   node scripts/preflight-source-status.js --registry
//       check every source entity in data/evidence/master-sources.json
//       (the retroactive audit mode; add --statuses active,pending-verification
//       to restrict by entity status)
//   node scripts/preflight-source-status.js --fixture path/to/fixtures.json
//       offline evaluation of recorded esummary/efetch payloads (used by tests)
//   node scripts/preflight-source-status.js --json
//       machine-readable report on stdout
//
// Exit codes: 0 clean, 1 status flags found, 2 usage or fetch failure.

const fs = require("fs");
const path = require("path");
const https = require("https");

const KB_DIR = path.join("data", "knowledge-base");
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const USER_AGENT = "citation-status-preflight/1.0";
const BATCH = 200;

const FLAG_CLASSES = {
  RETRACTED: "RETRACTED",
  WITHDRAWN: "WITHDRAWN",
  EXPRESSION_OF_CONCERN: "EXPRESSION_OF_CONCERN",
  UNRESOLVED: "UNRESOLVED",
};

const RETRACTION_REF_TYPES = new Set(["retractionin", "retractionof", "retractedandrepublishedin"]);
const EOC_REF_TYPES = new Set(["expressionofconcernin", "expressionofconcernfor"]);
const ERRATUM_REF_TYPES = new Set(["erratumin", "erratumfor"]);

function normalizeToken(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractPmid(ref) {
  const url = ref && typeof ref.sourceUrl === "string" ? ref.sourceUrl : "";
  const fromUrl = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{4,9})/);
  if (fromUrl) return fromUrl[1];
  const citation = ref && typeof ref.citation === "string" ? ref.citation : "";
  const fromCitation = citation.match(/PMID[:\s]+(\d{4,9})/i);
  return fromCitation ? fromCitation[1] : null;
}

// Parses an esummary JSON payload (the `result` object) into pmid -> record.
function parseEsummaryResult(result) {
  const out = new Map();
  if (!result || typeof result !== "object") return out;
  for (const [key, doc] of Object.entries(result)) {
    if (key === "uids" || !doc || typeof doc !== "object") continue;
    out.set(String(doc.uid || key), {
      title: typeof doc.title === "string" ? doc.title : "",
      pubtypes: Array.isArray(doc.pubtype) ? doc.pubtype.map(String) : [],
    });
  }
  return out;
}

// Parses efetch PubMed XML into pmid -> { pubtypes, commentsCorrections }.
function parseEfetchXml(xml) {
  const out = new Map();
  if (typeof xml !== "string") return out;
  const articles = xml.split(/<PubmedArticle[\s>]/).slice(1);
  for (const article of articles) {
    const idMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!idMatch) continue;
    const pubtypes = [];
    const typeRe = /<PublicationType[^>]*>([^<]*)<\/PublicationType>/g;
    let m;
    while ((m = typeRe.exec(article)) !== null) pubtypes.push(m[1].trim());
    const commentsCorrections = [];
    const ccRe = /<CommentsCorrections\s+RefType="([^"]+)">([\s\S]*?)<\/CommentsCorrections>/g;
    while ((m = ccRe.exec(article)) !== null) {
      const sourceMatch = m[2].match(/<RefSource>([^<]*)<\/RefSource>/);
      commentsCorrections.push({
        refType: m[1],
        refSource: sourceMatch ? sourceMatch[1].trim() : "",
      });
    }
    out.set(idMatch[1], { pubtypes, commentsCorrections });
  }
  return out;
}

// Pure classification of one PubMed record. Returns { flags, notes }.
function classifyRecord(pmid, esummaryDoc, efetchDoc) {
  const flags = [];
  const notes = [];
  const title = (esummaryDoc && esummaryDoc.title) || "";
  const pubtypes = [
    ...((esummaryDoc && esummaryDoc.pubtypes) || []),
    ...((efetchDoc && efetchDoc.pubtypes) || []),
  ];
  const comments = (efetchDoc && efetchDoc.commentsCorrections) || [];

  const pubtypeNorms = pubtypes.map(normalizeToken);
  const titleNorm = normalizeToken(title);

  const isWithdrawn =
    pubtypeNorms.some(t => t.includes("withdrawn")) || titleNorm.includes("withdrawn");
  const isRetracted =
    pubtypeNorms.some(
      t =>
        t === "retractedpublication" ||
        t === "retractionofpublication" ||
        t === "retractedandrepublishedarticle",
    ) ||
    comments.some(c => RETRACTION_REF_TYPES.has(normalizeToken(c.refType)));
  const isEoc =
    pubtypeNorms.some(t => t === "expressionofconcern") ||
    comments.some(c => EOC_REF_TYPES.has(normalizeToken(c.refType)));

  const evidence = [];
  for (const t of pubtypes) {
    const n = normalizeToken(t);
    if (n === "retractedpublication" || n === "retractionofpublication" || n === "retractedandrepublishedarticle" || n.includes("withdrawn") || n === "expressionofconcern") {
      evidence.push(`publication type: ${t}`);
    }
  }
  for (const c of comments) {
    const n = normalizeToken(c.refType);
    if (RETRACTION_REF_TYPES.has(n) || EOC_REF_TYPES.has(n)) {
      evidence.push(`linked notice (${c.refType})${c.refSource ? `: ${c.refSource}` : ""}`);
    } else if (ERRATUM_REF_TYPES.has(n)) {
      notes.push({
        pmid: String(pmid),
        note: "erratum-linked record",
        evidence: `linked notice (${c.refType})${c.refSource ? `: ${c.refSource}` : ""}`,
      });
    }
  }
  for (const t of pubtypes) {
    if (normalizeToken(t) === "publishederratum") {
      notes.push({ pmid: String(pmid), note: "erratum publication type", evidence: `publication type: ${t}` });
    }
  }

  if (isRetracted) flags.push({ pmid: String(pmid), flag: FLAG_CLASSES.RETRACTED, evidence: evidence.join("; ") });
  if (isWithdrawn) flags.push({ pmid: String(pmid), flag: FLAG_CLASSES.WITHDRAWN, evidence: evidence.join("; ") });
  if (isEoc) flags.push({ pmid: String(pmid), flag: FLAG_CLASSES.EXPRESSION_OF_CONCERN, evidence: evidence.join("; ") });
  return { flags, notes };
}

// Pure evaluation over collected refs and fetched PubMed payloads.
function evaluateRefs(refs, esummaryResult, efetchXml) {
  const esummary = parseEsummaryResult(esummaryResult);
  const efetch = parseEfetchXml(efetchXml);
  const flags = [];
  const notes = [];
  const checked = [];
  const skipped = [];

  for (const entry of refs) {
    const pmid = extractPmid(entry.ref);
    if (!pmid) {
      skipped.push({ reason: "non-PubMed reference (no PMID in sourceUrl or citation)", where: entry.where });
      continue;
    }
    const esum = esummary.get(pmid);
    const efetchDoc = efetch.get(pmid);
    if (!esum && !efetchDoc) {
      flags.push({
        pmid,
        flag: FLAG_CLASSES.UNRESOLVED,
        evidence: "PMID does not resolve in PubMed; status cannot be verified",
        where: entry.where,
      });
      continue;
    }
    checked.push({ pmid, where: entry.where });
    const verdict = classifyRecord(pmid, esum, efetchDoc);
    for (const f of verdict.flags) flags.push({ ...f, where: entry.where });
    for (const n of verdict.notes) notes.push({ ...n, where: entry.where });
  }

  return {
    refsConsidered: refs.length,
    pmidsChecked: checked.length,
    skipped,
    flags,
    notes,
    ok: flags.length === 0,
  };
}

// Collects pseudo-refs from the master source registry (audit mode).
function collectRegistryRefs(registryJson, { statuses } = {}) {
  const wanted = statuses && statuses.length ? new Set(statuses) : null;
  const sources = Array.isArray(registryJson.sources) ? registryJson.sources : [];
  const refs = [];
  for (const entity of sources) {
    if (wanted && !wanted.has(entity.status)) continue;
    const ref = {
      sourceUrl:
        entity.canonicalSourceUrl ||
        (entity.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${entity.pmid}/` : ""),
      citation: Array.isArray(entity.citationVariants) && entity.citationVariants.length
        ? entity.citationVariants[0]
        : entity.canonicalCitation || "",
    };
    if (entity.pmid) ref.citation += ` PMID ${entity.pmid}.`;
    refs.push({ ref, where: `registry:${entity.sourceId} [${entity.status}]` });
  }
  return refs;
}

function collectDraftRefs({ since, files }) {
  const refs = [];
  const dir = KB_DIR;
  const names = files
    ? files.map(f => path.relative(dir, f).replace(/\.json$/, "") + ".json")
    : fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  for (const name of names) {
    const mapping = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    if (!files && !mapping.draft) continue;
    const suggestions = Array.isArray(mapping.suggestions) ? mapping.suggestions : [];
    for (const suggestion of suggestions) {
      const sourceRefs = Array.isArray(suggestion.sourceReferences) ? suggestion.sourceReferences : [];
      for (const ref of sourceRefs) {
        if (ref.verified === true) continue;
        if (since && !(typeof ref.sourceCheckedOn === "string" && ref.sourceCheckedOn >= since)) continue;
        refs.push({
          ref,
          where: `${mapping.id} -> ${suggestion.conditionId} (${path.join(dir, name)})`,
        });
      }
    }
  }
  return refs;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": USER_AGENT } }, res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`JSON parse failure for ${url}: ${err.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": USER_AGENT } }, res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPubmedStatus(pmids) {
  const esummaryResult = { uids: [...pmids] };
  let efetchXml = "";
  for (let i = 0; i < pmids.length; i += BATCH) {
    const batch = pmids.slice(i, i + BATCH).join(",");
    const summary = await fetchJson(
      `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${batch}`,
    );
    Object.assign(esummaryResult, summary.result || {});
    await sleep(400);
    efetchXml += await fetchText(
      `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${batch}`,
    );
    await sleep(400);
  }
  return { esummaryResult, efetchXml };
}

async function main(argv) {
  const getFlag = name => {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const asJson = argv.includes("--json");
  const fixturePath = getFlag("--fixture");
  const since = getFlag("--since");
  const fileArg = getFlag("--file");
  const pmidArg = getFlag("--pmids");
  const statusesArg = getFlag("--statuses");
  const statuses = statusesArg ? statusesArg.split(",").map(s => s.trim()).filter(Boolean) : null;

  let refs;
  if (argv.includes("--registry")) {
    const registryJson = JSON.parse(fs.readFileSync(path.join("data", "evidence", "master-sources.json"), "utf8"));
    refs = collectRegistryRefs(registryJson, { statuses });
  } else if (pmidArg) {
    refs = pmidArg
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(pmid => ({ ref: { sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, citation: `PMID ${pmid}.` }, where: `--pmids ${pmid}` }));
  } else if (fileArg) {
    refs = collectDraftRefs({ since, files: fileArg.split(",").map(s => s.trim()) });
  } else {
    refs = collectDraftRefs({ since, files: null });
  }

  let esummaryResult;
  let efetchXml;
  if (fixturePath) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    esummaryResult = fixture.esummary;
    efetchXml = fixture.efetchXml;
  } else {
    const pmids = [...new Set(refs.map(r => extractPmid(r.ref)).filter(Boolean))];
    ({ esummaryResult, efetchXml } = await fetchPubmedStatus(pmids));
  }

  const report = evaluateRefs(refs, esummaryResult, efetchXml);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("Citation source-status preflight");
    console.log(`  references considered:  ${report.refsConsidered}`);
    console.log(`  PubMed records checked: ${report.pmidsChecked}`);
    console.log(`  skipped (non-PubMed):   ${report.skipped.length}`);
    console.log(`  flags (blocking):       ${report.flags.length}`);
    console.log(`  notes (non-blocking):   ${report.notes.length}`);
    if (report.flags.length) {
      console.log("\nFlags:");
      for (const f of report.flags) {
        console.log(`  ${f.flag}  PMID ${f.pmid}  ${f.evidence}`);
        if (f.where) console.log(`      at: ${f.where}`);
      }
    }
    if (report.notes.length) {
      console.log("\nNotes:");
      for (const n of report.notes) {
        console.log(`  ${n.note}  PMID ${n.pmid}  ${n.evidence}`);
      }
    }
    console.log(report.ok ? "\nPASS: no retracted, withdrawn, or expression-of-concern anchors." : "\nFAIL: blocked anchors present; replace or record them before authoring.");
  }
  return report.ok ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch(err => {
      console.error(err.message || String(err));
      process.exit(2);
    });
}

module.exports = {
  FLAG_CLASSES,
  extractPmid,
  parseEsummaryResult,
  parseEfetchXml,
  classifyRecord,
  evaluateRefs,
  collectRegistryRefs,
};
