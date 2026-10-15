# Runtime drift probe — the daily production whistle that could not open its issue

**Status: APPLIED (repository side), 2026-10-14.** This record corrects a defect in the repository's own monitoring automation. It changes no probe threshold, no schedule, no production surface, and no user-facing claim.

Related: `.github/workflows/runtime-drift-probe.yml`, `tests/runtime-drift-probe-workflow.test.ts`, `tests/decay-watch-artifact-handoff.test.ts` (the cross-workflow invariant this defect motivated), `.github/workflows/citation-decay-watch.yml` and `docs/citation-decay-probe-outcome-policy-2026-10-14.md` / `docs/va-gov-probe-handoff-policy-2026-10-14.md` (the two sibling probes whose hand-offs were corrected first).

## The defect this closes

`runtime-drift-probe` is the only daily signal that production still reports `ready` on `/runtime-readiness` and `healthy` on `/api/health` between deploys. When it detects drift it is supposed to open a tracking issue so an operator acts. It could detect drift and not tell anyone.

Three mechanisms combined, and each is provable from the workflow alone:

1. **The evidence was written in one job's workspace and uploaded from another.** The check step writes `drift.txt` in the `probe` job (`cp "$tmp_dir/drift.txt" ./drift.txt`), but the upload lived in a separate job, `upload-drift-artifact`, which has **no checkout step** (verified: zero `checkout` references in that job). GitHub job workspaces are separate runners, so that workspace had no drift file; with the action's no-files behaviour the run produced no usable artifact.
2. **The downloader and the uploader ran in parallel.** `report-drift` and `upload-drift-artifact` both declared only `needs: probe`, with no dependency between them, so the notification job began the moment the probe finished and raced the uploader.
3. **The download failure was fatal and silent.** The download step had no tolerance, so it failed before the reporting payload's first `gh` call. The result was a red scheduled run in the Actions history and no issue, no comment, no summary line — nothing an operator would look at.

Net effect: the readiness/health signal this workflow exists to keep alive could go dark on production without a single notification, which is worse than having no probe — a green-looking daily schedule would read as "production is fine".

## The decision

1. **Upload from the job that writes the file.** The drift details are now uploaded by a step inside `probe` (`if: always()` so a drifted run still keeps its evidence) with `if-no-files-found: ignore` (a green run has no drift file, and a warning every day is noise). The separate `upload-drift-artifact` job is deleted.
2. **Notify from the probe's own output, not from an artifact.** The check step publishes the drift lines as the job output `drift_lines` (heredoc-delimited), and `report-drift` reads `needs.probe.outputs.drift_lines` into `DRIFT_LINES`. The notification path therefore touches no artifact at all: there is no download step left to fail, no cross-job workspace assumption, and no race.
3. **An empty detail set still opens the issue.** The outcome is known from the probe's own failure, so when the details are missing the body now says so explicitly ("Drift was detected but this run did not carry its details… read the run's step summary and log") instead of the payload throwing on a missing file. Losing the details costs context; losing the notification cost the signal.
4. **Everything else is unchanged.** Both signals and their thresholds, the daily 04:11 UTC schedule, the exact-commit boundary (`Production Runtime Readiness` still owns lineage and the route matrix), the permissions split (`probe` is read-only and never comments), the "no response body is ever pasted into an issue" rule, and the close-on-green job all stay as they were.

## Verification (and what it does not cover)

- **The check step was executed end to end**, extracted from the workflow: against the live production URL it reports green (`readiness ready=true`, `health healthy`, `drifted=false`), and against a local fake production answering `not_ready` plus a 503 health it reports drift, writes `drifted=true`, writes the heredoc `drift_lines` output, writes `drift.txt`, and exits 1 — the exact state that makes `report-drift` run.
- **The reporting payload was executed** with a stubbed `gh`: with details it opens the issue and lists them; with `DRIFT_LINES` empty it still opens the issue with the fallback line. The payload is also syntax-checked (`node --check`) by the test suite, so YAML/quoting damage in the heredoc cannot reach a drifted production run unnoticed.
- **The job graph is pinned, and the general shape is now a repository invariant.** `tests/decay-watch-artifact-handoff.test.ts` scans every workflow and fails if any job downloads an artifact without `needs:`-ing the job that uploads it (or uploading it itself). That check reports `report-drift` against the pre-fix workflow from git and nothing against the fixed one, so it catches the real defect rather than only the synthetic description of it.
- **Not covered:** the GitHub runner path itself. Payloads and the check step ran locally; `gh` was stubbed, artifact upload semantics were reasoned from job isolation rather than observed, and no production drift was induced to watch a real issue open.

## Enforcement

| Surface | What it enforces |
| --- | --- |
| `.github/workflows/runtime-drift-probe.yml` | upload inside the producing job with `always()`; the `drift_lines` output; no artifact on the notification path; the empty-details fallback |
| `tests/runtime-drift-probe-workflow.test.ts` | the upload's location and flags, the deleted sibling job, the output wiring, the fallback wording, no `readFileSync("drift.txt")` on the reporting side, and `node --check` over the embedded payload |
| `tests/decay-watch-artifact-handoff.test.ts` | the cross-workflow invariant (a downloader must `needs:` its uploader), with a falsifying case for the pre-fix shape |

## Standing follow-ups (not done here)

- **Nothing asserts that a green run produced evidence.** A probe that silently probed nothing and exited 0 would still read as green; the drift path is the one that matters, and it is now either a notification or a red run, but the inverse (a green run that never actually checked) remains unguarded.
- **The same class should be assumed present in any new monitor.** It is now pinned mechanically for artifacts, but the wider shape — a monitor whose notification depends on an untested plumbing hop — is why three consecutive scheduled workflows in this repository had to be repaired in one day.
- **`VA_Lighthouse_Readiness_Report.md` still says only two workflows carry a `schedule:` block.** That was true when written; it is not now (the drift probe and the scheduled dependency audit both do). Left as-is because it is a dated record, not a live inventory.
