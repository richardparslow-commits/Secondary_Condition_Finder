import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assertDev, assertManifest } from "../scripts/ontology-tiger-dev.mjs";
import { validateEnrichment, sha } from "../scripts/load-ontology-enrichment-dev.mjs";
import { validateCitationAudit } from "../scripts/load-ontology-citations-dev.mjs";

const STAGED = "/tmp/scf-mondo-20261006/staged";
const MONDO_SNAPSHOT = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7";
const goodConnection = {
  PGHOST: "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com",
  PGPORT: "30902", PGUSER: "tsdbadmin", PGDATABASE: "tsdb",
  PGSSLMODE: "require", PGPASSWORD: "synthetic-test-only",
  TIGER_LAB_ENDPOINT: "direct",
};

function sampleEnrichment() {
  const row = {
    provider: "ols4", condition_id: "condition-0", rank: 1,
    candidate_id: "MONDO:0005146", label: "post-traumatic stress disorder",
    relation: "ontology_search", status: "EXACT_LABEL_REVIEW",
    source_url: "https://www.ebi.ac.uk/ols4/api/search",
    source_version: "OLS4", observed_at: "2026-11-09T00:00:00+00:00",
    metadata: { ontology: "mondo" }, reviewRequired: true,
  };
  row.content_sha256 = sha(row);
  const doc = {
    base_snapshot: MONDO_SNAPSHOT,
    seed: Array.from({ length: 12 }, (_, n) => "condition-" + n),
    observed_at: "2026-11-09T00:00:00+00:00",
    clinicalApproval: "NOT_GRANTED",
    observations: [row], gaps: [],
  };
  doc.digest = sha(doc);
  return doc;
}

test("DEV-only connection is pinned; rejects PROD, pooled and admin host substitution", () => {
  assertDev("m8vrpmo6ec", goodConnection);
  assert.throws(() => assertDev("yc5kzxwazj", goodConnection));
  assert.throws(() => assertDev("m8vrpmo6ec",
    { ...goodConnection, PGHOST: "yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com" }));
  assert.throws(() => assertDev("m8vrpmo6ec",
    { ...goodConnection, TIGER_LAB_ENDPOINT: "pooled" }));
});

test("valid lexical OLS candidate remains review-only, never clinical evidence", () => {
  const d = sampleEnrichment();
  assert.equal(validateEnrichment(d), d);
  assert.equal(d.clinicalApproval, "NOT_GRANTED");
  assert.equal(d.observations[0].reviewRequired, true);
});

test("digest rejects silently changed ontology candidate and source ID", () => {
  const d = sampleEnrichment();
  d.observations[0].candidate_id = "MONDO:9999999";
  assert.throws(() => validateEnrichment(d));
});

test("rehashed non-approved medical causality is rejected by strict status allowlist", () => {
  const d = sampleEnrichment();
  d.observations[0].status = "CAUSATION_PROVEN";
  d.observations[0].content_sha256 = sha(
    Object.fromEntries(Object.entries(d.observations[0]).filter(([k]) => k !== "content_sha256")));
  d.digest = sha(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "digest")));
  assert.throws(() => validateEnrichment(d));
});

test("rehashed untrusted API host is rejected", () => {
  const d = sampleEnrichment();
  d.observations[0].source_url = "https://untrusted.invalid/medical";
  d.observations[0].content_sha256 = sha(
    Object.fromEntries(Object.entries(d.observations[0]).filter(([k]) => k !== "content_sha256")));
  d.digest = sha(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "digest")));
  assert.throws(() => validateEnrichment(d));
});

test("HPO and Open Targets are research candidates, not causality evidence", () => {
  for (const [provider, url, state] of [
    ["hpo_ols4", "https://www.ebi.ac.uk/ols4/api/search", "PHENOTYPE_TERM_REVIEW"],
    ["opentargets", "https://api.platform.opentargets.org/api/v4/graphql",
      "DISEASE_IDENTITY_CANDIDATE_REVIEW"],
  ]) {
    const d = sampleEnrichment();
    const x = d.observations[0];
    x.provider = provider;
    x.source_url = url;
    x.status = state;
    x.content_sha256 = sha(Object.fromEntries(Object.entries(x).filter(([k]) => k !== "content_sha256")));
    d.digest = sha(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "digest")));
    validateEnrichment(d);
  }
});

function syntheticCitationAudit() {
  const rows = Array.from({ length: 875 }, (_, i) => {
    const row = {
      source_id: "primary-" + String(i).padStart(3, "0"),
      target_id: "secondary-" + String(i).padStart(3, "0"),
      rank: 1, nexus_classification: "ASSOCIATION_ONLY",
      references: 1, declared_verified: 0, clinical_refs: 1,
      clinical_declared_verified: 0, pmids_count: 1,
      flags: ["CLINICAL_CLAIM_UNASSESSED"], review_state: "HUMAN_REVIEW_REQUIRED",
    };
    return { ...row, content_sha256: sha(row) };
  });
  const d = { schemaVersion: 1, ontologySnapshot: MONDO_SNAPSHOT,
    clinicalApproval: "NOT_GRANTED", rows };
  return { ...d, digest: sha(d) };
}

test("all 875 synthetic pathways must remain flagged for clinical review", () => {
  const d = syntheticCitationAudit();
  validateCitationAudit(d);
  assert.equal(d.rows.length, 875);
  assert.equal(d.rows[0].review_state, "HUMAN_REVIEW_REQUIRED");
});

test("an evidence-review flag cannot be removed even if a snapshot is rehashed", () => {
  const d = syntheticCitationAudit();
  const row = d.rows[0];
  row.flags = ["PROVEN_CAUSAL"];
  row.content_sha256 = sha(Object.fromEntries(Object.entries(row).filter(([k]) => k !== "content_sha256")));
  d.digest = sha(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "digest")));
  assert.throws(() => validateCitationAudit(d));
});

test("pinned MONDO source digest and staged rows cannot be silently substituted", (t) => {
  const path = STAGED + "/manifest.json";
  if (!fs.existsSync(path)) return t.skip("Full official MONDO release not staged in CI");
  const d = JSON.parse(fs.readFileSync(path, "utf8"));
  assert.equal(assertManifest(d).snapshot, MONDO_SNAPSHOT);
  assert.equal(d.appConditionCount, 819);
  assert.equal(d.appPathwayCount, 875);
  const tampered = structuredClone(d);
  tampered.tables.synonyms.jsonl_sha256 = "0".repeat(64);
  assert.throws(() => assertManifest(tampered));
});

test("only exact name/exact synonym matches become ontology identity candidates", (t) => {
  const p = STAGED + "/app_candidates.csv";
  if (!fs.existsSync(p)) return t.skip("Official ontology mapping audit not staged");
  const data = fs.readFileSync(p, "utf8").trim().split("\n");
  assert.equal(data.length - 1, 565);
  for (const line of data.slice(1)) {
    assert.ok(["LABEL", "EXACT_SYNONYM", "ALIAS_LABEL", "ALIAS_EXACT_SYNONYM"]
      .some((s) => line.includes("," + s + ",")));
  }
});
