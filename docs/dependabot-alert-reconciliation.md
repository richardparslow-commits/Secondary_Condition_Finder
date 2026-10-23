# Dependabot alert reconciliation — 2026-10-23

## Why this exists

`docs/dependency-advisory-disposition.json` and `npm run audit:disposition` are the
enforced dependency-risk record and gate. Dependabot is a discovery surface, not a
second source of truth, and its alert state can disagree with the tree in both
directions:

- an alert can stay **open after the lockfile moves past its vulnerable range**, so
  it looks like live debt when the installed version is already patched;
- an advisory the database **withdrew** can stay visible even though the register
  keeps it only as a dated historical record.

Neither case is reported by `npm audit`, so the register gate cannot close it. This
reconciliation explains every open alert against the installed lockfile and the
register, and dismisses only the alerts that no longer describe an installed
vulnerability. The register remains the record; the dismissal comment records where
the surviving evidence lives.

## Classification rules

`scripts/lib/dependabot-alert-reconciliation.mjs` classifies each alert:

| Classification | Meaning | Dismissible |
| --- | --- | --- |
| `registered-live` | The advisory is in the register as live and an installed version is in its vulnerable range. | No |
| `registered-withdrawn` | The register records the advisory as `withdrawn-upstream`. | Yes — the register keeps the dated record |
| `resolved-installed` | The package is installed, but no installed version is in the vulnerable range. | Yes |
| `package-not-installed` | The package does not appear in `package-lock.json`. | Yes |
| `withdrawn-unregistered` | The advisory itself is withdrawn and no register entry is needed. | Yes |
| `unregistered-live` | An installed version is in range, but the register does not classify the advisory. | No — this fails the reconciliation |
| `register-stale` | The register classifies the advisory, but no installed version is in range. | No — this fails the reconciliation |
| `range-unreadable` | The alert's range or an installed version cannot be evaluated (for example a prerelease or a caret range). | No — fail closed |
| `alert-incomplete` | The alert lacks an advisory id, package or range. | No — fail closed |

The CLI refuses to dismiss anything while any failure exists. `--dismiss-resolved`
sends `state: "dismissed"`, `dismissed_reason: "inaccurate"` and an explanatory
comment capped at the API's 280-character limit.

## Result on 2026-10-23

Reconciled against `main` at `618bb999` with the register as committed. Five open
alerts:

| # | Advisory | Package | Severity | Installed | Vulnerable range | Register | Classification | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GHSA-vfj7-8cjw-p6xm` | `braces` | high | `3.0.3` | `<= 3.0.3` | `tracked-no-fix` | `registered-live` | Left open; the one live alert |
| 2 | `GHSA-hp3w-g68c-fv3c` | `sprintf-js` | medium | `1.0.3` | `<= 1.1.3` | `withdrawn-upstream` | `registered-withdrawn` | Dismissed as inaccurate; the register keeps the withdrawal record |
| 3 | `GHSA-698v-4r3x-3vcv` | `vite` | medium | `8.3.5` | `>= 8.0.0, <= 8.1.5` | absent | `resolved-installed` | Dismissed as inaccurate (first patched `8.1.6`) |
| 4 | `GHSA-587h-7wmj-h5pm` | `vite` | high | `8.3.5` | `>= 8.0.0, <= 8.1.5` | absent | `resolved-installed` | Dismissed as inaccurate (first patched `8.1.6`) |
| 5 | `GHSA-r825-w8mm-5pxw` | `vite` | medium | `8.3.5` | `>= 8.0.0, <= 8.1.5` | absent | `resolved-installed` | Dismissed as inaccurate (first patched `8.1.6`) |

After the run, the only open Dependabot alert is the `braces` alert, which the
register classifies as `tracked-no-fix` and which `npm audit` still reports. The
withdrawn `sprintf-js` alert was dismissed through the API and is no longer listed
by GitHub; the register retains the dated `withdrawn-upstream` record and fails if
the advisory is reported again.

The three `vite` alerts are not added to the register on purpose: the register's
premise is the advisories `npm audit` reports, and `vite@8.3.5` is outside these
ranges, so the audit does not report them. Recording them as register entries would
make the register claim live debt the tree does not have; the dismissal comment and
this page are the evidence that they were checked.

## Reproduce

```bash
# Classify the live open alerts (read-only).
GH_TOKEN=$(gh auth token) npm run audit:dependabot

# Offline against a captured response.
gh api 'repos/OWNER/REPO/dependabot/alerts?state=open&per_page=100' > tmp/alerts.json
node scripts/reconcile-dependabot-alerts.mjs --alerts=tmp/alerts.json --json \
  --report=tmp/dependabot-reconciliation.json

# Dismiss only after the read-only run reports no failures.
GH_TOKEN=$(gh auth token) npm run audit:dependabot -- --dismiss-resolved
```

The CLI follows the API's cursor pagination (the alerts endpoint does not accept
`page`), so more than one page is not silently truncated. It never dismisses while
an `unregistered-live`, `register-stale`, `range-unreadable` or `alert-incomplete`
finding exists, and it exits non-zero on any of them.

## Limits

- This does not replace `npm audit`, `npm run audit:high`, or
  `npm run audit:disposition`; it reconciles the GitHub alert surface with them.
- Installed versions come from `package-lock.json`, not from the filesystem
  `node_modules`; the lockfile is the reviewed tree.
- The range evaluator supports the comparator forms Dependabot emits and `||`
  alternatives. Prereleases, wildcards, carets, tildes and any other shape return
  `range-unreadable` and fail closed rather than reading as "not affected".
- Dismissal changes GitHub alert state, not the risk record. A dismissal is
  reversible by GitHub and can be re-opened if the tree changes; the comments
  preserve the reason and the register path for the next reviewer.
- No deployed host, upstream provider, or Dependabot configuration setting is
  verified here.
