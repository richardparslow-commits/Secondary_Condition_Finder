import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { SandboxConnectForm } from "@/components/va-account/SandboxConnectForm";

import { accountCookieName, loadVaAccountConfig, VA_ACCOUNT_SERVICES } from "@/lib/va/account/config";
import { loadAccountData, type AccountDataResult } from "@/lib/va/account/data";
import { loadAccountStore } from "@/lib/va/account/store";

export const metadata: Metadata = { title: "Sandbox VA Account | Secondary Condition Finder" };
export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  connected: "Sandbox authorization completed. Only the selected service is connected.",
  disconnected: "The application connection was cleared. This does not sign you out of VA or its identity provider.",
  "consent-required": "Confirm the sandbox read-only consent before connecting.",
  "connection-failed": "Authorization was denied, expired, invalid, or could not be verified. Try connecting again.",
  unavailable: "The sandbox connection is unavailable. No local recommendation data was substituted for account data.",
  "cleanup-unconfirmed": "The browser connection was removed, but server-side cleanup could not be confirmed. Close this session and contact the operator; server entries expire within 30 minutes.",
  "revocation-unconfirmed": "The application session was cleared, but provider token revocation could not be confirmed. Review connected applications with VA or the identity provider.",
};

function AccountData({ result }: { result: AccountDataResult }) {
  if (result.status !== "connected") return <p role="status" className="mt-3">{result.status === "rate-limited" ? "Sandbox reads are temporarily rate limited. Wait before retrying." : result.status === "unavailable" ? "Sandbox data could not be retrieved or validated. No account data is shown." : "No active sandbox connection. Connect again if your session has expired."}</p>;
  if (result.service === "ratings") return <div className="mt-4 space-y-2">
    <p><strong>Combined disability rating:</strong> {result.data.combined_disability_rating === null ? "No rating record reported" : `${result.data.combined_disability_rating}%`}</p>
    <p><strong>Combined effective date:</strong> {result.data.combined_effective_date ?? "Not reported"}</p>
    <p><strong>Legal effective date:</strong> {result.data.legal_effective_date ?? "Not reported"}</p>
    <ul className="list-disc pl-5">{result.data.individual_ratings?.map((rating, index) => <li key={index}>{rating.decision ?? "Decision not reported"}; rating {rating.rating_percentage == null ? "not reported" : `${rating.rating_percentage}%`}; effective {rating.effective_date ?? "not reported"}.</li>)}</ul>
  </div>;
  return <div className="mt-4"><p>{result.data.length} claim status record(s) returned by the sandbox.</p><ul className="mt-2 list-disc pl-5">{result.data.map((claim, index) => <li key={index}>{claim.claim_type}; filed {claim.date_filed}; {claim.status}; {claim.open ? "open" : "closed"}.</li>)}</ul><p className="mt-2 text-sm">These are existing claim statuses, not confirmation of a submission made by this application.</p></div>;
}

export default async function VaAccountPage({ searchParams }: { searchParams?: Promise<{ notice?: string | string[] }> }) {
  const jar = await cookies();
  const notice = (await searchParams)?.notice;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  return <main className="max-w-4xl mx-auto px-4 py-8">
    <Link href="/" className="underline">← Back to Home</Link>
    <h1 className="mt-4 text-3xl font-bold">Sandbox VA Account — Read Only</h1>
    <p className="mt-3">For sandbox test accounts only. Do not use real veteran records or identifiers. Production account access is unavailable in this phase.</p>
    <p className="mt-2">This page reads a signed-in test veteran&apos;s rating summary or existing claim statuses after separate authorization. It does not submit claims, upload documents, act for representatives, or alter the research engine. Passwords and MFA are entered only on the VA-authorized sign-in page.</p>
    <p className="mt-2">OAuth tokens stay encrypted on the application server, never in browser storage or workflow cookies. The browser holds only an opaque HttpOnly connection handle. Sessions expire after 30 minutes; each service has a separate connection.</p>
    <p className="mt-2"><Link href="/privacy" className="underline">Read the privacy and retention policy</Link></p>
    {message && <p role="status" className="mt-4 rounded border p-3">{message}</p>}
    <div className="mt-6 space-y-6">{await Promise.all(VA_ACCOUNT_SERVICES.map(async (service) => {
      const config = loadVaAccountConfig(service);
      const store = config ? loadAccountStore(config) : null;
      const handle = jar.get(accountCookieName(service))?.value;
      const result = config && store && handle ? await loadAccountData(config, store, handle) : null;
      return <section key={service} className="rounded-xl border p-5" aria-labelledby={`account-${service}`}>
        <h2 id={`account-${service}`} className="text-xl font-semibold">{service === "ratings" ? "Disability rating summary" : "Claim status"}</h2>
        {!config || !store ? <p role="status" className="mt-3">Sandbox connection is disabled or unconfigured. A registered VA sandbox client, approved callback, server secret, and isolated session store are required. This is not a live connectivity check.</p> : <>
          {result && <AccountData result={result} />}
          <SandboxConnectForm service={service} />
          {handle && <form action={`/va-account/oauth/${service}/disconnect`} method="post" className="mt-3"><button type="submit" className="ui-button-secondary">Disconnect sandbox {service}</button></form>}
        </>}
      </section>;
    }))}</div>
  </main>;
}
