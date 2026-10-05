import type { RegulatorySourceValidator } from "./types";

export type FetchLike = typeof fetch;

export interface FetchTextResult extends RegulatorySourceValidator {
  status: "success" | "not-modified";
  text?: string;
  responseStatus: number;
}

export interface FetchJsonResult<T> extends RegulatorySourceValidator {
  status: "success" | "not-modified";
  json?: T;
  responseStatus: number;
}

const withConditionalHeaders = (
  headers: HeadersInit | undefined,
  validator: RegulatorySourceValidator | undefined,
): Headers => {
  const result = new Headers(headers);
  if (validator?.etag) result.set("If-None-Match", validator.etag);
  if (validator?.lastModified) result.set("If-Modified-Since", validator.lastModified);
  result.set("Accept", result.get("Accept") ?? "*/*");
  result.set("User-Agent", result.get("User-Agent") ?? "Secondary-Condition-Finder-Regulatory-Preflight/1.0");
  return result;
};

const responseValidator = (response: Response): RegulatorySourceValidator => ({
  etag: response.headers.get("etag") ?? undefined,
  lastModified: response.headers.get("last-modified") ?? undefined,
});

const boundedResponseText = async (response: Response, maxBytes: number, url: string): Promise<string> => {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Response from ${url} declared ${declaredLength} bytes, exceeding the ${maxBytes}-byte safety limit.`);
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(`Response from ${url} exceeded the ${maxBytes}-byte safety limit.`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response-size-limit");
        throw new Error(`Response from ${url} exceeded the ${maxBytes}-byte safety limit.`);
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
};

export async function fetchTextWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  options: {
    timeoutMs?: number;
    headers?: HeadersInit;
    validator?: RegulatorySourceValidator;
    maxBytes?: number;
  } = {},
): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: withConditionalHeaders(options.headers, options.validator),
      cache: "no-store",
      signal: controller.signal,
      // Source requests can carry an API key (Regulations.gov); a redirect
      // would replay that credential to an origin outside the source list.
      redirect: "error",
    });
    if (response.status === 304) {
      return { status: "not-modified", responseStatus: 304, ...responseValidator(response) };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    const maxBytes = options.maxBytes ?? 25_000_000;
    const text = await boundedResponseText(response, maxBytes, url);
    return { status: "success", text, responseStatus: response.status, ...responseValidator(response) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJsonWithTimeout<T>(
  fetchImpl: FetchLike,
  url: string,
  options: {
    timeoutMs?: number;
    headers?: HeadersInit;
    validator?: RegulatorySourceValidator;
    maxBytes?: number;
  } = {},
): Promise<FetchJsonResult<T>> {
  const result = await fetchTextWithTimeout(fetchImpl, url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  if (result.status === "not-modified") return result;
  try {
    return { ...result, json: JSON.parse(result.text ?? "null") as T };
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
