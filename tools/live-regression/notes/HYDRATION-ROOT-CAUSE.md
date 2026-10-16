# The intermittent React hydration mismatch — root cause, fix, and how it was proved

**App:** `https://lifeinsurancebrokeradvocate.com/practice-application` (production, Lovable-hosted, React 19 + TanStack Start)
**Symptom:** run 7 of the first 100-journey campaign threw
`Error: Minified React error #418 ... reactor.dev/errors/418?args[]=HTML&args[]=` — an **element-level** hydration
mismatch. Every functional check in that journey still passed, and a same-seed replay of that exact journey was clean.
**Status: root cause identified and reproduced on demand (20/20).** It is not the application's markup and not the
saved draft; it is a known React 19 streaming-hydration defect that this app's delivery conditions trigger.

---

## 1. What the original evidence actually said

| Clue | Reading |
|---|---|
| `#418` (not `#425`) | An **element/structure** mismatch. `#425` is the text-mismatch variant. |
| `args[]=HTML` | The arg is the *kind* of mismatch ("HTML" = element tree), not "the `<html>` element". An attribute-level theory was tested and rejected (§3). |
| 1 occurrence in 100 journeys | Rare but real. |
| Same-seed replay clean | Timing-dependent, not state-dependent. |
| Every functional check passed | The mismatch does not corrupt the worksheet; React discards the server DOM and client-renders instead. |

## 2. Root cause

React 19's streaming (Fizz) hydration can begin **before the HTML parser has finished the body**. If a network chunk
boundary lands mid-shell while the client chunks are already in the HTTP cache, the hydration claim walk runs out of
siblings and React throws a **false fatal `#418`** and re-renders the document from scratch — even though the server
HTML is byte-for-byte correct. Upstream report: **facebook/react#37321**, *"streaming hydration can overtake the HTML
parser — false fatal #418 (args HTML) wipes the SSR DOM when a network chunk boundary splits the shell"* (opened
2026-08-19, still open). Its stated preconditions are exactly this app's shape:

1. streaming SSR — this app is TanStack Start, which streams;
2. the client JS chunks **already in the HTTP cache** (the upstream reporter measured the *first* load of a cold cache
   as consistently clean and every warm-cache load after that as failing);
3. slow, chunked document delivery;
4. reported rate un-throttled: ~5–17% per cold boot, which is the order of the 1-in-100 seen in the campaign.

Two candidate causes were eliminated first:

- **Saved draft rendered at first paint** (the original hypothesis). Measured directly with `probe-hydration.mjs`:
  scenario A (fresh load, no draft) **0/30**, scenario B (draft pre-seeded before first paint) **1/30 then 0/120**,
  scenario C (load → answer → reload) **0/30**. No repeatable effect: **1 mismatch in 180 targeted loads**.
- **A script writing attributes on `<html>`** (which `args[]=HTML` could have meant). Measured with
  `probe-html-mutation.mjs`, which traps `setAttribute`/`removeAttribute`/`classList`/`className` on the document
  element plus an attribute MutationObserver: **40/40 loads showed no write to `<html>` at all** — the element keeps
  exactly its server-rendered `lang="en"`, with the ads script present on all 40. Rejected.

## 3. Reproduction — `hydration-race-gate.mjs`

The gate builds the preconditions instead of hoping for them: one **persistent browser profile** (so the client chunks
stay in the HTTP cache after a warm-up load) and then N loads with CDP
`Network.emulateNetworkConditions`, and it deliberately injects **no observer into the page** — the upstream report
found that attaching a MutationObserver suppresses the race almost completely (40/40 clean), so an instrumented page
cannot measure this defect.

| Condition | Result |
|---|---|
| warm cache, 1500 kbps / 20 ms, 30 loads | 0 mismatches |
| **warm cache, 400 kbps / 150 ms, 20 loads** | **20 mismatches — 100%** |

Every hit carries the campaign's exact signature, e.g. run 1:

```
Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=
```

The `wipeCascade` counter (React's post-wipe `Cannot read properties of null (reading 'parentNode')`) stayed at 0,
which matches the upstream reporter's "recoverable variant" note: this page has no streamed Suspense segment in
flight, so React re-renders the subtree instead of crashing the streamed completion scripts. The defect is the same
either way.

That the rate is **speed-sensitive** — 0% at 1500 kbps, 100% at 400 kbps — explains the whole original picture: 1 in
100 un-throttled journeys, never reproducible by seed, and a clean replay. Raw data:
`results/hydration-race-gate.json`, `results/html-mutation-probe.json`, `results/hydration-probe.json`.

## 4. The fix

**Fix 1 (primary, app repository).** Ship the upstream reporter's verified workaround, a `patch-package` gate on the
bundled scheduler that defers React work while the document is still parsing:

```js
// patch-package: scheduler — gate on parse completion (react/react#37321)
function performWorkUntilDeadline() {
  if (
    typeof document !== "undefined" && document !== null &&
    (document.readyState === "loading" ||
      (typeof window !== "undefined" && window.$RB != null && window.$RB.length > 0))
  ) {
    if (isMessageLoopRunning) localSetTimeout(performWorkUntilDeadline, 8);
    return;
  }
  // ...unchanged original body
}
```

Upstream measured **4/12 cold boots failing unpatched vs 0/36 gated** under the same adversarial conditions.

**Fix 2 (alternative, if the framework exposes it).** Serve the route without streaming SSR (a synchronous
`renderToString`-style shell), which removes precondition 1 entirely. This is the cleaner permanent option if
TanStack Start supports it in this project's version — verify against the installed version's docs before adopting,
and confirm with the gate below either way.

**Fix 3 (belt and braces, independent of React internals).** The draft-dependent render pattern is still worth
removing as a class of hydration risk, and it costs nothing: read `localStorage` in a mount effect, not in a
`useState` initialiser or during render, and render a stable shell (identical server/first-client markup) until
mounted. It does not fix this defect, but it prevents the *other* hydration-mismatch family from ever appearing.

**Do not** "fix" this with `suppressHydrationWarning`: that silences the visible error while React still throws the
server DOM away, and the FATAL variant's `parentNode` cascade can still fire.

**Nothing here is needed for the app's functional correctness.** The worksheet itself is intact across all 125
full journeys; this is a rendering-race defect with a real cost (a wasted document re-render, console noise, and
an error that would mask a genuine mismatch in future runs).

## 5. How the fix is verified

1. `node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150` → today **20/20 mismatches (exit 1)**. After the
   patch it must report **0/20 (exit 0)**. This is the same-run proof of cause and effect, in about a minute.
2. `node hydration-race-gate.mjs --runs=30` (milder throttle) as a second, independent condition.
3. `node live-suite.mjs --runs=100 --seed=42` — the randomized suite carries dedicated checks
   (`no_hydration_mismatch`, `no_hydration_dom_wipe`), so a recurrence in ordinary journeys fails the build rather
   than hiding behind still-green functional assertions.
4. The gate's own teeth are verified by `node live-suite.mjs --only=1 --seed=7 --injectHydration=1`, which injects a
   synthetic `#418`: it must fail **only** `no_hydration_mismatch` and exit non-zero (observed: `appFailures: 1`,
   `no_hydration_mismatch fail: 1`, exit 1). A clean pilot (`--runs=6`) must pass both new checks (observed: 6/6).

---

## 6. Applying the fix in the application repository — tested commands

Everything below was run and its output observed here, against real `scheduler` builds (react 19.2.8 / scheduler 0.27.0),
so the only unverified step is the app repo itself.

```bash
# 1. insert the gate into the installed scheduler (bundler-visible CJS builds, production + development)
node make-scheduler-gate.mjs --repo=/path/to/app-repo
#    → gated node_modules/scheduler/cjs/scheduler.production.js (+524 bytes)
#      gated node_modules/scheduler/cjs/scheduler.development.js (+572 bytes)
#    idempotent: a second run reports "already gated (unchanged)"; both files pass `node --check`

# 2. prove the mechanism locally before building the app
node test-scheduler-gate.mjs --repo=/path/to/app-repo
#    ungated → "ran during parse: 0ms"        (work starts mid-parse: the race window)
#    gated   → "ran during parse: no | after parse: 64ms"   (deferred, then runs once parsing completes)

# 3. freeze it so reinstalls keep it
npx patch-package scheduler
#    and add to package.json:  "postinstall": "patch-package"

# 4. build and run the app locally, then verify the race is gone on the local build
node hydration-race-gate.mjs --url=http://localhost:<port>/practice-application --runs=20 --kbps=400 --latency=150
#    before the gate this same command reports 20/20 mismatches, exit 1
#    after the gate it must report 0/20, exit 0

# 5. after deploying: production gate + the randomized suite
node hydration-race-gate.mjs --runs=20 --kbps=400 --latency=150
node live-suite.mjs --runs=100 --seed=42
```

Measured today: the ungated builds run scheduled work **0 ms** after scheduling while `document.readyState === "loading"`;
the gated builds do not run it at all during parse and run it **64 ms** later, once the document is complete. The
production gate currently reports **2/2 and 20/20 mismatches at 400 kbps / 150 ms** (exit 1) and **0/30 at 1500 kbps**,
which is the before-state every one of steps 4–5 is measured against.
