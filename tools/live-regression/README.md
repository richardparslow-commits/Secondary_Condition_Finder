# Live regression monitor

Randomized journeys against the **production** practice application
(`https://lifeinsurancebrokeradvocate.com/practice-application`), run on a schedule rather than only by hand, so a
regression that ships between releases surfaces without anyone remembering to look.

Three pieces, no duplicated test logic:

| File | Role |
|---|---|
| `live-suite.mjs` | the harness — randomized journeys, 30 checks (28 always, 2 only when a journey ticks a condition), same-seed replay, evidence capture, exit codes (suite v6) |
| `hydration-race-gate.mjs` | the React `#418` streaming-hydration race canary; reproduces the defect on demand and exits 1 while it is present |
| `monitor.mjs` | runs both, compares against `state/baseline.json`, and answers one question: **is any check failing now that was passing when the baseline was last accepted?** |

Promoted from `tmp/lppa-live-tests/` (gitignored scratch) on 2026-10-15; the working copies and every raw campaign
result stay there. The investigation behind the checks is versioned in `notes/` — `AUDIT.md` (issue register),
`VERIFICATION-LOG.md` (per-issue evidence), `HYDRATION-ROOT-CAUSE.md` (the `#418` root cause and the scheduler-gate
patch), `LIVE-TEST-REPORT.md` (the 100-journey campaign, the 200-journey campaign of §8, and the throttled replay of §9).

## Run it

```bash
cd tools/live-regression
npm ci                                  # playwright only
npx playwright install chrome           # the harness uses real Chrome (channel: chrome)
node monitor.mjs                        # 8 journeys + 20 race-canary loads
node monitor.mjs --runs=25 --race=30 --kbps=1500 --latency=20     # a heavier sweep
node monitor.mjs --url=http://localhost:3000/practice-application # race canary against a local build
node live-suite.mjs --runs=50 --seed=505                          # the suite directly
node live-suite.mjs --only=45 --seed=404 --viewport=mobile --kbps=400 --latency=150   # one journey, slow link
```

Exit codes — the workflow and any cron wrapper gate on these:

| Code | Meaning |
|---|---|
| 0 | no newly failing check (known failures are reported, not re-raised) |
| 1 | at least one **newly failing** check, or the race canary regressed |
| 2 | the monitor itself could not run (harness error, unreadable output) — not an application verdict |

Useful switches: `--seed=<n>` (pin a run), `--suite-extra=--injectHydration=1` (test-only: proves the monitor can go
red), `--update-baseline`, `--quiet`, `--webhook=<slack-compatible-url>` (+ `--webhook-always`).

The suite's own switches that matter day to day: `--runs=<n>`, `--concurrency=<n>`, `--seed=<base>`,
`--viewport=desktop|mobile|random`, `--only=<n>` (run a single journey by index — the way to replay one seed),
`--kbps=<n> --latency=<ms>` (throttled runs: per-page CDP emulation with the race gate's parameters, and navigation
timeouts widened to 180 s so a slow link cannot manufacture harness failures), `--checkpoint=<file> --resume`,
`--noEvidence`, `--headful`. Every summary records which profile ran (`throttle`) and which revision produced it
(`suiteVersion`).

## The opt-in submission test

`e2e-send-submission.mjs` is the only script in this directory — and, as far as we know, in the repository — that
deliberately sends real email. Everything else here stops at the browser: the suite aborts every request to the
submission backend, so it can prove *no submission left the browser* but never that a submission that the app
accepted then reached an inbox. This is the test for the second question.

It fills the live worksheet with unmistakably synthetic data (`QA-SYNTHETIC-E2E-<stamp>#<n>` in every free-text field,
`qa+synthetic-<stamp>-<n>@example.com` as the contact address), ticks both consent boxes, drives the form to the
application's own sendable state, submits through the real UI, and records what actually left: the payload, the
response, and the on-screen confirmation.

```bash
cd tools/live-regression
node e2e-send-submission.mjs --dry                              # rehearse: capture the payload, send nothing
E2E_SEND_CONFIRM=I-understand-this-sends-real-email \
  node e2e-send-submission.mjs --confirm-send                   # 3 real submissions
```

Two independent guards, because a misfire sends real email to a real inbox: `--confirm-send` **and** the exact
`E2E_SEND_CONFIRM` string. Without both it refuses and exits 2. Use `--submissions=<n>`, `--url=<target>`, `--quiet`,
`--headful` to vary a run. It is deliberately **not** scheduled — a monitor that emails the owner three times a night
is not a monitor.

### What it verifies

| Claim | How it is checked |
|---|---|
| the form reaches a valid state | clicking Submit only reaches the backend once every rule passes, so a refused write is the evidence — the same signal in `--dry` and live |
| the consent boxes are really ticked | each is found by the app's own error wiring (`aria-describedby="… error-consent_contact\|error-consent_disclaimer"`) and re-read until the app stops complaining |
| consent is actually recorded | `application.consents.consent_contact` / `consent_disclaimer` in the captured payload |
| the synthetic data is identifiable in the email | the `QA-SYNTHETIC-E2E-…` marker and the contact address, located by path in the payload |
| the submission was accepted | response status plus the on-screen confirmation after the real click |

Artifacts: `results/e2e-send-<stamp>.md` (the human receipt, including the inbox search strings) and
`results/e2e-send-<stamp>.json` (the raw record). Both are gitignored. Exit 0 means every submission was accepted
(rehearsal: every submission reached the sendable state); exit 1 means at least one did not.

### Safety: writes are refused by default

The first version of this harness allowed anything whose URL did not look like the submission endpoint. That is not
good enough: it let a real `POST` through in `--dry` (see below), and it would have blocked the real submission anyway,
because the endpoint it guessed is not the one the page uses. Every non-GET/HEAD/OPTIONS request is now refused unless
it is the submission itself **and** the run is authorised. Refusing and recording is also how the endpoint was found
rather than guessed — `POST https://lifeinsurancebrokeradvocate.com/api/public/practice-application` — and it is why
the page's own first-party telemetry (`/__l5e/trackevents`, three writes per load) never leaves during a test run: no
synthetic lead is registered anywhere.

### Known state of the live submission path (recorded 2026-10-16)

The endpoint is deployed but cannot deliver: it answers **503 `{"error":"Email delivery is not configured"}`** to a
valid, fully-consented submission. So the last leg — the email in the inbox — cannot be verified end to end until the
site's mail delivery is configured; every attempt is recorded as `sent: false` with that body in the receipt, and a
live run exits 1 rather than reporting success. This is the deployed site's configuration, not this repository's: the
endpoint's code is not in this repo. When delivery is configured, `--dry` then `--confirm-send` completes the chain.

### Read-only recon probes

`recon-submit.mjs` and `probe-consent-state.mjs` are the read-only probes used to learn the submit contract and the
consent wiring above (they never submit; the send path is aborted). They are kept because the next person to touch the
form needs the same answers, and because the contract in the table above should be re-verifiable rather than trusted.

## Baseline lifecycle

`state/baseline.json` records the last **accepted** state: every check with its failure count, plus the race canary's
recorded mismatch count. A check failing now that had zero failures in the baseline is *newly failing* (exit 1); a
check already failing there is *known* and reported without re-raising; a check that fails in the baseline and passes
now is *recovered*.

When a change is intended — a new check appears, an accepted regression is being tracked, or the race canary is fixed
— accept the current state:

```bash
node monitor.mjs --update-baseline      # writes what it just measured as the new baseline, exits 0
```

The shipped baseline was seeded from the 100/100 desktop + 25/25 mobile campaign. Its **race canary entry is a
deliberate known failure**: the React `#418` race reproduces ~20/20 at 400 kbps / 150 ms (see
`notes/HYDRATION-ROOT-CAUSE.md`), so the canary is tracked, not newly failing. It flips to recovered — and should be
accepted — once the scheduler gate ships in the application.

### The record's name must not collide with a dynamic read

Each run rewrites `state/last-verdict.json`: the one-word verdict, the check names it raises, and the race canary. It is
deliberately **not** called `latest.json`, and the name is not cosmetic. The app's regulatory preflight cache reads
`path.join(cacheDir, "latest.json")` with a runtime cache directory, so the bundler cannot bound the path and resolves
that basename against the project — a same-named file is traced into the server artifacts that touch the cache, and
`npm run audit:traces` fails on it (it did, on exactly this file). A generated record is not worth a deployment gate, so
the name stays.

### Flakes are reported, not raised

The harness replays a failing journey with the same seed; a failure that does not reproduce is classified as a flake
(`flaky: true`) and counted as a passed run. The monitor therefore recomputes its per-check tallies from the run
records — only a run that **stayed** failed can raise a check — and lists the wobbles under **Flakes** instead. This
is not cosmetic: the React `#418` race is intermittent, so reading the suite's per-check tallies at face value raised
it on every wobble even though the harness had already attributed that wobble to timing. A rising flake count in the
report is the early warning that precedes a reproducible regression; the exit code remains a function of reproduced
failures only.

## Schedule

`GitHub Actions`: [`.github/workflows/live-regression-monitor.yml`](../../.github/workflows/live-regression-monitor.yml)
runs daily at **05:23 UTC** (off the hour, offset from the repository's other scheduled workflows), on
`workflow_dispatch` too, with `runs`/`race` inputs. On a new failure it opens or comments a scoped tracking issue with
the monitor's report and uploads the artifacts; when the monitor is green again it closes that issue, the same pattern
the repository's other scheduled gates use.

`cron`, if you would rather not involve Actions:

```cron
# daily 05:23, log to a file, alert slack-compatible webhook on a new failure
23 5 * * * cd /path/to/repo/tools/live-regression && MONITOR_WEBHOOK_URL=https://hooks.slack.com/... /usr/bin/env node monitor.mjs --runs=8 --race=20 >> /var/log/live-regression.log 2>&1
```

Either way the artifacts to triage from are `results/monitor-<stamp>.{md,json}`, the per-journey detail in
`results/monitor-suite-<stamp>.json`, and `results/evidence/` (screenshot + HTML + console at the moment of failure).
