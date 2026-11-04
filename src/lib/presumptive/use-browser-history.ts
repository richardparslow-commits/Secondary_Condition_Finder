"use client";

import { useSyncExternalStore } from "react";

import {
  presumptiveHistoryRevision,
  presumptiveHistoryStorageKey,
  readPresumptiveHistory,
  subscribeToPresumptiveHistoryChanges,
} from "./browser-history";
import type { ServiceHistory } from "./match";

/**
 * React binding for the browser-local presumptive service history (PRIV-01
 * follow-on, 2026-10-08).
 *
 * The record lives in `sessionStorage`: tab-scoped, cleared on tab close, and
 * covered by the same `clearPresumptiveLocalState` clear-all that owns the
 * DD-214 draft. Nothing here is ever sent to the server.
 *
 * The binding mirrors `src/lib/secondary-workflow/use-browser-context.ts`
 * rather than seeding state from a mount effect: `useSyncExternalStore` reads
 * against a cached snapshot with a server snapshot of "no history", so the
 * record is never read during render on the server, hydration renders the
 * neutral placeholder (`history` null, `ready` false), and no setState runs
 * inside an effect body.
 */
export interface BrowserServiceHistoryHandle {
  history: ServiceHistory | null;
  ready: boolean;
}

function readSessionHistory(): ServiceHistory | null {
  if (typeof window === "undefined") return null;
  try {
    return readPresumptiveHistory(window.sessionStorage);
  } catch {
    return null;
  }
}

// Module-level snapshot cache: `useSyncExternalStore` requires a pure
// `getSnapshot` that returns a cached value, so the record is parsed once and
// refreshed only by the first client read after hydration, a same-tab
// write/clear (revision change), or another tab clearing the key.
let snapshot: ServiceHistory | null = null;
let snapshotRead = false;
let snapshotRevision = -1;
const listeners = new Set<() => void>();

function notifyHistoryListeners(): void {
  for (const listener of listeners) listener();
}

function invalidateHistorySnapshot(): void {
  snapshot = null;
  snapshotRead = false;
  notifyHistoryListeners();
}

function subscribeToHistory(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    // A `null` key is a `clear()` in another tab; both discard the cache.
    if (event.key !== null && event.key !== presumptiveHistoryStorageKey) return;
    invalidateHistorySnapshot();
  };
  // Same-tab writes and clears do not fire `storage`; the store announces them.
  const unsubscribeChanges = subscribeToPresumptiveHistoryChanges(invalidateHistorySnapshot);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    unsubscribeChanges();
    window.removeEventListener("storage", onStorage);
  };
}

function readHistorySnapshot(): ServiceHistory | null {
  const revision = presumptiveHistoryRevision();
  if (!snapshotRead || snapshotRevision !== revision) {
    snapshot = readSessionHistory();
    snapshotRead = true;
    snapshotRevision = revision;
  }
  return snapshot;
}

function readReadySnapshot(): boolean {
  if (!snapshotRead) readHistorySnapshot();
  return true;
}

function emptyServerHistory(): ServiceHistory | null {
  return null;
}

function serverNotReady(): boolean {
  return false;
}

export function useBrowserServiceHistory(): BrowserServiceHistoryHandle {
  const history = useSyncExternalStore(
    subscribeToHistory,
    readHistorySnapshot,
    emptyServerHistory,
  );
  const ready = useSyncExternalStore(
    subscribeToHistory,
    readReadySnapshot,
    serverNotReady,
  );

  return { history, ready };
}
