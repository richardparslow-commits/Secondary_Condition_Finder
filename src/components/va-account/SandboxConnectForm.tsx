"use client";

import { useState } from "react";

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
      if (!data || typeof data !== "object" || !("authorizationUrl" in data) || typeof data.authorizationUrl !== "string") throw new Error("Connection unavailable");
      const url = new URL(data.authorizationUrl);
      const path = service === "ratings" ? "/oauth2/veteran-verification/v1/authorization" : "/oauth2/claims/v1/authorization";
      if (url.origin !== "https://sandbox-api.va.gov" || url.pathname !== path || url.username || url.password) throw new Error("Connection unavailable");
      window.location.assign(url.toString());
    } catch {
      setMessage("Sandbox sign-in could not start. Check consent and try again; contact the operator if the problem persists.");
      setBusy(false);
    }
  }}>
    <label className="flex gap-2"><input type="checkbox" name="consent" value="sandbox-read-only" required disabled={busy} /><span>I am using a sandbox test account for myself and authorize this application to read only my sandbox {service === "ratings" ? "rating summary" : "claim statuses"}. No upload or claim submission is authorized.</span></label>
    <button type="submit" className="ui-button" disabled={busy}>{busy ? "Opening sandbox sign-in…" : `Connect sandbox ${service}`}</button>
    {message && <p role="alert">{message}</p>}
    <noscript>JavaScript is required to navigate to sandbox sign-in under the strict form security policy. Local research remains available without this connection.</noscript>
  </form>;
}
