"use client";

import Link from "next/link";
import { useEffect } from "react";

import { createClientErrorEvent } from "@/lib/observability/client-error-event";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Never serialize exception text, stack, cause, or digest to the console.
    console.error(JSON.stringify(createClientErrorEvent("root-error-boundary", error)));
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
    </div>
  );
}
