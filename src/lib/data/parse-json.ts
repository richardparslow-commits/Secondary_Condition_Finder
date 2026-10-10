import "server-only";

/**
 * Parse a bundled JSON data file without allowing engine-generated parse
 * diagnostics to echo portions of its contents through health, warmup, or
 * framework error sinks.
 */
export function parseDataJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON data file.");
  }
}
