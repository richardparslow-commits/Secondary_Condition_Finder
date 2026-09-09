"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PresumptiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        component: "presumptive-error-boundary",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">Presumptive workflow — something went wrong</h1>
      <p className="mt-3 text-sm text-slate-600">
        The presumptive-exposure workflow hit an unexpected error. Try again or return to the start. Do not
        include service-history details beyond sanitized route/time context in reports.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="ui-button" onClick={() => reset()}>
          Try again
        </button>
        <Link className="ui-button-secondary" href="/presumptive">
          Back to presumptive start
        </Link>
        <Link className="ui-button-secondary" href="/">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-slate-500">Error digest: {error.digest}</p>}
    </div>
  );
}
