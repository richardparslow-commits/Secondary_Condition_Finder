# Section 508 Review — Session Preparation Pack

Companion to [the manual review workbook](section508-manual-review-workbook.md). This pack converts every workbook row into a procedure, so the human session is observation and recording rather than design work.

## What this pack is — and what it deliberately is not

**It fills no workbook row.** Not one `Result` cell, not one coverage checkbox, not the session conclusion. The workbook's own rule is that a result cell must come from a human tester on an identified build, and the repository enforces it: the session-identity rows must stay blank in the committed file, every result defaults to `NOT TESTED`, the resolver in `scripts/resolve-review-build-identity.mjs` is tested to be incapable of emitting a verdict, and `tests/accessibility-ux-reliability.test.ts` fails if the workbook ever contains a pre-ticked row.

Three specific reasons those answers cannot be pre-drafted:

1. **The build is not fixed.** `main` advances; an answer drafted against one commit is invalid on the next, and issue #195 prohibits evidence that is not attributed to an exact build.
2. **Automation measures the DOM, not perception.** The suites establish structure, computed contrast, and focus presence. They cannot establish whether an announcement made sense, whether a focus order was logical, or whether an error message was understandable — which is what most of these rows ask.
3. **Pre-drafting an answer is the failure mode the workbook exists to prevent.** A row that says `PASS` because a gate was green is exactly the "infer PASS from automated tests" the workbook forbids.

What the pack does instead: it says, for each row, *what to do*, *what you should observe*, *what has already been measured so you do not spend the session re-measuring it*, and *what automation cannot tell you*. The remaining human work is judgement and recording.

## Before the session (about 20 minutes, no accessibility judgement required)

### 1. Establish the build

```bash
node scripts/resolve-review-build-identity.mjs
```

Run it immediately before testing and paste the resolved rows into the workbook's session-identity table. Then confirm the canonical production alias is serving that exact commit before recording anything. If `main` moves mid-session, finish against the recorded deployment or start a second session record — never merge evidence across builds.

### 2. Confirm the remediation ordering still holds

`VA_Lighthouse_Readiness_Report.md` §7 requires the session to fall after R-02 and R-07. Both are merged (workbook's remediation table). Re-read that table; if a later remediation lands that changes the same surfaces, check whether it invalidates the session before starting.

### 3. Pull the automated corroboration, so the session does not repeat it

| Corroboration | Where | What it already establishes |
|---|---|---|
| R-05 contrast + keyboard gate | CI `verify` → `Run real-browser contrast and keyboard gate (R-05)`, evidence in the `ci-diagnostics-<run_id>` artifact | axe `color-contrast` and `link-in-text-block` clean on all 26 shipped routes, light host and emulated dark host; per-route evidence plus `route-inventory-report.md` |
| Full-route axe gate | CI `verify` → `Run Playwright axe gate on every route`, `a11y-evidence/full-axe.json` | WCAG 2.1 A/AA rules clean, zero serious/critical, on every declared route, in both the light host and an emulated dark host |
| Route coverage | `npm run report:route-inventory` | Which routes a run actually covered, and whether any evidence is missing or degraded |

Read these as **corroboration of what the session is not being asked to re-measure**. Do not copy any of it into a result cell.

### 4. Assemble synthetic data in advance

The test-data rule is absolute: synthetic only, never a real Veteran's records.

- Secondary path: synthetic diagnosed conditions, synthetic service-connected answers, synthetic ratings.
- Evidence upload: one synthetic PDF, one synthetic DOCX, one synthetic `.txt`.
- Presumptive path: one synthetic DD-214 **image**, one synthetic **scanned/mixed PDF**, with a masked SSN present so the Show/Hide row is reachable.

Prepare these before the clock starts; the file-input rows cannot be exercised without them.

### 5. Confirm the environments the tables name

| Workbook column | Requires |
|---|---|
| Keyboard-only | Keyboard only, pointer physically moved away or disabled |
| `NVDA + current Chrome/Edge` | Windows + NVDA, speech or braille output actually reviewed |
| `VoiceOver + current Safari` | macOS + VoiceOver |
| 200% zoom / reflow | Browser zoom at 200%, not just a narrow window |
| Forced colours | A real Windows high-contrast/forced-colours session |

If any of these is unavailable, the honest result is `BLOCKED` with the reason — that is a recorded result, not a skipped row.

## Per-route procedure (applies to every route row)

Repeat for each row of the coverage matrix. Roughly two minutes per plain route.

1. **Load the route fresh** (not via in-app navigation, so the initial focus and title are the ones a direct arrival produces).
2. **Read the document title and the `h1`.** Do they name the page a user would recognise? Is there exactly one `h1`?
3. **Press Tab from the top.** The skip link should appear first and, when activated, move focus into the main content. Confirm focus lands *in content*, not merely at the top of the page.
4. **Tab the whole route**, recording the order in the evidence notes. Ask: does the sequence follow the visual reading order? Does focus ever stop on something invisible or non-interactive, or skip something actionable?
5. **Shift+Tab back** through at least five stops. Order should be the reverse; no jump elsewhere.
6. **Watch the focus indicator on every stop.** It must be clearly visible against that element's own background, including on dark or coloured surfaces.
7. **Operate one control of each kind without the pointer** — a link, a button, a checkbox/radio, a text field, a file input, a disclosure. Enter/Space behaviour should match the control's role.
8. **At 200% zoom**, check the same route for clipping, overlap, and unexpected two-dimensional scrolling.
9. **In forced-colours mode**, check that focus, selected state, and status remain distinguishable and that nothing disappears.
10. **Record** the route, the synthetic data used, and your notes. A route being reachable is not a pass; the note must say what you exercised.

## Bespoke workflow rows

These coverage rows need more than the per-route pass. Each one is a single workbook row, but the observable is specific.

| Workbook row | Exercise | What to judge |
|---|---|---|
| Secondary Steps 1–6 (`/secondary/diagnosed` … `/secondary/evidence`) | Walk the six steps with synthetic answers, keyboard only, then repeat once with NVDA or VoiceOver running | Step headings and progress are understandable out of visual context; the step change announces somewhere sensible; earlier answers remain reachable |
| Priority 1/1B evidence — synthetic PDF / DOCX / text | One upload per format | File input is operable and named by keyboard; extraction state (working / done / warning / error) is understandable without colour; the same is true with speech output |
| `/presumptive` DD-214 OCR — image | Upload the synthetic image DD-214 | Progress and completion are conveyed non-visually; a failure says what to do next |
| `/presumptive` DD-214 OCR — scanned/mixed PDF | Upload the synthetic scanned PDF | Same, plus: does partial extraction get described in words? |
| `/presumptive` extracted-field verification | Review and correct an extracted field, then confirm | Labels, current values, and the confirm action are announced with name and state; editing is reachable by keyboard |
| `/presumptive` masked-SSN Show/Hide | Toggle with keyboard, then with speech on | The control's state is announced, and the redaction-limit notice is discoverable, not decorative |
| `/presumptive` "Show extracted text" | Expand the disclosure, then scroll the raw-text region | Expanded state is announced; the scroll region is reachable and labelled |
| `/pathways` | Tab every card and its action | Card actions are named distinguishably — not a run of identical "Learn more" labels |
| `/va-account` sandbox | Inspect the disabled state and consent copy | Disabled controls announce as unavailable; consent copy is complete when read linearly |
| Workflow completion controls | Use confirm, clear, download, finish/restart | Each is operable by keyboard, named distinctly, and destructive actions are unambiguous |
| `/va-reference` filters | Filter, then read the notice and the result count | The count announcement is truthful and timely; the privacy notice is part of the reading order, not an afterthought |
| `/scenarios` | Launch a demo scenario | The synthetic-data notice is read before the launch action in reading order |
| `/privacy/request` | Follow the prepared `mailto:` link and copy the message text | Link purpose is clear out of context; the copyable text is complete and selectable by keyboard |
| Global footer disclaimer | Read it on two different routes | Present, in the reading order, and identical |

`/runtime-readiness` is a legitimate small surface: the keyboard walk records a single visible tabbable element on it, and the route inventory reports that as *degraded* rather than failed or hidden. Verify the skip link, the heading, and that one control; do not file "focus leaves the page after one Tab" as a keyboard trap.

## Row-by-row guidance for the four evidence tables

### Keyboard-only

| Check | How to exercise | Pass looks like | Automation cannot tell you |
|---|---|---|---|
| Skip-to-main link | Tab once on arrival, activate, then Tab again | Link appears, activating it puts focus in main content, next Tab continues inside it | Whether the skip target's landing point is sensible |
| Tab / Shift+Tab order is logical | Full cycle, both directions, on the rows you record | Order matches reading order; reverse order reverses | Logic, which is a judgement |
| Focus indicator visible on every actionable element | Stop on each one; note any you have to hunt for | Indicator is obvious on every element, on every surface | Whether it is *clearly* visible at normal viewing distance |
| No keyboard traps | Tab and Shift+Tab through each workflow, including dialogs, disclosures, and the OCR steps | Focus always leaves the way it came | Anything about focus management across state changes |
| Controls operate without a pointer | Enter/Space on each control kind | Correct action fires; state changes visibly | — |
| Focus after navigation | Complete a step transition, then Tab | Focus lands on the new content or its heading, not the page top or a stale control | Whether the landing point matches user expectation |
| Focus after validation | Submit an incomplete Secondary step | Focus moves to the error summary or the first invalid field, and the error is findable | Whether the placement is *reasonable* |

### Forms, validation, and status

| Check | How to exercise | Pass looks like | Automation cannot tell you |
|---|---|---|---|
| Accurate accessible name | With speech on, Tab through every control on each step and the upload surfaces | Each control announces a name that matches its visible label and purpose | Accuracy against meaning — only hearing it tells you |
| Required state without colour/placement | Find required fields by reading only | Required-ness is stated in text or by attribute, not by an asterisk's colour alone | Whether instructions are understandable |
| Errors programmatically associated | Trigger each validation path, then focus the field | The error is announced as part of the field | Association exists in the DOM; whether it *reads* well is manual |
| Error/status announced | Trigger success, warning, and error states on evidence extraction and Secondary validation | A live announcement occurs and says what changed | Timing and politeness in practice |
| Incomplete Secondary answers keep context | Leave a step incomplete, come back | The question and the reason for the error are still evident | — |
| Extraction states understandable without colour | Force one success, one warning, one failure on local evidence | Each state says in words what happened and what to do | — |
| VA reference source/environment/cache/fallback status | Load `/va-reference` in each reachable state | Status is legible as text and in reading order | Whether the vocabulary is understandable to a non-engineer |

### Screen reader

Run every row in **both** columns, and keep the observations separate — the two engines fail differently, and collapsing them loses the finding.

| Check | How to exercise | Pass looks like |
|---|---|---|
| Titles and heading context | Land on each route from a fresh load; read the title, then navigate by heading | Title names the page; heading structure gives a usable outline |
| Landmarks and navigation | Use the screen reader's landmark list on each route | One `main`, a labelled navigation region, named complementary regions — each announceable and distinguishable |
| Control label/state/required/error | Tab through a Secondary step and the upload panels | Name, role, state, required, and error are all spoken |
| Dynamic validation/status announced | Trigger validation and extraction states | Announcement happens without moving focus away by hand |
| Evidence excerpts, provenance, warnings, nexus labels | Open an evidence result with synthetic content | Reading order matches meaning; provenance is attached to the excerpt it describes |
| VA reference filtered count + fallback status | Filter, then listen | The count is announced and matches the visible result set |
| No meaning conveyed only visually | Read a page with the display covered, or in forced-colours, while listening | Nothing essential is lost without sight of the layout |

### Zoom, reflow, contrast, display mode

| Check | How to exercise | Pass looks like | Automation cannot tell you |
|---|---|---|---|
| 200% zoom readable and operable | Browser zoom 200% on every route type | Text reflows; controls remain usable | — (this is the row automation genuinely cannot reach) |
| No clipping/overlap/2-D scrolling | Same pass; watch for horizontal scrollbars on the page body and for content escaping containers | Content stays inside the viewport at 320 CSS px equivalent | — |
| Long condition names wrap | Use the longest synthetic condition in the catalogue | Wraps; nothing truncated without an accessible alternative | — |
| Evidence excerpts, citations, controls wrap | 200% on the evidence and citation surfaces | Labels and citations wrap; form controls stay aligned to their labels | — |
| Text contrast where automation is insufficient | Check **interaction states**: focus, hover, active, disabled, error, expanded | Every state keeps legible contrast against its own background | Computed colours do not capture perceived legibility |
| Component/focus/state contrast | Same states, plus selected/checked | States are distinguishable by more than a subtle shade | — |
| Windows forced-colours | Real high-contrast session, every route | Focus, controls, selected states, and status survive; nothing vanishes | Emulation is not this |
| Not colour alone | Find every colour-coded signal (status, warnings, selected, required) | Each carries text, icon, or pattern too | — |

## Known traps — do not file these

- **`nextjs-portal` / dev overlay.** Exists only in the dev server. A production session will not see it. Earlier keyboard counters were polluted by it; no keyboard finding should be derived from those counters.
- **Prior "keyboard walk" numbers.** The committed gate pressed the wrong WebDriver key until 2026-10-22 and recorded `distinct=1` everywhere. Any pre-2026-10-22 walk figure is not traversal evidence.
- **axe `incomplete` colour nodes.** They are `aria-hidden` decorative glyphs, not unresolved text contrast.
- **`/runtime-readiness` single tabbable.** The walk records one visible tabbable element there and the inventory marks the route *degraded*; see its row above.
- **`/results`.** A 307 shim to `/secondary`. Confirm the redirect lands somewhere accessible; it is not a reviewed route.
- **Repeated widgets re-keying.** A widget that re-mounts mid-walk can look like a trap. Re-key once before recording.

## Recording and exit

1. Work in a **copy** of the workbook during the session. The committed file keeps its blank identity rows and `NOT TESTED` defaults, because those are pinning the *template*'s honesty, not the session.
2. Fill every coverage row or record its exclusion with a reason.
3. Log every distinct material finding in the finding log with reproduction steps, severity, environment, and the remediation issue/PR it produced.
4. Append the completed session record — build identity, environment, per-table results, findings, retest outcomes — to [the accessibility audit](accessibility-audit.md), whose preamble must keep reading `PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING` until the record is complete.
5. Only then answer the four session-conclusion questions. They are conclusions over recorded evidence; each is answerable at that point, and none is answerable before it.
6. Exit criteria are unchanged and still the workbook's: every required item evidenced on an identified build, every material finding remediated and retested, the audit and the phase-3 checklist updated, and the conformance answer drawn from the record rather than from green CI.

## Why the sign-off is still verification

After this pack, the session's remaining work is: observe, judge, type what you observed. Nothing here decides a result for you — that boundary is what makes the record usable in a VA submission, and it is the same reason the resolver refuses to print a verdict.
