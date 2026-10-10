"use client";

import Link from "next/link";
import { useEffect } from "react";

import { createClientErrorEvent } from "@/lib/observability/client-error-event";

export default function ApiRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify(createClientErrorEvent("api-error-boundary", error)));
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">Service request failed</h1>
      <p className="mt-3 text-sm text-slate-600">
        The requested service encountered an unexpected error. No stack trace or sensitive payload is shown
        here. Try again, or return home.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="ui-button" onClick={() => reset()}>
          Try again
        </button>
        <Link className="ui-button-secondary" href="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
