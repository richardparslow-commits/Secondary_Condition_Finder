"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SecondaryError({
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
        component: "secondary-error-boundary",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-bold">Secondary workflow — something went wrong</h1>
      <p className="mt-3 text-sm text-slate-600">
        The secondary-condition workflow hit an unexpected error. Your previous selections are preserved in the
        short-lived session cookie when possible. Try again, or restart the workflow. Do not paste raw medical
        records into error reports.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="ui-button" onClick={() => reset()}>
          Try again
        </button>
        <Link className="ui-button-secondary" href="/secondary">
          Back to secondary start
        </Link>
        <Link className="ui-button-secondary" href="/">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-4 text-xs text-slate-500">Error digest: {error.digest}</p>}
    </div>
  );
}
