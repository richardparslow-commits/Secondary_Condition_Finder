import "server-only";

import path from "node:path";

import { createMemoryLogger } from "./memory";
import type { EventLogger } from "./types";

let logger: EventLogger | null = null;

/**
 * SQLite when a writable path is configured (local dev, self-hosted),
 * otherwise an in-process logger that emits structured stdout lines.
 * Phase 2 swaps the SQLite implementation for Postgres without touching
 * any caller.
 *
 * Async so the native SQLite module is only loaded when it is actually
 * configured. Serverless bundles that never set the env var never touch it.
 */
export async function getEventLogger(): Promise<EventLogger> {
  if (logger) return logger;

  const dbPath = process.env.EVENT_LOG_SQLITE_PATH;

  if (dbPath) {
    const { createSqliteLogger } = await import("./sqlite");
    logger = createSqliteLogger(path.resolve(dbPath));
  } else {
    logger = createMemoryLogger();
  }

  return logger;
}

export type { EventLogger, RecommendationEvent } from "./types";
