# Security and architecture audit — 2026-10-07

## Verdict and scope

**NOT PRODUCTION READY.** The production build, typecheck, and live corpus now pass again after the REL-02 and REL-01 repairs, but the incomplete VA/Section 508 acceptance evidence remains. PRIV-01's acceptance contract was resolved on 2026-10-07 as **browser-local all PHI** and all four migration stages have landed (browser-local step pages, PHI-bearing Server Actions retired, legacy cookie path deleted and tombstoned, and the browser sentinel acceptance passed with zero private-field leakage). SEC-01's installed production dependency has been patched; target-Linux/deployed native-binary verification remains outstanding. REL-01's quarantine was reconciled on 2026-10-08: each root/target identity is determined, none of the six drafts is restorable as-is, and the runtime corpus and the five pinned graph routes are unchanged; both follow-on authoring questions were put to the owner on 2026-10-08 and resolved without new authoring.

This is a risk-focused source review with executable checks, not a claim that every line of the repository has been audited, a penetration-test certification, a medical-content verification, or a Section 508 attestation. During the original audit, no application source, authored mappings, lockfile, or existing tests were changed. The subsequent SEC-01 remediation changed only dependency policy/lockfile, the existing security-contract test, and this report; the REL-02 remediation changed only the already-failing test's declared type, its retry guard, and its own `node:fs` import, plus this report. The REL-01 remediation repaired two invalid enum values in tracked draft mappings (with reviewer todos recording the prior values), moved six unapproved or invalid runtime drafts byte-for-byte with SHA-256 hashes into [data/knowledge-base-quarantine/2026-10-07-rel-01/MANIFEST.json](data/knowledge-base-quarantine/2026-10-07-rel-01/MANIFEST.json), and refreshed the tracked coverage ledger with the repository's own generator; no medical mapping was invented, and nothing was deleted or renamed. All other remediation below remains proposed. Existing dirty/untracked work was included in the checkout assessment and left untouched; it must not be confused with the committed baseline.

- Branch: `main`; HEAD at inspection: `1759b87b3ef00f99fd36d85dc772dc0ef078cd1a`.
- Installed: Next.js **16.3.8**, React **19.2.8**, TypeScript **5.9.3**, Zod **4.5.4**, Vitest **4.1.11**. The requested Next.js 14/15 references were checked, but examples must also respect the actual version.
- Local Node: **24.16.0**; [package.json](package.json) requires **22.x**. Target-Node verification remains outstanding.
- Source inventory: 234 files, 44 component files, four module-level Server Action modules, four API handler files plus the dynamic VA account OAuth handler. Critical security/data paths and selected UI components were read in detail; not all source files were read line by line.
- Actual raw corpus: **819 catalog conditions**, **822 mapping files**, **682 draft files**, **140 published files**, **874 suggestion edges**. 574 files contain suggestions; 434 of those are drafts; 245 catalog identities lack suggestions. Extra non-catalog files invalidate the identity contract. These are raw counts, not a validated production graph. Adjacency directory: eight files/12 raw edges, including duplicate filenames and invalid data; no valid live-graph count is asserted.
- [Audit evidence directory](tmp/security-audit-2026-10-07/http-results.json) uses synthetic values only. No deployment, credentials provisioning, commit, push, or destructive cleanup occurred.

### SEC-01 remediation — completed locally on 2026-10-07

- Added the exact `sharp` **0.35.5** override and aligned its install allowlist in [package.json](package.json#L77). Regenerated [package-lock.json](package-lock.json#L7199) and ran a clean `npm ci` with the existing postinstall assets procedure. Only **27 sharp/native-libvips package entries** changed; no unrelated dependency updates. All locked native wrappers are 0.35.5 and libvips packages are 1.3.4, including Linux/glibc and musl variants. [Lock comparison](tmp/security-audit-2026-10-07/sharp-remediation/lock-changes.json), [installation log](tmp/security-audit-2026-10-07/sharp-remediation/install.log).
- Next's loaded native instance reports **sharp 0.35.5, librsvg 2.63.2, libvips 8.18.7**. [Runtime versions](tmp/security-audit-2026-10-07/sharp-remediation/native-versions.json). Added three regression tests to [remediation-security-contracts.test.ts](tests/remediation-security-contracts.test.ts): dependency/platform lock policy, actual librsvg version, and SVG-to-PNG pixel correctness plus PNG-to-WebP resize through Next's optimizer. All **nine tests pass**, on both local Node 24.16.0 and project-local **Node 22.23.3**, macOS arm64. [Node 24 tests](tmp/security-audit-2026-10-07/sharp-remediation/native-tests.log), [Node 22 tests](tmp/security-audit-2026-10-07/sharp-remediation/node22-native-tests.log). Edited-test ESLint passes.
- Production audit now **passes the high-severity gate**, exit 0: **zero high/critical**, three moderate findings remain in `mammoth → argparse → sprintf-js`. [Production audit](tmp/security-audit-2026-10-07/sharp-remediation/audit-production.json). The all-dependency audit still **fails**, exit 1: five high development-tooling findings in `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`, plus the three moderate findings. [All-dependency audit](tmp/security-audit-2026-10-07/sharp-remediation/audit-all.json). This does not claim all dependencies are vulnerability-free; no forced downgrades were applied.
- Started/re-registered the local preview on Node 22 after stopping only the previously owned preview server. A real `/_next/image` HTTP test returns **200/image-webp**, resizes a synthetic 128×64 PNG to 64×32, and verifies decoded red pixels. SVG requests still return **400**, preserving the existing default refusal policy. Temporary UUID-named public fixtures were removed after testing; no new public route or SVG allowance was added. [HTTP smoke evidence](tmp/security-audit-2026-10-07/sharp-remediation/http-image-smoke.json). The home accessibility tree renders in Chromium with no captured console errors; server warmup still reports the pre-existing invalid KB mapping. Screenshot capture was blocked by the preview webview not being composited, including after a reload, so no visual-layout verdict is claimed. This is not a complete workflow pass.
- Full suite rerun: **137 failed/165 passed files, 144 failed/1,712 passed tests** (1,856 total); failure counts match the original run and the three new tests pass. Many failures cascade from invalid live corpus; not every failure was individually root-caused. [Full test log](tmp/security-audit-2026-10-07/sharp-remediation/full-tests.log). At SEC-01 remediation time, typecheck and production build still failed on the then-unchanged nexus-expansion-artifact.test.ts, TS2454, under both Node 24 and Node 22; the REL-02 remediation below fixes this. The graph whole-project tracing warning remains. [Typecheck](tmp/security-audit-2026-10-07/sharp-remediation/typecheck.log), [build](tmp/security-audit-2026-10-07/sharp-remediation/build.log), [Node 22 typecheck](tmp/security-audit-2026-10-07/sharp-remediation/node22-typecheck.log), [Node 22 build](tmp/security-audit-2026-10-07/sharp-remediation/node22-build.log).
- Existing dirty/untracked authored work was hash-checked and left unchanged. No commit, push, deployment, or system-wide runtime change. **Remaining SEC-01 acceptance:** execute these native tests on the actual Linux/Node 22 build and verify the deployed instance loads patched librsvg, especially if global libvips is used. This macOS host has no Docker/Podman runtime; a patched Linux lock entry is not an executed Linux/native test. Production build blockers also prevent a production-mode end-to-end verdict.

### REL-02 remediation — completed locally on 2026-10-07

- Applied exactly the prescribed repair in [nexus-expansion-artifact.test.ts:149–166](tests/nexus-expansion-artifact.test.ts#L149-L166): `esummaryResp` is declared `Response | undefined` with an explicit no-response error return before `.json()`, and the file's `require('node:fs')` became a top-level `readdirSync` import ([line 2](tests/nexus-expansion-artifact.test.ts#L2), used at [line 199](tests/nexus-expansion-artifact.test.ts#L199)). No assertion was weakened, no test excluded from TypeScript, and no source verification swallowed.
- `npm run typecheck` now exits **0** on local Node 24.16.0 and on project-local Node 22.23.3, from a baseline exit 2 with the single TS2454. [Before](tmp/security-audit-2026-10-07/rel-02-build-fix/typecheck-before.log), [Node 24 after](tmp/security-audit-2026-10-07/rel-02-build-fix/typecheck-after.log), [Node 22 after](tmp/security-audit-2026-10-07/rel-02-build-fix/typecheck-after-node22.log).
- The repaired file's own **21 tests pass** (74.1 s, live NCBI esummary/efetch against all four `crg-secondary-nexus-expansion-*` packets). [Test log](tmp/security-audit-2026-10-07/rel-02-build-fix/nexus-test.log). ESLint on the file: **0 errors** (two pre-existing unused-type warnings left untouched; no suppression added). [Lint log](tmp/security-audit-2026-10-07/rel-02-build-fix/eslint-nexus.log).
- `npm run build` now exits **0** on Node 22: compilation succeeded in **5.4 minutes** and every route was emitted. The dynamic-filesystem whole-project tracing warning remains (REL-03). [Build log](tmp/security-audit-2026-10-07/rel-02-build-fix/build-after-node22.log). The build ran with the previously owned dev server stopped; it was restarted on Node 22 at `127.0.0.1:3107` afterwards.
- Full suite rerun: **137 failed / 165 passed files; 144 failed / 1,712 passed tests (1,856 total)** — identical failure counts to the post-SEC-01 run, with this file and the three sharp/native tests passing. No regression. [Full test log](tmp/security-audit-2026-10-07/rel-02-build-fix/full-tests-after.log).
- This restores the **build/typecheck half of recommended step 1 only**. Live-data integrity (REL-01) is unchanged: after the successful production build and dev-server restart, `/api/health` still returns **503** (`kbGraph` duplicate working copy `degenerative-disc-disease 2.json`) and `/pathways` still returns **500**. [Live status](tmp/security-audit-2026-10-07/rel-02-build-fix/live-status-after.json), [captured exit codes](tmp/security-audit-2026-10-07/rel-02-build-fix/rel-02-evidence.json). Reconciling REL-01's invalid mappings, duplicate graph files and non-catalog roots needs the file owner plus a medical-sign-off decision; this remediation deleted, renamed, or re-mapped nothing.

### REL-01 remediation — completed locally on 2026-10-07

- Repaired the two unambiguous enum defects in the tracked draft mappings exactly as the repair candidates above describe. [degenerative-disc-disease.json:45–48](data/knowledge-base/degenerative-disc-disease.json#L45-L48): `claimTheories` dropped the invalid `biomechanical` (retained only as a pathway) and `intermediatechain` became `intermediate-chain`. [tinnitus.json:46](data/knowledge-base/tinnitus.json#L46): the two invalid claim theories were omitted pending reviewer selection and `pathways` became `["somatopsychic"]`, since the authored text never claimed aggravation. Each file gained a `todo` reviewer entry recording the prior values. No claim theory or pathway was added merely to satisfy Zod.
- Quarantined six unapproved or invalid runtime drafts **byte-for-byte with SHA-256 hashes** to [data/knowledge-base-quarantine/2026-10-07-rel-01/](data/knowledge-base-quarantine/2026-10-07-rel-01/MANIFEST.json), each with its original path, hash, reason, and restore instruction: the three non-catalog mappings (`chronic-pain`; `major-depressive-disorder` including its non-catalog `sexual-dysfunction` target; `post-traumatic-stress-disorder` — none re-rootable without a medical identity decision) and the three graph working copies (schema-invalid `tinnitus.json`; its unreachable sibling `tinnitus 2.json`, which already contained the string-form `evidenceGaps` repair; and `degenerative-disc-disease 2.json`, a filename-identity violation on an unreviewed DIRECT_CAUSATION draft). This follows the section above — place unapproved material outside runtime directories — rather than loosening the loaders, and keeps the shipped graph at the five pinned routes.
- Gates now pass: `npm run kb:validate` **exit 0** — 819 catalog conditions, 819 mapped, 0 unmapped, 574 with authored suggestions / 245 without, `errors: []` ([log](tmp/security-audit-2026-10-07/rel-01-kb-repair/kb-validate.log)); `node --no-warnings scripts/audit-crg.ts` **exit 0** — 5 nodes from 5 files, acyclic PASS ([log](tmp/security-audit-2026-10-07/rel-01-kb-repair/audit-crg.log)).
- Live product restored on the restarted Node 22 server: `/api/health` **200 healthy** with `kbGraph` ok (5 nodes / 5 edges) ([body](tmp/security-audit-2026-10-07/rel-01-kb-repair/health-body.json)); `/pathways` **200** and renders in Chromium as "5 authored pathways from 5 origin conditions … 11 of 14 citation anchors awaiting verification", matching the e2e oracle exactly ([rendered HTML](tmp/security-audit-2026-10-07/rel-01-kb-repair/pathways-body.html)); `/secondary/diagnosed`, `/secondary/upload`, `/secondary/suggestions` and `/secondary/evidence` all return 200.
- The previously blocked suites now run and pass: `kb-graph-loader` (9), `pathways-page-e2e` (7), `mapping-coverage-ratchet` (4), `step5-pathway-intelligence` (4), `va-cache-management` (8), `knowledge-base-integrity`, `pathway-explorer-surface`, `graph-pathway-results-surface`, `quarantined-pointer-guard`, `knowledge-base`, and `health-kb-graph` among the **35 files unblocked**. Full suite: failing test files **137 → 102**, a strict subset of the previous set — **zero newly failing files**. Individual failures moved 144 → 247 only because roughly 54 suites that previously aborted at import now execute 503 additional tests; those latent failures (e.g. clinical-evidence-promotion batches) were masked by the invalid corpus, and no previously passing file now fails. [Full log](tmp/security-audit-2026-10-07/rel-01-kb-repair/full-tests-after.log).
- The tracked [mapping-coverage-ledger.json](docs/mapping-coverage-ledger.json) was one edge ahead of the live corpus (both ratchet tests were already failing before this remediation). Refreshed with the repository's own `npm run coverage:ledger -- --write`, changing exactly one line (`suggestionEdges` 875 → 874) with the ratchet floors untouched (574 / 555); the ratchet suite is now 4/4. [Refresh log](tmp/security-audit-2026-10-07/rel-01-kb-repair/ledger-refresh.log), [ratchet run](tmp/security-audit-2026-10-07/rel-01-kb-repair/ratchet-after-refresh.log), [captured exit codes](tmp/security-audit-2026-10-07/rel-01-kb-repair/rel-01-evidence.json).
- **Not complete:** the six quarantined drafts were reconciled on 2026-10-08 ([record](data/knowledge-base-quarantine/2026-10-07-rel-01/RECONCILIATION.md)) — every root/target identity is determined and none is restorable as-is, so the manifest, the runtime corpus and the five pinned graph routes are unchanged; the owner confirmed on 2026-10-08 that the `chronic-pain` draft stays quarantined until a reviewed catalog identity exists and that the graph keeps its five pinned routes, so no new authoring is queued; the real Step 5/6 browser walk with a veteran session was not repeated (the e2e suite drives the real page and data path); and [checkout-fork-hygiene.test.ts](tests/checkout-fork-hygiene.test.ts) still fails on the owner's pre-existing desktop-sync forks under `docs/` and `tests/`, which this remediation did not delete.

### SEC-02 route-coverage remediation — completed locally on 2026-10-08

- Added `/va-forms/finder` and `/secondary/evidence` to the existing public-reference limiter in [proxy.ts](../src/proxy.ts). Both pages invoke public VA/reference loaders but were outside the API policy registry and omitted from the proxy's page list. `HEAD` now consumes the same reference budget as `GET`, because Next can execute the same page loader for either method. The existing allowance remains **30 reads/minute per attributed client per process, shared across guarded reference routes**; no new global fallback bucket, identity policy, service, or privacy exception was introduced.
- Added 21 regression cases to [api-route-rate-limit-coverage.test.ts](../tests/api-route-rate-limit-coverage.test.ts), including an on-disk inventory of pages referencing the current public VA/regulatory loaders, GET/HEAD budgets on all eight covered route examples, query/slash/RSC/prefetch variants, cross-route budget sharing, distinct-client isolation, unrelated pages, JSON bodies, `Retry-After`, and security headers. Before the source fix: **13 failed / 27 passed**, exit 1. After: **40/40 pass** in that suite; all six focused proxy/rate-limit/privacy/CSP/runtime suites **99/99 pass**, exit 0. Project typecheck and changed-file ESLint both exit 0. [Before](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/tests-before.log), [after](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/tests-after.log), [typecheck](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/typecheck.log), [lint](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/lint.log). The final audit-document checks also pass **179/179**, exit 0 ([doc-lint log](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/doc-lint.log)).
- Real local Next/Node 22 HTTP checks passed on both newly guarded routes: 30 mixed GET/HEAD requests returned 200; overflow GET and HEAD returned 429 (HEAD had no body), with positive `Retry-After` and the existing security headers; another guarded route remained blocked for the exhausted client, while an independent client and the unrelated home page returned 200. [HTTP evidence](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/http-evidence.json), [probe log](../tmp/security-audit-2026-10-07/sec-02-rate-coverage/http-check.log). An initial full-page probe exceeded its 60-second tool timeout while repeatedly refreshing scope-free regulatory data. The completed admission probe uses Step 6's existing missing-lock fail-closed state (`regSnapshot=sec02-missing-lock`); it tests the proxy, not successful regulatory refresh or recommendation output. A real browser search for public form `21-526EZ` rendered the expected local fallback result with no captured console errors; live VA access is disabled.
- **SEC-02 remains partially open.** Forwarding headers still depend on trusted ingress; missing identity still receives no per-client bucket; buckets remain process-local and reset on cold start. No deployment ingress configuration, direct-origin restriction, edge/distributed quota, two-instance/cold-start test, or production traffic test is claimed. `HEAD` support on existing OAuth paths enforces admission only; it does not certify OAuth method semantics. The filesystem-only `/pathways` page was reviewed and is not part of this upstream-reference budget. Hosted controls and identity policy must be selected and verified with deployment evidence before closing SEC-02. These source changes are local and uncommitted.

### REL-03 trace-scope remediation — completed locally on 2026-10-08

- Replaced the imported relative-directory path in [graph.ts](../src/lib/kb/graph.ts) with literal `data`, `knowledge-base`, `graph` segments. No trace-ignore comment, global excludes, dependency change, validation relaxation, or cache/interface change. Two added cases in [kb-graph-loader.test.ts](../tests/kb-graph-loader.test.ts) pin the literal path to the shared layout and preserve the uncached default-directory seam; the existing arbitrary-directory, validation, quarantine and pathway cases remain. Before: **1 failed / 10 passed**, exit 1; after: **51/51 focused tests**, exit 0; project typecheck and changed-file ESLint exit 0. [Baseline test](../tmp/security-audit-2026-10-07/rel-03-trace-scope/tests-before.log), [focused tests](../tmp/security-audit-2026-10-07/rel-03-trace-scope/tests-after.log), [typecheck](../tmp/security-audit-2026-10-07/rel-03-trace-scope/typecheck.log), [lint](../tmp/security-audit-2026-10-07/rel-03-trace-scope/lint.log).
- Matched isolated Node 22/Turbopack standalone builds both exit 0. The baseline reproduces the whole-project warning; the repaired build has no such warning. Inspected **all 38 NFT traces**, including 34 App Router traces, and the standalone files. Every App Router trace and the standalone retain all **875 required JSON data files**; no missing trace dependency or unrelated project source/tests/docs/scripts/scratch files remain. The app-wide data include is unchanged. [Baseline build](../tmp/security-audit-2026-10-07/rel-03-trace-scope/baseline-build.log), [rebuild](../tmp/security-audit-2026-10-07/rel-03-trace-scope/rebuild.log), [before inventory](../tmp/security-audit-2026-10-07/rel-03-trace-scope/traces-before.json), [after inventory](../tmp/security-audit-2026-10-07/rel-03-trace-scope/traces-after.json).
- Measured uncompressed file-size sums: health trace **3,014 → 1,909 entries**, **82,356,851 → 26,130,277 bytes** (68.3% fewer bytes); pathways trace **3,029 → 1,924 entries**, **82,521,703 → 26,295,129 bytes**. Standalone **145,887,156 → 95,430,787 bytes** (34.6% fewer bytes), with **1,077 → 0** unrelated project files. Browser-local suggestions were already narrowly traced after PRIV-01 and remain **1,113 entries**. These are local artifact measurements, not compressed deployment size, cold-start timing, or a deployment-speed claim. Dependency-internal `src` folders are legitimate package files, not project-source leakage.
- Packaged production-mode HTTP checks pass for health, pathways, diagnosed, suggestions and Form Finder, plus JS/CSS content types and the client corpus; graph health reports five nodes/five edges. The browser renders the five authored pathways, association-only chain-broken warnings and citation anchors, with no captured console errors. Two captured RSC prefetches return 200; one unknown request is recorded as `ERR_ABORTED`, with no URL/cause available, so no blanket clean-network claim is made. [HTTP evidence](../tmp/security-audit-2026-10-07/rel-03-trace-scope/http-evidence.json), [browser evidence](../tmp/security-audit-2026-10-07/rel-03-trace-scope/browser-evidence.json).
- **Scope:** builds used an isolated copy to avoid disrupting the live dev server and owner edits. Dependency-copy attempts timed out/were stopped after slow local copying; the completed builds share the existing dependency tree via a symlink and temporary Turbopack/output-tracing root settings, identical before/after. This produces a nested standalone server; static/public assets were copied beside that server for the smoke test, without changing workspace configuration or packaging. No hosted/Linux deployment, complete VA/OCR workflow, or full repository suite is claimed. Source changes remain local and uncommitted; future actual deployment artifacts should be rechecked under their exact build configuration.

### ARCH-01 authored-evidence join remediation — completed locally on 2026-10-08

- Added the dependency-free shared [graph-evidence-joins.mts](../src/lib/kb/graph-evidence-joins.mts) guard: every adjacency edge must have a matching authored suggestion with nonempty citations and the same nexus classification. [graph.ts](../src/lib/kb/graph.ts) loads the KB once, checks quarantine and evidence joins, and only publishes the cache after success. Existing default-directory and uncached behavior remain; tooling can pass an optional full candidate KB when validating staged edges against staged suggestions. No live clinical records or citation verification flags were changed.
- Both [client-corpus.ts](../src/lib/client-corpus/client-corpus.ts) and the native Node [generator](../scripts/build-client-corpus.mjs) run the same join guard before constructing/writing output. Bad inputs fail without overwriting an existing good artifact. Supported draft edges remain research graph data, while draft mappings stay out of published recommendations. Corpus version/keys remain v2; regeneration produces the identical SHA-256 `95bf69edc67f899647581b28c29a2111d7204d7b1d2fb8df4a916e5e921f5f7c`. The fetched corpus parser requires exactly one nonempty anchor entry per edge and refuses missing, empty, duplicate or extra entries. [Projection](../src/lib/engine/graph-pathway-projection.ts) refuses anchorless hops rather than presenting unsupported paths.
- Added **15 regressions** in [graph-evidence-joins.test.ts](../tests/graph-evidence-joins.test.ts). Before: **13 failed / 13 passed** across that suite plus the loader, exit 1. Final focused run: **98 passed / 2 failed**, exit 1 across nine files; all 15 new cases, the graph/health/quarantine/pathway/browser-corpus suites, and the staged-loader integration pass. The two remaining converter failures (governance-count and historical staged-manifest hashes) reproduce using the original HEAD test against the pre-existing owner clinical edits; assertions and those edits are untouched. The baseline diagnostic selected only those two failing cases; the final converter run exercised all 16. Its staged-loader test now supplies the staged candidate KB with retained live pointer markers; its 28-node/64-edge, schema, cycle and hash assertions remain. The traversal fixture now uses supported hypertension → CKD → anemia edges with their actual classifications, preserving two-hop assertions. [Before](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/tests-before.log), [final](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/tests-final.log), [original-test reproduction](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/converter-baseline.log).
- Project typecheck, changed-file ESLint, composition checks, public corpus generation/parity, and the isolated Node 22/Turbopack standalone build pass. [Typecheck](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/typecheck.log), [lint](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/lint.log), [corpus build](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/corpus-build.log), [production build](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/build.log). Packaged-server HTTP checks pass for health/pathways/suggestions/corpus and 11 JS/CSS assets; graph health reports five nodes/five edges. The real browser renders five origin routes and 14 citation links with the association-only chain-break disclosure and no captured console errors. [HTTP evidence](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/http-evidence.json), [browser evidence](../tmp/security-audit-2026-10-07/arch-01-evidence-joins/browser-evidence.json).
- **Limits:** this enforces citation presence and classification agreement, not qualified-human medical verification or full mechanism/profile/rationale/gap equivalence. Draft evidence is not publication approval. Because draft mappings are deliberately omitted from corpus v2, their classification join is enforced at trusted construction, not independently re-established by the browser from absent drafts. The existing dev server's first HTTP probe timed out after 20 seconds with no useful new log diagnostic; it was left untouched and is not counted as a pass. Browser capture includes one unknown `ERR_ABORTED` request, so no clean-network blanket claim. Production testing reuses REL-03's isolated shared-root/nested-server setup; no full repository suite, hosted/Linux deployment or complete credentialed VA/veteran workflow is claimed. Changes remain local and uncommitted.

### REL-01 quarantine reconciliation — completed locally 2026-10-08

- Reconciled the six REL-01 quarantined drafts against the live catalog (819 identities), the live authored corpus and the ARCH-01 evidence join, and recorded each root/target identity determination and restore verdict in [RECONCILIATION.md](data/knowledge-base-quarantine/2026-10-07-rel-01/RECONCILIATION.md). **No entry was restored:** no re-rooted draft is medically equivalent to a catalog identity, and the three adjacency copies are superseded by the owner's later mapping rewrites. Nothing was deleted, renamed, re-mapped or re-verified; the quarantine remains the record.
- Determinations: `chronic-pain` → **no catalog identity** (`unexplained-chronic-pain` is a distinct diagnosis that authors nothing, so the NSAID-aggravation claim cannot be filed there); `major-depressive-disorder` → root resolves to the published `depressive-disorder`, but the target class is split across `erectile-dysfunction` / `female-sexual-arousal-disorder` and the published file already carries the male route at rank 2; `post-traumatic-stress-disorder` → root resolves to the published `ptsd`, which already carries `sleep-apnea` at rank 1; the three graph copies → retired (schema-invalid `tinnitus.json`, unreachable `tinnitus 2.json`, and a `DIRECT_CAUSATION` degenerative-disc-disease copy the live `ASSOCIATION_ONLY` mapping contradicts).
- Added [quarantine-restore-refusal.test.ts](tests/quarantine-restore-refusal.test.ts) (**8 tests**): it replays this manifest's own `cp <quarantinePath> <originalPath>` restore instruction through the real graph loader and catalog validator, re-verifies the six manifest SHA-256 hashes and byte counts, proves a blind restore is refused for every entry (including the schema-repaired copies placed under an accepted filename), and pins the recorded determinations so the reconciliation cannot be silently undone. [Test log](tmp/security-audit-2026-10-07/rel-01-kb-repair/quarantine-reconciliation-tests.log)
- Corpus revalidated unchanged: `npm run kb:validate` **exit 0** — 819 catalog conditions, 819 mapped, 0 unmapped, 574 with authored suggestions / 245 without, `errors: []` ([log](tmp/security-audit-2026-10-07/rel-01-kb-repair/quarantine-reconciliation-kb-validate.log)); `npm run audit:crg:graph` **exit 0** — 5 nodes from 5 files, acyclic PASS ([log](tmp/security-audit-2026-10-07/rel-01-kb-repair/quarantine-reconciliation-audit-crg.log)); 13 focused suites **116/116 pass** ([graph loader, quarantine-pointer guard, evidence joins, explorer, results surface, anchor queue, integrity, mapping-coverage ratchet, health, step 5, pathways e2e and the new refusal suite](tmp/security-audit-2026-10-07/rel-01-kb-repair/quarantine-reconciliation-tests.log)); corpus regeneration byte-identical at SHA-256 `95bf69edc67f899647581b28c29a2111d7204d7b1d2fb8df4a916e5e921f5f7c` (819 conditions, 140 published mappings, 5 graph nodes / 5 anchored edges); six manifest entries intact, zero restored ([evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/quarantine-reconciliation-evidence.json)); project typecheck and changed-file ESLint exit 0.
- **Owner decisions (2026-10-08, product/medical, not findings):** the owner confirmed both follow-on questions — the `chronic-pain` draft stays quarantined until a `chronic-pain` identity is added through the reviewed catalog process (no re-root to `unexplained-chronic-pain`), and the shipped graph keeps its five pinned routes with **no** new adjacency node authored for `tinnitus` or `degenerative-disc-disease`. This reconciliation approved no medical content, changed no citation-verification flag, and asserts no medical equivalence; it is not clinical verification.

### PRIV-01 server-side request-refusal layer — completed locally 2026-10-08

- Added [private-context-request-guard.ts](../src/lib/security/private-context-request-guard.ts) and wired it into [proxy.ts](../src/proxy.ts). Stages 1–4 removed every server path that *read* veteran context; this layer makes the server *refuse* it: a request carrying a private context parameter is answered **400 on any path** (the contract's first prohibited flow names no route, so a future route cannot silently reopen one), and a write method is answered 400 anywhere under `/secondary`, whose pages are read-only shells now. The refusal names at most one constant parameter name and never echoes a value; it still appends the expired retired-cookie tombstones; and it runs after the existing limiters so admission control keeps its coverage instead of becoming an unthrottled endpoint. [Tests](../tests/private-context-request-guard.test.ts) — **8 cases**, with the parameter list pinned to the live browser-local record schema and to the retired parsers in `state.ts`, so adding a private field without extending the guard fails the suite. Before: a context-bearing request was answered while ignored, and nothing asserted a refusal.
- Deleted the orphaned pre-PRIV-01 transport [SecondaryWorkflowHiddenFields.tsx](../src/components/SecondaryWorkflowHiddenFields.tsx): hidden `diagnosed` / `serviceConnected` / `rating-<id>` / `documentsShared` form inputs for a Server Action, with zero references in `src`, `tests`, `e2e` or `scripts`.
- Verified: project typecheck, changed-file ESLint and the composition audit (14/14 executable imports, `architectureClean`) exit 0. Real HTTP against the running app: **11/11** probes — private parameters refused on and off the workflow paths, a write method refused, a stale retired cookie still tombstoned on both paths (including on a refused request), and public parameters plus the workflow pages unaffected; refusals carried no value and left no server-log line echoing their query. [HTTP evidence](../tmp/security-audit-2026-10-07/priv01-request-guard/http-evidence.json). A live browser walk of Steps 1→4 kept state only in `sessionStorage`, left `document.cookie` empty, sent only `_rsc` on navigation, and produced **zero** refusals in the server log.
- **Limitation:** the full sentinel acceptance was re-run twice and stopped both times at the page-side OCR wait — the recorded runner-error report ([priv01-sentinel-recheck.json](../tmp/security-audit-2026-10-07/priv01-request-guard/priv01-sentinel-recheck.json), token `6d648b47`) shows the 240-second "Local OCR completed for" wait expiring while every probe returned `CDP Runtime.evaluate timed out`, so no completed sentinel re-run is claimed and the 2026-10-07 stage-4 acceptance remains the contract's leakage evidence. Starting a server also required clearing the dev Turbopack cache (`.next/dev/cache/turbopack`, polluted with duplicate-suffix files) — a regenerable cache under `.next/dev`, not a source or data change. Changes are local and uncommitted; nothing was deployed.

### PRIV-01 stage-4 sentinel CI gate — wired 2026-10-08

- Stage 4's browser sentinel was a maintainer-run gate; it is now an enforced CI gate. Two steps in the required `verify` job of [ci.yml](../.github/workflows/ci.yml): **Detect PRIV-01 sentinel scope changes** reads the pull request's change set from the files API and answers `changed=true|false` — fail-closed, so a change set it cannot read runs the gate rather than skipping it — and **Run PRIV-01 stage-4 browser sentinel** starts a dev server on its own port, waits for `/api/health`, points `SENTINEL_APP_BASE`, `SENTINEL_SERVER_LOG` and `SENTINEL_REPORT_PATH` at that server, and runs [acceptance-browser-sentinel.mjs](../scripts/acceptance-browser-sentinel.mjs) with the runner's Chrome. A missing browser or an unhealthy server fails the gate instead of skipping it, and the step is named in the job's final aggregator, so it can fail the merge instead of appearing enforced.
- Scope lives in [priv01-sentinel-scope.mjs](../scripts/priv01-sentinel-scope.mjs): the workflow's routes, step components and browser-local state, the evidence/OCR pipeline and its self-hosted tesseract assets, the client corpus, the private-context refusal layer, the proxy, the COOP/COEP configuration, the sentinel runner, the corpus builder, `ci.yml` itself, and the privacy/contract suites. [priv01-sentinel-gate-wiring.test.ts](../tests/priv01-sentinel-gate-wiring.test.ts) pins that wiring and walks those directories on disk, so a new privacy-bearing module cannot land outside the gate's trigger scope.
- **Run tokens.** This pass's sentinel runs carried tokens **`34d6f3e0`** (first rehearsal) and **`40387030`** (quiet-machine rehearsal); both are `runner-error` records rather than acceptance evidence, and both stopped at the page-side OCR leg — the 240-second "Local OCR completed for" wait expiring while every probe returned `CDP Runtime.evaluate timed out` and the tesseract workers ran. The completed stage-4 runs remain **`7e6f1861`** (45/45, field-complete) and **`0f953e99`** (20/20). The rehearsal record — the step's own extracted script, the stub-API results for all three detection modes, and the failure logs — is [here](../tmp/security-audit-2026-10-07/priv01-request-guard/ci-rehearsal/README.md).
- **Limitation:** the gate is wired, enforced and pinned by tests, but no run on a CI runner has completed yet, so it must be read as *not yet observed green*; the page-side OCR leg is the leg to fix or budget before it is treated as a dependable required check. Nothing was deployed.

### Prioritized findings

| ID | Priority / severity | Finding | Status |
|---|---|---|---|
| SEC-01 | P0 / High dependency advisory | Original `sharp` 0.35.4 affected by GHSA-wq5f-xc86-pv6w; now pinned to 0.35.5 | Patched and native/HTTP tested locally on Node 22/24; Linux/deployed verification outstanding |
| PRIV-01 | P0 / High requirement violation | Diagnoses, ratings, medication/treatment/history, symptoms and chronology enter the server; encrypted cookies are not browser-local processing | **Met 2026-10-07**: contract accepted as **browser-local all PHI** ([contract](docs/privacy-acceptance-contract-2026-10-07.md)); stages 1–4 landed (client step pages; PHI-bearing Server Actions deleted; client corpus v2 with graph anchors; legacy cookie deleted and tombstoned by the edge proxy; sentinel acceptance **20/20** with zero private-field leakage — [stage-4 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json)); server-side refusal layer added 2026-10-08 — a request carrying private context is refused (400), not merely ignored; stage-4 sentinel gate wired into CI 2026-10-08 — enforced for pull requests touching the workflow scope, fail-closed detection, **not yet observed green** (the page-side OCR leg stops the walk on this host) |
| REL-01 | P0 / High availability | Invalid live mappings and adjacency files prevented recommendations/explorer from working | **Fixed locally 2026-10-07**: enums repaired; six unapproved drafts quarantined with hash manifest; health 200, explorer 200, gates pass; quarantine reconciled 2026-10-08 — zero restorable, corpus revalidates unchanged ([record](data/knowledge-base-quarantine/2026-10-07-rel-01/RECONCILIATION.md)) |
| REL-02 | P0 / Release blocker | Production build and typecheck failed in an existing test | **Fixed locally 2026-10-07**: typecheck exits 0 on Node 22/24; Node 22 production build succeeds; no assertion weakened; live-data failures remain (REL-01) |
| COMP-01 | P0 / Acceptance blocker | Production VA account access deliberately unsupported; complete credentialed sandbox and human Section 508 review not evidenced | Confirmed design/evidence limits; not an OAuth bypass |
| SEC-02 | P1 / Medium | Inbound limiter depends on ingress headers, skips missing identities, and is per-instance | **Partially remediated locally 2026-10-08**: finder/evidence page coverage and HEAD bypass fixed; 99 focused tests plus real HTTP checks pass. Trusted ingress, distributed quotas, and hosted acceptance remain open |
| REL-03 | P1 / Medium | Graph filesystem path causes whole-project output tracing | **Fixed locally 2026-10-08**: literal path; matched builds succeed; all 38 traces/standalone retain required data with no unrelated project files; packaged HTTP/browser smoke passes within recorded scope |
| ARCH-01 | P1 / Medium | Adjacency/citation projection does not enforce an authored evidence join or matching classification | **Fixed locally 2026-10-08**: loader and both corpus builders enforce citation presence/classification joins; projections reject missing anchors; 15 new regressions pass; two unrelated converter-baseline failures remain |
| REL-04 | P1 / Medium | Health can report healthy without the real production workflow secret | Isolated test reproduced; live checkout currently fails graph health |
| SEC-03 | P1 / Medium policy gap | Production styles retain `unsafe-inline`, contrary to requested CSP requirement | Source confirmed; no demonstrated script injection |
| REL-05 | P1 / Medium client availability | DD-214 OCR bypasses shared canvas/text allocation protections; submission promises are unhandled | Source confirmed; hostile-file browser stress test not run |
| HARD-01 | P2 / Low | Error/logging and storage-validation hardening inconsistencies | Defense-in-depth; no actual PHI log leak demonstrated |

## 1. Critical vulnerabilities and release blockers

### SEC-01 — vulnerable native image dependency

**Original audit evidence:** the lockfile and installed package resolved `sharp` 0.35.4; the baseline production audit exited 1 with one high and three moderate findings. Following remediation, [package-lock.json:7199](package-lock.json#L7199) resolves 0.35.5. Next's declared dependency at [package-lock.json:6327](package-lock.json#L6327) still permits `^0.35.4`, but the root override forces the patched version. See the remediation results above for current audit/native evidence.

The [maintainer advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), read live, affects versions below 0.35.5 and describes memory corruption with possible RCE under specific glibc/Linux runtime conditions when SVG decoding reaches vulnerable librsvg. Patched prebuilt binaries ship with sharp 0.35.5/librsvg 2.63.2. Local testing was macOS; that does not settle a Linux deployment's risk.

**Do not overstate:** no first-party `sharp`, `next/image`, `ImageResponse`, or `dangerouslyAllowSVG` use was found under `src`. A dependency finding is not proof that an anonymous user can execute code in this app. No exploit was attempted. Production native-binary/platform provenance and all image/OG routes must be assessed.

**Applied dependency remediation:** added `"sharp": "0.35.5"` to the existing `overrides` object in [package.json](package.json), retained the other overrides, and regenerated/installed the lockfile with the existing npm procedure. These commands were executed; their individual outcomes are recorded above:

```sh
npm install --package-lock-only --ignore-scripts
npm ci
npm audit --audit-level=high --omit=dev
npm run typecheck
npm test
npm run build
```

A successful dependency install does not override the failing build/test release gates. Never use `npm audit fix --force` indiscriminately: the scanner proposes a breaking downgrade to mammoth 0.3.29 for the moderate transitive `sprintf-js` advisory. Handle that separately after checking actual call paths and upstream fixes. A `sharp.block({ operation: ["VipsForeignLoadSvg"] })` workaround only protects the process/module instance that actually performs decoding; do not assume calling it somewhere in App Router protects every Next worker.

**Acceptance:** installed dependency and deployed native libraries patched; high audit clean; image/OG behavior tested on target Linux/Node 22; moderate exceptions documented if unresolved.

### PRIV-01 — privacy contract is narrower than the requested architecture

**Actual path:**

1. [upload/page.tsx:70–104](src/app/secondary/upload/page.tsx#L70-L104) posts `medications`, `treatments`, `history` through `saveDocumentsSelection`; chronology and symptom controls are also in that form.
2. The (now-deleted) secondary Server Action received plaintext `FormData`, parsed it, and wrote the whole workflow state.
3. The (now-deleted) secondary session module preserved health context inside encrypted `secondary-workflow-v2` cookie payloads and read/decrypted it on the server.
4. [upload/page.tsx:24–36](src/app/secondary/upload/page.tsx#L24-L36) reads that session in a Server Component and sends stored text back as textarea defaults. [suggestions/page.tsx](src/app/secondary/suggestions/page.tsx) uses the selected condition/context state in server-side recommendation rendering.
5. [Dd214LocalAnalyzer.tsx:297–307](src/components/presumptive/Dd214LocalAnalyzer.tsx#L297-L307) explicitly posts extracted service locations/branches/dates, after confirmation, to [presumptive.ts:34–73](src/lib/actions/presumptive.ts#L34-L73). SSN/document bytes are not part of that action.

**Status (2026-10-07, stages 1–4 landed):** the server path described above is historical — the six step pages are now uniform shells rendering browser-local client steps (`src/components/secondary/steps/`, `src/lib/secondary-workflow/client-steps.ts` + `browser-context.ts` + `transport.ts`), the PHI-bearing secondary actions were deleted, and Steps 5–6 run the engine in the browser over the public corpus at `/kb/client-corpus.json`. A full six-step browser walk on 2026-10-07 persisted state only in `sessionStorage`, set no cookie, made no data-bearing request, and cleared every key on Finish Review — [stage-2 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage2-evidence.json). Stage 3 then deleted the legacy sealed-cookie module and its compact encoding, and the edge proxy now tombstones any stale `secondary-workflow-v2` presentation on both historical paths — [stage-3 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage3-evidence.json). **Stage 4 passed its sentinel acceptance on 2026-10-07:** a real-browser walk with unique sentinels in every private field (UI walk plus a seeded browser-local record covering the id/draft/timeline fields) left zero sentinel occurrences across 99 requests, 99 responses, 93 scanned bodies (9 server HTML/RSC payloads), the browser console/log, the dev-server log, `.next/trace` and cookies; upload/OCR ran in same-origin pdf.js and tesseract workers, and Finish Review cleared all seven registered browser keys — [stage-4 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json).

**Browser reproduction (pre-stage-2, retained as the audit record):** incognito Chromium, synthetic PTSD selection, rating declined, history `AUDIT_SYNTHETIC_HISTORY_2026_10_07`; the UI sent POST `/secondary/upload`. Reloading that page restored the sentinel as textarea `defaultValue` from the server. This confirms off-browser health-context processing. The subsequent recommendation render failed on invalid KB data, not because the context was refused.

**Impact:** if the acceptance criterion is “no veteran PII/PHI enters Server Components/Actions/Routes,” this is a high-priority violation. TLS, HttpOnly, SameSite, encryption at rest/in transit, and log redaction do not turn server processing into browser-only processing. There is **no demonstrated hosting-provider body log, raw-document transmission, cross-user disclosure, or HIPAA violation determination** in this audit. The application's own privacy page describes these bounded-server-workflow exceptions, so this is not evidence that raw document parsing itself is remote.

**Required complete remediation:** browser-only collection, persistence and recommendation execution for all veteran workflow state; serve only versioned **public** catalog/mapping DTOs to the browser; do not bind private controls to Server Actions; replace server cookie reads with browser state; exclude private state from telemetry, URLs and server-rendered props. This is an architectural change, not a one-line encryption fix. Separate sandbox-account BFF data from this no-PHI workflow claim; a live VA account proxy intentionally processes veteran data server-side and needs an explicit privacy/security exception.

**Copy-pasteable containment for free-text context, pending migration:** add this guard at the start of `saveDocumentsSelection`, before any persistence, and remove the private-context keys from `CONTEXT_KEYS` and the cookie schema/encoding. Reject old context-bearing cookies rather than silently continuing to decrypt/render them. The guard alone does **not** make diagnoses/ratings browser-local.

```ts
const SERVER_FORBIDDEN_CONTEXT = ["medications", "treatments", "history"] as const;
for (const key of SERVER_FORBIDDEN_CONTEXT) {
  if (formData.getAll(key).some((value) =>
    typeof value !== "string" || value.trim().length > 0
  )) {
    redirectValidation("/secondary/upload", "invalid-context");
  }
}
```

A private local editor can use the following component **outside** any server-action form. No `name` attribute means its text is not a successful native form control. Use its browser state in local recommendation processing, not in a server request:

```tsx
"use client";
import { useState } from "react";

export function LocalHistoryEditor() {
  const [text, setText] = useState("");
  return (
    <section aria-labelledby="local-history-title">
      <h3 id="local-history-title">Browser-only history notes</h3>
      <label htmlFor="local-history">Relevant history</label>
      <p id="local-history-help">Temporary browser memory only. Not submitted.</p>
      <textarea
        id="local-history"
        aria-describedby="local-history-help"
        value={text}
        maxLength={3220}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <button type="button" onClick={() => setText("")}>Clear local notes</button>
    </section>
  );
}
```

Memory-only storage is the conservative default. If sessionStorage is retained, treat it as same-origin-script-readable sensitive state, implement expiry/clear, and do not describe it as encrypted or protected by HttpOnly.

**Acceptance:** sentinel tests on every private field show no sentinel in HTTP bodies, headers/cookies, URLs, server HTML/RSC payloads, logs or tracing; local evidence upload/OCR and workflow still operate; data-clearing tests cover all private storage. Network inspection must include workers, not only component imports.

**Applied 2026-10-07 (stages 1–4, complete):** the owner accepted the strict contract — **all veteran PHI stays browser-local** — recorded in [privacy-acceptance-contract-2026-10-07.md](docs/privacy-acceptance-contract-2026-10-07.md) with a staged plan and the audit's acceptance criteria. Stage 1 landed the foundations: a bounded, versioned browser-local context store ([browser-context.ts](src/lib/secondary-workflow/browser-context.ts), registered in the shared clear-all), a public client corpus ([client-corpus.ts](src/lib/client-corpus/client-corpus.ts) + [build-client-corpus.mjs](scripts/build-client-corpus.mjs)) served at `/kb/client-corpus.json` (819 conditions, 140 published mappings, 5 graph anchors, 1.82 MB) and wired into `postinstall`/`predev`/`prebuild`, and **engine parity**: `recommend()` over the public corpus equals the server loaders' output for minimal and full-context intakes. Stage 2 converted the six step pages to uniform shells rendering browser-local client steps ([client-steps.ts](src/lib/secondary-workflow/client-steps.ts)), deleted the PHI-bearing secondary and scenario Server Actions, and replaced server cookie reads with the browser record; a full six-step browser walk kept all state in `sessionStorage`, set no cookie, and made no data-bearing request ([stage-2 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage2-evidence.json)). Stage-3 then deleted the retired cookie module and its compact encoding and added the proxy tombstones ([retired-secondary-cookie.test.ts](tests/retired-secondary-cookie.test.ts)). Stage-1/2 tests: [privacy-browser-context.test.ts](tests/privacy-browser-context.test.ts) **11/11 pass**; full-suite failing files equal the pre-stage-2 baseline (zero new); typecheck exit 0. **Stage 4 landed and passed on 2026-10-07:** [acceptance-browser-sentinel.mjs](scripts/acceptance-browser-sentinel.mjs) drives headless Chrome over CDP against the running app and separates the two sentinel passes (real UI walk with sentinels in every free-text/evidence field; seeded browser-local record with sentinels in every id/draft/rating/timeline field), asserting zero sentinel occurrences in request URLs/bodies/headers/cookies, server HTML/RSC payloads, browser and server logs, `.next/trace` and browser storage — **20/20 assertions, exit 0**, with pdf.js and tesseract worker sessions attached and inspected, text-extraction and image-only-PDF OCR retained browser-locally, no third-party host contacted, and Finish Review removing all seven registered keys ([stage-4 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json)). The PRIV-01 contract is met; remaining production gates are the other findings (COMP-01 VA/Section 508 acceptance, SEC-02 trusted ingress, and SEC-01 deployed-native verification). The normative design record — invariant, layers, data flow, storage model, corpus, evidence pipeline, enforcement matrix and extension rules — is [browser-local-veteran-workflow-design.md](docs/browser-local-veteran-workflow-design.md).

### REL-01 — invalid mappings and adjacency prevent the product from functioning

**Confirmed source failures:**

- [degenerative-disc-disease.json:44–47](data/knowledge-base/degenerative-disc-disease.json#L44-L47): `biomechanical` is not a `claimTheories` value; `intermediatechain` is not a pathway value.
- [tinnitus.json:43–46](data/knowledge-base/tinnitus.json#L43-L46): `somatopsychic`/`intermediate-chain` are not claim theories; `secondary-aggravation` is not a pathway enum.
- (Quarantined 2026-10-07 — preserved copy linked.) [graph/tinnitus.json:22–24](data/knowledge-base-quarantine/2026-10-07-rel-01/graph/tinnitus.json#L22-L24), [62–64](data/knowledge-base-quarantine/2026-10-07-rel-01/graph/tinnitus.json#L62-L64), [97–99](data/knowledge-base-quarantine/2026-10-07-rel-01/graph/tinnitus.json#L97-L99): nested `evidentiaryProfile.evidenceGaps` is an array, but the schema expects a string. Top-level edge `evidenceGaps` is correctly an array and must stay one.
- (Quarantined 2026-10-07 — preserved copies linked.) [graph/degenerative-disc-disease 2.json:2](data/knowledge-base-quarantine/2026-10-07-rel-01/graph/degenerative-disc-disease-2.json#L2) and [graph/tinnitus 2.json](data/knowledge-base-quarantine/2026-10-07-rel-01/graph/tinnitus-2.json): duplicate working-copy filenames violate filename/node identity. Runtime rejects the first at [graph.ts:64–68](src/lib/kb/graph.ts#L64-L68).
- (Quarantined 2026-10-07 — preserved copies linked.) [chronic-pain.json:2](data/knowledge-base-quarantine/2026-10-07-rel-01/mappings/chronic-pain.json#L2), [major-depressive-disorder.json:2–14](data/knowledge-base-quarantine/2026-10-07-rel-01/mappings/major-depressive-disorder.json#L2-L14), [post-traumatic-stress-disorder.json:2](data/knowledge-base-quarantine/2026-10-07-rel-01/mappings/post-traumatic-stress-disorder.json#L2): roots are not catalog IDs; `sexual-dysfunction` is not a catalog target either. Available IDs include `unexplained-chronic-pain`, `depressive-disorder`, `ptsd`, `erectile-dysfunction`, and `female-sexual-arousal-disorder`, but they are **not medically interchangeable**. Do not blindly rename or overwrite existing canonical files.

Fail-loud behavior at [load.ts:87–110](src/lib/kb/load.ts#L87-L110) is appropriate; do not loosen schemas or skip files to restore green checks.

**Applied 2026-10-07:** the two tracked-mapping enum defects were repaired in place with reviewer todos, and the six unapproved/invalid drafts were quarantined byte-for-byte with hashes to [data/knowledge-base-quarantine/2026-10-07-rel-01/](data/knowledge-base-quarantine/2026-10-07-rel-01/MANIFEST.json) — no schema was loosened, no file was deleted or renamed, and no medical mapping was guessed. See the REL-01 remediation section above for gates, live HTTP, and test evidence.

**Runtime:** `/pathways` returned HTTP 500 and `/api/health` HTTP 503 due to the duplicate graph filename. A real browser could progress Steps 1–4 but Step 5 raised the invalid DDD mapping error. [suggestions/page.tsx:52](src/app/secondary/suggestions/page.tsx#L52) and [evidence/page.tsx:54](src/app/secondary/evidence/page.tsx#L54) load the full corpus, so one invalid draft blocks otherwise unrelated sessions.

**Schema repair candidates (not a medical approval):** preserve the current draft/association posture and reviewer todos. DDD's optional `claimTheories` can retain only `secondary-causation`; its pathways can be `["biomechanical", "intermediate-chain"]`. Tinnitus's invalid optional `claimTheories` can be omitted pending reviewer selection; its pathways can use `["somatopsychic", "aggravation"]` only if reviewer intent actually covers an aggravation research pathway. Otherwise keep just `["somatopsychic"]`. Never add a claim theory merely to satisfy Zod.

This narrow TypeScript helper normalizes **only** the nested graph profile field, preserving the same text and leaving top-level arrays unchanged:

```ts
import { KbNodeMappingSchema } from "@/lib/kb/schema";

export function repairNestedGraphGaps(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Graph node must be an object");
  }
  const root = input as Record<string, unknown>;
  if (!Array.isArray(root.outgoingEdges)) throw new TypeError("Edges required");
  const outgoingEdges = root.outgoingEdges.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const edge = value as Record<string, unknown>;
    const profile = edge.evidentiaryProfile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return edge;
    const fields = profile as Record<string, unknown>;
    const gaps = fields.evidenceGaps;
    if (!Array.isArray(gaps) || !gaps.every((gap) => typeof gap === "string")) return edge;
    return { ...edge, evidentiaryProfile: { ...fields, evidenceGaps: gaps.join("\n\n") } };
  });
  return KbNodeMappingSchema.parse({ ...root, outgoingEdges });
}
```

Reconcile duplicate graph files and non-catalog medical authoring **with their owner**, placing unapproved material outside runtime directories. This audit did not delete or rewrite them. Independently verify citations before any promotion.

**Acceptance:** full Zod + membership + filename + cycle + citation gates pass; real Step 5/6 and explorer work; health 200 represents the validated corpus. [schema-failures.json](tmp/security-audit-2026-10-07/schema-failures.json) and [kb-validation.json](tmp/security-audit-2026-10-07/kb-validation.json) contain exact issues.

### REL-02 — failing build/typecheck

[tests/nexus-expansion-artifact.test.ts:149–166](tests/nexus-expansion-artifact.test.ts#L149-L166) declared `esummaryResp` without initialization; TypeScript could not prove the retry loop assigned it before `.json()`, so both typecheck and build failed TS2454. Original production compilation took approximately **4.2 minutes**, then failed TypeScript; at that time there was no successful production build to test.

**Exact local repair (applied 2026-10-07 — see the REL-02 remediation section above):** change the declaration to `let esummaryResp: Response | undefined;`, then add this before `.json()`:

```ts
if (!esummaryResp) {
  return [`${label} (PMID ${pmid}): esummary retry loop returned no response`];
}
```

Use a top-level `readdirSync` import instead of `require('node:fs')` to address that file's lint error; the repaired file imports it at [line 2](tests/nexus-expansion-artifact.test.ts#L2) and uses it at [line 199](tests/nexus-expansion-artifact.test.ts#L199). Do not exclude this test from TypeScript or swallow failed source verification to make the build pass.

`npm run lint` also fails **52 errors/52 warnings**, largely pre-existing scratch JS under `tmp/` plus the test's require import. Separate audited, non-shipping scratch artifacts from source lint by deliberate configuration, or fix code that is meant to ship. The narrow source check `eslint src next.config.ts` passes; it is **not** a substitute for the failed repository lint.

### COMP-01 — VA production and Section 508 acceptance not established

[config.ts:10–35](src/lib/va/account/config.ts#L10-L35) hardcodes sandbox services; [74](src/lib/va/account/config.ts#L74) rejects any environment other than sandbox. Production account access is unavailable **by design**. Changing a hostname or enabling an environment flag is not production readiness.

The [accessibility evidence report](docs/accessibility-audit.md) explicitly says **PARTIAL EVIDENCE — MANUAL CONFORMANCE REVIEW PENDING**. [Manual workbook:103–116](docs/section508-manual-review-workbook.md#L103-L116) leaves results NOT TESTED. Automated source-string assertions cannot demonstrate all applicable WCAG criteria or entire multi-step flows.

**Remediation:** finish the controlled sandbox test matrix, exact provider registration/discovery checks, target-runtime/shared-store verification, deployment log scrubbing, and independent human assistive-technology review; retain production disablement until those gates and VA approval are complete. No code snippet can truthfully create a production approval or Section 508 certification.

## 2. Server Action and endpoint security

### What is actually protected

| Surface | Native controls and interpretation |
|---|---|
| [client-steps.ts](src/lib/secondary-workflow/client-steps.ts) (replaced the retired `secondary.ts` in PRIV-01 stage 2) | Browser-local step functions with the former field allowlists, catalog membership, context bounds, years and rating validation; no request, cookie, account DB or cross-user resource. |
| [presumptive.ts](src/lib/actions/presumptive.ts) | Bounded service-history Zod validation + explicit location membership; writes only caller cookie. |
| [ScenarioLaunchForm.tsx](src/components/ScenarioLaunchForm.tsx) (replaced the retired `scenarios.ts` in PRIV-01 stage 2) | Scenario-ID lookup and client-corpus validation in the browser; no request, user-controlled filesystem path or arbitrary code runner. |
| [accredited-representatives.ts:13–77](src/lib/actions/accredited-representatives.ts#L13-L77) | Manual ZIP/radius/type validation and allowlisted return routes; no confirmed open redirect. ZIP ends up in query strings and may enter access logs. |
| [admin/cache-clear](src/app/api/admin/cache-clear/route.ts) and [regulatory/preflight](src/app/api/regulatory/preflight/route.ts) | Each handler independently checks a >=32-character Bearer secret with constant-time comparison in [bearer-auth.ts](src/lib/security/bearer-auth.ts). No reliance on proxy/layout auth. Local unauthenticated cache-clear POST returned 401. |
| [OAuth handler](src/app/va-account/oauth/%5Bservice%5D/%5Boperation%5D/route.ts) | Native configured-origin validation, explicit consent, one-use state/browser binding, opaque session handle, independent POST origin checks. |
| [health](src/app/api/health/route.ts) and [CSP reporting](src/app/api/csp-report/route.ts) | Intentionally public diagnostics/content-free reporting. No veteran data authorization expected; abuse controls still matter. |

No SQL/NoSQL interpreter was found in these workflow actions. Manual allowlists are valid security controls even though they do not satisfy the literal “strict Zod on every argument” preference. `.strict()` alone neither prevents memory exhaustion nor substitutes for authorization. The installed Next handler defaults action bodies to 1 MiB ([action-handler.js:517–519](node_modules/next/dist/server/app-render/action-handler.js#L517-L519)); it is incorrect to describe these POSTs as unlimited solely because an array schema lacks `.max()`.

The actions are module-scoped, not secret-bearing closures inside render functions. Server-only loaders and VA DAL modules provide isolation; no captured client-bound secret or database row leak was established. Taint APIs are not enabled. Next.js 15 documentation calls taint **additional protection**, not a replacement for minimal DTOs, and absence of experimental taint is not a confirmed vulnerability. Consider adding `import "server-only"` to workflow crypto/session helpers as compile-time intent protection; do not claim that omission proves current secret bundling.

**Bounded strict validation example** for the manually validated public directory search; `getAll` rejects duplicate values and File arguments rather than silently selecting the first. Next's internal `$ACTION_` fields are not application keys:

```ts
import { z } from "zod";
const directorySearchSchema = z.object({
  zip: z.string().regex(/^\d{5}$/),
  radiusMiles: z.enum(["25", "50", "100"]).optional(),
  type: z.enum(["VSO", "agent", "attorney"]).optional(),
  returnTo: z.enum([
    "/secondary/suggestions", "/secondary/evidence", "/presumptive/results",
  ]).default("/secondary/suggestions"),
}).strict();

function singleText(fd: FormData, key: string): string | undefined {
  const values = fd.getAll(key);
  if (values.length > 1 || values.some((value) => typeof value !== "string")) {
    throw new TypeError("Invalid form field");
  }
  const value = values[0];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
const parseDirectorySearch = (fd: FormData) => directorySearchSchema.parse({
  zip: singleText(fd, "zip"), radiusMiles: singleText(fd, "radiusMiles"),
  type: singleText(fd, "type"), returnTo: singleText(fd, "returnTo"),
});
```

Use `.safeParse()`/the existing validation redirect flow for user errors. Do not log the rejected object or Zod values. For anonymous workflow inputs, bound field sizes/counts before expensive normalization; add catalog-sized caps and reject duplicate/File values explicitly. Preserve existing overposting defenses.

### SEC-02 — ingress-dependent rate control and missed public search route

[rate-limiter.ts:263–294](src/lib/rate-limiter.ts#L263-L294) accepts the first `x-forwarded-for` or `x-real-ip` token without validating it as an IP/trusted ingress identity. [proxy.ts:237–255](src/proxy.ts#L237-L255) skips every app limiter if neither header supplies a key. Buckets are process-local and restart on cold start; scaling yields approximately limit × instance count. Comments acknowledge an external WAF, but source comments do not prove one is configured.

**Original route omission (fixed locally 2026-10-08):** the proxy limited GET `/va-forms`, not `/va-forms/finder`. The actual search route [finder/page.tsx:20–23](src/app/va-forms/finder/page.tsx#L20-L23) invokes [forms-finder.ts:55–74](src/lib/va/forms-finder.ts#L55-L74), potentially reaching VA/shared services. The original isolated test sent 31 requests with the same identity: finder remained accepted while `/va-forms` yielded 429. The remediation now covers finder and the also-omitted `/secondary/evidence` public-loader page, and charges HEAD to the same budget as GET. See the SEC-02 remediation evidence above. Global outbound admission may protect upstream quota; it does not replace inbound per-client fairness or establish trusted ingress.

**Applied route/method fix:** [proxy.ts](../src/proxy.ts) now includes both `/va-forms/finder` and `/secondary/evidence` in the reference-page condition and checks GET and HEAD against the same budget. [api-route-rate-limit-coverage.test.ts](../tests/api-route-rate-limit-coverage.test.ts) inventories the current public-loader pages and behaviorally checks admission. The filesystem-only `/pathways` page was reviewed and deliberately excluded from this upstream-reference budget. The API-route coverage registry alone scans API conventions, not every App Router page/account route; newly introduced loaders still require coverage review.

**Trusted identity remediation depends on deployment:** require a managed edge which strips client-supplied forwarding headers, supplies an authoritative identity, prevents direct-origin access, and enforces distributed quotas and body/read deadlines. A client-supplied “user ID,” `Origin`, signed action ID or regex-valid IP is not trusted authentication. Without ingress evidence, there is no honest universal drop-in `getClientIp()` fix. Do not replace missing identities with a single `unknown` bucket, which permits one client to throttle everyone. If an edge/shared limiter is selected, research/install it through the service-discovery process; this report recommends no vendor from memory.

**Acceptance:** test missing/spoofed header behavior through the actual edge, two instances/cold starts, 429 headers, public search routes, and operator/OAuth throttles. Global OAuth budgets (one admission/two seconds per config) are conservative app-wide upstream safety controls, not per-veteran fairness or a multi-user capacity plan.

### Logging, telemetry, and mutation details

- [logger.ts](src/lib/observability/logger.ts) implements allowlisted/redacted structured events; automatic OTEL export is disabled by [instrumentation.ts](src/instrumentation.ts)/[telemetry-policy.ts](src/lib/observability/telemetry-policy.ts). No browser analytics SDK is initialized.
- Optional [recommend.ts:413–433](src/lib/engine/recommend.ts#L413-L433) LangSmith processors emit input/output **counts**, not raw intake. Do **not** claim they export all medical inputs. Its malformed-output fallback `return { outputs }` at line 427 is fail-open hardening debt; replace with `return { outputStatus: "invalid" };`. SDK exception export and collector retention remain unverified; leave tracing disabled pending sentinel tests.
- The retired secondary actions' raw `console.error` exception-text path (previously `secondary.ts:152,202,229,268,332,388`) was removed with the module in PRIV-01 stage 2; client [error.tsx:20](src/app/error.tsx#L20) and [secondary/error.tsx:18](src/app/secondary/error.tsx#L18) still print `error.message`. The paths currently observed mostly contain static/config/public-data errors. No PHI-containing exception leak was reproduced. Replace raw console error with fixed error codes and digest-only client diagnostics; never attach rejected form values.
- Regulatory preflight uses authenticated GET to refresh cache. Bearer auth prevents ordinary browser-driven unauthorized refresh, but a mutating operator operation should use POST with reviewed cron method configuration. Do not invent an unauthenticated CSRF exploit here.
- Cache-clear accepts/echoes an unconstrained authenticated `prefix`. Bound it (for example `z.string().max(120).regex(/^[a-zA-Z0-9:_-]+$/).optional()` after clarifying valid namespaces), return a failing status if required shared invalidation fails, and retain server authorization.

## 3. CSP and PII/PHI boundary details

**Good controls:** [next.config.ts:12–24](next.config.ts#L12-L24) applies HSTS, nosniff, DENY, no-referrer and restrictive Permissions-Policy. COOP/COEP isolates same-origin local OCR assets. [proxy.ts:111–125](src/proxy.ts#L111-L125) uses request nonces/strict-dynamic; production does not include general `unsafe-eval`. `wasm-unsafe-eval` is the narrower WASM allowance required by OCR, not generic JavaScript eval. Development `unsafe-eval` is expected by official Next guidance and is not proof of production failure.

The actual Next 16 convention is [src/proxy.ts](src/proxy.ts), not a missing `middleware.ts`. [layout.tsx:17–18](src/app/layout.tsx#L17-L18) calls `await connection()` to force request-time rendering for nonce support. **No static HTML/nonce mismatch was found.** App-wide dynamic rendering is a conscious security/performance tradeoff, not a bug to “fix” by removing `connection()`.

Raw documents are handled by client-only components/dynamic parser imports; PDF worker and Tesseract assets are same-origin. [document-extract.ts](src/lib/evidence/document-extract.ts) caps file/pages/text, preflights DOCX declared expansion, extracts text instead of rendering DOCX HTML, and tears down document resources after successful load. [VoiceInputTextarea.tsx](src/components/secondary/VoiceInputTextarea.tsx) deliberately disables off-device speech recognition. Static import/source tests are supporting evidence, not complete runtime network proof.

### SEC-03 — inline-style exception

[proxy.ts:170–172](src/proxy.ts#L170-L172) includes `style-src 'self' 'unsafe-inline'` in production. This does not meet the user's explicit prohibition. It weakens style injection protection, but is not equivalent to enabling executable inline JavaScript.

**Proposed replacement in `buildContentSecurityPolicy`:**

```ts
...(isDevelopment
  ? ["style-src 'self' 'unsafe-inline'"]
  : [`style-src 'self' 'nonce-${nonce}'`, "style-src-attr 'none'"]),
```

Do **not** paste this and claim compatibility without replacing/auditing existing dynamic styles in [ConditionTimelineVisualization.tsx:342–374](src/components/secondary/ConditionTimelineVisualization.tsx#L342-L374), [719](src/components/secondary/ConditionTimelineVisualization.tsx#L719) and all library/framework generated styles. A nonce on a style tag does not authorize a literal HTML `style` attribute. Prefer static CSS/SVG presentation attributes; if dynamic style tags are unavoidable, give those reviewed tags the trusted server-generated nonce and keep text free of untrusted CSS values. Browser DOM style APIs, server style attributes and nonce-bearing tags are not interchangeable.

Production Trusted Types is gated to same-origin script URLs in [trusted-types-policy.ts](src/lib/security/trusted-types-policy.ts). The default policy is installed **after hydration**, not before as an outdated layout comment implies. Initial framework/hydration, navigation/dynamic chunks, PDF/OCR worker realms and strict-style behavior need a successful production build/browser test. None was possible here after the build failed. Do not disable Trusted Types/CSP merely to silence runtime violations.

### HARD-01 — local storage and parser hardening

[storage.ts:136–163](src/lib/evidence/storage.ts#L136-L163) parses stored evidence before checking raw serialized size and filters all analyses before slicing. Write budgets are not read guards. Add a byte limit before `JSON.parse` and bound arrays/excerpt text during validation. Oversize/malformed local storage should trigger the existing visible warning/clear path, not silent data loss. This is a local/same-origin resource issue, not demonstrated remote server exploitation.

DOCX preflight bounds declared central-directory expansion, but does not cap actual decompressor output incrementally. [document-extract.ts:256–258](src/lib/evidence/document-extract.ts#L256-L258) checks text after `mammoth.extractRawText`; a dishonest ZIP header/parser issue can allocate before that check. Hostile DOCX and PDF worker cancellation/deadline tests remain necessary. `loadingTask.promise` should sit inside its teardown try/finally in every extractor, so load rejection also reaches `destroy()`.

## 4. CRG integrity, caching and performance

### Runtime traversal controls — supported

- [pathway-depth.ts:26](src/lib/kb/pathway-depth.ts#L26): `MAX_PATHWAY_HOPS = 2`.
- [pathway-generator.ts:104–144](src/lib/engine/pathway-generator.ts#L104-L144): expansion stops at the cap; current-branch node set skips ancestor revisits, preserves convergent paths, and stops after an association-only link.
- [schema.ts:739–742](src/lib/kb/schema.ts#L739-L742): hop array max matches the shared cap; contiguous endpoints and composite labels checked.
- [pathways.ts:109–150](src/lib/engine/pathways.ts#L109-L150): published-map composer checks two-edge depth/self/return loops and refuses association-only composition.
- [utils.ts](src/lib/kb/utils.ts) mirrors association/aggravation label precedence. These labels are authored research semantics, **not a proof of an individual statutory nexus or adjudication outcome**.
- [scripts/audit-crg.ts:185–210](scripts/audit-crg.ts#L185-L210): three-color DFS detects global cycles in CI. Runtime loader does not itself assert DAG acyclicity; traversal remains cycle-safe. The current live cycle gate fails invalid data before any valid DAG verdict.

**Measured synthetic correctness/timing**, Node 24/macOS, 20 runs per case, same unmodified generator, schema-valid fixtures:

| Input | Output checked | Median | Maximum |
|---|---|---|---|
| 819-node directed cyclic chain | Exactly two paths, <=2 hops, no origin terminal | 0.022 ms | 0.262 ms |
| 30 × 30 branching frontier | Exactly 930 paths, <=2 hops, no origin terminal | 6.702 ms | 16.488 ms |

[Initial reproduction log](tmp/security-audit-2026-10-07/reproductions.log). A final repeat also passed all four tests ([final log](tmp/security-audit-2026-10-07/final-reproductions.log)); medians were 0.017 ms and 5.779 ms respectively, illustrating run-to-run timing variation. This demonstrates bounded termination/correctness for those fixtures, not a measured production throughput promise or speedup. A two-hop cap limits stack depth, not branching/output growth; high-degree graphs or rendering every origin can still expand quadratically. Benchmark full live data after repair, bound work/output with a visible partial-result contract, and avoid silently truncating clinical paths.

CI's recursive DFS is not protected by the runtime two-hop cap. Current scale alone does not establish a stack overflow; for substantial growth prefer iterative DFS/SCC and cap file/node bytes. Do not conflate cycles in population-level medical associations with individual causal conclusions: rejecting cycles is a modeling gate, not a medical fact.

### ARCH-01 — independent graph and evidence stores can drift

**Original audit evidence:** the graph loader checked membership/quarantine but not authored suggestion/citation joins; projection silently yielded zero anchors for absent suggestions while carrying graph classifications. The original invalid tinnitus adjacency had unsupported targets, and an isolated fixture emitted a direct-causation projection without anchors. Those observations are historical: the current five shipped graph edges all have matching evidence/classifications, and the 2026-10-08 remediation adds fail-closed checks before graph-cache publication and corpus generation plus anchorless-projection rejection. UI disclosures still separate draft research from published recommendations; citation presence does not verify an individual nexus.

**Implemented fail-closed join contract**, shared by runtime loading and corpus generation in [graph-evidence-joins.mts](../src/lib/kb/graph-evidence-joins.mts) (abbreviated below):

```ts
export function assertGraphEvidenceJoins(
  kb: KnowledgeBase,
  nodes: readonly KbNodeMapping[],
): void {
  const mappingById = new Map(kb.map((mapping) => [mapping.id, mapping]));
  for (const node of nodes) {
    for (const edge of node.outgoingEdges) {
      const suggestion = mappingById.get(node.nodeId)?.suggestions.find(
        (candidate) => candidate.conditionId === edge.targetConditionId,
      );
      if (!suggestion || suggestion.sourceReferences.length === 0) {
        throw new Error(`[kb-graph] Missing authored evidence for ${node.nodeId} -> ${edge.targetConditionId}`);
      }
      if (suggestion.nexusClaim.nexusClassification !== edge.nexusClaim.nexusClassification) {
        throw new Error(`[kb-graph] Nexus classification mismatch for ${node.nodeId} -> ${edge.targetConditionId}`);
      }
    }
  }
}
```

The shared guard uses type-only imports so native Node generation does not need server-loader aliases or a new dependency. The runtime loads KB once, checks quarantine and evidence joins, and caches only after success. The generator refuses bad inputs before writing; corpus parsing/projection refuse incomplete anchor indexes. See the remediation evidence above. This minimal join is not full payload equivalence: mechanism/profile/rationale/gap reconciliation remains a separate improvement. Permitted draft edges retain research-only disclosures; neither citation presence nor a verification flag is publication approval.

### REL-03 — whole-project file tracing

**Original audit evidence (before the 2026-10-08 repair):** [graph.ts](../src/lib/kb/graph.ts) joined `process.cwd()` with an imported relative directory constant. Actual Turbopack warning: “Dynamic filesystem access causes tracing of the whole project.” Generated [health route trace](.next/server/app/api/health/route.js.nft.json) contains **3,032 file entries**, including 233 source files, 313 test files, 466 documentation files and 28 scratch files. Summed current sizes are **82,612,160 bytes** (about 78.8 MiB), not a compressed deploy-size measurement. Suggestions trace has 3,065 entries. No `.env` file was found in the inspected traces; this is not proof of a shipped secret or public source download. It is confirmed unnecessary artifact inclusion and increased deployment/resource risk.

**Applied static anchoring** in the default path declaration:

```ts
const KB_GRAPH_DIR = path.join(process.cwd(), "data", "knowledge-base", "graph");
```

[kb-graph-loader.test.ts](../tests/kb-graph-loader.test.ts) now pins this literal to [graph-layout.ts](../src/lib/kb/graph-layout.ts). Successful before/after builds and inspection of all 38 traces plus standalone confirm this minimal fix is sufficient locally; no additional tooling-seam refactor was necessary. `loadKbGraphFromDir` retains its arbitrary-directory/default-dir interface and validation behavior. No `turbopackIgnore` or global excludes hide runtime data. See the REL-03 remediation section above for measured artifact reductions, packaged-server checks and the exact isolated-build limitations; repeat artifact inspection on the actual target build before deployment.

### Cache promotion semantics

[load.ts:19–22,63–80,184–190](src/lib/kb/load.ts#L19-L22) and [graph.ts:123–138](src/lib/kb/graph.ts#L123-L138) use process-wide caches; published IDs are separately memoized. No `unstable_cache`, `revalidateTag` or `revalidatePath` use was found under `src`. That is not inherently wrong: knowledge-base promotion is file/build driven, not a live user mutation endpoint. Redeploy immutable reviewed data and invalidate/restart all instances. Next tag/path invalidation would **not** clear these JavaScript module variables. [admin cache-clear](src/app/api/admin/cache-clear/route.ts) clears VA reference caches, not the KB. If hot promotion becomes a supported product feature, define versioned snapshots plus shared invalidation/atomic loader publication and test cross-instance consistency first.

Other performance/type observations: strict TypeScript is enabled; no explicit `as any`, `: any`, `<any>` or `@ts-ignore` was found in source scanning. Public catalog/KB loaders carry `server-only`; PDF/Mammoth/Tesseract and the timeline use dynamic imports. Some client views receive the full public catalog/view models rather than minimum subsets. This is a payload optimization opportunity, not private server-code bundling proof. Production client bundle size was not verified because build failed. Step 1 exposes 819 native checkboxes without a functional search despite “Search or browse” copy: costly keyboard navigation/UX, not by itself a WCAG failure. Add an accessible filter and preserve selected controls; avoid unreviewed virtualization that removes screen-reader access.

### REL-04 — health tests primitives, not workflow readiness

[health/route.ts:38–41](src/app/api/health/route.ts#L38-L41) tests crypto with a hardcoded probe secret, deliberately independent of production config. [188–190](src/app/api/health/route.ts#L188-L190) only combines catalog/crypto/graph. A missing real workflow key blocks writes while health can say healthy. This was reproduced with **only graph loading mocked to valid empty data**; workflow readiness was false and real sealing threw, but GET health returned 200/healthy. The current live checkout returns 503 for graph corruption, so no claim of a current live false-green endpoint is made.

**Exact readiness addition** in the health route:

```ts
import { workflowSessionRuntimeReady } from "@/lib/workflow-session-crypto";
// Alongside the other checks:
const workflowReady = process.env.NODE_ENV !== "production" || workflowSessionRuntimeReady();
// Include this in the returned components:
const workflowSession = {
  status: workflowReady ? "ok" as const : "error" as const,
  latencyMs: 0,
  detail: workflowReady ? "Workflow session available" : "Workflow session configuration unavailable",
};
// Incorporate workflowSession.status === "ok" into `healthy`.
```

Do not return secrets or exception values. Resolve the configuration mismatch: [workflow-session-crypto.ts:37–40](src/lib/workflow-session-crypto.ts#L37-L40) accepts the legacy `SECONDARY_WORKFLOW_SESSION_SECRET`, whereas [182–189](src/lib/workflow-session-crypto.ts#L182-L189) readiness checks only `WORKFLOW_SESSION_SECRET`. Share the resolver or explicitly retire the fallback with a migration. Liveness may stay independent; production workflow **readiness** must fail on unusable required configuration.

### REL-05 — DD-214 allocation and asynchronous submission

Unlike the main evidence OCR pipeline, [Dd214LocalAnalyzer.tsx:87–100](src/components/presumptive/Dd214LocalAnalyzer.tsx#L87-L100) uses raw scale-2 page dimensions without `computeOcrRenderMetrics` or `releaseCanvas`. PDF text is accumulated then truncated only downstream; image files are passed directly to OCR at [116](src/components/presumptive/Dd214LocalAnalyzer.tsx#L116). File-byte limits do not bound decoded image/canvas dimensions. Large page geometry or many dense pages can exhaust a veteran's browser tab. The parser's `_limits` argument is explicitly unused at [dd214-extract.ts:170–177](src/lib/evidence/dd214-extract.ts#L170-L177).

**Reuse existing protection** (import both helpers from `ocr-session`) and replace per-page viewport/canvas handling:

```ts
const unit = page.getViewport({ scale: 1 });
const metrics = computeOcrRenderMetrics(unit.width, unit.height);
const viewport = page.getViewport({ scale: metrics.scale });
canvas = document.createElement("canvas");
canvas.width = metrics.canvasWidth;
canvas.height = metrics.canvasHeight;
// Existing render/recognition work here.
// In the matching finally block, before/after page cleanup:
if (canvas) releaseCanvas(canvas);
```

Track cumulative extracted characters before appending text to either text-layer or OCR arrays, refuse/warn at `limits.textChars`, cap image decoded dimensions before recognition, and move PDF load-await inside teardown. Share the existing chunk-yield/cancellation contract; do not simply truncate after allocating the entire transcript.

[305–307](src/components/presumptive/Dd214LocalAnalyzer.tsx#L305-L307) has an unhandled dynamic-import `.then` and detached action promise. It also lacks a real pending transition and can send repeated submissions. Replace synthetic DOM form creation/dynamic import with a static Server Action import and a real action form:

```tsx
import { saveServiceHistory } from "@/lib/actions/presumptive";
// Replace the current confirmation form's onSubmit with action={saveServiceHistory}.
<form action={saveServiceHistory}>
  {editedLocations.map((location) => (
    <input key={location} type="hidden" name="location" value={location} />
  ))}
  {editedBranches.map((branch) => (
    <input key={branch} type="hidden" name="serviceBranchCode" value={branch} />
  ))}
  <input type="hidden" name="serviceStart" value={editedStart} />
  <input type="hidden" name="serviceEnd" value={editedEnd} />
  <button type="submit" disabled={!confirmed || busy}>Confirm and continue</button>
  <button type="button" onClick={clearDraft}>Clear uploaded DD-214 from this tab</button>
</form>
```

Add a child `useFormStatus` submit button for pending feedback. This fixes invocation reliability under the **current server-service-history contract only**; it is not the PRIV-01 browser-only architecture fix. Raw extracted text/SSN must remain absent from hidden fields. Server action must still validate dates/location membership. User confirmation is not authorization or sanitization of arbitrary uploaded text.

## 5. OAuth 2.0 PKCE and Section 508

### OAuth controls found and tested

- [oauth.ts:10–12,95–108](src/lib/va/account/oauth.ts#L95-L108): independent 32-byte randomness, 43-character base64url verifier/state/binding/nonce, SHA-256 challenge and `S256`.
- [113–129](src/lib/va/account/oauth.ts#L113-L129): unique state/code, browser-binding digest, service/config fingerprint, expiration, atomic consumption before exchange, fixed redirect URI, ID-token verification.
- [72–90](src/lib/va/account/oauth.ts#L72-L90): RS256, issuer/audience/sub/exp/iat, nonce, authorized-party checks, bounded JWKS and timeouts.
- [store.ts:80–143](src/lib/va/account/store.ts#L80-L143): encrypted server-side values, NX/GETDEL/CAS, bounded HTTPS command exchange. [146–155](src/lib/va/account/store.ts#L146-L155) refuses implicit memory storage in hosted/production runtimes.
- [OAuth route:13,45–64,79–91](src/app/va-account/oauth/%5Bservice%5D/%5Boperation%5D/route.ts#L45-L64): private/no-store, configured-origin native POST check, consent, Lax short-lived transaction cookie, Strict opaque HttpOnly account cookie, HTTPS Secure selection, fixed redirects. Tokens are not exposed in cookie/props/browser storage.
- [data.ts:45–86](src/lib/va/account/data.ts#L45-L86): minimal bounded schemas, no-store/no-redirect reads, shared upstream pacing/cooldown, no raw upstream error exposure. Refresh expiry fixed; logout CAS does not resurrect a session.

**24 sandbox account unit tests passed** with synthetic signing keys/provider/store mocks, including replay/concurrent redemption, invalid issuer/audience/nonce/signature/expiry, DTO minimization, refresh races, CSRF, consent and cookies. These are strong source contracts, **not credentialed VA interoperability**. Live local start returns 503 because sandbox is disabled/unconfigured; that does not test a successful login or actual foreign-Origin 403. The mock-configured origin test does check 403.

Live [VA Benefits Claims Authorization Code Grant documentation](https://developer.va.gov/explore/api/benefits-claims/authorization-code) was rendered in Chromium because text extraction initially returned only the SPA shell. It confirms fixed registered redirect URI, required state, supported S256, code verifier at token exchange, read-scope minimization, JWT signature/nonce/expiry validation and HTTPS outside local development. The app's claims endpoints match the documented URL shape. The same docs state `openid` makes an ID token available, even though a simplified PKCE response example omits it; do not weaken signature/identity checks to match an abbreviated example.

**Still needed:** current signed/approved client configuration and read scopes for both APIs; exact issuer/JWKS/discovery comparison (especially ratings); test-account credentials used securely outside chat; real token response/refresh/revocation interoperability; two-account data isolation; hosted store GETDEL/CAS compatibility; actual origin/cookie/no-store behavior in a successful production-mode sandbox build. Do not invent secrets or request their values. Global shared login/data budgets currently permit only one request/two seconds per service/config, limiting capacity across all users; quantify that policy before scale-up.

### Accessibility evidence and gaps

Source review found native labeled forms, fieldsets, landmarks, English language, skip link, visible focus styles, reduced-motion/forced-colors rules, roving-arrow-key tab controls, and live statuses. No ARIA attribute is a blanket compliance guarantee. Potential dialog/SVG/timeline, validation-focus, table, and export behavior still requires complete browser/assistive-technology coverage.

**Small live Chromium check:** home screenshot/snapshot rendered; keyboard Tab reached skip link and Enter moved focus to `main-content`; at 320 CSS px diagnosed/upload pages had no measured horizontal overflow; 819 diagnosed checkboxes were accessible native controls. Rating validation rendered a visible alert; keyboard selection and actual Server Action submissions progressed through upload. This was not a complete keyboard-only workflow, screen-reader, contrast-state, or forced-colors review. Failed Step 5 prevented completion of the sequence.

Sample palette ratios: white on `#1d4ed8` **6.70:1**; `#475569` on white **7.58:1**. Both exceed 4.5:1 for normal text. Only these colors were calculated; opacity, hover/selected/disabled states, badges, SVG/text, all routes and screenshots were not exhaustively tested. Do not infer “all contrast passes.”

[Section508.gov](https://www.section508.gov/develop/applicability-conformance/) confirms the Revised Standards incorporate WCAG 2.0 A/AA and that failure of one applicable criterion or one step in a sequence prevents full conformance. Pursue WCAG 2.1/2.2 where required by the actual procurement/integration agreement, but do not substitute assumptions for its specified baseline.

**No honest copy-paste code certifies this pillar.** Complete the existing workbook using named human tester/build identity, NVDA/Chrome or Edge and VoiceOver/Safari, keyboard-only flows, screen-reader announcements, 200%/reflow, focus/traps, errors, forced colors, print/download accessibility and all active account consent/callback/error/disconnect paths.

## Original audit checks and artifacts (before SEC-01, REL-02, and REL-01 remediation)

These baseline results are retained for comparison. Current dependency/native/release-check reruns are recorded in the SEC-01, REL-02, and REL-01 remediation sections above.

| Check | Result |
|---|---|
| `npm run typecheck` | **FAIL**, TS2454; [log](tmp/security-audit-2026-10-07/typecheck.log) |
| `npm run build` | **FAIL**, compiled then TS2454; dynamic filesystem tracing warning; [log](tmp/security-audit-2026-10-07/build.log) |
| `npm test` | **FAIL**, 137 failed/165 passed test files; 144 failed/1,709 passed tests; 1,853 collected tests; 83.46 s; some suites fail collection. [log](tmp/security-audit-2026-10-07/tests.log) |
| `npm run lint` | **FAIL**, 52 errors/52 warnings; [log](tmp/security-audit-2026-10-07/lint.log) |
| `eslint src next.config.ts` | **PASS**; [log](tmp/security-audit-2026-10-07/source-lint.log) |
| `node scripts/validate-knowledge-base.js` | **FAIL**, seven reported integrity/metadata errors; [report](tmp/security-audit-2026-10-07/kb-validation.json) |
| `node --no-warnings scripts/audit-crg.ts` | **FAIL**, invalid tinnitus adjacency schema; no valid live acyclicity verdict; [log](tmp/security-audit-2026-10-07/crg.log) |
| Full schema inspection of authored/adjacency files | Three schema-invalid files; additional filename/membership failures are separate; [report](tmp/security-audit-2026-10-07/schema-failures.json) |
| `npm audit --audit-level=high --omit=dev` | **FAIL**, sharp high + three moderate; [log](tmp/security-audit-2026-10-07/dependency-audit.log) |
| Isolated audit reproductions | **PASS, 4 tests**, after correcting an audit-harness syntax typo; reproduces readiness false-green, missing finder limiter, absent citation join, traversal correctness/timing. [test](tmp/security-audit-2026-10-07/audit-reproductions.test.ts), [config](tmp/security-audit-2026-10-07/audit.config.mts), [log](tmp/security-audit-2026-10-07/reproductions.log) |
| Live development HTTP | Home/diagnosed/account 200; explorer 500; health 503; unauthenticated cache-clear 401; disabled account start 503. [results](tmp/security-audit-2026-10-07/http-results.json) |
| Development browser | Partial real workflow through upload, synthetic context server persistence, failed recommendations, skip link, small-width reflow; no production-mode/credentialed end-to-end pass claimed. [Observations](tmp/security-audit-2026-10-07/browser-observations.json) |
| File-tracing artifact | Whole-project inclusion verified; [summary](tmp/security-audit-2026-10-07/tracing-summary.json) |

Passing security suites within the full failing run include VA account (24), proxy headers (11), Trusted Types (21), rate limiter (19), structured logger privacy (11), workflow privacy (6), telemetry (6), completion privacy (4), ingestion (2), bearer auth (6), CSRF helper (14), pathway generator (12), generator fuzz (9), and graph-cycle fixture audit (24). These numbers describe unit contracts, not the failed live-data/release gate. Accessibility UX had two failures; graph loader had four failures. Many other failures cascade from invalid corpus, but not every failed test was individually root-caused; the complete failure log is retained.

## Missing context / requests to complete the five pillars

No evidence that a specifically requested critical source file is absent: [next.config.ts](next.config.ts), [proxy.ts](src/proxy.ts), actions, engine, KB, OAuth and selected components are present. `middleware.ts` is not required with this Next 16 convention. Remaining source coverage and external configuration still block any “100% audit” claim.

Please provide **sanitized configuration/evidence, not secret values**:

1. Deployment target/config and exact deployed commit/build: actual ingress/WAF rules, trusted forwarded-header normalization, direct-origin exposure restrictions, request/body/read timeouts, instance topology, TLS and custom-domain/callback setup.
2. Hosting access/error log policy: query redaction for OAuth code/state and ZIP/forms query, request/response body capture settings, retention/access controls; APM/tracing exception/input processors and collector retention if enabling tracing.
3. VA approved registrations: public client IDs/auth-method names, granted read scopes, registered redirect origins/URIs, authoritative discovery/issuer/JWKS metadata for both services, production-access approval and test-account execution evidence. Do not send client secrets, access/refresh tokens, store bearer tokens or veteran records.
4. Shared account/coordinator store capability and transport configuration with secret values removed; GETDEL/NX/CAS TTL/failure/race test evidence in actual hosting environment.
5. Completed [Section 508 manual workbook](docs/section508-manual-review-workbook.md), named reviewer/build/OS/browser/assistive technology, criterion-level results and any accessibility conformance report required by VA/procurement.
6. Exact privacy acceptance decision: browser-local **raw documents only** versus browser-local **all veteran PII/PHI**. Current implementation meets neither a certified conformance claim nor the latter architectural promise; choose and document before enabling real veteran data.
7. Ownership/disposition of current dirty/untracked mappings, duplicate graph files, medical draft packets and live-network test artifacts. Reconcile without blind delete/rename or mechanically claiming medical equivalence. The REL-01 quarantine manifest now records a reversible disposition for six of them; their re-entry still requires the owner's clinical-identity decision.
8. Successful Node 22 production build and artifacts, complete browser/OCR hostile-input/network probes, all 234 source-file coverage/remaining dynamic UI paths, Linux native dependency provenance and runtime security scanning. Existing unit/e2e scripts are not automatically proof these were executed against this build.

### Recommended order

1. ~~Patch the high native dependency and restore build/live-data integrity without relaxing validation or clinical verification.~~ **Done locally:** dependency patched (SEC-01), build/typecheck restored (REL-02), and live-data integrity restored (REL-01) by repairing two enum defects and quarantining six unapproved drafts byte-for-byte with hashes. Their re-entry still needs their owner and a medical-sign-off decision; no schema was loosened, and nothing was deleted or renamed.
2. ~~Resolve PRIV-01's acceptance contract; implement true client-only veteran workflow if the requested constraint stands.~~ **Done 2026-10-07:** contract resolved (browser-local all PHI); stages 1–4 landed (client step pages; PHI-bearing Server Actions removed; client corpus v2 with graph anchors; legacy cookie deleted and tombstoned; browser sentinel acceptance **20/20**, zero private-field leakage — [stage-4 evidence](tmp/security-audit-2026-10-07/rel-01-kb-repair/priv01-stage4-evidence.json)).
3. Fix trusted-ingress/distributed rate-control coverage, readiness truthfulness, graph evidence joins and trace scope.
4. Harden DD-214 allocations/promise handling and production strict-style/Trusted Types compatibility.
5. Run target-Node/hosted sandbox two-account PKCE tests and complete human Section 508 review; only then request/enable authorized production VA access.

## Official sources checked

- [Next.js 14 Server Actions and Mutations](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations): public POST endpoints, in-action authorization/validation, closures, Origin/Host checks, revalidation and redirect control flow.
- [Next.js 15 Data Security](https://nextjs.org/docs/15/app/guides/data-security): server-only DAL, minimal DTOs, untrusted inputs, experimental taint as additional defense, mutation/render boundaries.
- [Current Server Actions configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions): 1 MiB default, allowed-host behavior, missing Origin caveat. Installed handler also inspected.
- [Current CSP guide](https://nextjs.org/docs/app/guides/content-security-policy): nonce request-time rendering, `connection()`, automatic nonce propagation, dev-only eval and nonce styles/WASM compatibility.
- [VA Benefits Claims ACG/PKCE documentation](https://developer.va.gov/explore/api/benefits-claims/authorization-code): live rendered official page inspected, not merely a search snippet.
- [Section508.gov applicability and conformance](https://www.section508.gov/develop/applicability-conformance/): criterion and complete-process evidence requirements.
- [sharp maintainer security advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w): affected/patched versions and runtime prerequisites.
