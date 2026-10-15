# VA.gov walkthrough probe — the scheduled watch that could not report route rot

**Status: APPLIED (repository side), 2026-10-14.** This record corrects a defect in the repository's own automation. It changes no product copy, no deep link, no verdict about VA.gov, and no user-facing claim.

Related: `scripts/probe-va-gov-links.js`, `.github/workflows/va-gov-walkthrough-probe.yml`, `tests/va-gov-walkthrough-probe-handoff.test.ts`, `tests/va-gov-walkthrough-probe.test.ts`, `src/lib/secondary-workflow/va-gov-record-walkthrough.ts`, and the sibling hand-off record for the citation-decay watch, `docs/citation-decay-probe-outcome-policy-2026-10-14.md`.

## The defect this closes

The weekly `va-gov-walkthrough-probe` workflow exists to catch **route rot**: when VA.gov renames or removes one of the routes the guided records-download walkthrough deep-links into, the probe must fail and a tracking issue must open so the walkthrough is corrected before a veteran hits a 404 mid-flow. It could not do the second half.

The probe writes its report to stdout when passed `--json`, and the workflow captures it with `> va-gov-walkthrough-probe-report.json` — but the probe also wrote its progress banner and every per-URL verdict line to stdout ahead of the JSON:

```
va-gov-walkthrough-probe: probing 8 walkthrough deep-link(s)…
  [alive] https://www.va.gov/?next=loginModal&oauth=true (status 200)
  …
{ "probedAt": "…", "status": "…", … }
```

Both readers of that file called `JSON.parse` on the **whole** capture. Measured on 2026-10-14 against a real run:

| Observation | Value |
| --- | --- |
| captured file's first line | `va-gov-walkthrough-probe: probing 8 walkthrough deep-link(s)…` |
| `JSON.parse(readFileSync(report))` | **throws** `SyntaxError: Unexpected token 'v', "va-gov-wal"... is not valid JSON` |
| the step-summary payload | throws the same way — and the workflow's `\|\| true` on that shell line swallowed it, so **the weekly summary was silently never written** |
| the `track-rot` payload, executed against that capture with a stubbed `gh` | died at `JSON.parse` **before a single `gh` call** — the tracking issue was never created or updated |
| what VA.gov deep-link rot would therefore look like | nothing. A green-looking run, no issue, no summary, and a veteran finding the 404 |

The failure is worst exactly when the probe matters: on a healthy run the summary is cosmetically empty, but on a run with a genuinely dead route the notification path — the workflow's entire purpose — is dead too. The repository had already met this class of defect once, in the citation-decay watch (`2026-09-28`: npm's script banner ahead of the report, `track-decay`'s `JSON.parse` died on it, no tracking issue). That fix was applied to one workflow; this is the same bug in the sibling, which is why the fix below is structural rather than a second one-off.

## The decision

1. **`--json` means stdout is exactly one JSON document.** Progress and per-URL lines go to **stderr** in that mode (they stay on stdout for the maintainer run, `npm run probe:va-gov-walkthrough`, which is unchanged). The routing lives in one small `createOutput({ json, stdout, stderr })` seam so it is testable without spawning a process or touching the network.
2. **Both readers still slice from the first `{`.** Belt and braces: with the capture now pure JSON this is redundant, and it is what keeps a future banner (npm's, a runner's, the probe's own) from killing the hand-off again.
3. **An absent or unusable report changes nothing and says so.** A probe that was cancelled, timed out, or never started is not evidence of route rot, so `track-rot` logs `No usable walkthrough probe report for this run (probe result: …)` and exits 0; the `link-probe` job's own red status reports the failure. The artifact download is `continue-on-error: true` so a missing artifact is not a second, confusing failure.
4. **The tracking issue is maintained in both directions.** `track-rot` now runs `if: always()`, opens or updates the issue when the probe failed, and **closes** it, with a comment, when a scheduled run is green. A notice that outlives its cause is its own false signal — the same reasoning that closed the equivalent gap in the decay watch.
5. **Unchecked routes are labelled as unchecked.** The issue body gains a short qualifier and a `## Unreachable (not checked — not dead)` section: the probe's request timed out, DNS failed, it exceeded its redirect allowance, or VA.gov answered a rate limit. Those rows are *not* findings about the route, and the body now says so where a human reads it.

## What this does not do

- **It changes no verdict.** `404`/`410` remain the only failing outcome; a login redirect is still the route being alive; server errors and unreachable results still do not fail the run. The probe's redirect allowance (`2` hops) and pacing (one GET per URL, 1.5 s apart, 8 URLs) are untouched.
- **It verifies no route by itself.** The live probe run of 2026-10-14 was **green** (8 deep links, all alive or auth-redirect), so no real dead route exists today to exercise the open path against. The defect and the fix are pinned instead by the captured banner-prefixed report, a synthetic dead-route report, the executed summary payload, and the executed tracking payload with a stubbed `gh`.
- **It is not witnessed on a GitHub runner.** The payloads were executed locally against real and synthetic captures; the runner's own behaviour (checkout, artifact upload/download, `gh` auth) is unchanged and untested here.
- **It does not fix the probe's own labelling.** A `429` from VA.gov is classified `unreachable`, the same bucket as a DNS failure or a redirect loop, and the probe does not honour `Retry-After` — the distinction the citation-decay probe now draws between *refused* and *broken*. With 8 URLs at 1.5 s spacing this is a low-impact conflation rather than a gating one, and it is recorded as a follow-up rather than bundled in here.

## Enforcement

| Surface | What it enforces |
| --- | --- |
| `scripts/probe-va-gov-links.js` | `--json` stdout is one JSON document; diagnostics on stderr; every human line routed through the seam |
| `tests/va-gov-walkthrough-probe-handoff.test.ts` | the routing (both modes, parsed as JSON); the **step-summary payload executed** against a pure-JSON and a banner-prefixed report; the readers' tolerance; `continue-on-error` on the download; open **and** close branches; the "NOT checked" disclosure |
| `tests/va-gov-walkthrough-probe.test.ts` | the verdict table and report aggregation (unchanged) |
| `.github/workflows/va-gov-walkthrough-probe.yml` | the capture comment, both tolerant readers, the unusable-report guard, and the both-directions issue maintenance |

## Standing follow-ups (not done here)

- **Neither probe's hand-off is exercised on a real runner.** Both are now guarded by local executions of their payloads with a stubbed `gh`; a scheduled run that failed to open its issue for a runner-specific reason (permissions, artifact name, `gh` version) would still only be visible in the run log.
- **Draw the refused-vs-broken distinction in this probe too.** `Retry-After`-aware pacing and a `throttled` verdict would match the citation-decay probe and stop a rate-limit response reading as a network fault.
- **Assert that a green run produced a report at all.** Today a probe that silently captured nothing and exited 0 would pass the summary step (which tolerates its own failure) and leave `track-rot` logging "no usable report" on a green job — visible, but not failing. Failing loudly on that shape would close the last hole in the hand-off.
