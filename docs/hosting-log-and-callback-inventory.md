# Hosting log sinks and OAuth callback surfaces — H-02 inventory

H-02 (`VA_Lighthouse_Readiness_Report.md` §5.4) asks for two reviews: hosting log
retention and access controls ([#537](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/537),
gate A), and OAuth callback-URL log scrubbing ([#538](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/538),
gate B). Both need live hosting-account inspection, which repository automation
cannot perform.

What the repository *can* do is prepare the inventory the operator review reads
from: exactly which sinks the application can write to, exactly which callback
surfaces ship, and what the code already guarantees about a `code` or `state`.
That is what this document records, verified against the working tree on
**2026-10-13**.

**This document is not the operator review.** It is not evidence for either gate,
it does not establish a retention period or an access control, and it closed
neither issue on its own. The code-side half is an *input* to the reviews; the
per-sink record and each gate's disposition live in the
[ownership register](external-manual-gates-status.md), which is the canonical
record. As of 2026-10-15 that register closes **gate A (#537)** and **gate B
(#538)** — each on a dated record of what the platform *documents*, with the
account facts that remain unread named and accepted there.

**Correction to an earlier revision of this paragraph (2026-10-15).** It said
gate B was still open because "the live scrubbing half still has to be read from
the account". That was half wrong, and the error mattered in one direction: it
treated the platform's scrubbing behaviour as an account secret. It is not one.
The platform publishes what its logs contain and documents no query-parameter
scrubbing at all, so the scrubbing question is answerable from the platform's
terms — the account only decides whether a drain exists, on what plan, and for
how long logs are retained. Part 3 now separates those two kinds of fact, and
Part 4's gate B procedure is rewritten accordingly.

## Part 1 — Application log sinks (code side)

The reviewed application sink set is pinned against the working tree by
[`tests/logging-sink-inventory.test.ts`](../tests/logging-sink-inventory.test.ts)
rather than transcribed here, so a new sink fails CI instead of shipping
silently. In summary, every application-emitted record goes through one of:

- **One redacting logger choke point** (`src/lib/observability/logger.ts`), with a
  pinned list of reviewed client modules; the modules that log veteran-workflow
  fields are enumerated there and their fields are operational-only.
- **Reviewed `auditLog` callers** — a pinned list of routes/actions emitting
  action/status/counter events. The event names and field shapes are a closed
  set in `src/lib/observability/audit.ts`, which drops any key it does not
  recognize.
- **Fixed-string `console.*` call sites** in a pinned file list, whose argument
  *shapes* are governed by
  [`tests/phi-logging-boundary.test.ts`](../tests/phi-logging-boundary.test.ts),
  the ESLint rule `eslint-rules/no-unsafe-logging.mjs`, and the pre-commit
  scanner `scripts/lib/phi-logging-scan.mjs` (two independent implementations of
  one rule, cross-checked in CI).
- **No external log or trace collector.** LangSmith wiring lives in one
  `server-only` module with no `src/` caller and export defaults off; the OTel
  meters are no-ops because `registerOTel` is never called
  ([`tests/telemetry-policy.test.ts`](../tests/telemetry-policy.test.ts)).
- **A content-free violation-report intake** (`/api/csp-report`): bounded status
  codes only, and the raw report body is never logged.

The repository configures **no log drain and no custom collector**: there is no
`vercel.json` and no drain/collector configuration in the tree. That is a
statement about the source tree, and deliberately *not* a statement about the
deployment. Log drains on this platform are configured in the hosting account
(dashboard or API) and **not** in `vercel.json`, so an absent `vercel.json`
cannot establish that no drain exists: a drain could be forwarding these records
to a third-party destination and this repository would not see it. The platform's
runtime logs also cover only static requests that serve cache, with full
static-request coverage available only through a drain, and drained records carry
the request path *with its query parameters*. The sink set this application can
reach is therefore the provider's runtime logs, its build logs (retained
indefinitely per deployment), and **any account-configured drain** — the last of
which only the account can show, which is precisely why gate A is externally
operated and why its record names that fact as unread rather than assuming it.

## Part 2 — Callback surfaces that actually ship

Issue #538 warns against assuming that historical `api/auth/callback` references
describe a shipped route. Both routes named there **do** ship; the inventory
below is the current source of truth, and
[`tests/oauth-callback-surface-inventory.test.ts`](../tests/oauth-callback-surface-inventory.test.ts)
fails if this set changes.

| Surface | Route | Method | Callback values | Admission control | What it writes |
| --- | --- | --- | --- | --- | --- |
| Canonical callback (the registered `redirect_uri`) | `/va-account/oauth/{service}/callback` | GET | `code`, `state`, `error` in the query, passed whole to the reviewed exchange | reference-read budget in `src/proxy.ts` | session handle cookie (HttpOnly, Secure, SameSite=Strict, path `/va-account`); 303 to a fixed notice code |
| Adapter callback | `/api/auth/callback` | GET | same | `accountAuthCallbackLimiter` via `src/lib/api-route-policies.ts` | same session handle cookie and fixed-notice redirect |
| Login initiator (page) | `POST /va-account/oauth/{service}/start` | POST | none inbound; mints `state`/verifier/nonce | reference-read budget; same-origin POST required | JSON `{ authorizationUrl }`; binding-only transaction cookie scoped to `/va-account/oauth/{service}` |
| Login initiator (adapter) | `GET /api/auth/login` | GET | none inbound | `accountAuthLoginLimiter` | 303 to the configured VA authorization URL; binding-only transaction cookie scoped to `/api/auth` |
| Disconnect | `POST /va-account/oauth/{service}/disconnect` | POST | none | reference-read budget; same-origin POST required | upstream revocation attempt; clears session and transaction cookies |
| Account page | `/va-account` | GET | `notice` — a fixed code only | reference-read budget | reads the sealed server-side session; renders status |

The exchange itself lives in exactly one reviewed place
(`src/lib/va/account/oauth.ts`): both callback surfaces hand it the full
parameter set, so neither surface reads `code` or `state` by name, and neither
can echo, store or serialize one.

## Part 3 — What the code already guarantees, and what it cannot

Guarantees, each pinned by
[`tests/oauth-callback-surface-inventory.test.ts`](../tests/oauth-callback-surface-inventory.test.ts):

1. **Inventory.** Exactly two surfaces redeem an authorization code, exactly two
   start a login, and exactly one disconnects. A new callback or initiator route
   fails the suite and this table must be updated with it.
2. **No sink on the callback path.** The callback-path modules (both route
   handlers plus the account config/store/transport/exchange modules) contain no
   logging sink at all — no `console.*`, no logger construction, no audit event.
   The exchange cannot log a code because it cannot log.
3. **No request-derived text in any sink, corpus-wide.** Every logging call site
   under `src/` is inspected: an argument mentioning a request URL, the query
   string, or a `code`/`state` read fails CI, so a future route cannot add
   `logger.info(request.url)` and call it reviewed. The detector is itself
   falsified with planted violations, so the fence cannot pass vacuously.
4. **Failure text is fixed, and the URL cannot leak onward.** The only error the
   exchange raises is `AccountUnavailable` with a constant message; both routes
   swallow it into a fixed notice code (`connected`, `connection-failed`,
   `unavailable`, `disconnected`, `revocation-unconfirmed`,
   `cleanup-unconfirmed` — a pinned set). Every callback response is
   `Cache-Control: private, no-store` + `Referrer-Policy: no-referrer`, so the
   code-bearing callback URL cannot leak onward through a `Referer` header, and
   the temporary transaction cookie is cleared on every callback path.
5. **The code is single-use.** The transaction is consumed before the token
   exchange and the callback is bound to an HttpOnly transaction cookie, so a
   replayed or CSRF-crafted callback fails closed. This bounds the value of a
   leaked code; it is not log evidence.

What the code cannot establish — the actual gate. Two different kinds of fact
were conflated here before 2026-10-15; they are separated now, because only the
second is an account reading:

**Published platform behaviour (answerable without the account, verified
2026-10-15 against the platform's own documentation):**

- The platform's request logs record the request line **including its query
  string**. Runtime Logs detail a request's *search parameters*, and a Log Drain
  carries `proxy.path`, documented as the "request path with query parameters".
  A callback request therefore arrives in the logs with `code` and `state` as
  sent.
- **No documented setting removes them.** The platform documents no
  query-parameter redaction for runtime logs, function logs, or drains on any
  plan; the only privacy control documented for a drain is **IP hiding**
  (Pro/Enterprise), which does not touch the path or query string; and the one
  documented query-parameter filter (`beforeSend` in Web Analytics) applies to
  analytics events, not to runtime logs or drains. "Check whether a scrubbing
  rule removes `code`/`state`" (the earlier gate B step 2) was therefore the
  wrong instruction — the finding to record is that no such rule exists to
  configure.
- The request line is recorded **whether or not the request is answered**, and
  failures are filterable by status, so a callback that fails closed is still
  logged. Neither disabling the sandbox nor a 503 keeps the request line out of
  the logs.

**Account facts (not readable from this repository or by any code here):**
whether a drain is configured for this project, the plan tier, the retention
period actually in force, and who can read or export the logs. These are the same
four facts gate A names as its unread residual, and they are the reason both
closure records are terms-and-behaviour records rather than account inspections.

No code-side sink gap was found in this inventory. The residual for gate B is
therefore external and platform-side: the callback request line is retained,
readable, and not scrubbed. What bounds it is not scrubbing but *reachability* —
the callback paths are inert while the sandbox account config is absent (both
handlers return a fixed 503 before reading any parameter, per Part 2), they are
the only consumers of a code, and `completeAccountLogin` consumes the transaction
single-use before the exchange. A request line logged today therefore carries an
attacker-supplied or stale value, not a live one. Gate B closed on that record on
2026-10-15: the retained request line is the accepted residual, and **credentialed
hosted use** — the moment a live code could exist — is the trigger that must be
read from the account first.

## Part 4 — Operator review procedure

Run this against the exact production deployment. Record sanitized facts only.

Gate A — retention and access controls, per sink:

1. Enumerate every sink that can receive request, runtime or build logs for the
   project (platform request logs, runtime/edge logs, and any configured drain
   destination).
2. Record, for each: the retention period and the date it was set, whether the
   retention is configurable and at what value, and the policy/plan tier it comes
   from.
3. Record the read and export access controls: which roles/accounts can read the
   logs, whether access requires SSO or MFA, and what restricts export or
   forwarding.
4. Record the data-handling/redaction terms applicable to retained log content,
   with the date the terms were reviewed.

Gate B — callback-URL scrubbing:

1. Confirm the shipped callback surfaces from Part 2 against the deployment (a
   route inventory, not a memory of the issue text).
2. Record the platform's documented behaviour from Part 3 rather than hunting for
   a setting that does not exist: the request line reaches Runtime Logs and any
   drain **with its query string**, and the platform documents no
   query-parameter scrubbing for either. Then read the account-side facts that
   remain: plan tier, whether a drain exists, the retention in force in each sink,
   and who can read or export it (the same readings gate A needs).
3. If the sandbox account config is enabled in the deployment, exercise the
   synthetic callback path with a test account and search each sink for the
   callback request line for the review window. If it is disabled — the shipped
   state — record that instead, together with the two code-side facts that stand
   in for it: both handlers return a fixed 503 **before** reading any parameter,
   so no live code can exist or be consumed, and a logged request line can only
   carry an attacker-supplied or stale value.
4. Record the outcome as one of: confirmed not retained; confirmed scrubbed;
   retained and **remediated** (with the remediation and a retest date); or
   retained and **named as an accepted residual** with the mitigation that bounds
   it and the trigger that reopens the question. The platform documents no way to
   scrub, so the third option is often unavailable and the fourth is the honest
   one — but it is only available with the residual named, its mitigation stated,
   and the account-side readings listed as the reopen condition. A retained
   code/state is a finding in every case; what changes is whether the finding can
   be remediated at all, and the record must say which it is.

Record for each gate: review date (UTC), hosting account/project, the sink
identifiers, the retention/access/scrubbing facts, and the reviewer.

**Never record as evidence:** log excerpts, callback URLs with query strings,
authorization codes, `state` values, tokens, cookies, account identifiers, or
any Veteran data. Sink and policy *names* and dates are the evidence.

## Part 5 — What would close these gates

- **#537 (gate A)** — **closed 2026-10-15** in the
  [ownership register](external-manual-gates-status.md): the dated, per-sink
  record there is taken from the platform's published retention/access/
  redaction terms, names the account-level facts that were not read, and carries
  the accountable owner's dated acceptance of that residual. It is not a read of
  the account. Reopen under the original criterion if credentialed hosted use is
  pursued, or if a plan, drain, or 2FA/SSO change makes a row stale.
- **#538 (gate B)** — **closed 2026-10-15** in the
  [ownership register](external-manual-gates-status.md): the callback-surface
  inventory, the platform's documented (absent) scrubbing, and the fixed-outcome
  statement are recorded per sink, with the retained request line named as the
  owner's accepted residual and credentialed hosted use kept as the trigger that
  reopens it. Its three findings and their dispositions are in Part 3. Like gate
  A, it is not a read of the hosting account. Reopen as a new issue if
  credentialed hosted use is pursued, or if the platform publishes a
  query-parameter scrub control or a plan/drain change alters the sink set.

Repository tests, a green CI run, a passing HTTP check, or this document cannot
close a gate. The register's own record is what closed both gates, and each closes
by naming what it could not read; the code-side inventory here is the operator's
input rather than the review. Neither closure is an account inspection, which is
why the report's H-02 close-out box stays unchecked and why the account-side
readings are the reopen condition rather than a formality.
