import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { findCondition, normalizeConditionName } from "../src/lib/catalog/lookup.ts";

const [mode, service] = process.argv.slice(2);
const sourceName = "secondary-condition-finder-fixture-source";
const targetName = "secondary-condition-finder-test";
if (process.argv.length !== 4 || !["seed", "verify"].includes(mode) || !/^[a-z0-9]{10}$/.test(service)) {
  throw new Error("Usage: node scripts/test-tiger-catalog.mjs seed|verify <lab-service-id>");
}

function tiger(args, input) {
  const result = spawnSync("tiger", args, { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0 && result.stderr?.trim()) throw new Error(result.stderr.trim());
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Tiger command failed.");
  return result.stdout.trim();
}

const metadata = JSON.parse(tiger(["service", "get", service, "-o", "json"]));
const lab = metadata.service ?? metadata;
assert.ok(
  lab.name === sourceName || (mode === "verify" && lab.name === targetName),
  "Only the designated fixture source and test service are allowed.",
);
assert.equal(lab.metadata?.environment, "DEV");
assert.equal(lab.status, "READY");

function jsonFiles(dir) {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8").replace(/^\uFEFF/, "")));
}

function copy(table, columns, records) {
  const csv = records.map((record) =>
    record.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(","),
  );
  return `COPY ${table} (${columns}) FROM STDIN WITH (FORMAT csv);\n${csv.join("\n")}\n\\.\n`;
}

const catalog = jsonFiles("data/conditions").flatMap((file) => file.conditions);
const mappingFiles = jsonFiles("data/knowledge-base");
const mappings = new Map(mappingFiles.map((file) => [file.id, file]));
assert.equal(mappings.size, mappingFiles.length, "Duplicate mapping IDs.");
assert.equal(catalog.length, mappings.size);
const conditions = catalog.map((condition) => {
  const mapping = mappings.get(condition.id);
  assert.ok(mapping, `Missing mapping for ${condition.id}`);
  return [condition.id, condition.name, mapping.draft !== true];
});
const terms = catalog.flatMap(({ id, name, aliases }) =>
  [...new Set([id, id.replaceAll("-", " "), name, ...aliases].map(normalizeConditionName))]
    .map((term) => [term, id]),
);
const edges = [...mappings.values()].flatMap((mapping) =>
  mapping.suggestions.map((suggestion) => [mapping.id, suggestion.conditionId, suggestion.rank]),
);
const snapshot = createHash("sha256").update(JSON.stringify([conditions, terms, edges])).digest("hex");
const withSnapshot = (rows) => rows.map((row) => [snapshot, ...row]);

function sql(source, ...flags) {
  return tiger(["db", "psql", service, "--", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", ...flags], source);
}

if (mode === "seed") {
  sql(`BEGIN;
    SELECT pg_advisory_xact_lock(171006, 819);
    CREATE SCHEMA IF NOT EXISTS scf_tiger_lab;
    CREATE TABLE IF NOT EXISTS scf_tiger_lab.conditions (
      snapshot text NOT NULL, id text NOT NULL, name text NOT NULL, published boolean NOT NULL,
      PRIMARY KEY (snapshot, id)
    );
    CREATE TABLE IF NOT EXISTS scf_tiger_lab.terms (
      snapshot text NOT NULL, term text NOT NULL, condition_id text NOT NULL,
      PRIMARY KEY (snapshot, term),
      FOREIGN KEY (snapshot, condition_id) REFERENCES scf_tiger_lab.conditions (snapshot, id)
    );
    CREATE TABLE IF NOT EXISTS scf_tiger_lab.edges (
      snapshot text NOT NULL, source_id text NOT NULL, target_id text NOT NULL, rank integer NOT NULL,
      CHECK (source_id <> target_id), CHECK (rank > 0),
      PRIMARY KEY (snapshot, source_id, target_id),
      FOREIGN KEY (snapshot, source_id) REFERENCES scf_tiger_lab.conditions (snapshot, id),
      FOREIGN KEY (snapshot, target_id) REFERENCES scf_tiger_lab.conditions (snapshot, id)
    );
    -- Cover child-side foreign-key checks during parent updates/deletes.
    CREATE INDEX IF NOT EXISTS edges_snapshot_target_id_idx
      ON scf_tiger_lab.edges (snapshot, target_id);
    CREATE INDEX IF NOT EXISTS terms_snapshot_condition_id_idx
      ON scf_tiger_lab.terms (snapshot, condition_id);
    CREATE TEMP TABLE seed_conditions (LIKE scf_tiger_lab.conditions) ON COMMIT DROP;
    CREATE TEMP TABLE seed_terms (LIKE scf_tiger_lab.terms) ON COMMIT DROP;
    CREATE TEMP TABLE seed_edges (LIKE scf_tiger_lab.edges) ON COMMIT DROP;
    ${copy("seed_conditions", "snapshot, id, name, published", withSnapshot(conditions))}
    ${copy("seed_terms", "snapshot, term, condition_id", withSnapshot(terms))}
    ${copy("seed_edges", "snapshot, source_id, target_id, rank", withSnapshot(edges))}
    SELECT EXISTS (SELECT FROM scf_tiger_lab.conditions WHERE snapshot = '${snapshot}') AS already_seeded \\gset
    \\if :already_seeded
    \\else
    INSERT INTO scf_tiger_lab.conditions SELECT * FROM seed_conditions;
    INSERT INTO scf_tiger_lab.terms SELECT * FROM seed_terms;
    INSERT INTO scf_tiger_lab.edges SELECT * FROM seed_edges;
    \\endif
    COMMIT;
  `);
  console.log(JSON.stringify({ snapshot, conditions: conditions.length, terms: terms.length, edges: edges.length }));
} else {
  const inputs = terms.map(([term], index) =>
    index % 2 === 0 ? term : `  ${term.toUpperCase().replaceAll(" ", "   ")}  `,
  );
  inputs.push("synthetic-unmatched-condition", "knee", "");
  const expected = new Map(terms);
  const started = performance.now();
  const app = inputs.map((input) => findCondition(catalog, input)?.id ?? null);
  const appMs = Math.round(performance.now() - started);
  assert.deepEqual(app, inputs.map((input) => expected.get(normalizeConditionName(input)) ?? null), "Application lookup disagrees with the checked-in term identities.");
  const result = JSON.parse(sql(`
    CREATE TEMP TABLE probes (probe_id integer PRIMARY KEY, term text NOT NULL);
    ${copy("probes", "probe_id, term", inputs.map((input, index) => [index, normalizeConditionName(input)]))}
    SELECT json_build_object(
      'conditions', (SELECT count(*) FROM scf_tiger_lab.conditions WHERE snapshot = '${snapshot}'),
      'terms', (SELECT count(*) FROM scf_tiger_lab.terms WHERE snapshot = '${snapshot}'),
      'edges', (SELECT count(*) FROM scf_tiger_lab.edges WHERE snapshot = '${snapshot}'),
      'orphan_edges', (SELECT count(*) FROM scf_tiger_lab.edges e
        LEFT JOIN scf_tiger_lab.conditions a ON (a.snapshot,a.id) = (e.snapshot,e.source_id)
        LEFT JOIN scf_tiger_lab.conditions b ON (b.snapshot,b.id) = (e.snapshot,e.target_id)
        WHERE e.snapshot = '${snapshot}' AND (a.id IS NULL OR b.id IS NULL)),
      'condition_rows', (SELECT json_agg(json_build_array(id,name,published) ORDER BY id COLLATE "C")
        FROM scf_tiger_lab.conditions WHERE snapshot = '${snapshot}'),
      'edge_rows', (SELECT json_agg(json_build_array(source_id,target_id,rank)
        ORDER BY source_id COLLATE "C", target_id COLLATE "C")
        FROM scf_tiger_lab.edges WHERE snapshot = '${snapshot}'),
      'published', (SELECT count(*) FROM scf_tiger_lab.conditions WHERE snapshot = '${snapshot}' AND published),
      'matches', (SELECT json_agg(t.condition_id ORDER BY p.probe_id) FROM probes p
        LEFT JOIN scf_tiger_lab.terms t ON t.snapshot = '${snapshot}' AND t.term = p.term)
    );
  `));
  const { matches, condition_rows: conditionRows, edge_rows: edgeRows, ...summary } = result;
  assert.deepEqual(conditionRows ?? [], [...conditions].sort(([a], [b]) =>
    a < b ? -1 : Number(a !== b),
  ), "Tiger conditions disagree with the checked-in reference.");
  assert.deepEqual(edgeRows ?? [], [...edges].sort(([a, b], [c, d]) =>
    a === c ? (b < d ? -1 : Number(b !== d)) : a < c ? -1 : 1,
  ), "Tiger pathway edges disagree with the checked-in reference.");

  assert.deepEqual(matches, app, "Tiger lookup disagrees with the application.");
  assert.deepEqual(summary, {
    conditions: conditions.length, terms: terms.length, edges: edges.length, orphan_edges: 0,
    published: conditions.filter((row) => row[2]).length,
  });
  console.log(JSON.stringify({ snapshot, ...summary, lookup_probes: inputs.length, app_lookup_ms: appMs }));
}
