"use client";

import { useState } from "react";

const NETWORK_FAILURE_MESSAGE =
  "The sandbox sign-in connection could not be reached. Check your internet connection and try again.";
const START_FAILURE_MESSAGE =
  "Sandbox sign-in could not start because the connection service returned an error. Try again; contact the operator if the problem persists.";

function authorizationUrlFor(
  value: unknown,
  service: "ratings" | "claims",
): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const path =
      service === "ratings"
        ? "/oauth2/veteran-verification/v1/authorization"
        : "/oauth2/claims/v1/authorization";
    if (
      url.origin !== "https://sandbox-api.va.gov" ||
      url.pathname !== path ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function SandboxConnectForm({ service }: { service: "ratings" | "claims" }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return <form action={`/va-account/oauth/${service}/start`} method="post" className="mt-4 space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const params = new URLSearchParams();
    params.set("consent", String(new FormData(form).get("consent") ?? ""));
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(form.action, {
        method: "POST", body: params, credentials: "same-origin", redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("Connection unavailable");
      const data: unknown = await response.json();
      const authorizationUrl =
        data && typeof data === "object" && "authorizationUrl" in data
          ? authorizationUrlFor(data.authorizationUrl, service)
          : null;
      if (!authorizationUrl) throw new Error("Connection unavailable");
      window.location.assign(authorizationUrl);
    } catch (error) {
      // A rejected fetch (offline, DNS failure, interrupted tunnel) is not a
      // consent problem. Keep the two failures distinct instead of sending the
      // visitor back to a checkbox they already ticked.
      const networkFailure =
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        error instanceof TypeError;
      setMessage(networkFailure ? NETWORK_FAILURE_MESSAGE : START_FAILURE_MESSAGE);
      setBusy(false);
    }
  }}>
    <label className="flex gap-2"><input type="checkbox" name="consent" value="sandbox-read-only" required disabled={busy} /><span>I am using a sandbox test account for myself and authorize this application to read only my sandbox {service === "ratings" ? "rating summary" : "claim statuses"}. No upload or claim submission is authorized.</span></label>
    <button type="submit" className="ui-button" disabled={busy}>{busy ? "Opening sandbox sign-in…" : `Connect sandbox ${service}`}</button>
    {message && <p role="alert">{message}</p>}
    <noscript>JavaScript is required to navigate to sandbox sign-in under the strict form security policy. Local research remains available without this connection.</noscript>
  </form>;
}
