"use client";

/**
 * useAriaLive — the shared polite announcement channel for dynamic state.
 *
 * Why a hook rather than another inline `aria-live` region: the workflow has
 * several surfaces that change *after* a screen-reader user has arrived —
 * the recommendation engine finishing, the adjacency-graph layer mapping a new
 * route, an evidence parser completing — and each one needs three things that
 * are easy to get subtly wrong:
 *
 *   1. **A region that exists before the message does.** A live region inserted
 *      into the DOM in the same commit as its text is frequently not announced,
 *      because assistive technology only observes *changes* inside a region it
 *      has already seen. The region therefore renders unconditionally and empty,
 *      and only its text content changes.
 *   2. **`aria-atomic`**, so the whole message is re-read rather than a fragment.
 *   3. **A re-announcement path for a repeated message.** If the same sentence
 *      is set again, React sees no DOM change and nothing is announced — so each
 *      announcement carries a monotonic counter that forces a real mutation.
 *
 * Politeness is **polite only, by construction**. The workflow's guidance is
 * advisory research context, so interrupting whatever the user is currently
 * reading would be hostile — and an `assertive` region driven by a form that
 * re-renders per keystroke would re-read on every character. `assertive` is
 * therefore not exposed as an option; a surface that genuinely needs an
 * interruption should use `role="alert"`, which the workflow's validation
 * messages already do (see `tests/workflow-validation-accessibility.test.ts`).
 *
 * The announced text must never carry more than the surface already shows: this
 * hook takes a finished string and does not compose one, so a caller cannot
 * accidentally leak a value into the accessibility tree that the visible UI
 * withheld.
 */
import { useCallback, useMemo, useState } from "react";

/** Monotonic suffix that guarantees a repeated announcement mutates the DOM. */
export interface AriaLiveMessage {
  id: number;
  text: string;
}

export interface AriaLiveRegionAttrs {
  role: "status";
  "aria-live": "polite";
  "aria-atomic": true;
}

/**
 * Attributes for the live region. `role="status"` is the implicit-polite
 * landmark that assistive technology already understands, and it is what the
 * existing surfaces in this codebase use (`DisabilityReferenceExplorer`,
 * `LocalEvidenceAnalyzer`), so the whole app announces through one vocabulary.
 */
export const ARIA_LIVE_REGION_ATTRS: AriaLiveRegionAttrs = {
  role: "status",
  "aria-live": "polite",
  "aria-atomic": true,
};

export interface UseAriaLiveResult {
  /** Set the announced text. Empty or whitespace-only input clears the region. */
  announce: (message: string) => void;
  /** Current message; empty until the first announcement. */
  message: string;
  /** Spread onto the region element. */
  regionProps: AriaLiveRegionAttrs;
  /** Clears the region without announcing anything. */
  clear: () => void;
}

export function useAriaLive(): UseAriaLiveResult {
  const [current, setCurrent] = useState<AriaLiveMessage | null>(null);

  const announce = useCallback((message: string) => {
    const text = message.trim();
    if (text.length === 0) {
      setCurrent(null);
      return;
    }
    // Functional update: the counter must advance from the previous value even
    // when React batches several announcements into one render pass, otherwise
    // two different messages set in the same tick would collide on one id.
    setCurrent((previous) => ({ id: (previous?.id ?? 0) + 1, text }));
  }, []);

  const clear = useCallback(() => setCurrent(null), []);

  return useMemo(
    () => ({
      announce,
      clear,
      message: current?.text ?? "",
      regionProps: ARIA_LIVE_REGION_ATTRS,
    }),
    [announce, clear, current?.text],
  );
}

/**
 * Longest list of connections spelled out before the announcement summarises.
 *
 * A multi-hop route is worth announcing; eighteen of them read aloud is not.
 * Beyond this bound the announcement names the count and the first route, which
 * is what a screen-reader user needs to know that the surface changed, and the
 * visible list carries the detail.
 */
export const MAX_SPELLED_OUT_CONNECTIONS = 3;

/**
 * Turn mapped connections ("PTSD → Sleep Apnea") into one polite sentence.
 *
 * Returns `null` for an empty list so a caller can distinguish "nothing to say"
 * from "say nothing" and skip the announcement entirely — an empty live region
 * change is not free for a screen-reader user.
 *
 * The arrow is spelled out as the word "to" in the *announced* text while the
 * visible UI keeps "→": a screen reader may read "→" as "right arrow" or skip it
 * entirely, so the announcement is not a copy of the visible string.
 */
export function describeMappedConnections(
  connections: readonly string[],
): string | null {
  const cleaned = connections
    .map((connection) => connection.trim())
    .filter((connection) => connection.length > 0)
    // Dedupe: the graph view can legitimately carry the same origin/terminal
    // pair on two routes, and announcing it twice reads as a second finding.
    .filter((connection, index, all) => all.indexOf(connection) === index);

  if (cleaned.length === 0) return null;

  const spoken = cleaned.map((connection) => connection.replace(/\s*→\s*/g, " to "));
  const [first, ...rest] = spoken;

  if (spoken.length === 1) {
    return `Adjacency-graph route mapped: ${first}.`;
  }
  if (spoken.length <= MAX_SPELLED_OUT_CONNECTIONS) {
    return `${spoken.length} adjacency-graph routes mapped: ${spoken.join("; ")}.`;
  }
  return `${spoken.length} adjacency-graph routes mapped, starting with ${first}. ${
    spoken.length - 1
  } more are listed below, beginning with ${rest[0]}.`;
}

export function AriaLiveRegion({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p {...ARIA_LIVE_REGION_ATTRS} className={className}>
      {message}
    </p>
  );
}
