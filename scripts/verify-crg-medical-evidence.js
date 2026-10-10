#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_RE = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/$/;
const ESEARCH_RE = /^https:\/\/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/(esearch\.fcgi|esummary\.fcgi)/;
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const EBOOK_BASE = 'https://www.ncbi.nlm.nih.gov/books/';

const PAUSE_MS = 1800;
const PAGE_TIMEOUT_MS = 25000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePmid(url) {
  const m = url.match(URL_RE);
  return m ? m[1] : null;
}

function isNcbiEbookUrl(url) {
  return url.startsWith(EBOOK_BASE) && !url.includes('/pmc/') && !url.includes('/books/');
}

function isNcbiStableBookUrl(url) {
  // Honest NCBI book URL check: only pass if it looks like a real bookshelf path
  if (!url.startsWith(EBOOK_BASE)) return false;
  const path = url.slice(EBOOK_BASE.length);
  if (!path.startsWith('/')) return false;
  if (url.includes('ncbi.nlm.nih.gov/books/') && /\/\d+\//.test(url)) return true;
  return false;
}

function extractHtmlTitle(body) {
  const m = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function normalizeTitle(title) {
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[-–—]+\s*$/, '')
    .trim();
}

async function fetchText(url, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'crg-citation-checker/1.0 (+https://github.com/example/crb packets)' },
    });
    if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, label) {
  const body = await fetchText(url, label);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} non-JSON response: ${body.slice(0, 300)}`);
  }
}

async function esearchPmid(query, retmax = 3) {
  const url = `${NCBI_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json`;
  const json = await fetchJson(url, 'esearch');
  return Array.isArray(json.esearchresult?.idlist) ? json.esearchresult.idlist : [];
}

async function esummaryTitles(pmids) {
  const url = `${NCBI_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
  const json = await fetchJson(url, 'esummary');
  const out = {};
  for (const pmid of pmids) {
    const doc = json.result?.[pmid];
    if (!doc) {
      out[pmid] = { error: 'no esummary result' };
      continue;
    }
    out[pmid] = {
      title: doc.title || null,
      source: doc.source || null,
      authors: doc.authors?.map((a) => (a === null ? null : a.name)).filter(Boolean) || [],
    };
  }
  return out;
}

function stripPunct(s) {
  return s.replace(/[.,;:!?()\[\]{}'"`´]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function titleMatch(asserted, observed, context) {
  if (!observed) return { ok: false, reason: 'no observed title' };
  const a = normalizeTitle(asserted);
  const o = normalizeTitle(observed);
  if (a === o) return { ok: true };
  // PubMed elinks-style suffix differences
  const aStem = a.replace(/\s+(and|et\s*al\.?\s*)$/i, '').trim();
  const oStem = o.replace(/\s+(and|et\s*al\.?\s*)$/i, '').trim();
  if (aStem === oStem) return { ok: true, note: 'normalized suffix equivalence' };
  // Loose similarity guard to avoid false positives from homonym collisions
  const aTerms = new Set(stripPunct(a).split(' '));
  const oTerms = new Set(stripPunct(o).split(' '));
  const overlap = [...aTerms].filter((t) => oTerms.has(t)).length;
  const minLen = Math.min([...aTerms].length, [...oTerms].length);
  if (minLen === 0) return { ok: false, reason: 'title too short to compare' };
  if (overlap / minLen >= 0.6) return { ok: true, note: 'high lexical overlap, manual review recommended', overlap, minLen };
  return { ok: false, reason: 'low lexical overlap' };
}

function walkEvidence(root, dir, prefix = '') {
  const entries = readdirSync(join(root, dir)).filter((name) => statSync(join(root, dir, name)).isFile()).sort();
  const out = [];
  for (const name of entries) {
    const rel = relative(root, join(dir, name)).replace(/^\.\//, '');
    if (!name.endsWith('.json')) continue;
    const text = readFileSync(join(root, dir, name), 'utf8');
    let value;
    try { value = JSON.parse(text); } catch (err) { out.push({ file: rel, error: `JSON parse failed: ${err.message}`, hash: createHash('sha256').update(text).digest('hex') }); continue; }
    const walker = (obj, path) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach((v, i) => walker(v, `${path}[${i}]`)); return; }
      if ('medicalEvidence' in obj && Array.isArray(obj.medicalEvidence)) {
        const pack = { file: rel, path, hash: createHash('sha256').update(text).digest('hex'), rows: [] };
        for (const item of obj.medicalEvidence) {
          if (!item || typeof item !== 'object') { pack.rows.push({ error: 'non-object evidence item' }); continue; }
          const url = item.url;
          const pmid = parsePmid(url);
          const assertedTitle = typeof item.title === 'string' ? item.title : null;
          const assertedAuthors = typeof item.authors === 'string' ? item.authors : null;
          pack.rows.push({
            assertedTitle,
            assertedAuthors,
            url,
            pmid,
            pmidParsed: !!pmid,
            urlFormatOk: !!pmid,
          });
        }
        out.push(pack);
        return;
      }
      for (const v of Object.values(obj)) walker(v, path);
    };
    walker(value, prefix);
  }
  return out;
}export async function runCheck({ root = process.cwd(), includeColocated = false } = {}) {
  const packetsRoot = join(root, 'docs');
  const absPacketsRoot = resolve(packetsRoot);
  if (!statSync(absPacketsRoot).isDirectory()) throw new Error(`docs/ directory not found at ${absPacketsRoot}`);
  const effectiveRoot = dirname(absPacketsRoot);
  const files = walkEvidence(absPacketsRoot, '.');
  const files2 = [];
  if (includeColocated) {
    for (const other of ['data/regulatory-actions', 'data/evidence', 'data/conditions', 'data/knowledge-base']) {
      const candidate = resolve(join(root, other));
      if (statSync(candidate).isDirectory()) files2.push(...walkEvidence(candidate, '.'));
    }
  }
  const evidence = [];
  const problems = [];
  const byPmid = new Map();
  let allFiles;
  if (process.env.CRG_VERIFY_USE_DOT_FOR_WALK) {
    allFiles = files.concat(files2);
  } else {
    allFiles = files.map(p => ({...p, file: './' + p.file})).concat(files2.map(p => ({...p, file: './' + p.file})));
  }
  for (const p of allFiles) {
    const base = join(effectiveRoot, p.file.replace(/^\.\//, ''));
    if (!statSync(base).isFile()) { if (!problems.some(q => q.kind === 'missing-file' && q.file === p.file)) problems.push({ kind: 'missing-file', file: p.file }); continue; }
    const textNow = readFileSync(base, 'utf8');
    if (p.hash && createHash('sha256').update(textNow, 'utf8').digest('hex') !== p.hash) { problems.push({ kind: 'file-modified', file: p.file, expectedHash: p.hash, actualHash: createHash('sha256').update(textNow, 'utf8').digest('hex') }); }
  }
  for (const pack of files) {
    if (pack.error) { problems.push({ kind: 'parse', file: pack.file, detail: pack.error, hash: pack.hash }); continue; }
    for (const row of pack.rows) {
      if (row.error) { problems.push({ kind: 'schema', file: pack.file, path: pack.path, detail: row.error }); continue; }
      if (!row.urlFormatOk) { problems.push({ kind: 'url-format', file: pack.file, path: pack.path, url: row.url }); continue; }
      if (!row.pmidParsed) { problems.push({ kind: 'url-parse', file: pack.file, path: pack.path, url: row.url }); continue; }
      evidence.push({ ...row, file: pack.file, path: pack.path });
      const key = row.pmid;
      if (!byPmid.has(key)) byPmid.set(key, { pmid: key, urls: [], rows: [] });
      byPmid.get(key).urls.push(row.url);
      byPmid.get(key).rows.push({ ...row, file: pack.file, path: pack.path });
    }
    const packFile = join(effectiveRoot, pack.file.replace(/^\.\//, ''));
    if (!statSync(packFile).isFile()) { if (!problems.some(q => q.kind === 'missing-file' && q.file === pack.file)) problems.push({ kind: 'missing-file', file: pack.file }); continue; }
    const textNow = readFileSync(packFile, 'utf8');
    if (pack.hash && createHash('sha256').update(textNow, 'utf8').digest('hex') !== pack.hash) { problems.push({ kind: 'file-modified', file: pack.file, expectedHash: pack.hash, actualHash: createHash('sha256').update(textNow, 'utf8').digest('hex') }); }
  }

  const dupUrls = new Map();
  for (const ev of evidence) {
    if (!dupUrls.has(ev.url)) dupUrls.set(ev.url, []); dupUrls.get(ev.url).push({ file: ev.file, path: ev.path });
  }
  const duplicates = [...dupUrls.entries()].filter(([, hits]) => hits.length > 1);
  if (duplicates.length) {
    for (const [url, hits] of duplicates) problems.push({ kind: 'duplicate-url', url, occurrences: hits });
  }

  const results = [];
  const pmidList = [...byPmid.keys()];
  for (let i = 0; i < pmidList.length; i++) {
    const pmid = pmidList[i];
    if (i === 0) { console.error(`starting NCBI title check for ${pmidList.length} unique PMIDs`); }
    if (i > 0) await sleep(PAUSE_MS);
    if (pmidList.length > 60 && (i % 60) === 0) { await sleep(120000); }
    if (i > 0 && (i % 200) === 0) { console.error(`progress: ${i}/${pmidList.length} PMIDs processed`); }
    const canon = byPmid.get(pmid);
    const asserted = canon.rows[0].assertedTitle;
    let observed = null;
    let observedSource = null;
    let observedAuthors = null;
    let method = 'esummary';
    try {
      const summary = await esummaryTitles([pmid]);
      const doc = summary[pmid];
      if (doc.error) throw new Error(doc.error);
      observed = doc.title;
      observedSource = doc.source;
      observedAuthors = doc.authors;
    } catch (err) {
      method = 'fallback-browser-esummary';
      results.push({ pmid, asserted, file: canon.rows[0].file, path: canon.rows[0].path, problem: { kind: 'esummary-failed', error: err.message } });
      continue;
    }
    if (!observed) { results.push({ pmid, asserted, file: canon.rows[0].file, path: canon.rows[0].path, problem: { kind: 'no-title', observed } }); continue; }
    const match = titleMatch(asserted, observed, `esummary for PMID ${pmid}`);
    if (!match.ok) {
      results.push({ pmid, asserted, observed, observedSource, observedAuthors, method, file: canon.rows[0].file, path: canon.rows[0].path, problem: { kind: 'title-mismatch', match } });
    }
    for (const row of canon.rows) {
      const rowAsserted = row.assertedTitle || asserted;
      const m2 = titleMatch(rowAsserted, observed, `esummary for PMID ${pmid} row in ${row.file}${row.path?`#${row.path}`:''}`);
      if (!m2.ok && (!results.some(r => r.pmid === pmid && r.problem?.kind === 'title-mismatch'))) {
        results.push({ pmid, asserted: rowAsserted, observed, observedSource, observedAuthors, method, file: row.file, path: row.path, problem: { kind: 'title-mismatch-per-row', match: m2 } });
      }
    }
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    evidenceRows: evidence.length,
    uniquePmids: pmidList.length,
    urlFormatErrors: problems.filter((p) => p.kind === 'url-format').length,
    urlParseError: problems.filter((p) => p.kind === 'url-parse').length,
    duplicateUrls: duplicates.length,
    parseErrors: problems.filter((p) => p.kind === 'parse').length,
    schemaProblems: problems.filter((p) => p.kind === 'schema').length,
    colocateScanFailures: problems.filter((p) => p.kind === 'colocate-scan-failed').length,
    fileModifiedCount: problems.filter((p) => p.kind === 'file-modified').length,
    missingFileCount: problems.filter((p) => p.kind === 'missing-file').length,
    esummaryFailures: results.filter((r) => r.problem?.kind === 'esummary-failed').length,
    noTitle: results.filter((r) => r.problem?.kind === 'no-title').length,
    titleMismatches: results.filter((r) => r.problem?.kind === 'title-mismatch' || r.problem?.kind === 'title-mismatch-per-row').length,
    problems: problems.flatMap((p) => {
      if (p.kind === 'duplicate-url') return [{ kind: p.kind, url: p.url, occurrences: p.occurrences }];
      const base = { kind: p.kind, file: p.file };
      if (p.detail != null) base.detail = p.detail;
      if (p.hash != null) base.hash = p.hash;
      return [base];
    }),
  };
  return { summary, results, evidence: evidence.map((e) => ({ pmid: e.pmid, url: e.url, file: e.file, path: e.path, assertedTitle: e.assertedTitle, assertedAuthors: e.assertedAuthors })) };
}

if (process.argv[1] && process.argv[1].endsWith('/scripts/verify-crg-medical-evidence.js') || process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd();
  const start = Date.now();
  const result = await runCheck({ root });
  const elapsed = Date.now() - start;
  console.log(JSON.stringify({ ...result.summary, elapsedMs: elapsed }, null, 2));
  if (result.results.length) {
    console.error('\nPer-PMID results:');
    for (const r of result.results) {
      console.error(JSON.stringify(r, null, 2));
    }
  }
  if (result.summary.titleMismatches || result.summary.esummaryFailures || result.summary.noTitle || result.summary.urlFormatErrors || result.summary.urlParseError || result.summary.duplicateUrls || result.summary.parseErrors || result.summary.schemaProblems || result.summary.fileModifiedCount || result.summary.missingFileCount) {
    process.exitCode = 1;
  }
}
