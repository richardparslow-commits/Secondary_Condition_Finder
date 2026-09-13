"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured log for observability — never includes sensitive payload.
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        component: "root-error-boundary",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-sm text-slate-600">
        The page encountered an unexpected error. This is not a VA or medical determination. You can try
        again or return to the home page. If the problem persists, note the time and route and share only
        sanitized details with support — do not paste medical records, credentials, or cookies.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="ui-button" onClick={() => reset()}>
          Try again
        </button>
        <Link className="ui-button-secondary" href="/">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-slate-500">Error digest: {error.digest}</p>}
    </div>
  );
}
