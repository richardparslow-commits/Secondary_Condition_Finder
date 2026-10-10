# Decision: the default for the shared admission ceiling

**Decision (2026-10-09):** `RATE_LIMIT_UNATTRIBUTED_MAX` stays **6000 charges per 60-second window, per instance** (`UNATTRIBUTED_ADMISSION_MAX_DEFAULT` in [rate-limiter.ts](../src/lib/rate-limiter.ts)). The number does not change; what was missing was its reasoning, which is recorded here so the value is a derivation that can be re-derived rather than a constant that has to be trusted. How an operator reads, verifies and re-derives it in a deployment is in [deployment-readiness.md](deployment-readiness.md#shared-admission-ceiling-sec-02).

## What the number is, and why it cannot be tuned on the abuse case alone

[chargeAdmission](../src/lib/rate-limiter.ts) charges the shared ceiling on **every** request to a limited surface — whether or not a validated identity was resolvable — and then the per-client bucket when one exists. The ceiling is therefore two things at once:

- a bound on traffic that presents no usable identity, and on traffic that rotates identities so that no per-client bucket ever accumulates; and
- the per-instance **floor** on throughput for limited surfaces, because every honest request pays into it too.

Because it is both, it cannot be sized near the per-client allowance. If it were, honest traffic alone could consume it and one client could then deny every other client — which is exactly the defect the older shared `"unknown"` bucket represented. That is why the ceiling is a separate, named, deliberately generous budget, reported as its own number (`components.rateLimit.ceiling`) rather than as a relabelled per-client limit.

## Derivation

```
C = A × N
  A = 30   charges/minute — the tightest user-scale per-client allowance
  N = 200  concurrent clients on one instance, each at their FULL allowance
  C = 6000
```

**A = 30.** The shared, user-scale buckets are the reference-page reads, `/api/health`, and workflow-session POSTs, each at 30/minute. The two 5/minute limiters (regulatory preflight, admin cache-clear) are authenticated operator routes and are not user-scale, so 30 is the tightest allowance a real client can hold.

**N = 200.** The ceiling is per instance, so N is concurrency *on one instance*. Sizing it from each client's **full** allowance rather than typical usage is deliberate: it is the worst case for honest traffic, so the ceiling is conservative in the direction that protects users. At a typical browsing rate of a few requests per minute the same ceiling leaves room for well over a thousand concurrent clients on one instance.

**Charges, not requests.** A POST to a policed API route is charged to the workflow-session bucket *and* to its own route policy, so one request can consume two charges. The derivation counts charges as if they were requests, which makes the effective *request* ceiling slightly lower than 6000 for a POST-heavy mix — a small, named bias on the permissive side of the honest-traffic question, not a hidden one.

## The upper bound on C, and its honest status

C must be large enough for honest traffic **and** small enough that one instance can serve it. `6000 / 60 = 100` charges/second. `/api/health` is the heaviest limited route (it evaluates the catalog, the session-crypto probe, workflow-session readiness and the knowledge-base graph), and the reference routes are cache-backed or fall back locally, so 100 charges/second is treated as within one instance's capacity for these routes.

**That upper bound is asserted, not measured.** No per-instance throughput measurement for these routes is recorded in this repository, so the number is a reviewed assumption with a named falsifier — the triggers below — rather than a measured optimum. Stating that here is the point: an unmeasured bound that admits it is unmeasured is usable; one that presents itself as measured is not.

## Failure directions, and why the default is biased high

| Direction | Consequence |
|---|---|
| **Too low** | Self-inflicted denial. Honest requests share the budget with the attacker's, so a low ceiling turns abusive traffic into an outage for honest clients — and enough honest traffic can trip it on its own. |
| **Too high** | A weaker abuse bound. A key-rotating client is bounded at C instead of at the per-client allowance. The loss is bounded: each rotation still costs a request, the per-client bucket still applies to every identity it presents, and the edge WAF remains the capacity layer. |

The asymmetry decides the bias. Too high makes a guard weaker; too low breaks the product for real users — and this module's stated stance is that a limiter may be weaker than intended, but never wrong.

## What this number is not

The counter is process-local, so the fleet aggregate is about `C × instances`. This is **not** a deployment-wide quota, and `components.rateLimit.store` says so (`mode: "process-local"`, `blockedBy: "no-store-provisioned"`). The evidence required before it may be described as one — spoofed and missing headers at the real edge, direct-origin refusal, two instances and a cold start — is the operator procedure in [the SEC-02 hosted acceptance runbook](sec-02-hosted-acceptance-runbook-2026-10-09.md).

## Re-derivation triggers

| Trigger | Action |
|---|---|
| An honest client is refused *by the ceiling* (many distinct identities refused in the same minute) | Raise C, and record the new derivation beside this one. |
| A measured per-instance throughput for these routes falls below 100 charges/second on the production shape | Lower C to the measured sustainable rate. |
| Any per-client allowance (A) changes | Recompute `C = A × N`. |
| A shared counter store is provisioned | Re-derive C as a **fleet** figure, with N read as fleet-wide concurrency rather than per-instance. |
| The instance count changes materially | Nothing to change in C: the fleet bound is `C × instances`, and C stays a per-instance number. |

## What would replace this decision

A recorded load test of these routes on the production shape, or production CPU/latency observations taken at the ceiling, would replace the asserted upper bound with a measured one and make the derivation exact. Absent that, the value stays as derived above, with its falsifier named.
