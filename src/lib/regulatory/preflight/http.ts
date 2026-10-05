import {
  DEFAULT_MAX_RESPONSE_BYTES,
  readBoundedResponseText,
} from "@/lib/bounded-response";

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
    // Shared size bound — see `src/lib/bounded-response.ts`. Throws
    // `ResponseTooLargeError` rather than buffering an oversized body.
    const text = await readBoundedResponseText(response, {
      url,
      maxBytes: options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    });
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
