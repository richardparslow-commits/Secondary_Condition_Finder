# Verification log — every issue, its fix, and the evidence it was fixed

Rule applied throughout: **no issue is called fixed until a command has been run whose result would have been
different before the fix.** Where the fix belongs in the application repository (which is not on this machine), the
entry says so and names the exact check that must pass once the patch is applied — it is not marked fixed.

Two classes: **Class A** = the application under test; **Class B** = the test harness (this workspace, all fixed here).
Severity: **S1** risks users or data · **S2** user-visible defect · **S3** quality/UX · **S4** process/tooling.

---

## Class B — harness defects (fixed and verified in this workspace)

Campaign that exposed them: `results/live-100-build-bd8cab47.json` — 13 of 100 journeys "failed", all of it the rig's
fault. After the repairs, the same suite ran **100/100 desktop** (`results/final-100-desktop.json`) and **25/25
mobile** (`results/final-25-mobile.json`) with zero app failures, zero harness failures and zero flakes.

| # | Issue | Fix | Verification (command → observed) |
|---|---|---|---|
| B1 | Three divergent harnesses (v1/v2/v3) with different checks; results not comparable | One maintained suite `live-suite.mjs`, older files frozen as history | `node live-suite.mjs --help` documents the switches; campaigns afterwards all ran from this file |
| B2 | Conditions ticked by positional handle, and the ticker read `el.checked` on a `role="checkbox"` **button** → concluded "not ticked" and clicked again, toggling the control back off; `check(force)` reported success while the app ignored it | Resolve by accessible name at click time; use Playwright `isChecked()` (reads `aria-checked`); verify before each action, never click twice; assert the ticked element's label equals the request | `node probe-tick-methods.mjs` printed the real markup (`button[role=checkbox]` + hidden mirror input); pilot ticks Cigars / OCD / Parachuting / Asthma+Emphysema by name with `ticked_element_matches_request` green |
| B3 | Assertion demanded a radiogroup after ticking a condition → 12/100 false failures | Assert page health + answer preservation; count every control type | the 12 previously failing journeys pass; `newControls` recorded per condition (0 for duplicated items, 9–43 for real ones) |
| B4 | `QUESTION_MAX` hardcoded 62 | Read the maximum from the page per journey | `counterMaxSeen: [63]` on the current build (the old constant would have failed 63 valid runs) |
| B5 | Build identity not normalised; a mid-campaign deploy could silently invalidate results | Capture `x-deployment-id`, compare prefixes, report `singleBuild`/`builds` | `singleBuild: true`, prefix `psr2.bd8cab47-114d-4ba0-ba30-1e3301938704` in both final campaigns (the older files show the deploy churn this catches) |
| B6 | Third-party ad errors counted as app failures (2/100 false failures) | Classify by host into `thirdPartyErrors` vs `networkErrors` | final campaigns: `runsWithThirdPartyErrors: 5` reported separately; `no_failed_requests_from_app` 100/100 |
| B7 | Every interaction wrapped in `.catch(() => {})` — steps could silently no-op | Record soft errors; `no_swallowed_errors` check | `runsWithSoftErrors: 0` in both final campaigns (a swallowed step now fails the run) |
| B8 | A failure could not be distinguished from a flake (run 7 had to be replayed by hand) | Same-seed auto-replay; classify flake vs reproduced; flakes pass with detail retained | `--injectFlake` → `flakyRuns: 1`, `reproduced: false`, exit 0; `--injectFailure` → `reproduced: true`, exit 1 (`results/verify-inject-*.json`) |
| B9 | No evidence captured at failure time | On failure write screenshot + HTML + console to `results/evidence/` | injected failure produced `run-2-attempt-1.{png,html,log}` and `-attempt-2.*` |
| B10 | Exit code not gated on app-level failure | Exit non-zero only when an app-level failure survives replay (or the rig itself failed) | injected failure exit 1, flake exit 0, clean pilot exit 0 — verified in the four `verify-*` runs |
| B11 | Flake detected and recovered, but the rollup still exited 1 | Count replay-recovered runs as passed | re-ran the flake injection → `flakyRuns: 1` and exit 0 |
| B12 | **New**: hydration failures had no dedicated check, so a mismatch hid behind green functional assertions (exactly what happened to run 7) | Added `no_hydration_mismatch` (`#418`/`#423`/`#425`) and `no_hydration_dom_wipe` (the post-wipe `parentNode` cascade), both exit-gating; plus a `--injectHydration=N` switch so the gate's teeth can be proved | clean pilot `--runs=6` → both checks 6/6, exit 0; `--only=1 --injectHydration=1` → `no_hydration_mismatch` fail 1, `appFailures: 1`, exit 1 |

### The re-run that closes the loop (done here)
The whole suite was re-run after the hydration gate was added:
- `node live-suite.mjs --runs=100 --seed=42 --viewport=desktop` → **100/100**, `appFailures: 0`, `harnessFailures: 0`,
  `flakyRuns: 0`, **26 checks** including `no_hydration_mismatch` 100/100 and `no_hydration_dom_wipe` 100/100
  (`results/gate-100-desktop.json`). It also caught a **live mid-campaign deploy**: runs 1–36 on `psr2.bd8cab47…`
  (36/36) and runs 37–100 on `psr2.1f54172e…` (64/64) — `singleBuild: false`, which is A5 recurring and B5 detecting it.
- `node live-suite.mjs --runs=25 --seed=11 --viewport=mobile` → **25/25**, single build (`psr2.1f54172e…`, i.e. the new
  deploy is covered), both hydration checks 25/25 (`results/gate-25-mobile.json`).

That is the "verify before moving on" rule applied to the last item: the gate was added, then proved to pass on 125
real journeys and proved to fail when a mismatch is injected.

## Class A — application issues

### A1 · Ads and analytics on a health questionnaire — S1 (fix belongs in the app repo)
- **Fix planned:** gate the ad unit off `/practice-application`, move `adsbygoogle.js` out of the root document, and
  promote the report-only CSP to enforcing (`frame-src 'self'`). Patch text: `AUDIT.md` §A1.
- **Verification available here:** already-observable evidence is recorded — `runsWithThirdPartyErrors: 5` in
  `final-100-desktop.json` and 1 `adsbygoogle` reference plus `/~flock.js` and `/__l5e/events.<hash>.js` in the served
  HTML. After the patch, `node live-suite.mjs --runs=25 --seed=5` must show `runsWithThirdPartyErrors: 0` and the
  served HTML must contain no `adsbygoogle`/`googlesyndication` reference.
- **Status: not fixed — blocked on the app source** (see the source-availability note at the end).

### A2 · Intermittent React #418 hydration mismatch — S2 → **root cause found, reproduced, gated**
- **Fix planned:** `patch-package` scheduler gate (upstream-verified workaround for facebook/react#37321), or a
  non-streaming shell for the route; plus the mount-effect pattern for draft reads. Patch text:
  `HYDRATION-ROOT-CAUSE.md` §4.
- **Verification of the diagnosis (done here, today):**
  - `node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150` → **20/20 mismatches, exit 1**, every hit
    carrying the campaign's exact signature (`#418 … args[]=HTML&args[]=`) — `results/hydration-race-gate.json`;
  - `node hydration-race-gate.mjs --runs=30` (1500 kbps) → 0/30, i.e. the rate is delivery-speed dependent, which is
    why the original occurrence looked random;
  - rival causes measured and rejected: `probe-hydration.mjs` 1 mismatch in 180 targeted loads (A 0/30, B 1/30 then
    0/120, C 0/30); `probe-html-mutation.mjs` 0 writes to `<html>` in 40/40 loads.
  - the suite gate that will catch a recurrence was verified in both directions (see B12).
- **Verification after the app patch:** the same gate must report 0/20, exit 0 — a same-run before/after proof.
- **Status: diagnosis complete and reproducible; app-side patch not applied (no app source here).**

### A3 · Thirteen condition items give no feedback when ticked — S3 (fix belongs in the app repo)
- **Fix planned:** the duplicated items (Nicotine items in section 3, risky-behaviour items in section 5) either leave
  the health list or show a hint on tick pointing at the owning section. Patch text: `AUDIT.md` §A3.
- **Verification available here:** the measurement itself is reproducible — ticking each of the 13 adds 0 new
  controls while Stroke/Autism/ADHD etc. add 9–43, recorded per run as `newControls`.
- **Status: not fixed — blocked on the app source.**

### A4 · Answer counter "Main questions answered" counting 62 of 74 groups — **closed, not a defect**
Counter advanced by 0 or 1 per click, never more; the label says *main*; the uncounted groups are conditional
sub-questions. Recorded so it is not re-raised.

### A5 · Production redeployed mid-session — S4
- **Fix planned:** harness side done (B5 records the build per journey and reports `singleBuild`); release side is a
  process change — deploy outside campaign windows and show the build id in the footer.
- **Verification:** `singleBuild: true` with the build prefix recorded per journey in both final campaigns.
- **Status: harness half fixed and verified; release-process half is the app owner's.**

### Correction to the earlier report
The "12 of 100 runs failed a condition check" finding in the first report was a measurement artifact of B2/B3, not an
application defect. Corrected in `results/LIVE-TEST-REPORT.md` and in `AUDIT.md`.

---

## Source availability (why A1/A3 and the A2 patch stop at "ready to apply")

The application is a hosted Lovable build (hashed `/assets/*.js`, Supabase edge function `send-practice-application`,
`~flock.js` + `/__l5e/events`, TanStack route chunks). Searches for `practice-app-draft`,
`send-practice-application` and `lifepolicypilot` across the local tree returned no source. Everything that can be
done without it — diagnosis, reproduction, harness fixes, regression gates, ready-to-apply patches — is done; the
three edits need the app repository (e.g. Lovable's GitHub export).

## Evidence index

| Artifact | What it proves |
|---|---|
| `results/live-100-build-bd8cab47.json` | the first 100 journeys: 13 failures, all Class B; run 7's `#418` |
| `results/final-100-desktop.json`, `results/final-25-mobile.json` | 100/100 and 25/25 clean on the repaired rig, single build |
| `results/gate-100-desktop.json` | the 100 journeys re-run under the suite's new hydration gate |
| `results/hydration-race-gate.json` | 20/20 reproduction at 400 kbps / 150 ms |
| `results/html-mutation-probe.json` | 40/40 loads with no write to `<html>` |
| `results/hydration-probe.json` | the draft hypothesis: 1 mismatch in 180 targeted loads |
| `results/gate-pilot.json`, `results/gate-teeth.json` | the new gate passes clean and fails on injection |
| `results/verify-inject-failure*.json`, `verify-inject-flake*.json` | replay, evidence capture and exit codes work |
