"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  browserWorkflowContextIsEmpty,
  clearBrowserWorkflowContext,
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
  type BrowserWorkflowContext,
  type BrowserWorkflowContextInput,
} from "./browser-context";

/**
 * React binding for the browser-local workflow context (PRIV-01).
 *
 * The record lives in `sessionStorage`: tab-scoped like the legacy 30-minute
 * sealed cookie, cleared on tab close, and covered by the same
 * `clearSecondaryWorkflowLocalState` clear-all that already owns the local
 * evidence excerpts. Nothing here is ever sent to the server — the store only
 * reads and writes `window.sessionStorage`.
 *
 * The store is bound with `useSyncExternalStore` rather than a mount effect so
 * the read happens against a cached snapshot with a server snapshot of "no
 * context": `context` is null and `ready` is false during server rendering and
 * the first client render, so context-dependent UI renders a neutral
 * placeholder until the record has been read and no veteran context can exist
 * in server HTML.
 */
export interface BrowserWorkflowContextHandle {
  context: BrowserWorkflowContext | null;
  ready: boolean;
  persist: (input: BrowserWorkflowContextInput) => void;
  clear: () => void;
}

export function readSessionContext(): BrowserWorkflowContext | null {
  if (typeof window === "undefined") return null;
  try {
    return readBrowserWorkflowContext(window.sessionStorage);
  } catch {
    return null;
  }
}

// Module-level snapshot cache. `useSyncExternalStore` requires `getSnapshot` to
// be pure and to return a cached value, so the session record is read once and
// then refreshed only by `persist`, by `clear`, or by the first client read
// after hydration.
let snapshot: BrowserWorkflowContext | null = null;
let snapshotRead = false;
const listeners = new Set<() => void>();

function subscribeToContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyContextListeners(): void {
  for (const listener of listeners) listener();
}

/**
 * Invalidates the cached snapshot after a clear-all that removed the record
 * directly from sessionStorage. Restart uses the shared key registry rather
 * than this hook's `clear()`, then navigates client-side; without this reset
 * the next step would read the pre-restart context from the module cache.
 */
export function resetBrowserWorkflowContextSnapshot(): void {
  snapshot = null;
  // Mark the cached value stale rather than caching "no context": the next
  // read must revalidate against sessionStorage (empty after a restart).
  snapshotRead = false;
  notifyContextListeners();
}

function readContextSnapshot(): BrowserWorkflowContext | null {
  if (!snapshotRead) {
    snapshot = readSessionContext();
    snapshotRead = true;
  }
  return snapshot;
}

function readReadySnapshot(): boolean {
  if (!snapshotRead) readContextSnapshot();
  return true;
}

function emptyServerContext(): BrowserWorkflowContext | null {
  return null;
}

function serverNotReady(): boolean {
  return false;
}

export function useBrowserWorkflowContext(): BrowserWorkflowContextHandle {
  const context = useSyncExternalStore(subscribeToContext, readContextSnapshot, emptyServerContext);
  const ready = useSyncExternalStore(subscribeToContext, readReadySnapshot, serverNotReady);

  // Out-of-bounds writes throw by design (see browser-context.ts) before
  // touching storage; the caller maps the failure to the `context-too-large`
  // guidance exactly like the retired cookie-budget path did.
  const persist = useCallback((input: BrowserWorkflowContextInput) => {
    writeBrowserWorkflowContext(window.sessionStorage, input);
    snapshot = readBrowserWorkflowContext(window.sessionStorage);
    snapshotRead = true;
    notifyContextListeners();
  }, []);

  // Cleanup that cannot be confirmed throws; callers must not report success.
  const clear = useCallback(() => {
    clearBrowserWorkflowContext(window.sessionStorage);
    snapshot = null;
    snapshotRead = true;
    notifyContextListeners();
  }, []);

  return { context, ready, persist, clear };
}

export { browserWorkflowContextIsEmpty };
