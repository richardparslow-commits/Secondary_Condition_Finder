"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import type {
  TimelineConditionInput,
  TimelineConnectionInput,
} from "./ConditionTimelineVisualization";

const ConditionTimelineVisualization = dynamic(
  () =>
    import("./ConditionTimelineVisualization").then((m) => m.ConditionTimelineVisualization),
  {
    loading: () => (
      <p
        className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"
        aria-live="polite"
        aria-busy="true"
      >
        Loading timeline…
      </p>
    ),
    ssr: false,
  },
);

interface SecondarySuggestionsTabsProps {
  conditions: TimelineConditionInput[];
  connections: TimelineConnectionInput[];
  datedCount: number;
  children: React.ReactNode;
}

const TAB_ORDER = ["list", "timeline"] as const;
type TabId = (typeof TAB_ORDER)[number];

export function SecondarySuggestionsTabs({
  conditions,
  connections,
  datedCount,
  children,
}: SecondarySuggestionsTabsProps) {
  const [active, setActive] = useState<TabId>("list");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  /**
   * WAI-ARIA Tabs keyboard contract: ArrowLeft/ArrowRight move between tabs
   * (wrapping), Home/End jump to the first/last. Activation follows focus
   * (standard for two tabs with no async panel load). Roving tabIndex keeps
   * only the selected tab in the tab sequence.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: TabId) {
    const index = TAB_ORDER.indexOf(current);
    let next: TabId | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
        break;
      case "ArrowLeft":
        next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
        break;
      case "Home":
        next = TAB_ORDER[0];
        break;
      case "End":
        next = TAB_ORDER[TAB_ORDER.length - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  const tabClassName = (tab: TabId) =>
    `rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold ${
      active === tab
        ? "border-slate-200 bg-white text-slate-900"
        : "border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Connection review view"
        className="mb-4 flex gap-2 border-b border-slate-200"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "list"}
          aria-controls="panel-list"
          id="tab-list"
          tabIndex={active === "list" ? 0 : -1}
          ref={(node) => {
            tabRefs.current.list = node;
          }}
          onClick={() => setActive("list")}
          onKeyDown={(event) => onKeyDown(event, "list")}
          className={tabClassName("list")}
        >
          List view
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "timeline"}
          aria-controls="panel-timeline"
          id="tab-timeline"
          tabIndex={active === "timeline" ? 0 : -1}
          ref={(node) => {
            tabRefs.current.timeline = node;
          }}
          onClick={() => setActive("timeline")}
          onKeyDown={(event) => onKeyDown(event, "timeline")}
          className={tabClassName("timeline")}
        >
          Timeline
          {datedCount === 0 ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              add years
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
              {conditions.length} conditions
            </span>
          )}
        </button>
      </div>

      <div
        id="panel-list"
        role="tabpanel"
        aria-labelledby="tab-list"
        hidden={active !== "list"}
        className={active !== "list" ? "hidden" : undefined}
      >
        {children}
      </div>

      <div
        id="panel-timeline"
        role="tabpanel"
        aria-labelledby="tab-timeline"
        hidden={active !== "timeline"}
        className={active !== "timeline" ? "hidden" : undefined}
      >
        {active === "timeline" ? (
          <ConditionTimelineVisualization conditions={conditions} connections={connections} />
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Timeline is derived only from the approximate years you entered in Step 4 and the authored
          relationships reviewed in the List view. It does not add diagnoses, estimate likelihood of
          approval, or replace review of your records and current VA guidance with a qualified
          provider or accredited representative.
        </p>
      </div>
    </div>
  );
}
