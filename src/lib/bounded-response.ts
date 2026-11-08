import "server-only";

/**
 * Bounded upstream response reading.
 *
 * The app makes outbound requests to two independent upstream families (VA API
 * reference data and regulatory sources) and both must bound what they are
 * willing to buffer: an unbounded `response.json()` lets a misbehaving or
 * hostile upstream exhaust the instance's memory, and it silently undoes the
 * resource limits the rest of the app enforces on uploads, pages, and evidence.
 *
 * This module is the single implementation of that bound, shared by both
 * stacks. It previously existed only inside `regulatory/preflight/http.ts`,
 * which is why the VA adapter ended up reading bodies unbounded.
 */

/** Default cap on a single response body we are willing to buffer (25 MB). */
export const DEFAULT_MAX_RESPONSE_BYTES = 25_000_000;

export interface BoundedResponseOptions {
  /** Value used in error messages. Must not contain credentials or query params. */
  url: string;
  /** Body-size cap in bytes. Defaults to `DEFAULT_MAX_RESPONSE_BYTES`. */
  maxBytes?: number;
}

/** Thrown when an upstream body exceeds the configured cap. */
export class ResponseTooLargeError extends Error {
  readonly url: string;
  readonly maxBytes: number;
  /** The `content-length` the response declared, when it declared one. */
  readonly declaredBytes?: number;

  constructor(args: {
    url: string;
    maxBytes: number;
    declaredBytes?: number;
  }) {
    super(
      args.declaredBytes === undefined
        ? `Response from ${args.url} exceeded the ${args.maxBytes}-byte safety limit.`
        : `Response from ${args.url} declared ${args.declaredBytes} bytes, exceeding the ${args.maxBytes}-byte safety limit.`,
    );
    this.name = "ResponseTooLargeError";
    this.url = args.url;
    this.maxBytes = args.maxBytes;
    this.declaredBytes = args.declaredBytes;
  }
}

/**
 * Parses a declared `content-length` only when it is a positive decimal
 * integer. HTTP does not permit scientific notation, fractions, signed
 * values, or prefixes such as `0x`, so those headers must not be interpreted
 * as byte counts and cause a false refusal.
 */
function parseDeclaredContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Reads a response body as text, refusing to buffer past `maxBytes`.
 *
 * Two checks, because either alone is insufficient:
 *   1. a declared `content-length` over the cap is rejected before reading, and
 *   2. the actual stream is accumulated with a running total, so a response
 *      that under-declares (or omits) the header is still stopped — the read is
 *      cancelled rather than completed and discarded.
 */
export async function readBoundedResponseText(
  response: Response,
  options: BoundedResponseOptions,
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const { url } = options;

  const declaredBytes = parseDeclaredContentLength(
    response.headers.get("content-length"),
  );
  if (declaredBytes !== undefined && declaredBytes > maxBytes) {
    try {
      await response.body?.cancel("response-size-limit").catch(() => undefined);
    } catch {
      // The body is already locked or closed; the size refusal is still the
      // actionable failure.
    }
    throw new ResponseTooLargeError({
      url,
      maxBytes,
      declaredBytes,
    });
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new ResponseTooLargeError({
        url,
        maxBytes,
        ...(declaredBytes !== undefined ? { declaredBytes } : {}),
      });
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response-size-limit").catch(() => undefined);
        throw new ResponseTooLargeError({ url, maxBytes });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(combined);
}

/**
 * Size-bounded JSON read. A malformed body throws `SyntaxError` from
 * `JSON.parse`, exactly as `response.json()` would.
 */
export async function readBoundedResponseJson<T>(
  response: Response,
  options: BoundedResponseOptions,
): Promise<T> {
  const text = await readBoundedResponseText(response, options);
  return JSON.parse(text) as T;
}
