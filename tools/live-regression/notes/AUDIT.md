# Audit — the live randomized campaigns (100 + 200 journeys), every issue and its permanent fix

Scope audited: `results/live-100-build-bd8cab47.json` (100 desktop journeys), `results/mobile-25.json` (25 phone-viewport
journeys), `results/live-100-seed42.json` (the earlier 100 journeys on build `631bea88`), plus every probe, replay and
counter-experiment in this directory, `results/gate-100-desktop.json` (the 100 journeys re-run under the suite's
new hydration gate), and `results/campaign-200-b{1..4}.json` — the 200-journey campaign of 2026-10-16 (rollup in
`results/campaign-200-aggregate.json`). Verification evidence for each fix is in `VERIFICATION-LOG.md`; the hydration
investigation has its own write-up in `HYDRATION-ROOT-CAUSE.md`; **the register to act on next is Class C below.**

Severity: **S1** risks users or data · **S2** user-visible defect · **S3** quality/UX · **S4** process/tooling.

---

## 0. Source availability (decides what can be fixed here)

The application is a Lovable-hosted build: hashed `/assets/*.js` bundles, `send-practice-application` Supabase edge
function invoked from the client, `~flock.js` + `/__l5e/events` hosting analytics, `/lovable/` in robots.txt, TanStack
route chunks. A search of the home tree for `practice-app-draft`, `send-practice-application` and `lifepolicypilot`
returned **zero matches** when this audit ran: the source was not on this machine then. It is now — the application's own
repository (the GitHub side of the Lovable project) is checked out at `tmp/pifa-src/` (gitignored, so it is not part of
this repository), and that is where the Class A fixes below belong.

- **Class A (application issues)** — evidence, root cause and a ready-to-apply patch are given below; the edits belong
  in the application repository (`tmp/pifa-src/`), not in this one.
- **Class B (harness defects)** — mine, in this workspace, and every one is already fixed and verified.

---

## Class C — the 200-journey campaign (2026-10-16): prioritized register and fix plan

**Scope.** `results/campaign-200-b{1..4}.json` and their `.jsonl` checkpoints: four batches of 50 randomized journeys
(100 desktop, 100 mobile), seeds `101000303–404001261`, every journey on one build — **200/200 passed, 0 app
failures, 0 harness failures, 0 flakes**, `singleBuild: true` in all four batches. Rollup
`results/campaign-200-aggregate.json`, regenerable with `node results/aggregate-200.mjs`; full narrative in
`LIVE-TEST-REPORT.md` §8. The **throttled replay** of the same 200 journeys (`results/campaign-200t-b{1..4}.json`,
400 kbps / 150 ms, rollup `results/campaign-200t-aggregate.json`, narrative §9) adds **200/200 passed, 0 app
failures, 0 harness failures, 3 recovered flakes, 0 hydration errors in 202 recorded attempts**, the 20/20 gate
control against the same build, and ISSUE-008 below.

**There are no failing seeds, because no journey failed.** This register therefore carries what the campaign *does*
support: every defect still live on the build it tested, deduplicated by root cause, with the seeds that evidence
each one. The earlier items map in like this:

| Earlier item | Disposition in this register |
|---|---|
| A1 ads/analytics on the questionnaire | **ISSUE-002** — re-evidenced by the campaign (2/200 journeys) |
| A2 React #418 hydration race | **ISSUE-003** — 0/200 at full speed; root cause and patch unchanged |
| A3 thirteen condition items with no feedback | **ISSUE-004** — re-evidenced by the campaign (11/146 condition-ticking journeys) |
| A4 counter counts 62 of 74 groups | **closed, not a defect** — unchanged, do not re-raise |
| A5 mid-session deploy | **ISSUE-007** — harness half verified (`singleBuild: true` ×4); release half open |
| B1–B12 harness defects | all fixed earlier; **none recurred** in 200 journeys (0 soft errors, 0 flakes, 0 refused requests) |

### The register, in priority order

| # | Sev | Issue | Root cause (one line) | Evidence seeds | Fix site |
|---|---|---|---|---|---|
| ISSUE-001 | S1 | A valid, fully-consented submission cannot be delivered | Deployed backend has no mail delivery configured → 503 on the submission endpoint | n/a — opt-in send test (`results/e2e-send-2026-10-16T01-38-17.md`) | deployed backend |
| ISSUE-002 | S1 | Ad frames and hosting analytics load on the health questionnaire | Ad/analytics tags injected site-wide instead of per route | 404001250, 404001254; ad host 404001256 | application repo |
| ISSUE-003 | S2 | Intermittent React #418 streaming-hydration race | React 19 Fizz hydration can overtake the HTML parser (facebook/react#37321) | gate 20/20 @400 kbps (both builds); suite 0/200 unthrottled and 0/202 throttled | application repo |
| ISSUE-004 | S3 | Duplicate condition items give no visible feedback when ticked | The health list repeats items whose questions live in other sections | 101000315, 101000325, 101000345, 303000911, 303000950, 404001242 | application repo |
| ISSUE-005 | S3/S4 | 11 journeys' ticks added zero new controls; two names conflict with the per-item audit | Not established — measurement artifact or state-dependent app behaviour (both candidates below) | 202000622, 202000636, 202000637, 303000914, 303000944, 303000950 (full list below) | this workspace (diagnose first) |
| ISSUE-006 | S4 | Suite/version/README drift — **fixed 2026-10-16**; the harness package is still uncommitted | Reports written at the 26-check revision; later revisions and the campaign were never committed | n/a | this workspace |
| ISSUE-007 | S4 | Deploys can land mid-campaign, and the tested build is invisible in the page | Release-side half of A5 unshipped | 100-campaign changed build at run 37 | application repo + release process |
| ISSUE-008 | S4 | A third-party ad-measurement host was outside the harness classifier — **fixed 2026-10-16** | `THIRD_PARTY` matched `google.com` but not `adtrafficquality.google`, and the console mirror of a failed resource names no host at all | 404001256 (b4 run 45) | this workspace (fixed) |

### ISSUE-001 · A valid, fully-consented submission cannot be delivered — S1

**Root cause.** The deployed backend has no mail delivery configured, so the submission endpoint refuses every write
with `503 {"error":"Email delivery is not configured"}`. The endpoint is the site's own (not this repository — §0),
and the randomized suite cannot see this by design: it aborts the submission endpoint, so its 200 green journeys say
nothing about delivery.

**Where.** `results/e2e-send-2026-10-16T01-38-17.md` — *Response: 503 …*; payload 4015 bytes with both consents
present (`consent_contact`, `consent_disclaimer`), submitted through the real UI to
`POST /api/public/practice-application`; on-screen confirmation empty. Documented as known state at `README.md:99`.

**Evidence.** The opt-in test (`e2e-send-submission.mjs`) reached the app's own sendable state (p1: radios 75,
selects 3, texts 10, numbers 2, dates 2, consents 2 — outstanding fields named by the app: none) and the endpoint
refused. Every attempt is recorded `sent: false` with that body.

**Fix steps.**
1. Configure mail delivery for the deployed backend (the endpoint's mail provider/secret), nothing else.
2. Re-run `node e2e-send-submission.mjs --dry` and confirm the payload is unchanged.
3. Then `E2E_SEND_CONFIRM=I-understand-this-sends-real-email node e2e-send-submission.mjs --confirm-send`.
4. Search the inbox for the receipt's marker (`QA-SYNTHETIC-E2E-<stamp>#1`) and the contact address.
5. Update `README.md:99` (the known-state block) and re-baseline the monitor if it tracked the failure.

**Verification.** A receipt with `sent: true`, the marker found in the inbox, and the on-screen confirmation captured;
the receipt's JSON records the response status and body.

### ISSUE-002 · Ad frames and hosting analytics on the questionnaire — S1

**Root cause.** Ad and analytics tags are injected site-wide rather than per route, so the page that asks for
diagnoses, medications, mental-health history, substance use, criminal record and finances carries Google ad frames
and hosting analytics. Unchanged from A1 (`notes/AUDIT.md:359`); the campaign re-evidenced it on the current build.

**Where.** Per-run records: `results/campaign-200-b4.json`, runs 39 and 43 (`thirdPartyErrors`) — the CSP
report-only violation `Framing 'https://www.google.com/' violates … frame-ancestors 'self'` and
`net::ERR_BLOCKED_BY_ORB https://csp.withgoogle.com/csp/frame-ancestors/…`. Classification by host is at
`live-suite.mjs:87` (pattern), `:194` (console — classified by the message's source URL, since its text names no host), `:203`, `:208` (push), rollup `:634`.

**Evidence seeds.** `404001250`, `404001254` (both mobile, batch b4). 2/200 runs; 0 app network errors; 0 console
errors from the app itself. The throttled replay adds a third ad host the route talks to:
`https://ep1.adtrafficquality.google/getconfig/sodar…` — a Google ad-traffic-quality/measurement endpoint — surfaced
by one throttled attempt (seed `404001256`); the same attempt exposed the classifier gap logged — and since fixed — as
ISSUE-008.

**Fix steps.** (as A1, re-stated for the application repository — §0)
1. Gate the ad unit off `/practice-application` in the route/layout that renders it.
2. Move `adsbygoogle.js` (and any ad component) out of the root document into routes allowed to carry ads.
3. Promote the CSP from report-only to enforcing: `frame-src 'self'; frame-ancestors 'self'` (`/api/csp-report`
   already exists to catch regressions).
4. If hosting analytics must stay for the pilot, load it only after explicit consent and never on this route.

**Verification.** 1) Re-fetch the route and assert the HTML contains no `adsbygoogle`/`googlesyndication` reference.
2) Re-run the two seeds (`node live-suite.mjs --runs=1 --seed=404001250 --viewport=mobile`) and assert
`thirdPartyErrors` is empty. 3) A 50-journey batch reports `runsWithThirdPartyErrors: 0`.

### ISSUE-003 · React #418 streaming-hydration race — S2

**Root cause.** Upstream `facebook/react#37321`: React 19's streaming (Fizz) hydration can start before the HTML
parser has finished the shell; when a chunk boundary lands mid-shell with client chunks already cached, the claim
walk throws a **false fatal #418** and React re-renders the document although the server HTML is correct. Preconditions
are this app's shape (streaming SSR, cached chunks, slow chunked delivery). Unchanged from A2 (`notes/AUDIT.md:381`).

**Where.** `notes/HYDRATION-ROOT-CAUSE.md:75` (§4 — patch text and reproduction); the suite's exit-gating checks are
`live-suite.mjs:487` (`no_hydration_mismatch`) and `:489` (`no_hydration_dom_wipe`).

**Evidence.** This campaign: **0/200** unthrottled (both gates green in every journey) — the best evidence yet that
at full speed the race is rare rather than absent; earlier 100-journey campaign: 1/100. Reproduced on demand at
400 kbps / 150 ms: 20/20, versus 0/30 at 1500 kbps.

**Throttled replay (2026-10-16, `LIVE-TEST-REPORT.md` §9).** The exact same 200 journeys replayed at 400 kbps /
150 ms with a fresh browser profile per journey: **0 hydration errors in 202 recorded attempts** (one aborted
attempt never reached the check), 200/200 journeys passed, 3 recovered flakes. The control keeps the defect alive:
the gate at the same profile, warm persistent cache, **20/20 mismatches (100.0%)** against the same build the replay
tested, `psr2.eab40132-73a6-43a7-83ea-32cf0eb9d9c6` (`results/gate-control-current-build.log`; previous build 3/3 in
`results/hydration-race-gate-prev-build.json`). Reading: a slow link alone does not fire the race — a fresh-profile
slow-link session is clean in 200/200 journeys (95% upper bound ≈1.5%, rule of three) — while the warm-cache
returning-visitor profile that the gate builds fires it every time. The patch's value is unchanged; its urgency is
for the warm-cache path, and the gate stays the acceptance instrument (after the patch: gate 0/20, then §9's replay
stays 0/200).

**Fix steps.**
1. Ship the upstream reporter's verified scheduler gate as a `patch-package` patch on the bundled scheduler
   (defer React work while `document.readyState === "loading"` or `window.$RB` is non-empty) — 0/36 gated vs 4/12
   unpatched upstream; or serve the route without streaming SSR (verify the TanStack Start version first).
2. Read `localStorage` in a mount effect rather than in render/`useState` initialisers — cannot cause this defect,
   removes the other mismatch family.
3. Do **not** use `suppressHydrationWarning`: React still discards the SSR DOM and the parentNode cascade can fire.

**Verification.** `node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150`: before 20/20 mismatches/exit 1,
after 0/20/exit 0; then a 50-journey batch with both hydration checks green; then the full 200 re-run.

### ISSUE-004 · Duplicate condition items with no visible feedback — S3

**Root cause.** The health list (section 1) duplicates items whose questions are rendered by other sections (section 3
nicotine, section 5 risky behaviour); ticking such an item registers but adds no control anywhere on the page, so the
user cannot tell the click landed. Unchanged from A3 (`notes/AUDIT.md:426`).

**Where.** The tick loop and its delta measurement: `live-suite.mjs:348` (`controlsBefore`), `:350–351` (which boxes
the journey ticks), `:346` (`newControlTotal`), `:349` (`conditionsWithNewControls`); rollup `:624–626`. The app-side
list is not in this repository (§0); the items are named by label in the campaign records.

**Evidence.** [audit] the one-item-at-a-time measurement (A3): Cigarettes, Cigars, Pipe, Bidis, Snuff, Chewing
tobacco, Oral nicotine pouches, Nicotine patch, Hookah, Parachuting, Professional sport, Rodeo events (+Sky diving in
one state) add no new control, while Stroke, Autism, Schizophrenia, ADHD/ADD, OCD, Arthritis, Asthma, Sleep Apnea do
(+43 controls for Stroke). [campaign] 11 of the 146 condition-ticking journeys produced zero new controls in total;
the boxes ticked in those journeys name, among others, **Snuff** (seeds `303000911`, `404001242`), **Parachuting**
(`303000950`) and first-time names **Nicotine gum** (`101000345`), **Nicotine aerosol/inhaler** (`303000950`),
**Bipolar I or II** + **Tourette's syndrome** (`101000325`, `303000944`), **Depression Major** (`101000315`),
**Mental Retardation** (`303000914`), **Suicide attempt/ideation** + **Hang gliding** (`202000636`),
**Non-Combat Transport** (`202000622`), **Eating disorder** (`202000637`).

**Fix steps.**
1. For each duplicated item: remove it from the health list, or keep it and add a visible hint that links to / focuses
   the owning section (e.g. "asked in section 3 — Nicotine").
2. First fold in the ISSUE-005 diagnosis so the fix list is the app's list, not the measurement's.

**Verification.** One-item re-measurement of every named box: ticking produces either a new control or the hint;
`ticking_conditions_keeps_page_healthy` stays green; zero-new-control journeys drop to 0 in a fresh batch.

### ISSUE-005 · The zero-new-control runs — diagnose before treating as an app defect — S3/S4

**What is established.** 135 of the 146 condition-ticking journeys saw new controls appear; **11 did not** (seeds
`101000315, 101000325, 101000345, 202000622, 202000636, 202000637, 303000911, 303000914, 303000944, 303000950,
404001242`). Two names ticked in those runs — **Stroke** and **Autism** (both ticked in `202000637`) — are items the per-item
audit measured as *opening follow-ups* (+43 controls for Stroke in four separate page states), so for those names
the two measurements disagree.

**Candidate root causes (not yet distinguished).**
1. **Harness measurement**: the delta is computed against the page state *before* the whole tick set
   (`live-suite.mjs:348` → `:367–371`), 1200 ms after the last tick, and the rollup counts *journeys*, not items
   (`:624–626`). A follow-up group already rendered earlier in the journey (e.g. by an earlier randomized answer in
   the owning section) shows as "added nothing", which would make these runs false negatives for the item ticked.
2. **App behaviour**: feedback for these items genuinely depends on the path taken through the form.

**Fix steps.**
1. Reproduce the 11 seeds headful, one box at a time (needs a small harness switch, e.g. `--toggleBox=<label>` plus
   `--minConditions=1`; a workspace change, not an app change).
2. Record per-box deltas for each of the 11 journeys' boxes.
3. Classify each name as (a) never adds controls (the A3 duplicate class), (b) state-dependent, or (c) measurement
   artifact; fold (a) into ISSUE-004's fix list and (b) into ISSUE-004's hint design.

**Verification.** Per-box verdicts for all 11 seeds; after the harness control exists, a re-run of those seeds
reports each box's delta; unexplained zero-new-control runs: 0.

### ISSUE-006 · Suite/version/README drift and an uncommitted harness — S4 · **drift fixed 2026-10-16, commit pending**

**Status.** The drift is fixed in this pass: the README states the real check count and revision, and every artifact
now self-describes as `suite v6`. The same pass repaired the stale line citations the drift had left behind — the
suite's line numbers had moved since the notes were written, and four `notes/AUDIT.md` class references never matched
their headings at all. The commit is still open: it needs the user's go-ahead, and nothing in this workspace is
committed.

**Root cause.** The harness notes and README were written at the 26-check revision; the suite has since grown to 30
checks and the 200-journey campaign ran that later revision, so some counts and artifact lists no longer match the
suite. The whole `tools/live-regression/` package is also untracked in git, so the campaign's provenance lives only
in this working tree.

**Where.** Before this pass: `README.md:11` ("26 checks" — the campaign ran 30: the 26 listed at §1.1 plus
`toggling_yes_to_no_hides_followups`, `toggling_yes_to_no_leaves_no_orphaned_answers`,
`no_application_data_leaves_device`, `no_horizontal_overflow`, and the two hydration checks' mobile coverage) and
`live-suite.mjs:616` (reported `suiteVersion: "v5"`). `notes/LIVE-TEST-REPORT.md` §7's artifact list was stale
the same way and was corrected in the Phase-2 write-up, which also adds the campaign itself (§8); the "26 checks"
mention in `VERIFICATION-LOG.md:36` is a historical record of the 100-journey gate revision and stays.

**Fix steps, and what was done (2026-10-16).**
1. `README.md:11` now states the real shape — 30 checks, 28 always and 2 only when a journey ticks a condition — and
   names the revision. **Done.**
2. The suite's banner and summary now read `v6` (`live-suite.mjs:538`, `:616`), so an artifact says which revision
   produced it. `v6` marks the ISSUE-008 classifier change, not a check-count change: the 30 checks are the same ones
   the 200-journey campaign ran, which is why the campaign artifacts correctly say `v5`. **Done.**
3. Commit the harness + notes, including this register. **Still open.**
4. `--kbps` / `--latency` are in `README.md`'s run block and switch list, not only the suite's docstring
   (`live-suite.mjs:29`). **Done.**
5. Every line citation re-derived and, from here on, checked: `results/check-phase2-docs.mjs` resolves all 12
   `live-suite.mjs:NNN` citations in both notes, asserts 17 named suite-line anchors by content, and asserts each
   `notes/AUDIT.md:NNN` class reference still lands on the item it names. **Done.**

**Verification.** `results/check-phase2-docs.mjs` derives the shipped check count from the suite source (the
`check("…")` call sites, excluding the test-only `injected_failure`), asserts it is 30, asserts exactly 2 of them are
condition-conditional, and asserts the README's numbers equal those — so a check added without a README update fails
the checker. It also asserts the summary self-describes as `v6`, that no stale `v5` string survives, and that a real
run of the suite records 30 checks (`results/issue008-replay.json`). The revision bump cannot disturb the monitor:
its baseline keys on check *names* — `state/baseline.json` carries no version field — and no check name changed. The
commit half stays unverified until `git status` shows the package tracked.

**Also found, and left open — it is a state decision, not a doc fix.** The monitor's baseline
(`state/baseline.json`) is a 26-check-era artifact: it still tracks the retired `http_2xx` and predates five shipped
checks (`toggling_yes_to_no_hides_followups`, `toggling_yes_to_no_leaves_no_orphaned_answers`,
`no_application_data_leaves_device`, `no_horizontal_overflow`, `journey_completed`), so a monitor run today lists
those five under "Checks new since the baseline" — an artefact of this same drift, not a regression. Accepting the
current state is one command (`node monitor.mjs --update-baseline`), but the baseline also carries the deliberate
race-canary known failure, so re-baselining is the user's call and is left open here.

### ISSUE-007 · Build visibility and release windows — S4

**Root cause.** Deploys can land inside a campaign window (A5, `notes/AUDIT.md:446`), and the build a tester exercises
is not visible in the page itself. The harness half is fixed: `live-suite.mjs:121` normalises the id to its
`psr2.<uuid>` prefix, `:303` records it per journey, `:628`/`:627` report `builds`/`singleBuild`.

**Evidence.** 100-journey campaign: build changed at run 37 (two builds, both clean). 200-journey campaign:
`singleBuild: true` in all four batches — one build for all 200 journeys.

**Fix steps.**
1. Release side: deploy outside test windows (or accept and re-baseline).
2. App side: surface the build id in the page footer so any manual tester can see what they tested.

**Verification.** The footer shows the same `psr2.<uuid>` prefix the harness records; a future campaign that straddles
a deploy is visible in `builds` and never read as one result.

### ISSUE-008 · Third-party ad-measurement host outside the classifier — S4 · **fixed 2026-10-16**

**Status.** Fixed: the host is in the classifier, and the console mirror of a failed third-party resource is now
classified by the message's own source URL. Evidence below; nothing committed yet.

**Root cause.** The harness's third-party pattern (`live-suite.mjs:87`) covered `googlesyndication`, `doubleclick`,
`csp.withgoogle`, `google.com`, `gstatic`, `adsbygoogle`, `flock.js` and `__l5e`, but the route also calls
`ep1.adtrafficquality.google` (Google ad-traffic-quality/SODAR measurement). Requests and failures on that host were
classified as *application* errors, so an ad-network failure could fail `no_console_errors` /
`no_failed_requests_from_app`. Adding the host turned out to be half a fix: the same failure arrives twice, once with
the host and once without it. The request entry carries the URL
(`net::ERR_CONNECTION_CLOSED https://ep1.adtrafficquality.google/…`), while Chrome mirrors it to the console as
`Failed to load resource: net::ERR_CONNECTION_CLOSED`, which names no host at all — so a host pattern alone
reclassifies only one of the two, and `no_console_errors` would still have failed on the mirror.

**Evidence.**
1. The b4 attempt record itself (`results/campaign-200t-b4.json`, run 45, attempt 1, seed `404001256`): one network
   error naming the ad host, one host-less console error, both checks failed, and the same-seed replay passed. It is
   the only one of the three throttled flakes that is not pure link noise, and the only reason any throttled
   per-check tally was not 200/0 at attempt level.
2. `results/issue008-console-location-probe.mjs` (new, exits 0): a page requests a failing ad-shape URL and the probe
   captures both halves of the mirror — console text `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` with no
   host in it, and `consoleMessage.location().url` = the failed resource URL. Applied to the verbatim recorded b4
   entry the new classifier matches; applied to the app's own origin it does not. This is the evidence the console
   half of the fix keys off.
3. `results/check-phase2-docs.mjs` re-derives the classifier from the suite source and asserts each of the above
   against the recorded b4 strings, so the gap cannot silently reopen.
4. `results/issue008-replay.json` — the throttled replay of that journey (below).

**Fix steps, and what was done (2026-10-16).**
1. The host is in the classifier (`live-suite.mjs:87`): `adtrafficquality|sodar`. **Done.**
2. The console classifier tests the message's source URL as well as its text (`live-suite.mjs:193–194`), which is
   what the host-less mirror needs. **Done.**
3. Longer term the noise disappears with ISSUE-002's fix (no ad stack on the route at all). **App side, open.**

**Verification.** `node live-suite.mjs --only=45 --seed=404 --viewport=mobile --kbps=400 --latency=150
--out=results/issue008-replay.json` replays that journey on the gate's profile — 1/1 passed, 0 app failures, 0
harness failures, 0 flakes, 30 checks recorded in 76.8 s, build `psr2.eab40132…` — the same build the throttled
campaign ran (§8 ran `psr2.4f0b2707…`, so a comparison across the two campaigns is only valid where the note says it
is).
The earlier form of this command (`--seed=404001256`) was wrong and is corrected here: that flag sets the *base*
seed, and a journey's seed is `base × 1000003 + index`, so `--only=45 --seed=404` is what reproduces `404001256`.
The ad host did not reappear in this replay, so the live end-to-end reclassification of an ad-host failure is **not**
directly observed; the probe plus the record cover the classification question instead, and the checker asserts the
invariant that matters (no ad-host error filed as an application error, whether or not the host shows up).

### Not defects — recorded so they are not re-raised

| Signal | Why it is not a defect |
|---|---|
| Two checks ran in 146/200 journeys | By design: `MIN_CONDITIONS` defaults to 0 and the draw is `floor(r() * 4)` (`live-suite.mjs:59`, `:350`); the checks are skipped when no condition was selected to tick (`:364`, `:375`). All 146 instruments passed. |
| 0 Not Sure answers placed in 200 journeys | The live form offers only Yes/No; the harness draws Not Sure and falls back by design (`live-suite.mjs:279–293`). Coverage note. |
| 2/200 runs with Google ad-frame errors | Classified as third-party by host (`live-suite.mjs:87`, `:194`) and deliberately not counted as app failures (B6). They are evidence for ISSUE-002, not a check failure. |
| Counter counts main questions, not every rendered group | Verified correct in A4; unchanged. |

### Prioritized action plan

| Priority | Issue | First step | Execution site |
|---|---|---|---|
| **P0** | ISSUE-001 | Configure mail delivery for the submission endpoint, then dry-run then confirm-send the E2E test | deployed backend |
| **P1** | ISSUE-002 | Gate the ad unit off the route, move `adsbygoogle.js` out of the root document, enforce the CSP | application repo |
| **P2** | ISSUE-003 | Ship the scheduler gate patch (or non-streaming shell); prove it with the race gate before/after | application repo |
| **P3** | ISSUE-004 | Remove or hint the duplicated condition items (using ISSUE-005's per-box verdicts) | application repo |
| **P4** | ISSUE-005 | Add the per-box control to the harness and re-measure the 11 seeds | this workspace |
| **P5** | ISSUE-008 | Extend the third-party classifier, replay seed 404001256 — **done 2026-10-16** (host + console source URL; probe `results/issue008-console-location-probe.mjs`, replay `results/issue008-replay.json`) | this workspace |
| **P6** | ISSUE-006 | Fix the suite version/count/README drift — **done 2026-10-16**; commit the harness, and decide on re-baselining the monitor — **still open** | this workspace |
| **P7** | ISSUE-007 | Deploy windows + build id in the page footer | app repo + release process |

P0–P3 need the application source or the deployed backend — the source is the clone §0 names. P5 and P6's drift are done
(2026-10-16, both verified by `results/check-phase2-docs.mjs`); P6's commit, its stale-baseline decision, and P4's
per-box harness control are the workspace-local work that remains, and P4 stays unstarted on purpose — it needs a
headful, box-by-box re-measurement rather than a guess. After any app-side fix: re-run the affected checks, then the full 200
(`bash run-200-campaign.sh`) and re-baseline the monitor (`node monitor.mjs --update-baseline`) only once the state is
accepted.

> **Approval gate.** No application source was touched, no package installed, no configuration changed, nothing
> committed; since the gate, the harness changes are the throttled replay's two optional flags (`--kbps`,
> `--latency`), the ISSUE-008 classifier (host + console source URL) and the ISSUE-006 version/count doc alignment.
> All 200 randomized tests, and their 400 kbps / 150 ms replay, are complete and documented in
> `LIVE-TEST-REPORT.md` (§8–§9) and this register. Please review the prioritized issues and step-by-step permanent
> solutions above. Reply **APPROVE** (or specify adjustments) and I will begin fixing **Issue #1**.

---

## Class A — application issues

### A1 · Third-party ads and analytics run on a health questionnaire — S1
**Evidence.** 3/100 desktop journeys logged errors from Google ad frames (`googlesyndication`, a
`csp.withgoogle.com/csp/frame-ancestors/...` CSP report, `ERR_BLOCKED_BY_ORB`), and the page HTML itself loads
`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7463404522334748`. The same route asks for
diagnoses, medications, mental-health history, substance use, criminal record and finances. Hosting analytics
(`~flock.js`, `/__l5e/events.124894084da8c432.js`) load unconditionally.
**Why it matters.** Third-party scripts on a page that collects health and financial disclosures is a privacy exposure
and a plausible state-law/consumer-protection complaint; the CSP is already reporting the ad frame as a violation
(`frame-ancestors 'self'`, report-only).
**Root cause.** Ad/analytics tags are injected site-wide rather than per route.
**Fix (ready to apply).**
1. Exclude `/practice-application` from the ad component — in the route or the layout that renders `<AdSlot />`, gate it:
   `const isPracticeRoute = useRouterState({ select: (s) => s.location.pathname.startsWith('/practice-application') })`
   and render the ad unit only when `!isPracticeRoute`.
2. Move `adsbygoogle.js` (and any ad component) out of the root document into the routes that are allowed to carry ads.
3. Promote the CSP directive from report-only to enforcing and tighten it:
   `frame-src 'self';` and set `frame-ancestors 'self'` without `Content-Security-Policy-Report-Only`. Keep
   `/api/csp-report` (already present) to catch regressions.
4. If analytics must stay for the pilot, load it only after explicit consent and never on the practice route.
**Verification.** Re-fetch the route and assert the HTML contains no `adsbygoogle` / `googlesyndication` reference; run
`live-suite.mjs --only=1 --runs=1` and assert `thirdPartyErrors` is empty and the `no_failed_requests_from_app` check passes.

### A2 · Intermittent React hydration mismatch (React #418) — S2, root cause found and reproduced
**Evidence.** One journey in 100 (`seed 42000132`, run 7, build `bd8cab47`) logged
`Error: Minified React error #418 ... args[]=HTML&args[]=` — an **element-level** (not text-level) hydration mismatch.
All 24 functional checks in that journey passed, and a same-seed replay was clean, so it is timing-dependent rather
than deterministic.

**Root cause (corrected, and now reproduced 20/20).** Not the app's markup and not the saved draft. React 19's
streaming (Fizz) hydration can start before the HTML parser has finished the shell; when a network chunk boundary
lands mid-shell and the client chunks are already cached, the claim walk runs out of siblings and React throws a
**false fatal #418** and re-renders the document even though the server HTML is correct. This is upstream
**facebook/react#37321** (open, opened 2026-08-19) and its preconditions are this app's shape: streaming SSR
(TanStack Start), client chunks in the HTTP cache, slow chunked delivery. Rate is speed-sensitive, which is exactly
the observed picture: 1/100 un-throttled, 0% at 1500 kbps, **100% (20/20) at 400 kbps / 150 ms** — the gate
`hydration-race-gate.mjs` builds those conditions and reproduces the campaign's exact signature on demand.

Two rival hypotheses were measured and rejected:
- *saved draft rendered at first paint* — `probe-hydration.mjs`: A (no draft) 0/30, B (draft pre-seeded) 1/30 then
  0/120, C (load → answer → reload) 0/30 ⇒ 1 mismatch in 180 targeted loads, no repeatable effect;
- *a script writing attributes on `<html>`* (a literal reading of `args[]=HTML`) — `probe-html-mutation.mjs` traps
  `setAttribute`/`removeAttribute`/`classList`/`className` on the document element plus an attribute
  MutationObserver: 40/40 loads show **no write to `<html>` at all** (only the server-rendered `lang="en"`, ads
  script present on all 40).

**Fix (app repository; ready to apply).**
1. Primary: ship the upstream reporter's verified workaround as a `patch-package` gate on the bundled scheduler —
   defer React work while `document.readyState === "loading"` or `window.$RB` is non-empty (upstream: 4/12 cold
   boots failing unpatched vs **0/36 gated**). Exact patch text in `HYDRATION-ROOT-CAUSE.md` §4.
2. Alternative: serve the route without streaming SSR, removing precondition 1 (verify against the installed
   TanStack Start version first).
3. Belt and braces, and worth doing regardless: read `localStorage` in a mount effect rather than in `useState`
   initialisers/render, with an identical server/first-client shell — it cannot cause this defect but it removes the
   *other* hydration-mismatch family.
4. Do **not** paper over it with `suppressHydrationWarning`: React still discards the SSR DOM, and the fatal
   variant's `parentNode` cascade can still fire.

**Verification.**
1. `node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150` — **before: 20/20 mismatches, exit 1**;
   after the patch it must be 0/20, exit 0. Same-run cause-and-effect proof in about a minute.
2. `node hydration-race-gate.mjs --runs=30` (1500 kbps) as an independent second condition — currently 0/30.
3. The randomized suite now gates it directly: new checks `no_hydration_mismatch` and `no_hydration_dom_wipe`
   (the post-wipe `Cannot read properties of null (reading 'parentNode')` cascade) fail the build on recurrence.
   Verified in both directions: clean pilot 6/6 with both checks green; `--only=1 --injectHydration=1` fails
   `no_hydration_mismatch` only, `appFailures: 1`, exit 1.
4. `node live-suite.mjs --runs=100 --seed=42` — the re-run of the 100 journeys under the gate.

### A3 · Thirteen condition items give no feedback when ticked — S3
**Evidence.** Measured one item at a time: Cigarettes, Cigars, Pipe, Bidis, Snuff, Chewing tobacco, Oral nicotine
pouches, Nicotine patch, Hookah, Parachuting, Professional sport, Rodeo events (and Sky diving in one state) add **no new
control anywhere** when ticked. Their detail questions already render in section 3 (Nicotine: Bidis, Chewing tobacco,
Cigarettes, Cigars, E-cigarettes, Hookah, Nicotine gum/patch/aerosol, Oral nicotine pouches, Pipe, Snuff, Vapes) and
section 5 (Risky Behavior: Parachuting, Professional sport, Rodeo events, Sky/scuba/skin diving, Rock or mountain
climbing, racing). By contrast Stroke, Autism, Schizophrenia, ADHD/ADD, OCD, Arthritis, Asthma and Sleep Apnea open
follow-ups (+43 controls for Stroke, reproduced in four separate page states).
**Why it matters.** The health list reads as "tick what applies to you"; for these items nothing visibly happens, so a
user cannot tell whether their click registered.
**Root cause.** The health list duplicates items owned by other sections.
**Fix (ready to apply).** For the duplicated items, either remove them from the health list, or keep them and add a hint
that links to the owning section (e.g. on tick, show "asked in section 3 — Nicotine") and focus that section's heading.
**Verification.** For each of the 13 items, ticking produces either a new control or a visible hint, and
`ticking_conditions_keeps_page_healthy` stays green.

### A4 · Answer counter reports "Main questions answered" and counts 62 of 74 rendered groups — **not a defect**
Every click advanced the counter by 0 or 1, never more; the label itself says *main* questions, and the 12–18 uncounted
groups are conditional sub-questions. Closed with no action, recorded here so it is not re-raised as a bug.

### A5 · Production redeployed mid-session — S4
Build prefix `psr2.631bea88…` (counter max 62) at session start, `psr2.bd8cab47…` (max 63) later. No individual journey
mixed builds, but a deploy landing inside a run set could invalidate results silently.
**Fix.** Harness now records the build for every journey and reports `singleBuild` (done — B5). Release side: deploy
outside campaign windows, and surface the build id in the page footer so a tester can see what they tested.
**Verification, and a live recurrence.** On the first clean campaign `singleBuild: true` with the prefix recorded per
journey. On the re-run of the same 100 journeys a deploy landed mid-campaign and the guard did its job:
`singleBuild: false`, with the build changing at run 37 — `psr2.bd8cab47…` for runs 1–36 (36/36 passed) and
`psr2.1f54172e…` for runs 37–100 (64/64 passed). Both builds were clean, so nothing was invalidated, but a campaign
that straddles two builds cannot be read as one result — which is exactly what the guard exists to tell us.

---

## Class B — harness defects, all fixed and verified

| # | Defect found in the audit | Fix applied | Verified by |
|---|---|---|---|
| B1 | Three divergent harnesses (v1/v2/v3) with different checks | One maintained suite `live-suite.mjs`; older files retained only as frozen records | pilot green, `--help` flags documented, exit codes meaningful |
| B2 | Conditions located by positional element handle; **and** the ticker read `el.checked` on a `role="checkbox"` **button**, concluded "not checked" and blindly re-clicked — toggling the control back off. Playwright's `check(force)` on a Radix control *reports success while the app ignores it*, so the rig could record phantom ticks | Resolve by accessible name at click time; use Playwright `isChecked()` (reads `aria-checked`); verify before each action and never click twice; assert the ticked element's own label equals the requested name | `probe-tick-methods.mjs` shows the real markup (`button[role=checkbox]` + hidden mirror input); pilot ticks Cigars / OCD / Parachuting / Asthma+Emphysema by name with `ticked_element_matches_request` green |
| B3 | Assertion demanded a *radiogroup* appear after ticking a condition → 12/100 false failures | Assert page health + answer preservation; count every control type; report new-control totals | the four previously "failing" journeys now pass; `newControls` recorded (0 for duplicated items, 9–43 for real ones) |
| B4 | `QUESTION_MAX` hardcoded 62 | Read the maximum from the page per journey | `counterMaxSeen: [63]` recorded on the current build |
| B5 | Build identity not normalised; no mid-campaign guard | Capture `x-deployment-id`, compare prefixes, report `singleBuild`/`builds` | `singleBuild: true`, prefix `psr2.bd8cab47-114d-4ba0-ba30-1e3301938704` |
| B6 | Third-party ad errors counted as app failures (2/100 false failures) | Classify by host into `thirdPartyErrors` vs `networkErrors` | campaign reports `runsWithThirdPartyErrors` separately; app network-error check clean |
| B7 | Every interaction wrapped in `.catch(() => {})` — steps could silently no-op | Record soft errors; `no_swallowed_errors` check | pilot and campaign show `runsWithSoftErrors: 0` |
| B8 | A failure could not be distinguished from a flake (I had to replay run 7 by hand) | Same-seed auto-replay; classify flake vs reproduced; flakes count as passed with detail retained | `--injectFlake` → `flakyRuns: 1`, `reproduced: false`, exit 0; `--injectFailure` → `reproduced: true`, exit 1 |
| B9 | No evidence captured at failure time | On failure write screenshot + HTML + console/notes to `results/evidence/` | injected failure produced `run-2-attempt-1.{png,html,log}` and `-attempt-2.*` |
| B10 | Exit code not gated on app-level failure | Exit non-zero only when an app-level failure survives replay (or the rig itself failed) | injected failure exit 1; flake exit 0; clean pilot exit 0 |
| B11 | Flake detected and recovered on replay, but the rollup still exited 1 | Count replay-recovered runs as passed | re-ran the flake injection → `flakyRuns: 1` and exit 0 |
| B12 | No dedicated hydration check: a mismatch hid behind green functional assertions (exactly what happened to run 7) | Added exit-gating `no_hydration_mismatch` (`#418`/`#423`/`#425`) and `no_hydration_dom_wipe` (the post-wipe `parentNode` cascade), plus `--injectHydration=N` to prove the gate has teeth | clean pilot `--runs=6` → both checks 6/6, exit 0; `--only=1 --injectHydration=1` → `no_hydration_mismatch` fails, `appFailures: 1`, exit 1; then 100/100 desktop and 25/25 mobile under the gate |

A defect the audit found in the *audit itself*: the earlier report's "12 of 100 runs failed a condition check" was a
measurement artifact of B2/B3, not an application defect. Corrected in the final report.
