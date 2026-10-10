# SEC-02 hosted acceptance runbook — inbound admission at the real edge

Operator runbook for the deployment evidence [SEC-02](security-architecture-audit-2026-10-07.md) still owes. It changes no source, rewrites no recorded hash, and closes nothing by itself: it produces the evidence that decides whether SEC-02's remaining half can be closed, and in which words.

Companion artifact: [sec-02-hosted-acceptance-evidence.template.json](sec-02-hosted-acceptance-evidence.template.json) — copy it, fill it, attach it to the finding.

## 0. What is already proven, and what this run covers

Proven by source and local tests (see the SEC-02 sections of the audit): route/method coverage, a per-client key built **only** from a syntactically valid IP literal, a shared admission ceiling that bounds unattributed and key-rotating traffic, and `/api/health` reporting the trust decision, the applied ceiling and the store regime instead of assuming them.

Not proven, and not provable from this repository: whether the **deployed** edge sets (rather than passes through) the forwarding headers, whether the origin is reachable **without** the edge, and whether the counters are anything other than process-local.

A local probe such as `tmp/security-audit-2026-10-07/sec-02-rate-coverage/http-check.mjs` sends a `x-forwarded-for` header from the local machine and measures the proxy. That is useful as a pre-check and is **not** ingress evidence — the header it sends is exactly the client-supplied value the test is supposed to distrust. Never cite a local probe as the real-edge result.

## 1. Preconditions

| Item | Requirement |
|---|---|
| Authorization | Owner approval for the target environment. Group A/C/D deliberately exhaust a shared budget, so run them against a **non-production** environment that carries the **same edge configuration** as production. |
| Commit + deployment | Record the exact commit SHA and every deployment id used. Evidence attaches to a specific deployment. |
| Instances | At least two serving instances are reachable through the edge, or a second instance can be started for the test. |
| Cold start | A way to restart or scale-to-zero exactly one instance. |
| Configuration visibility | Read access to the edge/WAF configuration and to the environment variables of the test deployment. |
| Template | A copy of the evidence template saved outside the repository's public assets, alongside the log files this run produces. |

An environment variable that only changes **reporting** must not be used to make the test pass. `RATE_LIMIT_TRUSTED_INGRESS=true` records a deployment claim; it does not change enforcement. Do **not** set it before Group A — Group A is what determines whether the claim is true. Set it only afterwards, and only if Group A passed.

## 2. Test configuration

The shared admission ceiling defaults to `6000` requests per `60` second window (`RATE_LIMIT_UNATTRIBUTED_MAX`), which is far above plausible honest traffic for one instance and therefore **not observable with a safe request count**. Two different groups need two different settings, and they are set apart on purpose:

| Group | `RATE_LIMIT_UNATTRIBUTED_MAX` | Why |
|---|---|---|
| A2 (per-client fairness under header rotation) | raised, e.g. `5000` | Keep the ceiling out of the way so a refusal, if any, is the **per-client bucket** — the thing a spoofed header attacks. |
| A3, B, C, D (unattributed/aggregate behaviour) | lowered, e.g. `20` | Make the **ceiling** observable with tens of requests instead of thousands. |

Record both values, the group each applied to, and — required — that the variable was restored to its intended production value afterwards (`testOnlyOverrides.restored` in the template must be `true`). An unrestored low ceiling is itself a finding.

## 3. Group A — spoofed and missing headers through the real edge

The question is behavioural, because the app does not echo the identity it resolved: **does a client-supplied forwarding header become a fresh allowance?**

`$BASE` is the edge URL. A guarded route is any policed surface — use `GET /api/health` (30/min per client) or `GET /va-forms/finder` (30/min, shared reference budget). Keep the request rate low enough that the edge's own WAF does not take over; record if it does.

**A1 — one claimed identity stays one bucket.** With the ceiling raised, send 31 requests from a single client that all carry the **same** forged value:

```bash
for i in $(seq 1 31); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H 'x-forwarded-for: 203.0.113.7' "$BASE/api/health"
done | sort | uniq -c
```

Expected: 30 accepted, the overflow refused with `429`. This confirms a claimed identity is honoured as a single bucket; it does **not yet** distinguish an edge that overwrites from one that passes through.

**A2 — rotating claimed identities (the discriminator).** Same client, one request per distinct valid literal, more than the per-client limit in total:

```bash
for i in $(seq 1 60); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-forwarded-for: 198.51.100.$i" "$BASE/api/health"
done | sort | uniq -c
```

- Edge **overwrites** the header with the observed peer address → every request lands in one bucket → requests are refused well before 60. **Pass.**
- Edge **passes the client's value through** → each request mints a fresh bucket → no per-client refusal at all. **Fail** — this is precisely the defect SEC-02 describes (an attacker rotates the header and never reaches a limit while honest traffic stays capped).

**A3 — non-literal or absent identity is bounded, not skipped.** With the ceiling lowered to `20`, send junk and rotating non-literal tokens, and — if the platform lets you reach the app without the header — requests with no forwarding header:

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-forwarded-for: not-an-ip-$i" "$BASE/api/health"
done | sort | uniq -c
```

Expected: the requests are **counted against the shared ceiling**, so the overflow is refused once the ceiling is reached. A run in which all 25 succeed is a **fail**: it means unattributed traffic is unbounded. A run that refuses *earlier* than the ceiling is also worth recording (the per-client path is being used when it should not be).

`X-Real-IP` fallback is only meaningful if your edge sets or overwrites that header; record what the edge does with it rather than assuming (A3 with `-H 'x-real-ip: not-an-ip-1'`).

**Record the negative case honestly.** If the edge overwrites the header, junk values never reach the app, so A3 *through the edge* is **not applicable** — record it as `not-applicable` with the reason "edge overwrites the client-supplied value; A2 is the evidence", and leave the app-side missing-identity behaviour on the recorded local suite. Do not record A3 as a pass when the edge is what prevented the junk from arriving.

**Group A passes when:** A2 shows rotation does not yield fresh allowances — record it as `environment.edge.overwritesClientSuppliedForwardingHeaders: true`, which is the claim `RATE_LIMIT_TRUSTED_INGRESS=true` is allowed to record — **and** A3 either shows unattributed traffic bounded by the ceiling or is a documented `not-applicable` for the overwrite reason above.

## 4. Group B — direct-origin refusal

The question: can a client reach the application **without** passing the edge controls in Group A?

1. **Discover whether an origin path exists.** Check the platform/edge documentation and configuration for a raw origin hostname, an `IP:port`, an internal DNS name, or a deployment URL that skips the edge; check whether deployment protection (authentication / bypass token) is enabled.
2. **Probe it.** Request a policed surface directly against the discovered origin, bypassing the edge:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://$ORIGIN_HOST/api/health"
```

Expected: connection refused, a `403`/`404`, or a platform authentication page. **Any response carrying the application's own health body is a fail**, regardless of status code.
3. **Header smuggling.** Through the edge, send a request that sets the forwarding header *and* any platform-internal header the edge is expected to strip or set, and confirm it changes nothing about admission. Confirm separately that any bypass token is a server-side secret and is not sent to browsers, embedded in client bundles, or logged.

**Group B passes when:** either no origin is reachable without the edge (record that finding and where it comes from), or a direct request is refused. Record the named platform control and where it is configured; a permission setting nobody recorded is not evidence.

## 5. Group C — two instances

The question: what does the enforced limit actually mean once more than one process serves traffic?

Note that `/api/health` reports `scope: "per-instance"` whenever `NODE_ENV=production` or a distributed-runtime marker is set — that is a **classification**, not a measurement of instance count. The measurement below is the evidence; the health field is only corroboration.

**C1 — read the surface on each instance.** Fetch `/api/health` from each instance through the edge and record `components.rateLimit` verbatim: `scope`, `identity.trustedIngress`, `identity.identity`, `ceiling.max`, `ceiling.windowMs`, `ceiling.key`, and `store.mode` / `store.distributed` / `store.blockedBy`.

**C2 — no shared store (today's configuration): measure the multiplication.** With the ceiling lowered to `20`, drive a single client round-robin across both instances and count how many requests succeed before the first refusal:

```bash
for i in $(seq 1 120); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-forwarded-for: 203.0.113.9" "$BASE/api/health"
done | sort | uniq -c
```

Expected without a store: the aggregate refusal point is roughly `ceiling × instances`, because each instance holds its own counter. Record the measured number and the instance count. This is a **measurement of a documented limitation**, not a failure — but it must be recorded, and the finding may then be closed only in the "per-instance, documented" form of §7.

**C3 — with a provisioned shared counter store (only if the owner has provisioned one).** Without a store, C3 is `not-applicable` and the finding may **not** be described as a distributed quota. With one, verify each of:

- **Deployment-wide:** the aggregate refusal point across both instances is ≈ the ceiling, not `ceilings × instances`.
- **Atomic:** concurrent increments from both instances for the same key lose no updates — the observed refusal point matches the configured ceiling, not a fraction of it.
- **TTL:** the window expires as configured and does not silently persist or reset early.
- **Failure mode:** with the store unreachable the surface refuses (fails closed) rather than skipping admission.
- **Race:** two boundary bursts arriving on different instances cannot both be admitted past the ceiling.

Record the store product, the atomic primitive it exposes (for example an atomic increment, or a compare-and-set with a retry), its TTL, and its error behaviour.

## 6. Group D — cold start

**D1 — no shared store (today's configuration).** Force a cold start of exactly one instance, then immediately re-test the client that was refused:

- The refusal must be **gone** — counters are process-local and reset. Record the elapsed time and the number of requests admitted after the reset. This is the documented weakness: a cold start hands a client a fresh allowance.
- Then confirm the **edge's own budget still applied across the restart**. If the edge enforces no independent limit, a client can reset the app's counters at will by driving cold starts; record that as the dominant residual risk, because it means the edge-as-capacity-layer argument does not hold and SEC-02 cannot close on it.

**D2 — with a shared store.** A restart of one instance must **not** reset the deployment-wide ceiling: the refused client stays refused, or the aggregate stays capped. Pass is required before SEC-02's distributed half can be closed.

## 7. Recording the result, and the closure rule

Fill the template. Rules that make the file mean something:

- `status` at the top level starts as `unfilled`; a file with that status, or with any `met: null` left in a criteria array, is **not** evidence.
- Every group status is `pass`, `fail`, or `not-applicable`; `not-applicable` requires `notApplicableReason`.
- Record both test-time overrides and their restoration, the commit, the deployment ids, and the time window in UTC.
- Attach, beside the filled JSON: the per-instance `/api/health` bodies, the command logs, and the edge-configuration references or CLI output.
- Redact per [security-operations.md](security-operations.md): no secrets or bypass tokens, no raw response bodies that could carry Veteran data, no session payloads.

Three honest outcomes, and only these:

| If | Then SEC-02 closes as |
|---|---|
| A2 + A3 + B pass, C/D record the per-instance regime | "Admission verified at the edge; the enforced quota is **per instance** and documented; the edge is the capacity layer." Record `closure.closeableAs: "per-instance-quota-documented"`. Do **not** describe this as a distributed quota. |
| A2 + A3 + B pass, **and** C3 + D2 pass with a provisioned store | "Deployment-wide admission quota verified." Record `closure.closeableAs: "deployment-wide-quota-verified"`. |
| Any group fails | SEC-02 **stays open**, named with the failing group and the observed numbers. Record `closure.closeableAs: "stays-open"`. |

## 8. If a group fails

| Symptom | Likely cause | Action |
|---|---|---|
| A2: rotating valid IPs each get a fresh allowance | Edge passes the client-supplied header through instead of setting it | Configure the edge to overwrite the forwarding headers; do **not** set `RATE_LIMIT_TRUSTED_INGRESS=true` (it would record a false claim). |
| A3: 25 junk-header requests all succeed | Unattributed traffic is not charged to the ceiling in this build | Confirm the deployed commit contains the admission change; the ceiling is the control, so an uncharged unattributed request is the original defect. |
| B: the origin answers with the app's own body | The origin is directly reachable | Enable the platform's origin protection, or firewall the origin to the edge's egress only. |
| C2: aggregate is far above `ceiling × instances` | A per-client bucket is being minted per instance *and* the edge is not bounding aggregate | Re-check Group A first; then the edge WAF is the only remaining aggregate control. |
| D1: the edge does not bound traffic across a restart | No independent edge budget | Do not close on the "edge is the capacity layer" argument; either provision a store or record the reset as an accepted, named risk. |
| C3/D2: a store is provisioned but the aggregate is still `ceiling × instances` | The store is per-instance, or the increment is not atomic | The store must be a genuinely shared, atomic counter; a per-process cache is not one. |

## 9. Safety

- Run the ceiling probes against a **test** environment first; they exhaust a shared budget for real clients behind the same instance.
- Never point the probes at a shared production instance without owner approval and a recorded window; note the window in the evidence.
- These probes use synthetic identities and public, non-PHI routes only. Do not send real Veteran context, and do not attempt to bypass controls on a system you are not authorized to test.
- Restore `RATE_LIMIT_UNATTRIBUTED_MAX` and leave `RATE_LIMIT_TRUSTED_INGRESS` reflecting the truth the run established, then create a fresh deployment so the running configuration matches the evidence.
