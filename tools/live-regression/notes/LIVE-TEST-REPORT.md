# Live acceptance testing — practice application

**URL:** https://lifeinsurancebrokeradvocate.com/practice-application
**Deliverable:** randomized journeys against the live production build in real Chrome, every issue found, and a fix +
verification for each one. Companion documents: `AUDIT.md` (issue register and fix plans),
`VERIFICATION-LOG.md` (per-issue evidence), `HYDRATION-ROOT-CAUSE.md` (the hydration investigation in full).

## 1. Result

| Campaign | Journeys | Passed | App failures | Harness failures | Flakes | Builds seen |
|---|---|---|---|---|---|---|
| Desktop, randomized (2026-10-16) | 100 | **100/100** | 0 | 0 | 0 | 2 builds (psr2.bd8cab47-114d-4ba0-ba30-1e3301938704, psr2.1f54172e-84c8-4c52-a262-75bfa8157f61) |
| Phone viewport | 25 | **25/25** | 0 | 0 | 0 | single |
| **200-journey campaign**, 100 desktop + 100 mobile (2026-10-16, later suite revision: 30 checks) | 200 | **200/200** | 0 | 0 | 0 | single (`psr2.4f0b2707-c408-44bc-81de-db4f6e8c9a71`) |

The 200-journey campaign is written up in **§8** — the largest run to date and the first that can be read as one result
across its whole length (one build, start to finish).


Each desktop journey starts from a random seed and does the real thing: identity fields by label, randomized condition
ticking by accessible name, randomized Yes/No per section, reload, autosave, save, print, clear-draft, and asserts that
nothing was ever submitted off the device. Surface covered across the 100 journeys:

- 1. Health / Medical: reached in 100/100
- 2. Mental Health: reached in 47/100
- 3. Nicotine / Smoking: reached in 45/100
- 4. Alcohol: reached in 46/100
- 5. Risky Behavior: reached in 47/100
- 6. Driving Record: reached in 40/100
- 7. Arrest / Criminal Record: reached in 41/100
- 8. Bankruptcy: reached in 47/100
- 9. Illegal Drug Use: reached in 51/100
- 10. Residency & Foreign Travel: reached in 50/100
- 11. Occupation & Financial: reached in 51/100
- 12. Military Service: reached in 39/100
- 1681 Yes and 1661 No answers placed; 87 free-text fields filled; 151 condition boxes ticked across 54 distinct conditions.
- **0** submissions left the browser; **0** requests blocked by the rig.

Builds covered: psr2.bd8cab47-114d-4ba0-ba30-1e3301938704 runs 1–36: **36/36** passed · psr2.1f54172e-84c8-4c52-a262-75bfa8157f61 runs 37–100: **64/64** passed — a deploy landed mid-campaign, so this is two builds read together (the harness detects and records it rather than hiding it).

### 1.1 Desktop checks

| Check | Pass | Fail |
|---|---|---|
| `http_2xx` | 100 | 0 |
| `no_bot_challenge` | 100 | 0 |
| `disclaimer_visible` | 100 | 0 |
| `counter_starts_at_zero` | 100 | 0 |
| `identity_inputs_accept_values` | 100 | 0 |
| `condition_checkboxes_accept_selection` | 77 | 0 |
| `ticking_conditions_keeps_page_healthy` | 77 | 0 |
| `every_answer_counts_at_most_once` | 100 | 0 |
| `counter_never_over_counts_answers` | 100 | 0 |
| `counter_tracks_observed_advances` | 100 | 0 |
| `counter_never_exceeds_max` | 100 | 0 |
| `autosaves_draft_without_clicking_save` | 100 | 0 |
| `counter_restored_after_reload` | 100 | 0 |
| `answers_restored_after_reload` | 100 | 0 |
| `identity_restored_after_reload` | 100 | 0 |
| `consent_boxes_not_persisted` | 100 | 0 |
| `save_draft_gives_feedback` | 100 | 0 |
| `print_invokes_window_print` | 100 | 0 |
| `clear_draft_resets_state` | 100 | 0 |
| `no_console_errors` | 100 | 0 |
| `no_page_errors` | 100 | 0 |
| `no_hydration_mismatch` | 100 | 0 |
| `no_hydration_dom_wipe` | 100 | 0 |
| `no_failed_requests_from_app` | 100 | 0 |
| `no_submission_left_the_browser` | 100 | 0 |
| `no_swallowed_errors` | 100 | 0 |

Checks per journey: **26**. Median journey 18.3s, slowest 28.8s.

### 1.2 Phone-viewport checks

| Check | Pass | Fail |
|---|---|---|
| `http_2xx` | 25 | 0 |
| `no_bot_challenge` | 25 | 0 |
| `disclaimer_visible` | 25 | 0 |
| `counter_starts_at_zero` | 25 | 0 |
| `identity_inputs_accept_values` | 25 | 0 |
| `condition_checkboxes_accept_selection` | 25 | 0 |
| `ticking_conditions_keeps_page_healthy` | 25 | 0 |
| `every_answer_counts_at_most_once` | 25 | 0 |
| `counter_never_over_counts_answers` | 25 | 0 |
| `counter_tracks_observed_advances` | 25 | 0 |
| `counter_never_exceeds_max` | 25 | 0 |
| `autosaves_draft_without_clicking_save` | 25 | 0 |
| `counter_restored_after_reload` | 25 | 0 |
| `answers_restored_after_reload` | 25 | 0 |
| `identity_restored_after_reload` | 25 | 0 |
| `consent_boxes_not_persisted` | 25 | 0 |
| `save_draft_gives_feedback` | 25 | 0 |
| `print_invokes_window_print` | 25 | 0 |
| `clear_draft_resets_state` | 25 | 0 |
| `no_console_errors` | 25 | 0 |
| `no_page_errors` | 25 | 0 |
| `no_failed_requests_from_app` | 25 | 0 |
| `no_submission_left_the_browser` | 25 | 0 |
| `no_swallowed_errors` | 25 | 0 |

Checks per journey: **24**. Median journey 18.9s, slowest 27.4s.

## 2. The first pass, read correctly

The first campaign (`results/live-100-build-bd8cab47.json`) reported 13 failures and looked alarming. It was not: 12
were the harness ticking condition boxes it had already unticked (one journey ticked and unticked the same box 5 times),
and 1 was a genuine but rare React hydration error. After the rig was repaired, the same suite ran
**clean** — every previously "failing" journey now passes, and
nothing in the application changed: the check that produced 12 of those failures
(`condition_selection_renders_followups`) became `ticking_conditions_keeps_page_healthy` and went from
66 pass / 12 fail to 77 pass / 0 fail among the journeys that ticked a condition (that check only runs for those;
78 of 100 first time, 77 of 100 now). That distinction — rig
defect vs application defect — is logged issue by issue in `VERIFICATION-LOG.md`.

## 3. Issues found, and what each one needed

| # | Issue | Severity | Fix | Status |
|---|---|---|---|---|
| A1 | Google ad frames plus hosting analytics load on a page that collects diagnoses, medication, mental-health, substance-use and criminal-record answers | S1 | Gate the ad unit off the route, move `adsbygoogle.js` out of the root document, promote the report-only CSP to enforcing | Ready to apply — needs the app repository |
| A2 | One journey logged `React #418` (element-level hydration mismatch); same-seed replay clean | S2 | **Traced to facebook/react#37321** (React 19 streaming hydration overtaking the HTML parser) and **reproduced 20/20**; patch-package scheduler gate, or non-streaming shell | Diagnosis complete; patch ready — see §4 |
| A3 | 13 condition items (nicotine, risky behaviour) give no visible feedback when ticked — their questions live in other sections | S3 | Remove the duplicates from the health list or show a hint on tick that links to the owning section | Ready to apply — needs the app repository |
| A4 | Counter reports "Main questions answered" and counts 62 of 74 groups | — | None: the label is accurate and the remainder are conditional sub-questions | Closed, not a defect |
| A5 | Production redeployed mid-session (build `631bea88` → `bd8cab47`) | S4 | Harness now pins and reports the build; release side: deploy outside campaign windows | Harness half done |

## 4. The hydration mismatch, in short

Reproduced on demand: **20/20** journeys threw the campaign's exact error
(`Minified React error #418 … args[]=HTML&args[]=`) at 400 kbps / 150 ms with a warm client cache — versus **0/30** at a
milder 1500 kbps, which is why the original occurrence looked random (1 in 100). The rival explanations were
measured and rejected:
a saved draft rendered at first paint produced 1 mismatch in 180 targeted loads across the three scenarios
(A no-draft 0/30, B draft pre-seeded 1/30 then 0/120 in the retained artifact `results/hydration-probe.json`, C load→answer→reload 0/30),
and 40/40 loads showed no script writing to `<html>` at all.
The upstream defect is a race in React's streaming hydration, not the application's markup: the server HTML is correct
and React re-renders the document. The fix is the upstream reporter's verified scheduler gate
(4/12 cold boots failing unpatched vs 0/36 gated) — full detail, patch text and verification plan in
`HYDRATION-ROOT-CAUSE.md`.

The randomized suite now gates this class of failure directly: `no_hydration_mismatch` and `no_hydration_dom_wipe`
are exit-gating checks, verified green on a clean pilot (6/6) and verified to have teeth by injecting a synthetic `#418` (1 app failure, exit 1).
A mismatch can no longer hide behind still-green functional assertions if it recurs in future campaigns.

## 5. The rig, and why its defects matter

Twelve harness defects were found and fixed in this workspace (list and evidence in `VERIFICATION-LOG.md` §Class B):
the ticker toggling Radix checkboxes back off, a false radiogroup assertion, a hardcoded question maximum, unclassified
third-party noise, silent `catch(() => {})` steps, no flake/evidence/exit-code handling, and — new today — no dedicated
hydration check. Each was verified by a command whose result would have differed before the fix: injected failures
still fail (exit 1), injected flakes are classified and exit 0, `--injectHydration` fails only the hydration gate, and
the pilot is green.

## 6. What remains

1. Apply A1/A3 and the A2 patch in the application repository (Lovable project or its GitHub export — the source is not
   on this machine), then re-run `hydration-race-gate.mjs` and the suite; both are ready to run as-is.
2. Release-side: deploy outside test windows and expose the build id in the page footer.
3. Keep the gate in CI: `node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150` plus
   `node live-suite.mjs --runs=100 --seed=42` per release.

## 7. Artifacts

```
live-suite.mjs              randomized suite (30 checks — 28 always, 2 conditional; replay, evidence, exit codes)
hydration-race-gate.mjs     reproduces the React streaming-hydration race; exits 1 when seen
probe-hydration.mjs         the draft-at-first-paint hypothesis (A/B/C scenarios)
probe-html-mutation.mjs     traps writes to <html> and reports who made them
run-200-campaign.sh         four checkpointed batches of 50 = the 200-journey campaign (§8)
results/                    every campaign, probe, replay and injection run, with the evidence/ attachments
  campaign-200-b{1..4}.*    the 200-journey campaign: per-journey records, checkpoints and full run logs
  aggregate-200.mjs         regenerates campaign-200-aggregate.json (the rollup §8 is written from)
  issue008-console-location-probe.mjs   how a failed third-party request is mirrored host-less (ISSUE-008)
  issue008-replay.json      the throttled replay of journey 45 / seed 404001256 (ISSUE-008 verification)
AUDIT.md                    issue register, severities and ready-to-apply fix plans (Class C = the 200 campaign)
VERIFICATION-LOG.md         per-issue fix + verification, and the source-availability note
HYDRATION-ROOT-CAUSE.md     the hydration root cause, reproduction and patch
```

## 8. The 200-journey campaign (2026-10-16)

200 randomized journeys against the live route: **200/200 passed, 0 app failures, 0 harness failures, 0 flakes, one
build**. The register that comes out of it — deduplicated by root cause, prioritized, with step-by-step fixes — is
`AUDIT.md` Class C.

### 8.1 How it was run

`run-200-campaign.sh`: four bounded batches of 50, alternating viewport, each with its own seed base, each with its
own checkpointed JSONL (`--checkpoint=… --resume`), so a batch that dies resumes instead of restarting.
`--concurrency=4`, `--runs=50` per batch.

| Batch | Viewport | Seed arg | Seeds (first–last) | Journeys | Passed | Started (UTC) | Wall clock |
|---|---|---|---|---|---|---|---|
| b1 | desktop | 101 | 101000303–101000352 | 50 | 50/50 | 2026-10-16T03:44:02Z | 4m 30s |
| b2 | mobile | 202 | 202000606–202000655 | 50 | 50/50 | 2026-10-16T03:48:34Z | 4m 50s |
| b3 | desktop | 303 | 303000909–303000958 | 50 | 50/50 | 2026-10-16T03:53:25Z | 4m 34s |
| b4 | mobile | 404 | 404001212–404001261 | 50 | 50/50 | 2026-10-16T03:58:00Z | 4m 08s |
| **all** | 100 desktop + 100 mobile | — | 101000303–404001261 (**200 distinct**) | **200** | **200/200** | 03:44:02Z | **18m 02s** |

Every journey used a distinct seed, so no journey repeated another's path; the four batches are independent samples.
The suite revision behind this campaign was `v5`; the current revision is `v6`, which carries ISSUE-008's classifier
change and not a change of check count — the same 30 checks ran here (the campaign artifacts say `v5` because that is
what produced them).

### 8.2 Execution summary

| Metric | Value |
|---|---|
| Journeys | **200** (100 desktop · 100 mobile) |
| Passed | **200/200** |
| App failures | **0** |
| Harness failures | **0** |
| Flakes | **0** — 200 first attempts, 200 recorded, 0 replays |
| Checks per journey | **30** (28 always, 2 only when the journey ticked a condition — §8.3) |
| Seeds | 101000303–404001261, 200 distinct, contiguous within each batch |
| Build | **single**: `psr2.4f0b2707-c408-44bc-81de-db4f6e8c9a71` for all 200 journeys (the raw `x-deployment-id` carries a per-response suffix; the suite compares the `psr2.<uuid>` prefix — 174 distinct raw ids, one build) |
| Submissions made | 0 |
| Requests refused by the rig | 0 |
| Data-leak suspects | 0 |
| Soft (swallowed-step) errors | 0 |
| Runs with third-party errors | 2 (mobile, b4) — classified out of app failures by host, see §8.5 |
| Median / slowest journey | 20.4 s / 34.2 s |

“App failures 0” means no exit-gating check failed in any journey, including the hydration gates and the four
robustness/privacy checks added since the 100-journey campaign (`toggling_yes_to_no_hides_followups`,
`toggling_yes_to_no_leaves_no_orphaned_answers`, `no_application_data_leaves_device`, `no_horizontal_overflow`).

### 8.3 Checks, aggregated over all 200 journeys

| Check | Ran | Pass | Fail |
|---|---|---|---|
| `http_2xx` | 200 | 200 | 0 |
| `no_bot_challenge` | 200 | 200 | 0 |
| `disclaimer_visible` | 200 | 200 | 0 |
| `counter_starts_at_zero` | 200 | 200 | 0 |
| `identity_inputs_accept_values` | 200 | 200 | 0 |
| `every_answer_counts_at_most_once` | 200 | 200 | 0 |
| `counter_never_over_counts_answers` | 200 | 200 | 0 |
| `counter_tracks_observed_advances` | 200 | 200 | 0 |
| `counter_never_exceeds_max` | 200 | 200 | 0 |
| `autosaves_draft_without_clicking_save` | 200 | 200 | 0 |
| `counter_restored_after_reload` | 200 | 200 | 0 |
| `answers_restored_after_reload` | 200 | 200 | 0 |
| `identity_restored_after_reload` | 200 | 200 | 0 |
| `toggling_yes_to_no_hides_followups` | 200 | 200 | 0 |
| `toggling_yes_to_no_leaves_no_orphaned_answers` | 200 | 200 | 0 |
| `consent_boxes_not_persisted` | 200 | 200 | 0 |
| `save_draft_gives_feedback` | 200 | 200 | 0 |
| `print_invokes_window_print` | 200 | 200 | 0 |
| `clear_draft_resets_state` | 200 | 200 | 0 |
| `no_console_errors` | 200 | 200 | 0 |
| `no_page_errors` | 200 | 200 | 0 |
| `no_hydration_mismatch` | 200 | 200 | 0 |
| `no_hydration_dom_wipe` | 200 | 200 | 0 |
| `no_failed_requests_from_app` | 200 | 200 | 0 |
| `no_submission_left_the_browser` | 200 | 200 | 0 |
| `no_application_data_leaves_device` | 200 | 200 | 0 |
| `no_horizontal_overflow` | 200 | 200 | 0 |
| `no_swallowed_errors` | 200 | 200 | 0 |
| `condition_checkboxes_accept_selection` † | 146 | 146 | 0 |
| `ticking_conditions_keeps_page_healthy` † | 146 | 146 | 0 |

† Run only when the journey's random draw selected at least one condition to tick — `MIN_CONDITIONS` defaults to 0
(`live-suite.mjs:59`) and `wantTicks = Math.max(MIN_CONDITIONS, Math.floor(r() * 4))` (`:350`), so roughly a quarter of
journeys tick none and the checks are skipped by design, not abandoned (`:364`, `:375`). All 146 journeys that ticked
a condition asserted, and all 146 passed. This is a coverage number, not a defect.

### 8.4 Surface coverage across the 200 journeys

| Section | Journeys reached |
|---|---|
| 1. Health / Medical | 200/200 |
| 2. Mental Health | 98 |
| 3. Nicotine / Smoking | 93 |
| 4. Alcohol | 89 |
| 5. Risky Behavior | 87 |
| 6. Driving Record | 88 |
| 7. Arrest / Criminal Record | 94 |
| 8. Bankruptcy | 96 |
| 9. Illegal Drug Use | 90 |
| 10. Residency & Foreign Travel | 92 |
| 11. Occupation & Financial | 101 |
| 12. Military Service | 89 |

- **3,377 Yes** and **3,301 No** answers placed; 0 Not Sure (the live form offers only Yes/No — the harness draws
  Not Sure and falls back, `live-suite.mjs:279–293`).
- **206 free-text fields** filled with synthetic markers; **288 condition boxes** ticked across **59 distinct conditions**.
- **648 follow-up groups** rendered and answered.
- Answer counter reached at most **57** of a page-declared maximum of **63**; `counter_never_exceeds_max` passed 200/200.
- **0** submissions, **0** requests refused by the rig, **0** data-leak suspects, **0** soft errors.

### 8.5 Evidence seeds

**There are no failing seeds: 0 of 200 journeys failed.** The only non-pass-shaped signals in the campaign, with their
exact seeds, are:

| Signal | Seeds | What it is |
|---|---|---|
| Third-party ad-frame errors (CSP report-only `frame-ancestors` violation + `ERR_BLOCKED_BY_ORB` from `csp.withgoogle.com`) | 404001250, 404001254 (both mobile) | classified as third-party by host (`live-suite.mjs:87`), so they did not fail `no_console_errors`; live evidence for ISSUE-002 |
| Condition ticks that added **no** new control anywhere on the page | 101000315, 101000325, 101000345, 202000622, 202000636, 202000637, 303000911, 303000914, 303000944, 303000950, 404001242 | 11 of the 146 condition-ticking journeys (135 of the 146 saw new controls appear); the boxes involved are listed in `AUDIT.md` ISSUE-004 / ISSUE-005 |

Replay any of them against the live build with:

```bash
node live-suite.mjs --runs=1 --seed=202000637 --viewport=mobile --headful
```

### 8.6 What this campaign does not prove

- **Not a submission test.** The suite aborts the submission endpoint and asserts nothing left the browser; 0 submits
  by design. The end-to-end send test (`e2e-send-submission.mjs`) is separate and currently blocked by the deployed
  backend: a valid, fully-consented submission answers **503 `{"error":"Email delivery is not configured"}`**
  (`results/e2e-send-2026-10-16T01-38-17.md`, recorded 2026-10-16) — carried as **ISSUE-001** in `AUDIT.md` Class C.
- **Unthrottled network only.** All 200 journeys ran at full speed — the slow-network replay of the same 200
  journeys is §9 (and the narrower gate conditions remain in `hydration-race-gate.mjs`).
- **No assistive-technology pass.** The evidence is DOM/ARIA state and measured geometry, not screen-reader output.
- **Black-box.** The route is a hosted build; the application's source is not on this machine (`AUDIT.md` §0), so
  nothing here proves anything about code in any repository.

### 8.7 Reproduce and re-roll

```bash
bash run-200-campaign.sh                                   # the whole 200 (resumes completed batches)
node results/aggregate-200.mjs                             # regenerate the rollup below
node live-suite.mjs --runs=50 --concurrency=4 --seed=505 --viewport=desktop --checkpoint=results/campaign-200-b5.jsonl --resume --out=results/campaign-200-b5.json
```

Artifacts: `results/campaign-200-b{1..4}.{json,jsonl,log}` (per-journey records and the full run logs),
`results/campaign-200-aggregate.json` (the rollup every number above is taken from, generated by
`results/aggregate-200.mjs`).

## 9. The throttled replay (2026-10-16): production-realistic reliability

§8 measured 0 hydration errors in 200 unthrottled journeys, while `hydration-race-gate.mjs` reproduces React `#418`
on demand at 400 kbps / 150 ms. This section closes that gap: the **exact same 200 journeys** — same seeds, same
viewports, same suite — replayed under the gate's network profile, to answer *how often the defect fires for a user
on a slow link* rather than only *whether it can fire*.

### 9.1 How it was run

The suite gained `--kbps` / `--latency` (`live-suite.mjs:29`, `:60–62`): a per-page CDP session applies
`Network.emulateNetworkConditions` with the gate's exact parameters (`:174–188`), and navigation timeouts widen to
180 s so a slow link cannot manufacture harness failures (`:187`, `:302`). Every run records its profile
(`throttle` in the summary, `:617`). Campaign: four checkpointed batches of 50, `--concurrency=4`, same seed bases
as §8, artifacts `results/campaign-200t-*`; runner `results/run-200-throttled.sh`; rollup
`results/campaign-200t-aggregate.json` (`results/summarize-throttled.mjs`).

| Batch | Viewport | Seeds | Journeys | Result | Flakes | Wall clock | Median journey |
|---|---|---|---|---|---|---|---|
| b1 | desktop | 101000303–101000352 | 50 | 50/50 | 0 | 15.2 min | 71.1 s |
| b2 | mobile | 202000606–202000655 | 50 | 50/50 | 0 | 15.4 min | 71.6 s |
| b3 | desktop | 303000909–303000958 | 50 | 50/50 | 2 | 15.6 min | 69.7 s |
| b4 | mobile | 404001212–404001261 | 50 | 50/50 | 1 | 15.2 min | 69.7 s |
| **all** | 100 desktop + 100 mobile | 101000303–404001261 | **200** | **200/200** | **3** | **61.4 min** | **70.3 s** |

### 9.2 Result

| Metric | Throttled (400 kbps / 150 ms) | Unthrottled (§8) |
|---|---|---|
| Journeys passed | **200/200** | 200/200 |
| App failures | **0** | 0 |
| Harness failures | **0** | 0 |
| Flakes (recovered on same-seed replay) | **3** | 0 |
| Hydration mismatch (`#418`) | **0** in 202 recorded attempts | 0 in 200 |
| Hydration DOM wipe | **0** | 0 |
| Median / slowest journey | 70.3 s / 83.5 s | 20.4 s / 34.2 s |
| Wall clock | 61.4 min | 18.0 min |
| Build | single `psr2.eab40132-73a6-43a7-83ea-32cf0eb9d9c6` | single `psr2.4f0b2707-c408-44bc-81de-db4f6e8c9a71` |
| Third-party error journeys | 6 | 2 |
| Submissions / leaks / soft errors | 0 / 0 / 0 | 0 / 0 / 0 |

All 30 checks are clean at journey level: **200/200** for the 28 unconditional checks and **146/146** for the two
conditional condition checks. Per-check rows and the full per-batch records are in
`results/campaign-200t-aggregate.json`; nothing weakened, nothing skipped.

The journey slowdown is the throttle itself: `Network.emulateNetworkConditions` at 400 kbps / 150 ms is 3.45× the
median journey of §8, which is what a slow 3G session looks like for this route.

### 9.3 The three flakes, and what they exposed

Each flake failed on attempt 1 and passed on its same-seed replay, so each counts as a passed journey (B8/B11
semantics) with the wobble retained:

| Batch/run | Seed | Attempt-1 failure | Reading |
|---|---|---|---|
| b3 run 26 | 303000934 | `journey_completed`: `waitForSelector: Timeout 30000ms exceeded` waiting for `h1` | the suite's 30 s visibility wait is tight at 400 kbps; a harness budget, not an app defect |
| b3 run 31 | 303000939 | `no_console_errors`: `net::ERR_CONNECTION_CLOSED` | transient connection reset on a throttled link |
| b4 run 45 | 404001256 | `no_console_errors` + `no_failed_requests_from_app`: `net::ERR_CONNECTION_CLOSED https://ep1.adtrafficquality.google/getconfig/sodar…` | a **Google ad-measurement endpoint** that the harness's third-party classifier does not match, so an ad-network failure was counted against the app — a classifier gap (registered as ISSUE-008) and further evidence for ISSUE-002 |

None of the three involved a hydration error: `no_hydration_mismatch`/`no_hydration_dom_wipe` passed in every
recorded attempt, including the attempt-1s that failed their other checks.

### 9.4 The control: the same profile, the gate

`hydration-race-gate.mjs` was re-run against the **current** build at the same profile (persistent browser profile
with a warm client-chunk cache, 20 throttled loads):

```
throttle: 400 kbps / 150 ms   runs: 20   hydrationMismatches: 20   rate: 100.0%
```

…the campaign's exact failure signature (`Minified React error #418 … args[]=HTML&args[]=`) on the first load and
every load after it (`results/gate-control-current-build.log`, `results/hydration-race-gate.json`; the previous
build's record, 3/3 at the same profile, is preserved in `results/hydration-race-gate-prev-build.json`).

### 9.5 What this measures — and what it does not

- **A slow link alone does not fire the race.** The identical journeys, at 3.45× the latency, produced **zero**
  hydration errors in 202 recorded attempts. The gate fires **100%** at the same profile. The difference between the
  two instruments is the cache/returning-visitor setup: the gate keeps a persistent profile so client chunks are
  resident and the throttled document streams around them; each suite journey starts with a fresh profile (a
  first-time visitor) and its in-session reloads did not reproduce it either. The honest reading: the defect's user
  profile is the **returning visitor with a warm cache on a slow link**; a first-time slow-link session was clean in
  200/200 journeys.
- **Zero of 200 journeys bounds the rate, it does not prove absence.** The 95% upper bound for the journey-level
  rate is ≈1.5% (rule of three), and the gate proves the failure mode is still reachable on this build — so the A2
  patch keeps its value and the gate keeps its role as the acceptance instrument.
- **Not a build-paired replay.** The throttled replay ran on a newer deploy than §8
  (`psr2.eab40132…` vs `psr2.4f0b2707…`). The gate control rules the build change out as the explanation for the
  zero: the race reproduces 20/20 on the newer build. For the other 29 checks the replay is still a same-suite,
  same-seeds comparison against a newer build, and its coverage numbers are near-identical but not bit-identical
  (3,374 Yes / 3,278 No vs 3,377 / 3,301; 287 condition boxes vs 288; 639 follow-up groups vs 648) — consistent with
  a newer build plus timing-sensitive control enumeration under throttling.
- **Still not a submission test**, and still no assistive-technology pass. The deployment's 503 delivery state
  (ISSUE-001) is unaffected by, and unaffected in, this replay.

### 9.6 Artifacts

```
results/campaign-200t-b{1..4}.{json,jsonl,log}   per-journey records, checkpoints, full run logs
results/campaign-200t-aggregate.json             the rollup/paired comparison this section is written from
results/summarize-throttled.mjs                  regenerates that rollup
results/run-200-throttled.sh                     the campaign runner (resumable)
results/gate-control-current-build.log           the 20/20 gate control against the current build
results/throttle-baseline.json / throttle-pilot.json    the 2-journey calibration (27.0/19.1 s → 74.9/66.3 s)
```
