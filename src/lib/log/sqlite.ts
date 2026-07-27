import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { EventLogger } from "./types";

/**
 * Local, file-backed logger for development and self-hosted deployments.
 * Not suitable for serverless targets with ephemeral disks; see index.ts for
 * how the logger is selected at runtime.
 */
export function createSqliteLogger(filePath: string): EventLogger {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      recognized_primaries TEXT NOT NULL,
      unrecognized_primary_count INTEGER NOT NULL,
      recommended_conditions TEXT NOT NULL,
      engine_version TEXT NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO recommendation_events
      (id, created_at, recognized_primaries, unrecognized_primary_count,
       recommended_conditions, engine_version)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const select = db.prepare(`
    SELECT * FROM recommendation_events ORDER BY created_at DESC LIMIT ?
  `);

  return {
    record(event) {
      insert.run(
        event.id,
        event.createdAt,
        JSON.stringify(event.recognizedPrimaries),
        event.unrecognizedPrimaryCount,
        JSON.stringify(event.recommendedConditions),
        event.engineVersion,
      );
    },
    recent(limit) {
      const rows = select.all(limit) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        recognizedPrimaries: JSON.parse(String(row.recognized_primaries)),
        unrecognizedPrimaryCount: Number(row.unrecognized_primary_count),
        recommendedConditions: JSON.parse(String(row.recommended_conditions)),
        engineVersion: String(row.engine_version),
      }));
    },
  };
}
