"use client";

import { useEffect, useState } from "react";

import {
  CLIENT_CORPUS_PATH,
  parseClientCorpus,
  type ClientCorpus,
} from "./client-corpus";

/**
 * Browser loader for the PUBLIC client corpus (PRIV-01).
 *
 * `/kb/client-corpus.json` is byte-identical for every visitor and contains
 * only authored public content — conditions, published mappings and graph
 * nodes. Fetching it is a uniform request: nothing about the visitor's
 * selections influences the URL, headers or response.
 *
 * The fetch is memoized for the tab so navigating between Steps 1–6 downloads
 * the corpus once. Failures are surfaced, never silently substituted.
 */
let cachedPromise: Promise<ClientCorpus> | null = null;

export function loadClientCorpus(fetcher: typeof fetch = fetch): Promise<ClientCorpus> {
  if (!cachedPromise) {
    cachedPromise = fetcher(CLIENT_CORPUS_PATH, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Client corpus request failed with status ${response.status}.`);
        }
        return parseClientCorpus(await response.json());
      })
      .catch((error: unknown) => {
        cachedPromise = null; // allow a retry after a transient failure
        throw error;
      });
  }
  return cachedPromise;
}

/** Test seam: clears the tab-memoized corpus promise. */
export function resetClientCorpusCache(): void {
  cachedPromise = null;
}

export interface ClientCorpusHandle {
  corpus: ClientCorpus | null;
  loading: boolean;
  error: string | null;
}

export function useClientCorpus(): ClientCorpusHandle {
  const [corpus, setCorpus] = useState<ClientCorpus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadClientCorpus()
      .then((loaded) => {
        if (!cancelled) setCorpus(loaded);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { corpus, loading: corpus === null && error === null, error };
}
