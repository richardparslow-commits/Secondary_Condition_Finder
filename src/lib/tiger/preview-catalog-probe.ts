import "server-only";
import { createHash } from "node:crypto";
import { Client } from "pg";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { normalizeConditionName } from "@/lib/catalog/lookup";
import { loadKnowledgeBase } from "@/lib/kb/load";

type Cell = string | number | boolean;
type Tuple = readonly Cell[];
type ConditionTuple = readonly [string, string, boolean];
type TermTuple = readonly [string, string];
type EdgeTuple = readonly [string, string, number];

export type PreviewCatalogResult = {
  connection: "ok";
  catalog: "missing_tables" | "snapshot_missing" | "parity_mismatch" | "parity_verified";
  referenceConditions: number;
  referenceTerms: number;
  referenceEdges: number;
  remoteConditions: number | null;
  remoteTerms: number | null;
  remoteEdges: number | null;
  orphanEdges: number | null;
};

// This is the isolated DEV verification service, never the PROD-tagged db-41579.
const EXPECTED_HOST = "m8vrpmo6ec.xtb16bcthd.tsdb.cloud.timescale.com";
const ROLE = "preview_catalog_reader";
const DATABASE = "tsdb";
const PORT = 30902;

/** No credentials are logged, returned to callers, or sent to client components. */
export function parseTigerPreviewConnection(raw: string) {
  const url = new URL(raw);
  const password = decodeURIComponent(url.password);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== EXPECTED_HOST ||
    Number(url.port) !== PORT ||
    url.pathname !== "/" + DATABASE ||
    decodeURIComponent(url.username) !== ROLE ||
    !password ||
    url.searchParams.get("sslmode") !== "require"
  ) throw new Error("Invalid Tiger Preview connection configuration.");

  return {
    host: EXPECTED_HOST, port: PORT, database: DATABASE, user: ROLE, password,
    ssl: { rejectUnauthorized: true },
    application_name: "scf_tiger_dev_preview_probe",
    connectionTimeoutMillis: 4500, query_timeout: 8000, statement_timeout: 7000,
  };
}

/** Exact multiset equality, including every ID, alias owner, publication flag and pathway rank. */
export function exactRowsMatch(expected: readonly Tuple[], actual: readonly Tuple[]): boolean {
  if (expected.length !== actual.length) return false;
  const a = expected.map((row) => JSON.stringify(row)).sort();
  const b = actual.map((row) => JSON.stringify(row)).sort();
  return a.every((value, i) => value === b[i]);
}

/**
 * Use the same deterministic ordering/identity contract as
 * scripts/test-tiger-catalog.mjs. A new catalog edition gets a new snapshot;
 * the old snapshot stays immutable for review.
 */
export function buildCatalogReference() {
  const catalog = loadConditionCatalog();
  const mappings = loadKnowledgeBase();
  const byId = new Map(mappings.map((entry) => [entry.id, entry]));
  if (byId.size !== mappings.length || catalog.length !== mappings.length) {
    throw new Error("Invalid catalog/mapping identity correspondence.");
  }

  const conditions: ConditionTuple[] = catalog.map(({ id, name }) => {
    const mapping = byId.get(id);
    if (!mapping) throw new Error("Missing knowledge-base mapping.");
    return [id, name, mapping.draft !== true];
  });
  const terms: TermTuple[] = catalog.flatMap(({ id, name, aliases }) =>
    [...new Set([id, id.replaceAll("-", " "), name, ...aliases].map(normalizeConditionName))]
      .map((term) => [term, id] as TermTuple),
  );
  const edges: EdgeTuple[] = mappings.flatMap((mapping) =>
    mapping.suggestions.map((suggestion) =>
      [mapping.id, suggestion.conditionId, suggestion.rank] as EdgeTuple),
  );

  const snapshot = createHash("sha256")
    .update(JSON.stringify([conditions, terms, edges]))
    .digest("hex");
  return { snapshot, conditions, terms, edges };
}

/**
 * All database actions are inside BEGIN READ ONLY. Compare ALL expected row
 * values, rather than accepting matching counts, a hash alone, or a few probes.
 * No schema creation, writes, migrations or replica changes.
 */
export async function probePreviewCatalog(raw: string): Promise<PreviewCatalogResult> {
  const { snapshot, conditions, terms, edges } = buildCatalogReference();
  const counts = {
    referenceConditions: conditions.length,
    referenceTerms: terms.length,
    referenceEdges: edges.length,
  };
  const client = new Client(parseTigerPreviewConnection(raw));
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.query("BEGIN READ ONLY");
    const identity = await client.query<{ db: string; username: string; read_only: string }>(
      "SELECT current_database() AS db, current_user AS username, current_setting('transaction_read_only') AS read_only",
    );
    if (
      identity.rows.length !== 1 ||
      identity.rows[0].db !== DATABASE ||
      identity.rows[0].username !== ROLE ||
      identity.rows[0].read_only !== "on"
    ) throw new Error("Tiger DEV role or read-only mode mismatch.");

    const tables = await client.query<{ relname: string }>(
      "SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='scf_tiger_lab' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[])",
      [["conditions", "terms", "edges"]],
    );
    const found = new Set(tables.rows.map(({ relname }) => relname));
    if (!["conditions", "terms", "edges"].every((name) => found.has(name))) {
      return { connection: "ok", catalog: "missing_tables", ...counts,
        remoteConditions: null, remoteTerms: null, remoteEdges: null, orphanEdges: null };
    }

    const remoteConditions = await client.query<{
      id: string; name: string; published: boolean;
    }>("SELECT id,name,published FROM scf_tiger_lab.conditions WHERE snapshot=$1 LIMIT $2",
      [snapshot, conditions.length + 1]);
    const remoteTerms = await client.query<{
      term: string; condition_id: string;
    }>("SELECT term,condition_id FROM scf_tiger_lab.terms WHERE snapshot=$1 LIMIT $2",
      [snapshot, terms.length + 1]);
    const remoteEdges = await client.query<{
      source_id: string; target_id: string; rank: number;
    }>("SELECT source_id,target_id,rank FROM scf_tiger_lab.edges WHERE snapshot=$1 LIMIT $2",
      [snapshot, edges.length + 1]);

    const rc = remoteConditions.rows.length;
    const rt = remoteTerms.rows.length;
    const re = remoteEdges.rows.length;
    const base = { connection: "ok" as const, ...counts,
      remoteConditions: rc, remoteTerms: rt, remoteEdges: re };

    if (!rc && !rt && !re) {
      return { ...base, catalog: "snapshot_missing", orphanEdges: null };
    }

    const fk = await client.query<{ orphan_edges: string }>(
      "SELECT COUNT(*)::text AS orphan_edges FROM scf_tiger_lab.edges e LEFT JOIN scf_tiger_lab.conditions a ON a.snapshot=e.snapshot AND a.id=e.source_id LEFT JOIN scf_tiger_lab.conditions b ON b.snapshot=e.snapshot AND b.id=e.target_id WHERE e.snapshot=$1 AND (a.id IS NULL OR b.id IS NULL)",
      [snapshot],
    );
    const orphanEdges = Number(fk.rows[0]?.orphan_edges ?? -1);

    const sameConditions = exactRowsMatch(conditions,
      remoteConditions.rows.map(({ id, name, published }) => [id, name, published]));
    const sameTerms = exactRowsMatch(terms,
      remoteTerms.rows.map(({ term, condition_id }) => [term, condition_id]));
    const sameEdges = exactRowsMatch(edges,
      remoteEdges.rows.map(({ source_id, target_id, rank }) => [source_id, target_id, rank]));

    return { ...base, orphanEdges,
      catalog: sameConditions && sameTerms && sameEdges && orphanEdges === 0
        ? "parity_verified" : "parity_mismatch" };
  } finally {
    if (connected) {
      try { await client.query("ROLLBACK"); } catch { /* preserve original error; do not retry SQL */ }
    }
    await client.end().catch(() => undefined);
  }
}
