# Semgrep SAST — the weekly security gate that could not report its own failure

**Status: APPLIED (repository side), 2026-10-14.** This record corrects a defect in the repository's own automation, and two false statements in the same workflow file. It changes no scan rule, no gated severity, no schedule, and no product surface.

Related: `.github/workflows/codeql-sast.yml`, `tests/sast-monitor-handoff.test.ts`, `tests/dependency-sast-gates.test.ts`, `.github/workflows/dependency-scheduled-audit.yml` (whose header states the rule this defect broke), and the three sibling hand-off records corrected in the same week: `docs/citation-decay-probe-outcome-policy-2026-10-14.md`, `docs/va-gov-probe-handoff-policy-2026-10-14.md`, `docs/runtime-drift-probe-handoff-policy-2026-10-14.md`.

## The defect this closes

`codeql-sast.yml` runs Semgrep's `p/typescript` ruleset on PRs touching `src/` or `scripts/`, weekly (Wed 03:33 UTC), and on demand, and it *does* fail on findings — that half has worked since it shipped, and it caught a real one on its first run. The half that did not exist is the hand-off.

**It was the only scheduled workflow in this repository with no notification path.** Every sibling has one: `dependency-scheduled-audit` opens or updates one tracking issue on failure and closes it when a run is green; `citation-decay-watch`, `runtime-drift-probe` and `va-gov-walkthrough-probe` all maintain theirs in both directions. `codeql-sast.yml` had `permissions: contents: read`, a single job, no `gh` invocation anywhere in the file, and two steps: scan, then write a step summary. The rule it broke is written in this repository, in the header of `dependency-scheduled-audit.yml`:

> every scheduled workflow in this repository must be able to fail visibly without a commit

A red job in a private repository's Actions history is not a notification. Nobody is paged by a scheduled run's conclusion, and the only artefact a weekly failure produced was a line in a run list that a collaborator has to open. The two ways this gate can fail were therefore both silent:

| Scheduled outcome | What it produced before this change | What it produced that a human would see |
| --- | --- | --- |
| The ruleset or registry was unreachable, or the engine failed (semgrep exits 2/7) | a red run with an engine diagnostic in the log | nothing |
| ERROR-severity findings in unchanged code | a red run, and a summary on the run page | nothing |

The second row is the one this workflow exists for: the PR path already covers a finding introduced by a change, so a *scheduled* finding means a rule or ruleset change caught something that was already merged — precisely the class that must not wait for someone to browse the Actions tab.

### Two claims in the same file could not hold

Writing the correction surfaced two statements the workflow made about itself that its own command contradicts:

1. **"WARN/INVENTORY findings are surfaced in the step summary without blocking."** The scan runs `--severity ERROR`, which semgrep documents as *"Report findings only from rules matching the supplied severity level"* — a selection, not a threshold. No WARNING/INVENTORY finding ever reaches the output, so nothing could surface them; the summary step grepped a log that could not contain them.
2. **"Findings are printed as sanitised rule/file/line/location text; no source excerpts are echoed into logs or artifacts."** Semgrep's default text formatter prints the matched source lines, and this job piped that output through `tee` into the run log. The claim was false as written, in the one place a repository rule about not copying code into logs and issues matters.

Neither claim had a test that could catch it: they were comments. Both are now corrected rather than restated, and the shape of the correction is pinned (see Enforcement).

## The decision

1. **One outcome job maintains one tracking issue, in both directions.** `record-sast-outcome` (`needs: semgrep`, `if: always()`, `issues: write`) opens or updates the issue when the scan fails and closes it with a comment when a scheduled or manual run is clean. The title is a fixed marker the job searches with `in:title`, so only this workflow's issue is ever touched, and every `gh` call carries `--repo` because this job has no checkout to infer the repository from.
2. **PR runs never touch the issue.** The job is excluded by `github.event_name != 'pull_request'` rather than by reasoning about merge state: a PR's own failing check is the signal its author is looking at, and a PR must not open an issue about code that may never merge.
3. **Findings travel as data, not as an artifact or a workspace file.** The scan step writes the sanitized list — rule id, file, line, and nothing else — to a heredoc-delimited job output, and the reporting job reads `needs.semgrep.outputs.finding_detail`. There is no artifact to upload, no download step to fail, and no assumption that two jobs share a workspace: the three failure modes that cost the runtime drift probe its notification are all absent by construction.
4. **The two failure kinds are labelled differently, because they are different claims.** `semgrep` exits `1` for findings at the gated severity and `2`/`7` when the scan itself could not run. The exit code is carried as an output, and the issue body says either *"reported ERROR-severity findings"* and lists them, or *"did not complete, so this run is **not a finding** … the gate could not do its job"*. Reporting an engine failure as a finding would ask a human to hunt code that may be clean; reporting a finding as an engine failure would hide one.
5. **A findings run that carried no detail still opens the issue**, with an explicit line saying the locations were unavailable. Losing the detail costs context; losing the notification costs the signal — the ordering the drift probe settled on for the same reason.
6. **The gate itself is untouched.** `--config p/typescript`, `--severity ERROR`, `--error`, the exclusions and the schedule are unchanged; the exit code is still semgrep's own. The only change to the scan command is `--json`, which redirects the report to a file that nothing prints and nothing uploads, and prints engine diagnostics (rule counts, paths, fetch errors) to the log instead. `audit:high` remains the single dependency gate; this adds no second merge-blocking vote.

## What this does not do

- **It does not make WARNING/INVENTORY findings visible.** That would need a second pass over the same tree (or a parse of every result with its severity), and adding cost to a security gate's schedule to satisfy a sentence is a decision this record does not make. The sentence is gone instead, and the removal is pinned by a test.
- **It does not verify what the scan covers.** `tmp/`, `data/` and `tests/` are excluded by design; a scan that matched no files still exits 0. A green scheduled run therefore says "no ERROR-severity finding under `src/` or `scripts/`", not "the repository is clean" — and nothing yet checks that the scan actually saw the tree it claims to cover.
- **It does not implement CodeQL or `actions/dependency-review-action`.** Both remain plan-gated for this private repository (GitHub Advanced Security is not purchased), and the pinned dependency-review call stays in `dependency-review.yml` for the swap-back.
- **It does not decide anything about a finding.** The issue asks a human to fix the cause or record why it is not applicable; the policy that never lowers `--severity ERROR --error` is unchanged and restated in the issue body.
- **It does not touch the PR path's cost.** PR runs keep exactly one scan, and they maintain no issue.

## Verification (and what it does not cover)

Measured on 2026-10-14 with a non-shipped local harness (`tmp/sast-audit/harness.mjs`), which extracts the step bodies and the payload out of the workflow YAML and runs them with a stubbed `semgrep` and a stubbed `gh`:

| Observation | Value |
| --- | --- |
| scan step, two ERROR findings, engine exit `1` | step exits `1`; `semgrep_exit_code=1`; detail lists both rules with file and line |
| source text in the detail or the step's own stdout | none — the stub's `extra.lines` values never appear, and neither does `check_id` from the JSON |
| scan step, engine failure (exit `7`), no JSON | step exits `7`; detail empty; the summary says the scan did not complete and "says nothing about the code either way" |
| scan step, clean run | step exits `0`; detail empty; summary reports zero ERROR-severity findings |
| payload, failure with detail | `gh issue create` with the sanitized list, the run URL, the commit and the exit code |
| payload, failure with exit `7` | issue opened, and the body says it is **not a finding** |
| payload, failure with exit `1` and empty detail | issue opened with the "did not carry their locations" fallback |
| payload, green run with one open issue | `gh issue close <n> --reason completed --comment …` |
| payload, green run with no open issue, and a cancelled run | no `gh` mutation at all |
| the payload's own syntax | `node --check` over the text the heredoc embeds |
| falsification | restoring the pre-fix `codeql-sast.yml` fails all 15 cases of `tests/sast-monitor-handoff.test.ts`; the fixed file is restored byte-identical (`cmp`) and passes 15/15 |

**Not covered.** The GitHub runner path itself: the payloads and step bodies ran locally, `gh` was stubbed, and no issue was actually opened or closed. The sanitized extraction reads that JSON with `python3`, which is present in the scan container because Semgrep's own image installs it; if it were ever absent the detail would be empty and the issue body would say the locations were unavailable rather than misreport them. No real Semgrep engine was executed — the JSON shape the extraction reads is the documented result schema (`results[].check_id`, `.path`, `.start.line`, `.extra.lines`), produced by a stub, not by `semgrep/semgrep:1.180.0`; the two claims the extraction relies on (`extra.lines` exists; the text formatter prints excerpts) are taken from the Semgrep CLI reference and the v1.180.0 formatter source rather than from a run of the container image. And the schedule itself has not yet fired: the first real scheduled failure is still the one that will prove the path end to end.

## Enforcement

| Surface | What it enforces |
| --- | --- |
| `.github/workflows/codeql-sast.yml` | the sanitized output, `--json` into a file nothing prints or uploads, the outcome job's permissions and trigger guard, the `1`-versus-`2`/`7` distinction in the issue body, and the close-on-green path |
| `tests/sast-monitor-handoff.test.ts` | the step bodies and the payload executed against stubbed `semgrep`/`gh`; the three scan outcomes; open, update, close and no-op; `node --check` over the embedded payload; no `readFileSync` and no artifact on the notification path; and a repository-wide rule that every workflow with a `schedule:` trigger can write an issue, falsified against the pre-fix shape |
| `tests/dependency-sast-gates.test.ts` | the gate command itself (ruleset, `--severity ERROR`, `--error`, the exclusions), the corrected statements, and that no write permission beyond `issues: write` was granted |
| `docs/sast-monitor-handoff-policy-2026-10-14.md` | this record |

## Standing follow-ups (not done here)

- **Decide whether WARNING/INVENTORY findings should be visible at all.** The claim was deleted, not implemented. A second `semgrep` pass scoped to WARNING severity (weekly only, so PR runs keep their single scan) would make the original intent real at the cost of a second pass over the same tree; the alternative is to declare the ERROR-only contract permanent and enforce `--severity` against a single documented value.
- **Pin the engine image the way the actions are pinned.** Every marketplace action in this repository is pinned to an immutable commit SHA, and the reason is written down in `ci-to-clickup.yml` — a mutable ref can be force-updated upstream. `semgrep/semgrep:1.180.0` is a mutable tag; a digest pin would close the same class for the container that runs the scan.
- **Guard the green direction.** Nothing distinguishes "scanned the tree, found nothing" from "scanned nothing, exited 0". The repository has already met this shape twice (a citation probe that reported verdicts it had not obtained, a green run whose monitor did nothing); the equivalent here is a target-count or coverage assertion on the scan.
- **Attribute a scheduled finding to the change that introduced it.** The scan runs on the default branch, where `git blame` is the only link back to a commit; a first-run failure would be far more actionable with the introducing commit named in the issue body.
