#!/usr/bin/env node
/**
 * Public-research-only ClinicalTrials.gov + NIH RePORTER metadata pilot.
 * No Veteran inputs, medical records, study abstracts or source full texts.
 * DEV-only service identity, immutable run digest, transactional row parity.
 *
 * collect --live          : bounded external collection to /tmp
 * apply --dev-write       : explicit authorized DEV-only SQL
 * verify                  : read-only exact metadata parity
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getLabConnection } from "../lib/tiger-lab-client.mjs";
import { assertDevTarget, DEV_SERVICE } from "../lib/medical-reference-tiger-dev.mjs";

const SEED_FILE = fileURLToPath(new URL("../fixtures/public-research-extensions-dev-seeds.json", import.meta.url));
const OUT = "/tmp/scf-public-research-extensions-dev.json";
const SCHEMA = "scf_public_research_extensions_dev";
const STATUS = "UNVERIFIED_RESEARCH_METADATA";
const MAX_BODY_BYTES = 1_000_000;
const MAX_RESULTS = 3;
const HOSTS = new Set(["clinicaltrials.gov", "api.reporter.nih.gov"]);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const canonical = (x) => Array.isArray(x) ? "[" + x.map(canonical).join(",") + "]" :
  x && typeof x === "object" ? "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}" : JSON.stringify(x);
const digest = (x) => sha(canonical(x));
const text = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function validateSeed(seed) {
  assert.equal(seed?.schemaVersion, 1);
  assert.match(seed.seedId, /^[a-z0-9-]{10,90}$/);
  assert.ok(Array.isArray(seed.topics) && seed.topics.length >= 1 && seed.topics.length <= 5);
  assert.equal(new Set(seed.topics.map((x) => x.id)).size, seed.topics.length);
  for (const t of seed.topics) {
    assert.match(t.id, /^[a-z0-9-]{5,80}$/);
    assert.match(t.query, /^[a-zA-Z][a-zA-Z -]{5,90}$/);
  }
  return seed;
}

async function boundedJson(url, { method = "GET", body, request = fetch } = {}) {
  assert.ok(url instanceof URL && url.protocol === "https:" && HOSTS.has(url.hostname));
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  const res = await request(url, {
    method, redirect: "error", signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "SecondaryConditionFinder-PublicResearch-DEV/1.0" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error("Public provider returned unsuccessful response");
  if (Number(res.headers.get("content-length")) > MAX_BODY_BYTES) throw new Error("Response too large");
  const raw = await res.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw new Error("Response too large");
  return JSON.parse(raw);
}

function makeRecord(provider, topic, sourceId, sourceUrl, title, sourceDate, detail) {
  const base = {
    provider, topicId: topic.id, sourceId, sourceUrl,
    title: text(title), sourceDate: text(sourceDate, 40).slice(0, 10),
    status: STATUS, details: { ...detail, reviewRequired: true },
  };
  const record = { ...base, contentHash: digest(base) };
  validateRecord(record);
  return record;
}

export function normalizeTrials(topic, response) {
  assert.ok(Array.isArray(response?.studies));
  return response.studies.slice(0, MAX_RESULTS).map((study) => {
    const p = study?.protocolSection ?? {};
    const id = p.identificationModule?.nctId;
    assert.match(id, /^NCT[0-9]{8}$/);
    const date = p.statusModule?.lastUpdatePostDateStruct?.date ??
      p.statusModule?.studyFirstSubmitDate ?? "";
    return makeRecord(
      "clinicaltrials", topic, id, "https://clinicaltrials.gov/study/" + id,
      p.identificationModule?.briefTitle, date,
      { nctId: id, overallStatus: text(p.statusModule?.overallStatus, 60),
        phase: Array.isArray(p.designModule?.phases) ? p.designModule.phases.map((x) => text(x, 50)).slice(0, 5) : [],
        conditions: Array.isArray(p.conditionsModule?.conditions) ? p.conditionsModule.conditions.map((x) => text(x, 120)).slice(0, 8) : [],
        metadataOnly: true },
    );
  });
}

export function normalizeProjects(topic, response) {
  assert.ok(Array.isArray(response?.results));
  return response.results.slice(0, MAX_RESULTS).map((p) => {
    const id = String(p.appl_id ?? "");
    assert.match(id, /^[0-9]{6,12}$/);
    return makeRecord(
      "nih_reporter", topic, id, "https://reporter.nih.gov/project-details/" + id,
      p.project_title, p.project_start_date ?? p.award_notice_date ?? "",
      { applicationId: id, coreProjectNumber: text(p.core_project_num, 100),
        projectNumber: text(p.project_num, 100),
        fiscalYear: Number.isInteger(p.fiscal_year) ? p.fiscal_year : null,
        metadataOnly: true },
    );
  });
}

export function validateRecord(r) {
  assert.deepEqual(Object.keys(r).sort(),
    ["provider","topicId","sourceId","sourceUrl","title","sourceDate","status","details","contentHash"].sort());
  assert.ok(["clinicaltrials", "nih_reporter"].includes(r.provider));
  assert.match(r.topicId, /^[a-z0-9-]{5,80}$/);
  assert.match(r.sourceId, r.provider === "clinicaltrials" ? /^NCT[0-9]{8}$/ : /^[0-9]{6,12}$/);
  assert.ok(r.title.length > 3 && r.title.length <= 300);
  assert.ok(!r.sourceDate || /^\d{4}-\d{2}-\d{2}$/.test(r.sourceDate));
  assert.equal(r.status, STATUS);
  assert.equal(r.details?.reviewRequired, true);
  assert.equal(r.details?.metadataOnly, true);
  const u = new URL(r.sourceUrl);
  assert.equal(u.protocol, "https:");
  assert.equal(u.search, "");
  assert.equal(u.username, "");
  assert.equal(u.password, "");
  assert.equal(u.hostname, r.provider === "clinicaltrials" ? "clinicaltrials.gov" : "reporter.nih.gov");
  assert.ok(!JSON.stringify(r).match(/(?:patient[_ ]?id|ssn|birthdate|medical[_ ]?record|raw[_ ]?text)/i));
  const { contentHash, ...base } = r;
  assert.equal(digest(base), contentHash);
  return r;
}

export function validateSnapshot(snapshot, seed) {
  validateSeed(seed);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.seedId, seed.seedId);
  assert.match(snapshot.repoCommit, /^[a-f0-9]{40}$/);
  assert.match(snapshot.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(snapshot.publicationAuthorization, "NOT_GRANTED");
  assert.equal(snapshot.clinicalVerification, "NOT_PERFORMED");
  assert.ok(Array.isArray(snapshot.records) && snapshot.records.length > 0 && snapshot.records.length <= seed.topics.length * 2 * MAX_RESULTS);
  const keys = new Set();
  const topics = new Set(seed.topics.map((x) => x.id));
  for (const r of snapshot.records) {
    validateRecord(r);
    assert.ok(topics.has(r.topicId));
    const k = r.provider + ":" + r.topicId + ":" + r.sourceId;
    assert.ok(!keys.has(k)); keys.add(k);
  }
  const { contentDigest, ...rest } = snapshot;
  assert.equal(digest(rest), contentDigest);
  return snapshot;
}

export async function collect(seed, { request = fetch, repoCommit, observedAt = new Date().toISOString() } = {}) {
  validateSeed(seed);
  const records = [];
  for (const topic of seed.topics) {
    const ct = new URL("https://clinicaltrials.gov/api/v2/studies");
    ct.searchParams.set("query.cond", topic.query);
    ct.searchParams.set("pageSize", String(MAX_RESULTS));
    ct.searchParams.set("format", "json");
    const trials = await boundedJson(ct, { request });
    records.push(...normalizeTrials(topic, trials));
    const nih = new URL("https://api.reporter.nih.gov/v2/projects/search");
    const payload = { criteria: {
      advanced_text_search: { operator: "and", search_field: "projecttitle,terms", search_text: topic.query },
      fiscal_years: [2025,2026],
    }, offset: 0, limit: MAX_RESULTS };
    const projects = await boundedJson(nih, { request, method: "POST", body: payload });
    records.push(...normalizeProjects(topic, projects));
    await sleep(1100); // NIH recommends <=1 request per second.
  }
  const base = { schemaVersion: 1, seedId: seed.seedId, repoCommit, observedAt,
    publicationAuthorization: "NOT_GRANTED", clinicalVerification: "NOT_PERFORMED", records };
  const snapshot = { ...base, contentDigest: digest(base) };
  return validateSnapshot(snapshot, seed);
}

async function openDev() {
  const connection = getLabConnection(DEV_SERVICE, "verify");
  assertDevTarget(DEV_SERVICE, connection);
  const client = new Client({
    host: connection.PGHOST, port: Number(connection.PGPORT),
    database: connection.PGDATABASE, user: connection.PGUSER, password: connection.PGPASSWORD,
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 7000,
    statement_timeout: 15000, query_timeout: 18000,
    application_name: "scf_public_research_extensions_dev",
  });
  await client.connect();
  return client;
}

async function compareRows(client, snapshot) {
  const result = await client.query(
    "SELECT provider,topic_id,source_id,source_url,source_date,content_hash,details FROM " + SCHEMA +
    ".records WHERE run_id=$1 ORDER BY provider,topic_id,source_id", [snapshot.contentDigest]);
  const expected = snapshot.records.slice().sort((a,b) =>
    (a.provider+":"+a.topicId+":"+a.sourceId).localeCompare(b.provider+":"+b.topicId+":"+b.sourceId));
  assert.equal(result.rows.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i]; const a = result.rows[i];
    assert.equal(a.provider, e.provider);
    assert.equal(a.topic_id, e.topicId);
    assert.equal(a.source_id, e.sourceId);
    assert.equal(a.source_url, e.sourceUrl);
    assert.equal(a.source_date, e.sourceDate);
    assert.equal(a.content_hash, e.contentHash);
    assert.equal(canonical(a.details), canonical(e.details));
  }
  const run = await client.query(
    "SELECT seed_id,source_commit,record_count,clinical_status FROM " + SCHEMA + ".runs WHERE run_id=$1",
    [snapshot.contentDigest]);
  assert.equal(run.rows.length, 1);
  assert.equal(run.rows[0].seed_id, snapshot.seedId);
  assert.equal(run.rows[0].source_commit, snapshot.repoCommit);
  assert.equal(run.rows[0].record_count, snapshot.records.length);
  assert.equal(run.rows[0].clinical_status, "RESEARCH_ONLY_NO_CLINICAL_APPROVAL");
}

export async function writeDev(snapshot) {
  const client = await openDev();
  let begun = false;
  try {
    await client.query("BEGIN"); begun = true;
    await client.query("SET LOCAL lock_timeout='3000ms'");
    await client.query("SET LOCAL statement_timeout='12000ms'");
    await client.query("SELECT pg_advisory_xact_lock(202611,921)");
    await client.query("CREATE SCHEMA IF NOT EXISTS " + SCHEMA);
    await client.query("CREATE TABLE IF NOT EXISTS " + SCHEMA + ".runs (" +
      "run_id text PRIMARY KEY CHECK (run_id ~ '^[0-9a-f]{64}$')," +
      "seed_id text NOT NULL, source_commit text NOT NULL, record_count integer NOT NULL CHECK(record_count BETWEEN 1 AND 30)," +
      "observed_at timestamptz NOT NULL, clinical_status text NOT NULL DEFAULT 'RESEARCH_ONLY_NO_CLINICAL_APPROVAL' " +
      "CHECK (clinical_status='RESEARCH_ONLY_NO_CLINICAL_APPROVAL'), created_at timestamptz NOT NULL DEFAULT now())");
    await client.query("CREATE TABLE IF NOT EXISTS " + SCHEMA + ".records (" +
      "run_id text NOT NULL REFERENCES " + SCHEMA + ".runs(run_id)," +
      "provider text NOT NULL CHECK(provider IN ('clinicaltrials','nih_reporter'))," +
      "topic_id text NOT NULL, source_id text NOT NULL, source_url text NOT NULL," +
      "title text NOT NULL, source_date text NOT NULL, record_status text NOT NULL CHECK(record_status='" + STATUS + "')," +
      "details jsonb NOT NULL CHECK(details->>'reviewRequired'='true' AND details->>'metadataOnly'='true')," +
      "content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$')," +
      "PRIMARY KEY(run_id,provider,topic_id,source_id))");
    await client.query("REVOKE ALL ON SCHEMA " + SCHEMA + " FROM PUBLIC");
    await client.query("REVOKE ALL ON ALL TABLES IN SCHEMA " + SCHEMA + " FROM PUBLIC");
    await client.query("INSERT INTO " + SCHEMA + ".runs (run_id,seed_id,source_commit,record_count,observed_at)" +
      " VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [snapshot.contentDigest,snapshot.seedId,snapshot.repoCommit,snapshot.records.length,snapshot.observedAt]);
    for (const r of snapshot.records) {
      await client.query("INSERT INTO " + SCHEMA + ".records" +
        "(run_id,provider,topic_id,source_id,source_url,title,source_date,record_status,details,content_hash)" +
        " VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT DO NOTHING",
        [snapshot.contentDigest,r.provider,r.topicId,r.sourceId,r.sourceUrl,r.title,r.sourceDate,r.status,JSON.stringify(r.details),r.contentHash]);
    }
    await compareRows(client,snapshot);
    await client.query("COMMIT"); begun = false;
  } catch(e) {
    if(begun) await client.query("ROLLBACK").catch(()=>{});
    throw e;
  } finally { await client.end().catch(()=>{}); }
}

export async function verifyDev(snapshot) {
  const client = await openDev();
  try {
    await client.query("BEGIN READ ONLY");
    await compareRows(client,snapshot);
    await client.query("COMMIT");
  } catch(e) {
    await client.query("ROLLBACK").catch(()=>{});
    throw e;
  } finally { await client.end().catch(()=>{}); }
}

async function main() {
  const mode = process.argv[2]; const flags = process.argv.slice(3);
  const seed = validateSeed(JSON.parse(readFileSync(SEED_FILE, "utf8")));
  if(mode === "collect") {
    assert.deepEqual(flags,["--live"]);
    const repoCommit = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8",timeout:8000}).trim();
    const snapshot = await collect(seed,{repoCommit});
    writeFileSync(OUT, JSON.stringify(snapshot,null,2)+"\n",{mode:0o600});
    console.log(JSON.stringify({result:"PUBLIC_METADATA_COLLECTED",file:OUT,
      digest:snapshot.contentDigest,records:snapshot.records.length,providers:
        snapshot.records.reduce((a,r)=>(a[r.provider]=(a[r.provider]??0)+1,a),{}),clinicalApprovals:0}));
    return;
  }
  if(mode !== "apply" && mode !== "verify") throw new Error("Usage: collect --live | apply --dev-write | verify");
  assert.deepEqual(flags, mode === "apply" ? ["--dev-write"] : []);
  const snapshot = validateSnapshot(JSON.parse(readFileSync(OUT,"utf8")), seed);
  if(mode === "apply") await writeDev(snapshot);
  else await verifyDev(snapshot);
  console.log(JSON.stringify({result:mode === "apply" ? "DEV_METADATA_INSERTED_WITH_PARITY":"DEV_METADATA_PARITY_PASS",
    digest:snapshot.contentDigest,records:snapshot.records.length,clinicalApprovals:0,publicationChanges:0}));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    console.error("Public research DEV operation failed; credentials and provider payloads omitted.");
    process.exitCode = 1;
  });
}
