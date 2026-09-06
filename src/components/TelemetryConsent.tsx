"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { initializeAppInsights } from "@/lib/appInsights";
import {
  readTelemetryConsent,
  storeTelemetryConsent,
  type TelemetryConsent,
} from "@/lib/telemetry-consent";

/**
 * Telemetry is compiled in only when the connection string was present at
 * build time. Without it there is nothing to consent to, so neither the
 * prompt nor the SDK ever loads.
 */
const TELEMETRY_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING,
);

type ConsentStatus = "loading" | "granted" | "declined" | "undecided";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStatus(): ConsentStatus {
  if (typeof window === "undefined") return "loading";
  return readTelemetryConsent(window.localStorage) ?? "undecided";
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export function TelemetryConsent() {
  const status = useSyncExternalStore(subscribe, readStatus, () => "loading");

  useEffect(() => {
    // Returning visitors who previously allowed analytics get telemetry
    // without being asked again.
    if (TELEMETRY_CONFIGURED && status === "granted") {
      void initializeAppInsights();
    }
  }, [status]);

  function decide(consent: TelemetryConsent) {
    storeTelemetryConsent(window.localStorage, consent);
    notifyListeners();
    if (consent === "granted") {
      void initializeAppInsights();
    }
  }

  if (!TELEMETRY_CONFIGURED || status !== "undecided") return null;

  return (
    <aside
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-600">
          This site may use Microsoft Application Insights to count page views
          and find errors. It is off by default, never collects the conditions
          you select or any document contents, and declining does not change
          what the tool can do. See the{" "}
          <Link href="/privacy" className="underline hover:text-slate-900">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("declined")}
            className="rounded-md border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-700"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </aside>
  );
}
