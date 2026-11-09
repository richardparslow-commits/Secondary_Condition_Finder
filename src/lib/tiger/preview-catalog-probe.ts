import "server-only";
import { Client } from "pg";
import { loadConditionCatalog } from "@/lib/catalog/load";

type Identity = { id: string; name: string };
export type PreviewCatalogResult = {
  connection: "ok";
  catalog: "missing_tables" | "identities_mismatch" | "identities_match";
  referenceConditions: number;
  remoteConditions: number | null;
  remoteTerms: number | null;
  remoteEdges: number | null;
};

const EXPECTED_HOST = "yc5kzxwazj.xtb16bcthd.tsdb.cloud.timescale.com";
const ROLE = "preview_catalog_reader";
const DATABASE = "tsdb";
const PORT = 37615;

// Parse the Preview secret without logging or echoing its value.
// Connect only to the designated service, with a non-admin role and verified TLS.
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
    application_name: "scf_preview_catalog_probe",
    connectionTimeoutMillis: 3500, query_timeout: 8000, statement_timeout: 7000,
  };
}

// Exact ID/name parity. Counts alone are never accepted as a match.
export function identitiesMatch(reference: readonly Identity[], remote: readonly Identity[]) {
  if (reference.length !== remote.length) return false;
  const expected = new Map(reference.map((item) => [item.id, item.name]));
  if (expected.size !== reference.length) return false;
  const seen = new Set<string>();
  for (const item of remote) {
    if (seen.has(item.id) || expected.get(item.id) !== item.name) return false;
    seen.add(item.id);
  }
  return true;
}

/**
 * Read-only catalog identity check. The counts for terms and pathway edges are
 * informational; this does not claim alias or pathway parity or migrate data.
 */
export async function probePreviewCatalog(raw: string): Promise<PreviewCatalogResult> {
  const reference = loadConditionCatalog().map(({ id, name }) => ({ id, name }));
  const client = new Client(parseTigerPreviewConnection(raw));
  let connected = false;
  try {
    await client.connect();
    connected = true;
    await client.query("BEGIN READ ONLY");
    const identity = await client.query<{ db: string; username: string; read_only: string }>(
      "SELECT current_database() AS db, current_user AS username, current_setting('transaction_read_only') AS read_only",
    );
    if (identity.rows.length !== 1 || identity.rows[0].db !== DATABASE ||
      identity.rows[0].username !== ROLE || identity.rows[0].read_only !== "on") {
      throw new Error("Tiger Preview identity or transaction mode mismatch.");
    }
    const tables = await client.query<{ relname: string }>(
      "SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='scf_tiger_lab' AND c.relkind IN ('r','p') AND c.relname=ANY($1::text[])",
      [["conditions", "terms", "edges"]],
    );
    const found = new Set(tables.rows.map((r) => r.relname));
    if (!["conditions", "terms", "edges"].every((name) => found.has(name))) {
      return { connection: "ok", catalog: "missing_tables", referenceConditions: reference.length,
        remoteConditions: null, remoteTerms: null, remoteEdges: null };
    }
    const totals = await client.query<{ total: string }>(
      "SELECT COALESCE(MAX(total),0)::text AS total FROM (SELECT COUNT(*) AS total FROM scf_tiger_lab.conditions GROUP BY snapshot) s",
    );
    const candidates = await client.query<{ snapshot: string }>(
      "SELECT snapshot FROM scf_tiger_lab.conditions GROUP BY snapshot HAVING COUNT(*)=$1 ORDER BY snapshot LIMIT 30",
      [reference.length],
    );
    for (const { snapshot } of candidates.rows) {
      const rows = await client.query<Identity>(
        "SELECT id,name FROM scf_tiger_lab.conditions WHERE snapshot=$1 ORDER BY id LIMIT $2",
        [snapshot, reference.length + 1],
      );
      if (!identitiesMatch(reference, rows.rows)) continue;
      const related = await client.query<{ terms: string; edges: string }>(
        "SELECT (SELECT COUNT(*) FROM scf_tiger_lab.terms WHERE snapshot=$1)::text AS terms, (SELECT COUNT(*) FROM scf_tiger_lab.edges WHERE snapshot=$1)::text AS edges",
        [snapshot],
      );
      return { connection: "ok", catalog: "identities_match",
        referenceConditions: reference.length, remoteConditions: rows.rows.length,
        remoteTerms: Number(related.rows[0].terms), remoteEdges: Number(related.rows[0].edges) };
    }
    return { connection: "ok", catalog: "identities_mismatch", referenceConditions: reference.length,
      remoteConditions: Number(totals.rows[0]?.total ?? 0), remoteTerms: null, remoteEdges: null };
  } finally {
    if (connected) {
      try { await client.query("ROLLBACK"); } catch { /* no SQL retry on uncertain disconnect */ }
    }
    await client.end().catch(() => undefined);
  }
}
