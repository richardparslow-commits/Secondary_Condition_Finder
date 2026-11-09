import "server-only";

import pg from "pg";
import { loadConditionCatalog } from "@/lib/catalog/load";
import { compareCatalogIdentities } from "./catalog-comparison";

const { Client } = pg;

export async function probeTigerPreview() {
  const connectionString = process.env.TIGER_DATABASE_URL;
  if (!connectionString) return { status: "not_configured" as const };

  // Do not use administrator credentials or accidentally connect to an unencrypted endpoint.
  let url: URL;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.password || !url.hostname)
      return { status: "invalid_configuration" as const };
    if (decodeURIComponent(url.username) === "tsdbadmin")
      return { status: "invalid_configuration" as const };
  } catch {
    return { status: "invalid_configuration" as const };
  }

  const client = new Client({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    query_timeout: 8000,
    application_name: "scf_preview_catalog_probe",
  });

  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const identity = await client.query<{ role: string; database: string; read_only: string }>(
      "SELECT current_user AS role, current_database() AS database, current_setting('transaction_read_only') AS read_only",
    );
    if (identity.rows[0]?.read_only !== "on" || identity.rows[0]?.role === "tsdbadmin")
      throw new Error("Read-only identity requirements not satisfied");

    const tables = await client.query<{ conditions: string | null }>(
      "SELECT to_regclass('scf_tiger_lab.conditions')::text AS conditions",
    );
    if (!tables.rows[0]?.conditions) {
      await client.query("COMMIT");
      return { status: "connected_catalog_absent" as const, database: identity.rows[0]?.database };
    }

    const rows = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM scf_tiger_lab.conditions ORDER BY id LIMIT 10001",
    );
    if (rows.rowCount === null || rows.rowCount > 10000) {
      await client.query("COMMIT");
      return { status: "catalog_too_large" as const };
    }
    const comparison = compareCatalogIdentities(loadConditionCatalog(), rows.rows);
    await client.query("COMMIT");
    return {
      status: Object.values(comparison).slice(2).every((count) => count === 0)
        ? "catalog_matches" as const
        : "catalog_mismatch" as const,
      comparison,
    };
  } catch {
    // No details, connection strings, SQL, or raw DB errors in HTTP responses.
    try { await client.query("ROLLBACK"); } catch { /* connection may already be closed */ }
    return { status: "connection_or_query_failed" as const };
  } finally {
    try { await client.end(); } catch { /* no credentials in logs */ }
  }
}
