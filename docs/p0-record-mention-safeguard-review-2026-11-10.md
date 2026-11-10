# P0 follow-up: negative findings, family history and short diagnostic aliases

Review date: 2026-11-10. Source: merged PR #686, verified on local synthetic records only. No real veteran medical records used.

## Discovery and impact

PR #686 was merged into main at 2026-11-10T13:55:35Z and Vercel independently deployed merge commit 88dabb4b5bbcc328da4a113762caea6fad41695b to Production. The requesting review did not perform either action.

A subsequent targeted headless Chrome test on the feature implementation found two unsafe eligibility false positives:
- Assessment: No obstructive sleep apnea was labeled as an affirmative diagnosis statement and eligible for veteran opt-in.
- Assessment: Mother has obstructive sleep apnea was also labeled as an affirmative diagnosis statement and eligible for veteran opt-in.

The app did not silently create a diagnosis or establish a nexus; a Veteran still had to opt in. Presenting these findings for confirmation was nevertheless misleading and is treated as a release-blocking defect.

An acronym-only positive (Assessment: OSA) was previously ignored. Suspected-condition and non-clinician contexts were correctly held.

## Correction (draft follow-up only, no Production changes)

The conservative record-mention classifier now:
- Detects simple negation (no, not, negative, absent, denied, without) as ruled-out rather than eligible.
- Detects family history headers and relative constructions including mother has and father diagnosed with.
- Holds tentative language (probable, versus, trailing question mark) as suspected.
- Recognizes a curated set of short clinical aliases only inside explicit assessment/diagnosis context, with unique catalog identity checks.
- Preserves the explicit veteran confirmation, browser-local privacy boundary, self-reported claim status, source retention and clinical review gates.

A negative phrase elsewhere in the same sentence may conservatively exclude an otherwise positive finding. This may cause false negatives and needs clinical review. Author credential selections are user-entered, not authenticated. OCR accuracy, nuanced diagnosis language and source-to-person attribution still need qualified-human review.

## Validation

- Original PR CI: successful six-step real-browser workflow, PRIV-01 browser privacy sentinel, keyboard/contrast checks, axe tests, hostile-file stress, Semgrep, secret scan, dependency review and regulatory/docs gates.
- Local targeted Chrome rerun with synthetic records: seven cases passed after the correction (affirmative confirmation to Step 5; negative; family; suspected; OSA acronym; conflicting positive and negative; non-clinician).
- Positive synthetic workflow stored catalog ID, self-reported claim status and opaque source ID, but not source filename or fake unique marker in the workflow context or captured requests.
- Local focused Vitest: 66 passed across eight files, including 12 record-discovery cases with four new safety regressions. Node 22 TypeScript check passed.

The original CI browser walkthrough did not specifically cover the negation/family wording, so its green status did not eliminate these risks.

## Release gate

Do not auto-merge or directly publish this corrective PR. Review the negative-context tradeoff with qualified clinical staff; complete the human accessibility gate and rerun Preview-specific checks before any deployment. No medical pathway publications or clinical approvals were changed.
