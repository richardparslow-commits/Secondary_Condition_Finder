import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { EventLogger } from "./types";

/**
 * Local, file-backed logger for development and self-hosted deployments.
 * Stores aggregate operational counts only; no condition identifiers or
 * health-related intake values are persisted.
 */
export function createSqliteLogger(filePath: string): EventLogger {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);

  db.pragma("journal_mode = WAL");

  // Purge the legacy table because it stored condition-level identifiers.
  db.exec("DROP TABLE IF EXISTS recommendation_events;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_event_metrics (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      recognized_primary_count INTEGER NOT NULL,
      unrecognized_primary_count INTEGER NOT NULL,
      recommended_condition_count INTEGER NOT NULL,
      engine_version TEXT NOT NULL
    );
  `);

  const insert = db.prepare(`
    INSERT INTO recommendation_event_metrics
      (id, created_at, recognized_primary_count, unrecognized_primary_count,
       recommended_condition_count, engine_version)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const select = db.prepare(`
    SELECT * FROM recommendation_event_metrics ORDER BY created_at DESC LIMIT ?
  `);

  return {
    record(event) {
      insert.run(
        event.id,
        event.createdAt,
        event.recognizedPrimaryCount,
        event.unrecognizedPrimaryCount,
        event.recommendedConditionCount,
        event.engineVersion,
      );
    },
    recent(limit) {
      const rows = select.all(limit) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        recognizedPrimaryCount: Number(row.recognized_primary_count),
        unrecognizedPrimaryCount: Number(row.unrecognized_primary_count),
        recommendedConditionCount: Number(row.recommended_condition_count),
        engineVersion: String(row.engine_version),
      }));
    },
  };
}
