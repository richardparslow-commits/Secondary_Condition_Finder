import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const ALLOWED = new Set([
  "eutils.ncbi.nlm.nih.gov",
  "rxnav.nlm.nih.gov",
  "api.fda.gov",
]);
const MAX_BYTES = 1_500_000;
const MAX_RECORDS = 30;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const digest = (value) => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

export function validatePublicSeed(seed, registryPmids = null) {
  assert.equal(seed?.schemaVersion, 1);
  assert.match(seed.seedId, /^[a-z0-9-]{5,90}$/);
  assert.ok(Array.isArray(seed.pmids) && seed.pmids.length > 0 && seed.pmids.length <= 10);
  assert.ok(Array.isArray(seed.genericDrugs) && seed.genericDrugs.length > 0 && seed.genericDrugs.length <= 6);
  assert.equal(new Set(seed.pmids).size, seed.pmids.length);
  assert.equal(new Set(seed.genericDrugs).size, seed.genericDrugs.length);
  for (const id of seed.pmids) {
    assert.match(id, /^\d{6,9}$/);
    if (registryPmids) assert.ok(registryPmids.has(id), "PMID must already exist in the public evidence registry");
  }
  for (const name of seed.genericDrugs) assert.match(name, /^[a-z][a-z -]{2,39}$/);
  return seed;
}

export function providerUrls(seed, apiKeys = {}) {
  validatePublicSeed(seed);
  const ncbi = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  ncbi.searchParams.set("db", "pubmed");
  ncbi.searchParams.set("id", seed.pmids.join(","));
  ncbi.searchParams.set("retmode", "json");
  ncbi.searchParams.set("tool", "SCFPublicResearchDEV");
  if (apiKeys.ncbi) ncbi.searchParams.set("api_key", apiKeys.ncbi);

  return {
    ncbi,
    rxnorm: (name) => {
      assert.ok(seed.genericDrugs.includes(name), "Only fixed public test seeds are allowed");
      const u = new URL("https://rxnav.nlm.nih.gov/REST/rxcui.json");
      u.searchParams.set("name", name);
      u.searchParams.set("search", "2"); // exact, then normalized — never approximate
      u.searchParams.set("allsrc", "0");  // active RxNorm concepts
      return u;
    },
    properties: (rxcui) => {
      assert.match(rxcui, /^\d{1,12}$/);
      return new URL(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`);
    },
    label: (name) => {
      assert.ok(seed.genericDrugs.includes(name), "Only fixed public test seeds are allowed");
      const u = new URL("https://api.fda.gov/drug/label.json");
      u.searchParams.set("search", `openfda.generic_name.exact:"${name.toUpperCase()}"`);
      u.searchParams.set("limit", "1"); // sample only; never completeness evidence
      if (apiKeys.fda) u.searchParams.set("api_key", apiKeys.fda);
      return u;
    },
  };
}

export async function boundedJson(url, {
  request = fetch, timeoutMs = 10_000, allowNotFound = false,
} = {}) {
  if (!(url instanceof URL) || url.protocol !== "https:" || !ALLOWED.has(url.hostname)) {
    throw new Error("Public research refused unapproved endpoint");
  }
  const response = await request(url, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "application/json", "User-Agent": "SCF-PublicResearch-DEV/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404 && allowNotFound) return { results: [] };
  if (!response.ok) throw new Error(`Public reference provider HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength > MAX_BYTES) throw new Error("Provider response exceeds size limit");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Provider response exceeds size limit");
  try { return JSON.parse(text); } catch { throw new Error("Invalid provider JSON"); }
}

const boundedText = (value, limit = 400) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";
const cleanArray = (value, n = 12) => Array.isArray(value)
  ? value.filter((x) => typeof x === "string").slice(0, n).map((x) => boundedText(x, 120))
  : [];

function metadata(provider, key, sourceUrl, title, status, sourceDate, details) {
  assert.match(sourceUrl, /^https:\/\//);
  const record = { provider, key, sourceUrl, title: boundedText(title), status,
    sourceDate: boundedText(sourceDate, 20), details };
  return { ...record, contentHash: digest(record) };
}

export function normalizePubmed(seed, payload) {
  return seed.pmids.map((pmid) => {
    const row = payload?.result?.[pmid];
    if (!row || String(row.uid) !== pmid) {
      return metadata("pubmed", pmid, `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        "", "unresolved", "", { doi: "", pubtypes: [], reviewRequired: true });
    }
    const doi = (Array.isArray(row.articleids) ? row.articleids : [])
      .find((x) => x.idtype === "doi")?.value ?? "";
    const pubtypes = cleanArray(row.pubtype, 24);
    const flagged = pubtypes.some((x) => /retract|expression of concern|withdraw/i.test(x));
    return metadata("pubmed", pmid, `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      row.title, flagged ? "publication_status_review" : "metadata_unverified",
      row.pubdate, { doi: boundedText(doi, 140), pubtypes, reviewRequired: true });
  });
}

export function normalizeRxnorm(query, idsPayload, propertiesPayloads) {
  const ids = [...new Set(
    (Array.isArray(idsPayload?.idGroup?.rxnormId) ? idsPayload.idGroup.rxnormId : [])
      .filter((x) => typeof x === "string" && /^\d{1,12}$/.test(x)),
  )];
  if (!ids.length) {
    return [metadata("rxnorm", `${query}:unresolved`,
      "https://www.nlm.nih.gov/research/umls/rxnorm/index.html", query,
      "unresolved", "", { query, rxcui: null, tty: null, reviewRequired: true })];
  }
  if (ids.length > 5) throw new Error("Ambiguous RxNorm concept set exceeds bounded pilot");
  return ids.map((id) => {
    const p = propertiesPayloads[id]?.properties ?? {};
    if (String(p.rxcui ?? "") !== id || !boundedText(p.name)) {
      throw new Error("RxNorm properties missing or mismatched");
    }
    return metadata("rxnorm", `${query}:${id}`,
      `https://rxnav.nlm.nih.gov/REST/rxcui/${id}/properties.json`, p.name,
      ids.length === 1 ? "metadata_unverified" : "ambiguous_review",
      "", { query, rxcui: id, tty: boundedText(p.tty, 16),
        matchCount: ids.length, reviewRequired: true });
  });
}

export function normalizeFda(query, payload) {
  const raw = Array.isArray(payload?.results) ? payload.results[0] : null;
  if (!raw) {
    return metadata("openfda_label", `${query}:unresolved`,
      "https://open.fda.gov/apis/drug/label/", query, "unresolved", "",
      { query, brandNames: [], genericNames: [], reviewRequired: true });
  }
  const id = boundedText(raw.id, 120);
  const setId = boundedText(raw.set_id, 120);
  if (!/^[a-f0-9-]{25,50}$/i.test(id) || !/^[a-f0-9-]{25,50}$/i.test(setId)) {
    throw new Error("FDA labeling record missing stable identity");
  }
  const names = cleanArray(raw.openfda?.generic_name, 8);
  const brandNames = cleanArray(raw.openfda?.brand_name, 8);
  return metadata("openfda_label", `${query}:${id}`,
    `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${encodeURIComponent(setId)}`,
    names[0] ?? query, "sample_label_unverified", raw.effective_time,
    { query, setId, genericNames: names, brandNames,
      boxedWarningPresent: Array.isArray(raw.boxed_warning) && raw.boxed_warning.length > 0,
      adverseReactionsSectionPresent: Array.isArray(raw.adverse_reactions) && raw.adverse_reactions.length > 0,
      reviewRequired: true, sampleOnly: true });
}

function validateMetadataRecord(seed, record) {
  assert.deepEqual(Object.keys(record).sort(),
    ["provider", "key", "sourceUrl", "title", "status", "sourceDate", "details", "contentHash"].sort(),
    "Unapproved reference fields (full text and personal data are forbidden)");
  assert.ok(typeof record.title === "string" && record.title.length <= 400);
  assert.ok(typeof record.sourceDate === "string" && record.sourceDate.length <= 20);
  assert.ok(record.details && typeof record.details === "object" && !Array.isArray(record.details));
  const props = Object.keys(record.details).sort();
  const sameKeys = (required) => assert.deepEqual(props, [...required].sort(), "Unexpected metadata fields");
  const url = new URL(record.sourceUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.searchParams.has("api_key"), false);
  const bits = record.key.split(":");
  if (record.provider === "pubmed") {
    assert.ok(seed.pmids.includes(record.key));
    assert.equal(url.hostname, "pubmed.ncbi.nlm.nih.gov");
    assert.equal(url.pathname, `/${record.key}/`);
    assert.ok(["unresolved", "metadata_unverified", "publication_status_review"].includes(record.status));
    sameKeys(["doi", "pubtypes", "reviewRequired"]);
    assert.ok(typeof record.details.doi === "string" && record.details.doi.length <= 140);
    assert.ok(Array.isArray(record.details.pubtypes) && record.details.pubtypes.length <= 24);
    assert.ok(record.details.pubtypes.every((v) => typeof v === "string" && v.length <= 120));
  } else if (record.provider === "rxnorm") {
    assert.equal(bits.length, 2);
    assert.ok(seed.genericDrugs.includes(bits[0]));
    assert.equal(record.details.query, bits[0]);
    if (bits[1] === "unresolved") {
      assert.equal(record.status, "unresolved");
      assert.equal(url.hostname, "www.nlm.nih.gov");
      assert.equal(record.details.rxcui, null);
      sameKeys(["query", "rxcui", "tty", "reviewRequired"]);
    } else {
      assert.match(bits[1], /^\d{1,12}$/);
      assert.equal(url.hostname, "rxnav.nlm.nih.gov");
      assert.equal(url.pathname, `/REST/rxcui/${bits[1]}/properties.json`);
      assert.equal(record.details.rxcui, bits[1]);
      assert.ok(["metadata_unverified", "ambiguous_review"].includes(record.status));
      assert.ok(Number.isInteger(record.details.matchCount) &&
        record.details.matchCount >= 1 && record.details.matchCount <= 5);
      sameKeys(["query", "rxcui", "tty", "matchCount", "reviewRequired"]);
    }
  } else if (record.provider === "openfda_label") {
    assert.equal(bits.length, 2);
    assert.ok(seed.genericDrugs.includes(bits[0]));
    assert.equal(record.details.query, bits[0]);
    if (bits[1] === "unresolved") {
      assert.equal(record.status, "unresolved");
      assert.equal(url.hostname, "open.fda.gov");
      sameKeys(["query", "brandNames", "genericNames", "reviewRequired"]);
    } else {
      assert.match(bits[1], /^[a-f0-9-]{25,50}$/i);
      assert.equal(record.status, "sample_label_unverified");
      assert.equal(url.hostname, "dailymed.nlm.nih.gov");
      assert.equal(url.searchParams.get("setid"), record.details.setId);
      assert.equal(record.details.sampleOnly, true);
      for (const field of ["boxedWarningPresent", "adverseReactionsSectionPresent"]) {
        assert.equal(typeof record.details[field], "boolean");
      }
      sameKeys(["query", "setId", "genericNames", "brandNames",
        "boxedWarningPresent", "adverseReactionsSectionPresent", "reviewRequired", "sampleOnly"]);
    }
    for (const field of ["genericNames", "brandNames"]) {
      assert.ok(Array.isArray(record.details[field]) && record.details[field].length <= 8);
      assert.ok(record.details[field].every((v) => typeof v === "string" && v.length <= 120));
    }
  }
  assert.equal(record.details.reviewRequired, true, "No automatic clinical approval");
}

export function sealSnapshot(seed, records, { observedAt = new Date().toISOString(), repoCommit = "" } = {}) {
  validatePublicSeed(seed);
  assert.ok(records.length > 0 && records.length <= MAX_RECORDS);
  const sorted = [...records].sort((a, b) =>
    (a.provider + ":" + a.key).localeCompare(b.provider + ":" + b.key, "en"));
  const identities = new Set();
  for (const record of sorted) {
    assert.ok(["pubmed", "rxnorm", "openfda_label"].includes(record.provider));
    assert.match(record.key, /^[a-z0-9: -]{2,130}$/i);
    assert.ok(!identities.has(record.provider + ":" + record.key));
    identities.add(record.provider + ":" + record.key);
    const { contentHash, ...rest } = record;
    assert.equal(contentHash, digest(rest), "Record metadata digest mismatch");
    validateMetadataRecord(seed, record);
  }
  for (const provider of ["pubmed", "rxnorm", "openfda_label"]) {
    assert.ok(sorted.some((x) => x.provider === provider), "All three official sources must be represented");
  }
  for (const id of seed.pmids) {
    assert.equal(sorted.filter((r) => r.provider === "pubmed" && r.key === id).length, 1,
      "Each requested PMID needs exactly one checked status");
  }
  for (const name of seed.genericDrugs) {
    assert.equal(sorted.filter((r) => r.provider === "openfda_label" && r.key.startsWith(name + ":")).length, 1,
      "Each requested generic needs exactly one FDA lookup result");
    const rxMatches = sorted.filter((r) => r.provider === "rxnorm" && r.key.startsWith(name + ":"));
    assert.ok(rxMatches.length >= 1 && rxMatches.length <= 5,
      "Every requested generic needs a bounded RxNorm lookup status");
  }
  const contentDigest = digest([seed.seedId, sorted]);
  return { schemaVersion: 1, seedId: seed.seedId, contentDigest,
    repoCommit, observedAt, records: sorted };
}

export function assertSnapshot(snapshot, seed) {
  assert.equal(snapshot?.schemaVersion, 1);
  assert.equal(snapshot?.seedId, seed.seedId);
  const expected = sealSnapshot(seed, snapshot.records, {
    observedAt: snapshot.observedAt, repoCommit: snapshot.repoCommit,
  });
  assert.equal(expected.contentDigest, snapshot.contentDigest, "Snapshot digest mismatch");
  return snapshot;
}

export async function collectPublicReferences(seed, {
  request = fetch, keys = {}, wait = sleep, timeoutMs = 10_000,
  observedAt = new Date().toISOString(), repoCommit = "",
} = {}) {
  validatePublicSeed(seed);
  const urls = providerUrls(seed, keys);
  const fetcher = (url, extras = {}) =>
    boundedJson(url, { request, timeoutMs, ...extras });
  const pubmed = normalizePubmed(seed, await fetcher(urls.ncbi));
  const rxnorm = [];
  const fda = [];
  for (const query of seed.genericDrugs) {
    await wait(450); // conservative rate limit for shared public APIs
    const ids = await fetcher(urls.rxnorm(query));
    const rxcuis = [...new Set(ids?.idGroup?.rxnormId ?? [])].filter((s) =>
      typeof s === "string" && /^\d{1,12}$/.test(s));
    if (rxcuis.length > 5) throw new Error("Unbounded RxNorm concept ambiguity");
    const props = {};
    for (const id of rxcuis) {
      await wait(450);
      props[id] = await fetcher(urls.properties(id));
    }
    rxnorm.push(...normalizeRxnorm(query, ids, props));
    await wait(450);
    fda.push(normalizeFda(query, await fetcher(urls.label(query), { allowNotFound: true })));
  }
  return sealSnapshot(seed, [...pubmed, ...rxnorm, ...fda], { observedAt, repoCommit });
}
