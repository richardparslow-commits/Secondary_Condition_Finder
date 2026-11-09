import test from "node:test";
import assert from "node:assert/strict";

import {
  digest, validatePublicSeed, providerUrls, boundedJson,
  normalizePubmed, normalizeRxnorm, normalizeFda, sealSnapshot,
  assertSnapshot, collectPublicReferences,
} from "../scripts/lib/public-medical-reference.mjs";
import { assertDevTarget, DEV_SERVICE } from "../scripts/lib/medical-reference-tiger-dev.mjs";

const seed = {
  schemaVersion: 1, seedId: "public-fixture-test-2026",
  pmids: ["30453780"], genericDrugs: ["metformin"],
};
const pmidDoc = {
  result: {
    "30453780": { uid: "30453780", title: "Test study metadata",
      pubdate: "2020", pubtype: ["Journal Article"],
      articleids: [{ idtype: "doi", value: "10.1000/example" }] },
  },
};
const drugDoc = { idGroup: { rxnormId: ["6809"] } };
const rxProperties = { "6809": { properties: { rxcui: "6809", name: "metformin", tty: "IN" } } };
const fdaDoc = { results: [{
  id: "50c0b704-0706-da22-e063-6394a90aa3c9",
  set_id: "27f603ec-25e6-4270-a7a3-34a64a76f7ef",
  effective_time: "20260501", openfda: { generic_name: ["METFORMIN"] },
  boxed_warning: ["full warning text must never enter database"],
  adverse_reactions: ["full adverse text must never enter database"],
}] };

test("seed requires bounded public identifiers and rejects unapproved medication names", () => {
  assert.doesNotThrow(() => validatePublicSeed(seed, new Set(["30453780"])));
  assert.throws(() => validatePublicSeed(seed, new Set(["99999999"])));
  assert.throws(() => validatePublicSeed({ ...seed, pmids: ["30453780", "30453780"] }));
  assert.throws(() => validatePublicSeed({ ...seed, genericDrugs: ["metformin", "metformin"] }));
  assert.throws(() => validatePublicSeed({ ...seed, genericDrugs: ["metformin AND user=private"] }));
  assert.throws(() => validatePublicSeed({ ...seed, pmids: Array.from({ length: 11 }, (_, i) => String(100000 + i)) }));
});

test("provider URLs use only official hostnames, bounded exact/normalized search", () => {
  const urls = providerUrls(seed);
  assert.equal(urls.ncbi.hostname, "eutils.ncbi.nlm.nih.gov");
  assert.equal(urls.rxnorm("metformin").searchParams.get("search"), "2");
  assert.equal(urls.rxnorm("metformin").searchParams.get("allsrc"), "0");
  assert.equal(urls.label("metformin").searchParams.get("limit"), "1");
  assert.throws(() => urls.label("different unapproved name"));
  assert.throws(() => urls.properties("../unexpected"));
});

test("fetcher rejects unknown hosts and non-HTTPS, oversized and non-JSON responses", async () => {
  const fake = () => { throw new Error("No request should be made"); };
  await assert.rejects(boundedJson(new URL("https://unapproved.example/data"), { request: fake }));
  await assert.rejects(boundedJson(new URL("http://rxnav.nlm.nih.gov/REST/rxcui.json"), { request: fake }));
  const response = (body, { status = 200, length = String(body.length) } = {}) =>
    ({ ok: status >= 200 && status < 300, status, headers: { get: () => length },
      text: async () => body });
  await assert.rejects(boundedJson(providerUrls(seed).ncbi, {
    request: async () => response('{"test":1}', { length: "999999999" }),
  }));
  await assert.rejects(boundedJson(providerUrls(seed).ncbi, {
    request: async () => response("<not JSON>"),
  }));
  const notFound = await boundedJson(providerUrls(seed).label("metformin"), {
    allowNotFound: true, request: async () => response("{}", { status: 404 }),
  });
  assert.deepEqual(notFound, { results: [] });
});

test("PubMed record is metadata only and never verified automatically", () => {
  const rows = normalizePubmed(seed, pmidDoc);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "metadata_unverified");
  assert.equal(rows[0].details.doi, "10.1000/example");
  assert.equal(rows[0].details.reviewRequired, true);
  const retracted = normalizePubmed(seed, {
    result: { "30453780": { ...pmidDoc.result["30453780"], pubtype: ["Retracted Publication"] } },
  });
  assert.equal(retracted[0].status, "publication_status_review");
  assert.equal(normalizePubmed(seed, { result: {} })[0].status, "unresolved");
});

test("RxNorm preserves RxCUIs and flags ambiguous concepts without guessing", () => {
  const single = normalizeRxnorm("metformin", drugDoc, rxProperties);
  assert.equal(single[0].details.rxcui, "6809");
  assert.equal(single[0].details.reviewRequired, true);
  const ambiguous = normalizeRxnorm("metformin", { idGroup: { rxnormId: ["6809", "999"] } },
    { ...rxProperties, "999": { properties: { rxcui: "999", name: "another", tty: "IN" } } });
  assert.equal(ambiguous.length, 2);
  assert.equal(ambiguous[0].status, "ambiguous_review");
  assert.equal(normalizeRxnorm("metformin", {}, {})[0].status, "unresolved");
  assert.throws(() => normalizeRxnorm("metformin", {
    idGroup: { rxnormId: ["1", "2", "3", "4", "5", "6"] },
  }, {}));
});

test("openFDA keeps label identity and warning presence, never full warning text", () => {
  const row = normalizeFda("metformin", fdaDoc);
  assert.equal(row.status, "sample_label_unverified");
  assert.equal(row.details.boxedWarningPresent, true);
  assert.equal(row.details.adverseReactionsSectionPresent, true);
  assert.equal(row.details.sampleOnly, true);
  assert.equal(JSON.stringify(row).includes("full warning text"), false);
  assert.equal(JSON.stringify(row).includes("full adverse text"), false);
  assert.equal(normalizeFda("metformin", { results: [] }).status, "unresolved");
});

test("sealed snapshots are reproducible, tamper-evident and never clinically approved", () => {
  const records = [
    normalizePubmed(seed, pmidDoc)[0],
    normalizeRxnorm("metformin", drugDoc, rxProperties)[0],
    normalizeFda("metformin", fdaDoc),
  ];
  const first = sealSnapshot(seed, records, { observedAt: "2026-11-08T00:00:00Z" });
  const second = sealSnapshot(seed, [...records].reverse(), { observedAt: "2026-11-09T00:00:00Z" });
  assert.equal(first.contentDigest, second.contentDigest);
  assertSnapshot(first, seed);
  const tampered = structuredClone(first);
  tampered.records[0].title = "changed";
  assert.throws(() => assertSnapshot(tampered, seed));
  const approved = structuredClone(first);
  approved.records[0].details.reviewRequired = false;
  assert.throws(() => assertSnapshot(approved, seed));
});

test("full collection uses three official sources and fixed safe seeds only", async () => {
  const calls = [];
  const request = async (url) => {
    calls.push(url.hostname + url.pathname);
    const json = url.hostname === "eutils.ncbi.nlm.nih.gov" ? pmidDoc
      : url.pathname.endsWith("properties.json") ? rxProperties["6809"]
      : url.hostname === "rxnav.nlm.nih.gov" ? drugDoc : fdaDoc;
    return { status: 200, ok: true, headers: { get: () => null },
      text: async () => JSON.stringify(json) };
  };
  const snap = await collectPublicReferences(seed, {
    request, wait: async () => {},
    observedAt: "2026-11-08T00:00:00Z", repoCommit: "fixture",
  });
  assert.deepEqual([...new Set(snap.records.map((r) => r.provider))],
    ["openfda_label", "pubmed", "rxnorm"]);
  assert.equal(snap.records.length, 3);
  assert.equal(calls.length, 4);
  assert.ok(snap.records.every((x) => x.details.reviewRequired));
  assertSnapshot(snap, seed);
});

test("forged snapshots cannot add arbitrary personal or full-text fields", () => {
  const rows = [normalizePubmed(seed, pmidDoc)[0],
    normalizeRxnorm("metformin", drugDoc, rxProperties)[0], normalizeFda("metformin", fdaDoc)];
  const snapshot = sealSnapshot(seed, rows);
  const tampered = structuredClone(snapshot);
  const record = tampered.records[0];
  record.details.fullAdverseText = "unapproved full section";
  const rest = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "contentHash"));
  record.contentHash = digest(rest);
  assert.throws(() => assertSnapshot(tampered, seed));
  const urlForged = structuredClone(snapshot);
  const changed = urlForged.records[0];
  changed.sourceUrl = "https://example.com/untrusted-record";
  const rest2 = Object.fromEntries(Object.entries(changed).filter(([key]) => key !== "contentHash"));
  changed.contentHash = digest(rest2);
  assert.throws(() => assertSnapshot(urlForged, seed));
  assert.throws(() => sealSnapshot(seed, rows.slice(1)));
});

test("Tiger DB isolation refuses Production, unexpected hosts and pooled writes", () => {
  const connection = {
    PGHOST: "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
    PGPORT: "30902", PGDATABASE: "tsdb", PGUSER: "tsdbadmin",
    PGPASSWORD: "test-placeholder-not-a-real-secret", TIGER_LAB_ENDPOINT: "direct",
  };
  assertDevTarget(DEV_SERVICE, connection);
  assert.throws(() => assertDevTarget("yc5kzxwazj", connection));
  assert.throws(() => assertDevTarget(DEV_SERVICE,
    { ...connection, PGHOST: "yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com" }));
  assert.throws(() => assertDevTarget(DEV_SERVICE,
    { ...connection, TIGER_LAB_ENDPOINT: "pooled" }));
});
