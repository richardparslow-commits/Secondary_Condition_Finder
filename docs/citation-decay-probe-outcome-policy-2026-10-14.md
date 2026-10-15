# Probe-outcome policy — a host refusing the probe is not a decayed citation

**Status: APPLIED (repository side), 2026-10-14.** This record decides *what a failed probe means*. It records no verification decision, changes no reference, no source entity, no mapping, and no verification or publication state — and it moves no count that a qualified human owns. It corrects a false signal in the scheduled gate's own reporting.

Related: `docs/citation-verification-sop.md` ("Probe outcomes: a verdict or a refusal"), `docs/citation-digest-ineligibility-policy-2026-10-14.md` (the companion decision about what the probe can *digest*), `scripts/audit-citation-decay.js`, `.github/workflows/citation-decay-watch.yml`, `tests/citation-decay-throttle-policy.test.ts`, issue [#518](https://github.com/richardparslow-commits/Secondary_Condition_Finder/issues/518).

## The defect this closes

`npm run citations:decay` treats a failed HTTP probe as link rot, and link rot hard-fails the gate by design: a dead URL can never support a nexus. The probe has twice been corrected for hosts that punish bulk automated traffic — a bounded worker pool with per-host spacing replaced unbounded `Promise.all` after the 2026-09-21 run labelled all 370 live probes dead, and transient statuses gained exponential-backoff retries.

One failure mode survived both fixes: **the retry ignored the host's own instruction.**

A full live sweep of the corpus on 2026-10-14 measured it directly. Reproduced end-to-end through the CLI against a local host that answers `429` with `Retry-After: 60` (tmp/decay-e2e/run.mjs, a non-shipped harness), the **pre-change** script reports `FAIL` / `exit 1` with `linkRotCount: 1` and the refused URL in `decayed`, while the same corpus with the fix reports `PASS` / `exit 0` with the same URL disclosed as `throttled` and `probeCoveragePercent: 33.3`. On the real corpus (`npm run citations:decay`, 2026-10-14):

| Observation (real corpus, fixed code) | Value |
| --- | --- |
| live references / unique URLs probed | 1,704 / 1,487 |
| status and exit code | `PASS`, exit 0 |
| link rot / content drift / stale | 0 / 0 / 0 |
| unverifiable by this probe | **1,212 references** — 13 with an explicit `throttled` verdict carrying `Retry-After: 60`, 1,199 skipped after the host's cool-down |
| bot-walled (unverifiable) | 1 |
| URLs that produced a definitive verdict | 440 of 1,487 — **`probeCoveragePercent: 29.6`** |
| what the pre-change script did with those 201 `429` answers measured earlier the same day | filed them as `decayed` — **dead links** — gating the weekly watch and opening human re-verification work |

The host asked for a minute of quiet; the probe came back 1.5 seconds later, was refused again, and — because the retry budget ran out before the host's window did — filed the reference as a dead citation. A reference that was never checked was reported as one that had failed, which is the same class of false signal as issue #518 (a gate failing on a signal it did not earn), arriving through a different door.

The sweep also showed the two honest limits of the evidence. The `429` pattern is **intermittent and host-side**: re-measuring with the same probe against the same eight corpus URLs, at the same pacing, the host answered `HTTP 203` with the per-request anti-bot interstitial (5,590 bytes carrying a `challengeId`) on both HEAD and GET, and a deliberate 60-request burst with *zero* pacing produced `203` sixty times with no `Retry-After` at all. So the throttle window depends on what else has hit the host's rate limiter, not on this probe's pacing, and a fix verified against one host's current mood would be worthless. The policy below is therefore written as a rule about **what the host said**, which is checkable by unit and local-server tests without any host's cooperation (`tests/citation-decay-throttle-policy.test.ts`) and reproducible end-to-end without any host at all (the local-host harness above).

**The coverage figure is the finding, not a footnote.** Only 29.6 percent of the sweep produced a verdict, because one host holds ~94 percent of the corpus's URLs and refuses the probe for most of a full sweep. The gate is now honest about that — `PASS` over 440 checked URLs is a much narrower claim than `PASS` over the corpus, and both the step summary and any tracking issue say which one it is. Whether that refusal should instead be declared as a measured, expiring class (the treatment the digest-ineligibility register gives its own unachievable population) is the first standing follow-up below; it is a policy decision about how to spend the corpus's verification attention, not a defect this record can settle by itself.

## The decision

**Classification is by the host's answer, and only a definitive failure is decay.** `classifyProbeOutcome()` is the single place that decides, and it maps every probe result to exactly one of:

| Outcome | The host said | Effect |
| --- | --- | --- |
| `ok` / `drift` | the URL resolves; content matches or has changed | unchanged: drift stays inside the ceiling budget |
| `decay` | `404`, `410`, a persistent `5xx`, an unresolvable/refusing host (`ENOTFOUND`, `ECONNREFUSED`, `ERR_INVALID_URL`), or a failure with no identifying code at all | unchanged: **hard-fails the gate**, listed for re-verification |
| `throttled` | `425`, `429`, or **any** response carrying `Retry-After` | unverifiable by this probe: not decay, not gated, not human work |
| `unresponsive` | a transport failure on a host that answers other URLs (`timeout`, `ECONNRESET`, `EAI_AGAIN`, …) | unverifiable by this probe |
| `blocked` | `403`/`405`/`406` to both HEAD and GET | unchanged exemption: bot walls |

1. **`Retry-After` is honoured, up to a bound.** The wait is the larger of the exponential backoff and the host's own request, capped at `MAX_RETRY_AFTER_WAIT_MS` (15 s).
2. **A host asking for longer than the run can afford is believed, not out-waited.** The verdict returns immediately as `throttled` (`tests/citation-decay-throttle-policy.test.ts` asserts a `Retry-After: 60` host is classified in under 3 s, in one request). Spending the sweep's budget against a closed door is what produced the 201 phantom rows.
3. **Pacing adapts instead of hammering.** A throttled host's spacing doubles up to `MAX_HOST_SPACING_MS` (4.8 s) and halves back toward `PER_HOST_MIN_INTERVAL_MS` (0.6 s) on success — never below the floor, so "recovered" means polite again, not unthrottled. Per-host slots are *reserved* before a worker sleeps, so four concurrent workers cannot bunch up on one host.
4. **A host that keeps asking for quiet is dropped.** Each throttle episode restarts a bounded cooldown (`Retry-After`, capped at `MAX_HOST_COOLDOWN_MS` = 60 s), and after `MAX_HOST_THROTTLE_EPISODES` (3) episodes the host is skipped for the remainder of the run. Its remaining URLs are recorded as skipped-and-throttled (`reason: "host-throttle-cooldown"`), **not** as dead and **not** as absent. Throttling therefore *shortens* the sweep rather than extending it into the job's timeout.
5. **Coverage is stated wherever a verdict count is stated.** Because a run can end with part of the corpus refused, the report carries `probeCoveragePercent`, `definitiveVerdictUrlCount`, `unverifiableByProbeUrlCount` and `throttledUnverifiableCount` beside the existing `botBlockedUnverifiableCount`. The weekly step summary and the tracking-issue body both print them, and the tracking issue states in words that a throttled or unresponsive reference **was not checked** and needs no re-verification. "No link rot" over half the corpus is a narrower claim than "no link rot"; the reader must be able to tell which one they are reading.
6. **The job budget outlasts the sweep.** `decay-probe` moves from `timeout-minutes: 20` to `60`. ~1.7k URLs at two requests each, with a 0.6 s per-host floor plus latencies and bounded cool-downs, does not fit in 20 minutes — a cancelled probe reports nothing at all, which is the same false-negative shape one layer up.

## What this does not do

- **It verifies nothing.** No reference, source, mapping, digest, verification state or publication state changed. The classification decides what the *gate* may say, not what a citation means.
- **It does not claim a refused reference is healthy.** A `throttled` or `unresponsive` row is an admission that this run could not ask. The staleness tier and a qualified human's re-check remain the control for those references, and a reference that both refused the probe and sits past its tier still fails on staleness.
- **It does not weaken the hard-fail path.** The `decays` union and the ceiling are unchanged; a single `404` or `410` still fails the run. The classification only removes results that never earned a verdict.
- **It does not repeat the digest mistake.** The digest-ineligibility register exists because an *unachievable* population must be declared once, with a measurement and a review window, rather than re-counted weekly. This policy takes the lighter route on purpose: a refused probe is disclosed every run as a coverage figure, and a host that refused is by construction re-probed next week. A **standing follow-up** is to promote a permanently-probe-refusing host to a declared class (with its own measurement and review window) if it turns out to be rejected the same way every week — a decision this record does not make.
- **It does not make PubMed's pages digestible.** The 2026-10-14 companion record already declares `pubmed.ncbi.nlm.nih.gov` record pages digest-ineligible (the probe receives the per-request interstitial, so a digest there could never validate). A `203` interstitial is a *successful* probe by this policy, and stays that way; the two decisions are independent.
- **It does not close #518.** That issue's cause was the ratchet, and the companion record closes it. This one is the other half of a probe that had been reporting verdicts it had not obtained.

## Enforcement

| Surface | What it enforces |
| --- | --- |
| `scripts/audit-citation-decay.js` | `classifyProbeOutcome` is the single verdict; `Retry-After` parsing, bounded waits, adaptive spacing and the per-host circuit breaker; the coverage counts in the report |
| `tests/citation-decay-throttle-policy.test.ts` | the classification table; live local-server runs of the real HTTP path (`429` + `Retry-After: 60` → throttled in one request and under 3 s; recovery after a short `Retry-After` → the real verdict; `404`/`503` → decay; `403` → blocked); the gate's separation and its coverage arithmetic |
| `tests/citation-decay-probe-resilience.test.ts` | the pool, the politeness knobs and the transient-status retry contract that preceded this policy |
| `.github/workflows/citation-decay-watch.yml` | both human-facing surfaces print the throttled population and the coverage, and the tracking issue distinguishes "not checked" from "found dead"; the probe job's budget |
| `docs/citation-verification-sop.md` | states the four outcomes and that a refusal queues no human work |

## Standing follow-ups (not done here)

- **Decide what to do about the host that will not be probed.** The measured coverage of 29.6 percent is dominated by one host: `pubmed.ncbi.nlm.nih.gov` holds the overwhelming majority of the corpus's URLs and refuses most of a full sweep, so the weekly gate currently speaks for roughly a third of the corpus. Three options, none of them free: declare that host as a measured, expiring class (the digest-ineligibility treatment) and stop reporting it as weekly coverage; keep re-probing it every run and accept the low coverage as the cost of catching the day it stops refusing; or move the probe onto a stable, permitted retrieval path for the same references (NCBI `efetch`/`esummary`) the way the digest-ineligibility record already contemplates for content digests. The first is the cheapest and the least likely to hide a real decay; it is a policy decision, not a defect.
- **Consider making `unresponsive` reference-scoped.** A host that answers some URLs and times out on others is currently unverifiable *for the refused URLs only*, which is correct; a *corpus-wide* host outage is indistinguishable from a network fault inside the runner, and neither should look like 1,400 decay rows. The coverage figure makes that visible today; a future run could fail loudly when coverage collapses instead of reporting a sweep that never happened.
- **Anchor the sweep's own timing.** `probeCoveragePercent` is now recorded every run; a slow downward trend across weeks would say more about host throttling policy than any single run can.
