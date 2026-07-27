import type { EventLogger, RecommendationEvent } from "./types";

/**
 * In-process logger used by tests and by deployments with ephemeral disks.
 * Also writes a single structured line to stdout so events remain traceable
 * through the platform's log drain.
 */
export function createMemoryLogger(options?: { silent?: boolean }): EventLogger {
  const events: RecommendationEvent[] = [];

  return {
    record(event) {
      events.unshift(event);
      if (!options?.silent) {
        console.log(JSON.stringify({ type: "recommendation", ...event }));
      }
    },
    recent(limit) {
      return events.slice(0, limit);
    },
  };
}
