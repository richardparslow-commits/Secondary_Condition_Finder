# Privacy-request fulfilment procedure — the operator half of R-01 / B-02

Issue [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539)
(R-04 gate C) requires more than published language. Its completion criterion names a
**named handler**, a **fulfilment procedure**, a **sanitized send/receive-test
outcome**, and an **approver's recorded decision**. The policy states the promise and
`/privacy/request` prepares a message; neither of them says what happens after a
Veteran sends one. This document is that half.

**What this document is not.** It is not an approval, and it is not a verification
that the published channel works. The approval half is recorded separately, with a
name and a date, in the [ownership register](external-manual-gates-status.md) and the
report's [§9 matrix](../VA_Lighthouse_Readiness_Report.md#9-approval). The channel
half is **not** recorded as working, because it is not working — see the finding
below. A procedure cannot make a mailbox receive mail, and nothing here may be read
as if it did.

## 1. The published channel, and its dated state

The application publishes exactly one privacy-request channel:
**`privacy@secondaryconditionfinder.org`** (`src/lib/privacy/intake.ts`
`PRIVACY_CONTACT_EMAIL`), stated in privacy-policy section 8, mirrored into Terms
section 7, and the sole recipient of every message the `/privacy/request` intake
pre-composes. There is no form, no postal address and no phone intake; VA's benefits
line is published for completeness and labelled as not an intake channel.

**Finding (2026-10-15): the published address is at a domain that does not exist in
DNS, so no request can be delivered to it.**

| Reading | Result |
| --- | --- |
| `MX` for `secondaryconditionfinder.org`, DNS-over-HTTPS (Cloudflare) | **NXDOMAIN** (RCODE 3), authority = the `.org` registry's own SOA (`a0.org.afilias-nst.info`) — the registry answering for a name it does not serve |
| `NS` for the same name, DNS-over-HTTPS (Cloudflare) | **NXDOMAIN**, same registry SOA |
| `MX` for the same name, DNS-over-HTTPS (Google, `dns.google`) | **NXDOMAIN**, same registry SOA |
| `RDAP` (`rdap.org/domain/…`) and `whois` | **No domain record** — the `whois` answer is the `.org` TLD record itself |
| Control, same environment and minute: `MX` for `vercel.com` | Resolves normally (five MX answers); `.org` TLD nameservers resolve normally |
| Behaviour of the environment's recursive resolvers for the name | `SERVFAIL` rather than `NXDOMAIN`; recorded because it was observed, and not relied on. The two authoritative DoH readings above are the evidence, and they agree: no mail route exists |

**Re-verification (2026-10-16): unchanged, and now with the registry's own
answer.** A second dated reading, taken before any registration work begins, found
the same state and strengthened the evidence for it:

| Reading | Result |
| --- | --- |
| `NS`, `SOA`, `MX`, `A`, `TXT` for the name, Cloudflare and Google DoH | **NXDOMAIN** at both resolvers, authority again the `.org` registry's own SOA. Nothing has changed since 2026-10-15 |
| `_dmarc` TXT for the name | **NXDOMAIN** — there is no mail authentication record either, because there is no name to carry one |
| Registry RDAP — the `.org` registry itself (`rdap.publicinterestregistry.org`) | **HTTP 404** for the name |
| Control, same endpoint and minute: `wikipedia.org` and `example.org` | **HTTP 200**, each with registration status and nameservers — so the 404 above means *not registered*, rather than an endpoint that always fails |
| Control, same endpoint: a `.com` name (`vercel.com`) | **HTTP 404** — expected on a `.org` registry, and the reason a name outside `.org` cannot validate this reading |
| `rdap.org` for the name **and** for a registered control | **HTTP 403 for both.** Corrected here: the 2026-10-15 record cited `RDAP`/`whois` as returning "no domain record", but this environment answers 403 for a name that demonstrably *is* registered, so that reading was never usable as evidence. The registry reading with its positive controls replaces it; the earlier sentence is left standing as the dated record it was rather than quietly rewritten |

The re-verification changes no conclusion — the name is **unregistered and
available to register**, and no mail route exists, so the two unchecked items in
section 9 stay unchecked — and it changes one method: availability is now read from
the registry that issues the name, against positive controls, instead of from a
redirect service that answers 403 in this environment.

Consequences, stated plainly:

- A Veteran who follows the published instruction and sends a request gets no
  acknowledgement, no completion confirmation, and no response at all. The 45-day
  commitment cannot start, because nothing arrives to start it.
- The deployed pages were checked directly on 2026-10-15
  (`https://secondary-condition-finder.vercel.app/privacy` and `/privacy/request`):
  both publish the address, and every composed message — deletion, access,
  correction, question — is addressed to it.
- This is the same failure the 2026-10-13 correction removed for the phone channel:
  a published channel with nothing behind it. That one was a documentation defect and
  was fixed by correcting the claim. **This one is not a documentation defect**, and
  no edit to this repository closes it: a mailbox has to exist.

**Owner decision (2026-10-15).** Register `secondaryconditionfinder.org` and operate
a mailbox at the published address, so the published promise becomes deliverable
rather than being rewritten. The policy text is therefore unchanged by this
finding — it stands as the commitment — and the gate stays open until a message
sent to the address is actually received. The registration and mailbox checklist is
section 8, and the closure checklist is section 9.

## 2. The named handler, and continuity

**Named handler: Richard Parslow (`richardparslow-commits`)**, the accountable owner
on [#539](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/539)
and in the [ownership register](external-manual-gates-status.md). This is a named
person, not a role or a queue.

**Continuity rule.** If the handler becomes unavailable, the replacement is recorded
as a named successor in the issue and the register before the promise is left
unowned; a request already in flight is handed over with its clock running. A
promise to a Veteran must never depend on an unnamed absence, and the escalation is
the same one the register's notes require for every gate.

## 3. How a request arrives

1. The visitor reads privacy-policy §8, or reaches `/privacy/request` from a
   workflow completion surface or from the policy.
2. `/privacy/request` composes the request in the visitor's **own** mail client: the
   message states the request, the 45-day commitment, the partial-handling promise,
   what the requester must supply themselves, and what not to include (no Social
   Security number, claim number, or medical records). The visitor sends it.
3. Nothing is submitted to the application. There is no request body, no server
   record, and no identifier held here — which is why this intake needed no
   exception to the PHI-free Server Action boundary, and also why the application
   cannot tell whether a request was ever sent.

The receiving side is therefore a human inbox, and this procedure is what that human
does with it.

## 4. What a request can reach — the honest scope

The [data retention policy](data-retention-policy.md) is the source of truth; this
section is the operational digest a handler acts on.

| Where the data is | What a request can do about it |
| --- | --- |
| Sealed server-side account session (sandbox-only, optional): encrypted token pair + identity-subject binding, behind an opaque HttpOnly handle, 30-minute absolute expiry | Deletable: disconnect the session, and on request purge the store entry and confirm |
| Operational records that identify the requester: allowlisted action/status/counter events (`workflow-*-selected`, `presumptive-service-history-saved`, `regulatory-preflight-*`) in the platform's structured logs | Handled through the log-retention path, not host-independent deletion: the operator confirms what the platform retains. No per-user server-side workflow history exists to delete |
| Browser-local state: workflow record, evidence excerpts, OCR checkpoints, service history (`sessionStorage`, tab-scoped) | **Nothing to delete on the requester's behalf.** It is theirs, in their tab, under the in-app clearing controls; a request grants nothing new for it, and the policy says so |
| VA public-reference cache (process-local + shared KV) | Not personal data: keys are SHA-256-hashed segments, entries expire in 5 minutes, and no lookup value is stored as a value. Nothing to delete |
| Hosting-platform request and operational logs | Covered by the [gate A log-retention record](external-manual-gates-status.md#issue-537--hosting-log-retention-and-access-control-review-h-02-gate-a), not by host-independent deletion. The completion confirmation states what the platform retains, and does not claim otherwise |

If a future change introduces a new server-side store, this table and the retention
policy must be updated **before** the store ships, because the promise is written
against what the application holds.

## 5. Handling a request — the nine steps

The commitment published in the policy is that a verified request is completed,
including any constituent partial request, **within 45 days of receipt**, and that a
partial or refused completion states what was retained and why. The clock starts when
the message arrives, not when identity is verified.

1. **Acknowledge** — reply to the message, from the same channel, confirming receipt
   and naming the handler.
2. **Verify identity only when needed** — tell the requester what is required, ask
   for the minimum, and use it for nothing else. Never ask for a Social Security
   number, a claim number, or medical records.
3. **Determine the scope** — one or more of deletion, access, correction, or a
   question, including any constituent partial request. Section 4 decides what is
   reachable; a question is answered rather than "completed" against a clock.
4. **Act** — disconnect/purge the session store entry where applicable; there is
   normally nothing else the application holds that a deletion reaches.
5. **State what is retained and why** — for any part that cannot be completed, name
   the record and the authority: 36 CFR Chapter XII (NARA recordkeeping) or VA
   recordkeeping obligations under Title 38, United States Code. Silence is not an
   option, and neither is a vaguer phrase than the policy uses.
6. **Complete within 45 days** — including a partial completion; if a part is
   refused, that refusal is itself a completion and is confirmed in the same reply.
7. **Confirm completion in the same thread** — acknowledgement and confirmation both
   come back to the message the requester sent, as the policy promises.
8. **Record a sanitized outcome** — section 6's template only, in the register's
   gate C record or a sibling record, never the request body.
9. **Escalate on unavailability** — per section 2, with the clock running.

## 6. The sanitized record (and what may never be written down)

Recorded per request, and nothing more:

```text
received (UTC date) | request type | channel | verification required (y/n)
| outcome (completed / partial / refused) | retention stated (y/n + authority)
| completed (UTC date) | handler initials
```

**Never recorded:** the requester's name, email address, or any identifier; the
message text or a copy of it; any connected-account information; any health
information; and no log excerpt, URL with a query string, code, state, token, or
cookie. The record exists to show the promise was kept, not to become a second store
of the very data the request was about.

## 7. What this procedure cannot do

While `secondaryconditionfinder.org` does not resolve, **no step above can run**,
because no request arrives. Sections 1 and 8 are therefore the binding part of this
document: everything else is ready and waiting on a mailbox.

## 8. Registration and mailbox checklist (the action that unblocks gate C)

Owner action, in order. Each line is verifiable, which is why they are separate.

1. Register `secondaryconditionfinder.org` (or, if the published address should
   change instead, record that decision and update `PRIVACY_CONTACT_EMAIL`, the
   policy, and every pin that names the address).
2. Create a mailbox at `privacy@secondaryconditionfinder.org` on that domain.
3. Publish MX records for the domain and confirm the mail host accepts mail for it.
4. Send a test message **from a mailbox outside the domain** to the published address
   and confirm it arrives and can be answered.
5. Record the **sanitized send/receive outcome** — date, from/to domains, delivery
   and reply confirmed, and nothing about the message content — in the register's
   gate C record, so the finding above is superseded by evidence rather than by
   assertion.
6. Confirm the address reaches a human (the named handler in section 2) rather than a
   mailbox nobody reads.

### What "publish MX records" means, concretely

Four records, published at whichever DNS provider holds the domain's nameservers.
The MX targets and the SPF host come from the mail provider's own setup screen,
because several providers issue region- or account-specific values — publish what
that screen shows rather than a value copied from elsewhere.

| Type | Name | Value | Why it is there |
| --- | --- | --- | --- |
| `MX` | `@` (`secondaryconditionfinder.org`) | the mail provider's inbound host(s); priority `10`, plus `20` if the provider lists a second | this is the record that makes mail arrive at all |
| `TXT` | `@` | `v=spf1 include:<the provider's SPF host> ~all` | lets the handler's replies pass SPF instead of being filtered as spam |
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:privacy@secondaryconditionfinder.org` | DMARC started in monitor mode while the domain is new; tighten to `p=quarantine` once replies are flowing |
| `TXT` | `@` | the provider's domain-verification value, where it issues one | some providers require ownership proof before the mailbox is enabled |

Verify each step rather than assuming it, from any machine with `dig` (`nslookup`
works too):

```bash
dig +short NS secondaryconditionfinder.org     # resolves once the domain is registered
dig +short MX secondaryconditionfinder.org     # the mail route: step 3's evidence
dig +short TXT secondaryconditionfinder.org    # SPF, and any verification value
dig +short TXT _dmarc.secondaryconditionfinder.org
```

Registry side, for whether the name is registered at all — `404` means
unregistered, `200` means registered, and the second line is the control that makes
the first line mean something (this endpoint answers `404` for other TLDs):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://rdap.publicinterestregistry.org/rdap/domain/secondaryconditionfinder.org
curl -s -o /dev/null -w '%{http_code}\n' https://rdap.publicinterestregistry.org/rdap/domain/example.org
```

Registering the name and choosing the mail provider are purchases in the operator's
own account: no credential in this repository can perform them, and none should be
added in order to.

Steps 1–3 are checkable rather than assertable: [`scripts/verify-privacy-channel.mjs`](../scripts/verify-privacy-channel.mjs)
(`npm run verify:privacy-channel`) reads the address from `src/lib/privacy/intake.ts` rather
than retyping it, queries both resolvers and the `.org` registry with a positive control,
and exits **0** when a mail route exists, **1** when it does not (naming what is missing),
or **2** when the reading itself failed. With `--smtp` it also asks the mail host whether it
would accept the published address, stopping at `RCPT TO`: it sends no message, so it cannot
substitute for step 4, and its own output says so.

Steps 1–3 are also **watched** rather than only measured once:
[`privacy-channel-watch.yml`](../.github/workflows/privacy-channel-watch.yml) runs the verifier daily
and compares the reading against an accepted state, raising a tracking issue when the channel is
recovered, regresses, outlives its review date, or when the watch itself cannot read the facts — and
staying silent while the channel is dead exactly as recorded. A green watch is **not** step 4: it
reads DNS and the registry, never a mailbox.

Steps 4–6 are the gate's "verified live monitored contact channel with a named
handler and a sanitized send/receive-test outcome". The repository can record
them; it cannot perform them.

## 9. Closing gate C — the checklist

Gate C closes when **all** of these are recorded, and not before:

- [x] The published promise stated and pinned: deletion right, 45-day commitment,
      statutory exceptions with a reason on any partial handling, and the intake
      route (`src/app/privacy/page.tsx` §8, `src/app/privacy/request/page.tsx`,
      `tests/privacy-rights-contact.test.ts`).
- [x] The approver's recorded decision: full name, affiliation, decision and date
      (report §9; package "Privacy approval and monitored contact").
- [x] The named handler recorded (section 2).
- [x] The fulfilment procedure recorded (this document).
- [ ] **The channel resolves and receives mail** (section 8, steps 1–4) — currently
      unmet, on the 2026-10-15 finding in section 1, re-verified 2026-10-16: the name
      is still NXDOMAIN and the registry reports it unregistered.
- [ ] **The sanitized send/receive test outcome recorded** (section 8, steps 5–6) —
      currently unmet, and it cannot be recorded before the mailbox exists.

The two unchecked lines are the whole remaining gate. Everything else that #539's
criterion names is recorded, dated, and pinned — including the parts that were
missing when this document was written.
