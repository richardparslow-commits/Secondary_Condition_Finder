# Secondary Condition Finder

A claim-preparation research aid for VA disability claims. It keeps secondary
and presumptive service-connection research separate because they use different
legal and evidentiary frameworks.

- **Secondary** (38 CFR § 3.310, M21-1 Spicer update May 2026): starts from established service-connected
  conditions and organizes diagnosed conditions that may warrant further
  research, along with authored pathways, evidence gaps, and source references.
  After the Spicer v. McDonough ruling, the M21-1 uses \"but for\" causation language
  and recognizes treatment-interference as a secondary aggravation pathway.
  Competent nexus evidence may be needed when the relationship requires medical
  expertise; the app does not create or replace a medical opinion.
- **Presumptive** (38 CFR §§ 3.307 and 3.309): compares authored qualifying
  service locations/date windows with the service history supplied in the
  workflow and lists presumptions that may apply. A presumption can remove the
  need to prove that qualifying service caused the recognized condition, but
  the app does not determine eligibility.

The current presumptive data covers the authored PACT Act burn-pit and Agent
Orange categories described in `docs/presumptive-track.md`. Data-governance
rules for condition IDs, schema strictness, and citation quality are in
`docs/data-governance-note.md`.

**This is not medical or legal advice.** It does not diagnose conditions,
determine eligibility, or estimate ratings. Every suggestion is a possibility
to research with a qualified provider or an accredited representative.

## Current status

### Deployment

The application is deployed on Vercel. The canonical production URL is
`https://secondary-condition-finder.vercel.app`.

### Knowledge-base snapshot — generated, not documented

The knowledge base changes with every authoring commit, so this README does not
hardcode snapshot counts (mappings, relationships, published/draft split,
verified references). Each was a recurring source of documentation-only
commits and merge conflicts. Generate the current numbers instead (the table below is generated from the `snapshotGenerators` metadata in `package.json` by `npm run readme:snapshot` — edit the metadata, not the table):

<!-- generated:snapshot-generators:start -->
| Snapshot metric | Generator |
|-----------------|-----------|
| Catalog + mapping integrity, file/condition counts | `npm run kb:validate` |
| Citation verification state and the verification-debt ratchet | `npm run citations:audit` |
| Published/draft authoring coverage by wave and batch | `npm run authoring:tracker` |
| References below the provenance bar | `npm run citations:weak` |
| CRG relationship-graph structure (cycles, bidirectional pairs, redundancy) | `npm run audit:crg` |
| CRG transitive-redundancy triage register and posture tables | `npm run crg:triage` |
| Qualified-human citation-verification queue | `npm run citations:queue` |
<!-- generated:snapshot-generators:end -->

### Browser-local evidence processing

Supported PDF, DOCX, and text files are read **entirely in the browser tab** —
raw bytes and extracted text are never submitted to the application server.

- **Step 6** groups excerpts under each authored claim pathway in a
  **Pathway Evidence Mapping** table (research cues only — no interpretation,
  no egress), alongside per-gap coverage chips and the evidence checklist.
- **Step 4** offers two analysis depths — **Standard** (the default) and an
  opt-in **Extended** envelope for large local sets such as full C-files — with
  file, batch, page, character, and retention limits derived from one limits
  module and published verbatim on `/privacy`.
- Each document carries its own **author credential** (physician, psychologist,
  NP/PA, non-clinician, or unknown), so VA decision letters are not counted as
  clinician-authored medical opinions.
- The classifier understands clinical shorthand (`dx`, `2/2` = secondary to),
  normalizes hyphen/spelling variants, treats `Diagnosis:`/`Assessment:`
  sections as diagnosis context, and excludes regulatory boilerplate from
  nexus counts.
- Scanned or image-only PDFs are recognized with **Local OCR** that runs
  entirely in the tab against same-origin tesseract.js assets.
- Every boundary is enforced before or during extraction, including DOCX
  archive-expansion preflight bounds.

### Guided VA.gov records walkthrough

Step 4 includes a **guided VA.gov medical-records download walkthrough** for
veterans who want their complete VA health record. Downloading it is a
multi-page journey — VA.gov signs you in through ID.me (email, password, and a
multi-factor code), then the download tool asks for a date range, record type,
and file type before producing the PDF.

- The walkthrough mirrors that flow as a **14-step checklist** with deep links
  that open VA.gov in a new tab.
- It never collects, transmits, or stores VA.gov or ID.me credentials, MFA
  codes, or session data — sign-in happens entirely on VA.gov.
- Progress checkmarks live only in the current browser tab.
- It appears on the secondary workflow's document step and standalone at
  `/get-records`.

![Guided VA.gov medical-records download walkthrough: 14 steps from VA.gov
sign-in through ID.me MFA to the PDF report download, with deep links and a
clear progress store](docs/assets/va-gov-walkthrough.png)

The screenshot is regenerable with `node
scripts/capture-va-gov-walkthrough-screens.mjs` (starts a dev server and
headless Chrome, seeds the browser-local workflow record in `sessionStorage`,
and captures the card via the DevTools Protocol).

### Step 5–6 research aids

Steps 5 and 6 surface research aids built from the same authored data:

- Condition comparison, combination insights, a rating schedule guide, and a
  prioritized action plan.
- A **pathway-specific medical record checklist**: for each claim pathway
  (service-connected primary → diagnosed condition via a nexus theory and
  causal mechanism), it lists the concrete records to request from providers or
  VA — for example, sleep study results, neurology records, and
  sleep-specialist notes for a neurological-mechanism theory — each with a
  short explanation of why it matters.
- Checkmarks are kept only in the current browser tab and can be exported
  alone or combined with the consultation summary.

### Citation verification posture

Published knowledge-base source references may still be marked **unverified**
until they are independently checked. Unverified references remain research
starting points, not verified authority.

- `npm run citations:audit` enforces unsafe-provenance rules and a
  non-regression ratchet so verification debt cannot silently increase.
- Automated authoring may record a canonical source URL, source-check date, and
  source locator, but `verified: true` remains a qualified-human decision under
  `docs/citation-verification-sop.md`.

## Stack

Next.js App Router, TypeScript, Tailwind, Zod, Vitest, Chrome/ChromeDriver E2E,
and Vercel. The condition catalog and knowledge base are JSON in version control
so mapping and citation changes remain reviewable diffs. Server-side automatic
OpenTelemetry trace export is deliberately disabled by policy
(`src/lib/observability/telemetry-policy.ts`) because framework spans can carry
query strings and exception text past the application log redaction; there is no
client analytics SDK, and production `connect-src` stays first-party only.

## Getting started

### Prerequisites

| Requirement | Detail |
|-------------|--------|
| **Node.js 22.x** | Enforced by the `engines` field in `package.json`. |
| **npm** | The package manager of record — `package-lock.json` is committed. Use `npm ci` for a reproducible, CI-identical install. |
| **Google Chrome + ChromeDriver** (E2E only) | Needed to run the WebDriver journeys in `e2e/` locally (CI provisions its own). The ChromeDriver major version must match the installed Chrome major version, and `chromedriver` must be on `PATH` (the journeys also probe for a binary beside the runner script). The Playwright gates (`npm run a11y:full`, `npm run stress:hostile`) use the installed Chrome channel instead, and set `A11Y_FULL_BROWSER=chromium` / `HOSTILE_E2E_BROWSER=chromium` to use Playwright's own Chromium. |
| **No external services required** | The app runs with development-only fallbacks; VA API adapters and outbound integrations are disabled by default (see [Configuration](#configuration)). |

> `npm install` runs a postinstall step (`scripts/copy-pdf-worker.mjs`) that
> generates the client runtime assets `public/pdf.worker.min.mjs` and
> `public/tesseract/` — these are machine-generated and intentionally not
> tracked in git.

### Environment

```bash
cp .env.example .env.local
```

Most variables are optional in development — the app runs with
development-only fallbacks and outbound integrations disabled. Production
secrets belong only in the deployment secret store; never commit them (all
private `.env*` files are git-ignored; the `.env.example` template is the
tracked starting point).

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. `/scenarios` contains repeatable demo walkthroughs.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite; CI runs it once and fails on any failure |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:composition` | Requires executable-test imports for 100% of the audited critical-module manifest; also enforces server-action placement, client-boundary, track-separation, and evidence-architecture guardrails |
| `npm run test:fleet` | Fleet coordination gate: runs `tests/va-fleet-simulation.test.ts` (shared consumer budget, circuit cooldown and probe lease, single-flight leases, epoch invalidation, coordinated outage, degraded store, split-brain partition) through `scripts/run-fleet-simulation.mjs` under a ratcheted wall-clock budget: the enforced limit is the tighter of the committed environment cap and a budget derived from recent measured runs (`.github/fleet-budget-ratchet.json`), so it tightens automatically as timing stabilizes but can never drift looser, and each coordination path also carries its own committed per-scenario real-time bound; `--record` appends a measurement to ratify a window, and an overrun of either bound is killed and fails the CI `fleet` step |
| `npm run test:doc-lint` | Documentation-drift gate: living-doc lint policy (banned snapshot counts, historical-zone fences, file/script references), audit finding/disposition-row parity, and schema-validated JSON examples; CI runs it as the required `verify-doc-lint` check |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run kb:validate` | Knowledge-base structural/integrity validation |
| `npm run citations:audit` | Citation safety, provenance, and verification-debt audit |
| `npm run audit:me-compliance` | Audits all mappings against the CRG schema, nexus-arm, consensus, guard-honesty, citation, and quarantine rules, and joins the ME approval ledgers to the corpus in both directions: every `mapping-expansion-me<N>-approved-implementation-ledger.json` is read in whatever shape it stores its approvals (`rows`, `relationships`, `mappings`), an unreadable or unrecognized ledger fails closed instead of being skipped, and a declared-but-absent approved relationship is reported rather than silently lowering a count |
| `npm run audit:crg` | CRG structural audit: simple-cycle enumeration, bidirectional-pair governance notes, and a transitive-redundancy report. Self-loops, duplicate edges, and pure-causation cycles hard-fail; the review and redundancy backlogs are ratcheted so they can shrink but not grow (`--strict` upgrades every review finding to a violation). CI gate |
| `npm run audit:crg:graph` | Adjacency-graph audit over `data/knowledge-base/graph/`: 3-color DFS cycle detection across `KbNodeMapping` files, plus the ARCH-01 evidence join (every edge needs an authored suggestion with citations and the same nexus classification; the authored corpus is read from the graph directory's parent or `--kb-root=`, and an unlocatable corpus fails closed). A hard gate since the first node migrated 2026-10-03 (`docs/crg-adjacency-migration-checklist.md`). CI gate |
| `npm run citations:decay` | Live link-rot/staleness probe for citations (deliberate maintainer gate, not per-PR CI) |
| `npm run citations:weak` | Weak-citation report (references below the repository's provenance bar) |
| `npm run citations:queue` | Reports the qualified-human citation-verification queue as markdown |
| `npm run authoring:tracker` | Generates the current authoring-state tracker across the catalog and knowledge base |
| `npm run probe:va-gov-walkthrough` | Probes the VA.gov walkthrough's deep-linked routes for route rot (auth-aware verdicts; scheduled weekly, also maintainer-runnable) |
| `npm run evidence:architecture` | Audits the browser-local evidence parser architecture and its security boundaries |
| `npm run regulatory:validate` | Validates the provenanced regulatory-actions seed data |
| `npm run regulatory:audit` | Regulatory-intelligence audit (add `:markdown` for the report form) |
| `npm run report:route-inventory` | Publishes the per-run route inventory report — every route's declared surfaces against the evidence actually recorded — as JSON + markdown (`--surface=`, `--evidence-dir=`, `--matrix=`); exits 1 when it names a coverage gap |
| `npm run stress:hostile` | REL-05 hostile-file browser stress run against the production build: declared-size image bombs, a malformed PDF, repeated refusals under heap measurement, a stalled OCR worker that Cancel must terminate, and a full-resolution scanned PDF that is admitted so real WASM pressure is measured in process RSS as well as the JS heap (writes `tmp/hostile-file-stress/evidence.json`) |

CI also builds the production app and runs real Chrome/ChromeDriver journeys for
the secondary workflow and validation/error behavior, plus a production-boot
smoke check (`e2e/pathways-smoke.mjs`) that fetches `/pathways` and asserts the
chain-break semantics and the absence of raw nexus enum values in the served
body and its embedded RSC payload. After successful `main`
CI, Production Runtime Readiness verifies exact Vercel deployment lineage,
canonical-alias convergence, the public route matrix, and the separate
`WORKFLOW_SESSION_SECRET` crypto-readiness marker; the marker does not indicate
research-workflow state or VA-account store readiness.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKFLOW_SESSION_SECRET` | development-only fallback outside production | Legacy server-only crypto-readiness marker checked by `/api/health` and `/runtime-readiness`; production requires at least 32 characters. It does not encrypt research-workflow records or VA-account tokens. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | retired (unset) | Retired 2026-10-10 (REL-04 follow-up): no longer read by the crypto helper; set `WORKFLOW_SESSION_SECRET`. |
| `VA_API_ENV` | `sandbox` | Selects the VA adapter environment: `sandbox` or `production`. |
| `VA_API_ENABLED` | disabled | Explicit generic enable flag. Production requests require this to be `true`. |
| `VA_SANDBOX_ENABLED` | disabled | Legacy sandbox-only enable flag when `VA_API_ENABLED` is unset. |
| `VA_FORMS_SANDBOX_API_KEY` | unset | VA Forms sandbox credential. |
| `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` | unset | Benefits Reference Data sandbox credential. |
| `VA_FORMS_PRODUCTION_API_KEY` | unset | VA Forms production credential; external production access is a separate gate. |
| `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` | unset | Benefits Reference Data production credential; external production access is a separate gate. |
| `VA_API_TIMEOUT_MS` | `4000` | Outbound VA request timeout. |
| `REGULATIONS_GOV_API_KEY` | unset | Optional Regulations.gov docket/comment enrichment for regulatory preflight. |
| `REGULATORY_PREFLIGHT_MAX_AGE_HOURS` | `24` | Cache-freshness ceiling for regulatory source checks. |
| `REGULATORY_PREFLIGHT_SOURCE_TIMEOUT_MS` | `8000` | Per-source HTTP timeout for regulatory preflight. |
| `REGULATORY_PREFLIGHT_CACHE_DIR` | bounded OS temp dir | Optional server-local cache location for regulatory preflight. |
| `REGULATORY_SYNC_SECRET` | unset | Bearer secret protecting the scheduled regulatory refresh endpoint. |
| `CRON_SECRET` | unset | Accepted fallback bearer for the regulatory refresh endpoint; also guards scheduled CI jobs. |

See `docs/va-api-runtime-configuration.md` for the complete environment-aware VA
runtime contract. Production secrets belong only in the deployment secret store;
do not expose them through `NEXT_PUBLIC_*` variables or commit them.

The VA public-reference cache is best-effort and non-authoritative. Tier 1 is
process-local (five-minute TTL, 32-entry LRU). Tier 2 is optional: when an
operator configures a shared Redis/KV (`VA_REFERENCE_SHARED_CACHE_URL` +
`TOKEN`, or the provider aliases), entries are key-namespace allowlisted,
finite-cardinality bounded (≤480 resident keys per namespace), stored as
`{envelopeVersion:2, epoch, value}` envelopes, re-checked against this
deployment's provenance before being served, deduplicated per key with a short
single-flight lease so an expired key is fetched once per fleet, and revocable
fleet-wide — `POST /api/admin/cache-clear` advances the shared invalidation
epoch. Outbound
VA requests use a process-local per-service budget, plus an opt-in distributed
consumer-wide budget (`VA_SHARED_CONSUMER_BUDGET=true`) that fails closed; this
is quota coordination, not a claim of global rate limiting. The multi-instance
fleet simulation (`npm run test:fleet`, CI step `fleet`) exercises these
invariants under a ratcheted wall-clock budget: the enforced limit is the
tighter of the committed environment cap and a budget derived from recent
measured runs, so it tightens automatically as timing stabilizes and cannot
silently drift looser. Each coordination path additionally carries its own
committed per-scenario real-time bound, printed as one `[fleet] <path>: N ms /
M ms (x% of bound)` line per run so a path drifting toward its limit is visible
before it fails, and an unbounded coordination regression fails the build. A
split network is simulated too: the partitioned half fails closed instead of
serving stale values as live, and honors the reachable half's invalidation
once it heals.

## Layout

The consolidated architecture, authoring, and security specification lives in
[`docs/master-specification.md`](docs/master-specification.md).

```text
data/conditions/          Condition catalog, grouped by body system and reviewed expansion/maintenance batches
data/knowledge-base/      Secondary mappings, one JSON file per primary
data/presumptives/        Exposure categories, locations, and date windows
data/evidence/            Master source and relationship registries (lineage source of truth)
data/regulatory-actions/  Provenanced VA regulatory action seed records
data/demo-scenarios.json
src/proxy.ts              Edge proxy (Next 16 middleware): per-request nonce CSP, x-nonce, route headers
src/lib/actions/          Server Actions for bounded public operations (currently the accredited-representative lookup)
src/lib/catalog/          Zod schema, loader, lookup; condition identity
src/lib/kb/               Zod schema, loader, mapping helpers
src/lib/engine/           Recommendation and export logic
src/lib/presumptive/      Service-history matcher and browser-local history store
src/lib/evidence/         Browser-local evidence extraction/evaluation helpers
src/lib/regulatory/       Regulatory intelligence and preflight (Federal Register / OIRA / Regulations.gov)
src/lib/va/               Environment-aware public-reference adapters/cache
src/app/                  App Router pages
src/components/           UI components
tests/                    Vitest regression/contract tests
e2e/                      Real-browser journeys (Chrome/ChromeDriver, plus Playwright gates)
docs/                     Product, operations, accessibility, and runtime docs
```

Primary public routes include:

- `/`
- `/about`
- `/secondary`
  - `/secondary/condition-caused-by`
  - `/secondary/condition-aggravation`
  - `/secondary/legal`
  - `/secondary/diagnosed`
  - `/secondary/service-connected`
  - `/secondary/ratings`
  - `/secondary/upload`
  - `/secondary/suggestions` (research aids: comparison, combination insights, rating guide, action plan, pathway record checklist; color-coded evidence-strength badges on every suggestion)
  - `/secondary/evidence` (evidence-gap review, pathway evidence mapping, consultation summary, research aids: record checklists, rating guide, action plan, pathway record checklist)
- `/presumptive` and `/presumptive/results`
- `/scenarios`
- `/va-forms` and `/va-forms/finder`
- `/va-reference` and `/va-reference/service-branches`
- `/pathways` (read-only claim pathway explorer: authored adjacency-graph routes, with association-only links shown as legally broken chains rather than nexus findings)
- `/privacy`
- `/terms`
- `/runtime-readiness`

`/results` is a legacy redirect to `/secondary` and does not process query-based
health state.

**Regulatory intelligence.** `src/lib/regulatory/` monitors Federal Register,
OIRA, and Regulations.gov activity that could affect the catalog's citations.
`GET /api/regulatory/preflight` is a bearer-protected scheduled refresh endpoint
(see the `regulatory-intelligence` workflow), and `data/regulatory-actions/`
holds the provenanced seed records behind it. See
[`docs/regulatory-preflight-v4.md`](docs/regulatory-preflight-v4.md) and
[`docs/regulatory-intelligence-v3.md`](docs/regulatory-intelligence-v3.md).

## Workflow privacy and browser security

The public security posture and vulnerability-reporting process (including Safe
Harbor) live in [`SECURITY.md`](SECURITY.md); the operations runbook lives in
[`docs/security-operations.md`](docs/security-operations.md). All Server Actions
reside in `src/lib/actions/`. The optional VA-account sandbox uses separate
same-origin Route Handlers at `/va-account/oauth/*`.

- Secondary health/disability and presumptive service-history state stays in
  versioned, schema-bounded, tab-scoped browser `sessionStorage` records; the
  workflow does not submit private context to Server Actions or encode it into
  query strings.
- The edge proxy refuses requests carrying private workflow-context fields and
  tombstones retired workflow cookies if a stale browser presents one.
- The separate optional VA sandbox account experiment uses an opaque HttpOnly
  handle cookie; its encrypted tokens remain in an isolated server session store.
- Back links use clean route paths so selections do not enter browser history,
  referrer headers, or copied URLs.
- Optional local evidence documents are processed in-browser; raw bytes/text are
  not placed in browser-local workflow records, URLs, or application logs.
- Local OCR runs entirely in the tab against same-origin assets; the production
  CSP adds only a narrow `'wasm-unsafe-eval'` allowance for the OCR WASM core
  while `connect-src` stays first-party only.
- The application does not initialize a client analytics/telemetry SDK. It does
  emit allowlisted workflow/recommendation operational events to platform logs;
  these are not a per-user history database, and host retention/access must be
  reviewed. Production `connect-src` remains first-party only.
- Production script execution uses a per-request nonce CSP generated by
  `src/proxy.ts`; production `script-src` does not use `'unsafe-inline'`.
  Request-time rendering is intentional so Next.js can attach the nonce to its
  framework and page scripts.

## Knowledge-base coverage and authoring

### Catalog universe

The catalog is the **2026-09 master-list expansion**: 813 recognized conditions
with one-to-one knowledge-base mappings. Catalog identities are a versioned
product target, not a claim that medicine or the VA rating schedule contains
only these conditions.

- The expansion added **framework-only draft identities** across 14 body
  systems, each with a TODO authoring checklist and **zero fabricated clinical
  evidence**.
- **13 duplicate identities were consolidated** into pre-existing catalog
  entries — for example the generic `arthritis` umbrella was retired in favor
  of `osteoarthritis` / `rheumatoid-arthritis` / `gout`, and duplicate CRPS,
  HIV/AIDS, hammertoe, epicondylitis, Paget's, osteomalacia, and frostbite
  identities were folded into their existing entries.
- The ambiguous `aneurysms` umbrella was renamed to `peripheral-aneurysm` so
  `aortic-aneurysm` keeps its distinct identity.
- Post-v2 maintenance still uses **33 catalog files**. Physical placement
  follows clinical authority: fibromyalgia, hip strain, and ankle strain are
  maintained in musculoskeletal maintenance; diabetic retinopathy in the
  ophthalmologic file; insomnia and substance-use disorder in the
  mental-disorders catalog; and Cushing's syndrome, Type 1 diabetes,
  hyperthyroidism, hyperparathyroidism, and hypoparathyroidism in the endocrine
  catalog with their current DC 7907, DC 7913, DC 7900, DC 7904, and DC 7905
  frameworks.
- `carried-over.json` remains reduced to the intentionally quarantined
  `contralateral-knee-condition` laterality placeholder.

None of these maintenance changes alters the 813-condition universe.

### Expansion and promotion roadmap

| Milestone | Scope | State |
|-----------|-------|-------|
| **Waves 1–7** | 107 conditions added with authored mappings | Complete |
| **2026-09 master-list expansion** | Catalog universe set to 813; framework-only drafts added across 14 body systems; 13 duplicates consolidated; ambiguous umbrellas renamed | Complete — framework drafts await clinical authoring |
| **ME-19 – ME-22 (expansion batches)** | One rank-1 bounded suggestion for twenty framework-only identities | Complete |
| **Clinical Evidence Promotion Batches 1–9** | Twelve individually reviewed expansion mappings published; legacy repairs and unsupported-chain removals | Complete |
| **Clinical Evidence Promotion Batches 10–11** | Legacy-coverage improvements and unsupported-edge pruning | Complete |

The current published/draft split per wave and batch is generated — run
`npm run authoring:tracker` rather than relying on any count written here.

**Clinically reviewed expansion mappings published by Promotion Batches 1–9:**

| From (primary) | To (secondary) |
|----------------|----------------|
| `cardiomyopathy` | `congestive-heart-failure` |
| `urethral-stricture` | `hydronephrosis` |
| `hypertensive-heart-disease` | `congestive-heart-failure` |
| `chronic-pyelonephritis` | `chronic-kidney-disease` |
| `chronic-liver-disease` | `cirrhosis-of-the-liver` |
| `acl-injury` | `osteoarthritis` |
| `pcl-injury` | `osteoarthritis` |
| `barretts-esophagus` | `esophageal-cancer` |
| `achalasia` | `esophageal-cancer` |
| `hyperaldosteronism` | `hypertension` |
| `acromegaly` | `hypertension` |
| `diabetes-mellitus-type-1` | `chronic-kidney-disease` |

The remainder of the wave mappings remain intentionally **safe drafts** pending
individual clinical review — they cannot surface in recommendation output until
promoted.

**Batches 10 and 11 improve legacy coverage** instead of publishing expansions:
primary-hyperparathyroidism/hypoparathyroidism kidney-stone research,
association-focused hypothyroidism/depression research, bounded
hypogonadism/osteoporosis research, and a clinically repaired ILD/OSA
association.

**ME-19 through ME-22** each added one rank-1 bounded suggestion for these
twenty framework-only identities: `transient-ischemic-attack`,
`cluster-headache`, `essential-tremor`, `myasthenia-gravis`,
`peripheral-neuropathy`, `restless-leg-syndrome`, `sciatica`, `spinal-stenosis`,
`thoracic-outlet-syndrome`, `trigeminal-neuralgia`, `bipolar-disorder`,
`dissociative-disorder`, `obsessive-compulsive-disorder`,
`somatic-symptom-disorder`, `acute-liver-failure`, `anal-fissure`,
`cholelithiasis`, `chronic-pancreatitis`, `diverticulitis`, and
`perianal-fistula`.

### Safety review actions

Evidence review is allowed to *demote* as well as promote:

- **Returned to draft** where previously published claims were stronger than
  the reviewed evidence, or relied on rating/legal authority rather than
  condition-specific clinical evidence: `ankle-strain`, `knee-injury`,
  `osteoarthritis`, `ageusia`, `agranulocytosis`, `al-amyloidosis`,
  `addisons-disease`, `anorexia-nervosa`, `emphysema`, `chronic-bronchitis`,
  and `pulmonary-fibrosis`.
- **Repaired with condition-specific clinical evidence and conservative
  safeguards**: existing relationships for `amputation-or-loss-of-use` →
  `depressive-disorder`, `anosmia` → `depressive-disorder`,
  `alopecia-areata` → `depressive-disorder`, `hypertension`, and
  `interstitial-lung-disease` → `sleep-apnea`.
- **Batch 8** publishes `cushings-syndrome` → `hypertension` under a bounded
  endocrine pathway.
- **Batch 9** removes the unsupported `erectile-dysfunction` → `gerd` treatment
  chain and clinically repairs `erectile-dysfunction` → `depressive-disorder`.
- **Batch 11** removes the unsupported ILD → cardiac-arrhythmia edge while
  preserving only the clinically sourced ILD → OSA association research.

### The CRG data model

The knowledge base is a **Causal Relational Graph (CRG)**, not a flat
association list. Strict Zod schemas enforce that every suggestion carries:

- `nexusClaim` — a `DIRECT_CAUSATION` / `AGGRAVATION` / `ASSOCIATION_ONLY`
  discriminated union. The research-guard posture decides the classification:
  never force a causation or aggravation claim when the guard or literature
  only supports association (`ASSOCIATION_ONLY` + `NOT_ESTABLISHED` +
  `hypothesizedOnly: true`). Legal or rating authority cannot substitute for
  clinical evidence of a medical relationship.
- `causalMechanism` — the authored biological mechanism category.
- `evidentiaryProfile.etiologicalConsensus` — replaced the deprecated
  `prevalence` field.

Enforcement and auditing:

- `npm run audit:me-compliance` audits every mapping for nexus-arm validity,
  consensus/alignment consistency, guard-disclaimer honesty, citation
  discipline, and quarantine compliance as a CI gate. It also joins the ME
  approval ledgers to the corpus in both directions. The ledgers do not share
  one shape (`rows` for ME-1..ME-25, `relationships` for ME-29+, `mappings` for
  ME-26..ME-28), so the join reads all three and reports any pair row held under
  a shape it does not recognize; a ledger that cannot be parsed is a violation,
  not a batch quietly dropped from the audit; and a declared approved
  relationship missing from the corpus is reported unless it is named in the
  exact-pair `ME_LEDGER_ABSENT_ALLOWLIST`. Reading only `rows` and skipping
  unparsable ledgers left 15 of 39 ledgers and 71 of 191 approved relationships
  unaudited while the gate reported a green count.
- `npm run audit:crg` and `npm run audit:crg:graph` are CI gates over the
  relationship graph's structure. Self-loops, duplicate edges, and cycles built
  entirely from `DIRECT_CAUSATION` hard-fail, because circular causation is not
  a defensible etiology to present to a veteran. The remaining review findings
  (association cycles, bidirectional pairs without `governanceNotes` on both
  files) and transitive-redundancy conflicts each need a qualified-human
  decision, so they are ratcheted: the backlog stays visible and can shrink,
  but growing it fails the gate.
- `npm run citations:decay` is the maintainer-run link-rot/staleness probe.
- Strict Zod schemas reject unknown JSON keys, and referential-integrity tests
  keep mapping IDs aligned with the catalog. Drafts may retain explicit TODO
  items but cannot silently appear in recommendation output.

### Authoring workflow

To add or change a condition or relationship:

1. **Catalog:** update `data/conditions/<body-system>.json` or a reviewed
   expansion/maintenance file with a stable unique ID, display name, aliases,
   and traceable rating authority when available. Where no single
   diagnosis-specific diagnostic code exists, record the applicable rating
   framework and review note instead of inventing a code. Product-wave grouping
   does not override the actual Part 4 body-system authority. When a broader
   regulatory identity overlaps a narrower existing catalog condition, keep
   names/aliases distinct and document the relationship rather than collapsing
   the two identities. When one roadmap identity intentionally groups related
   diagnoses, clinical authoring must still evaluate each diagnosis/pathway
   separately rather than assuming the grouped label has one etiology or nexus.
   Do not carry obsolete diagnostic codes forward after the governing schedule
   changes; retain any historical-code note only to prevent future regression.
2. **Mapping:** update/create `data/knowledge-base/<id>.json`. Each suggestion
   needs a condition ID, rank, the CRG trio (`nexusClaim` classified as
   `DIRECT_CAUSATION`, `AGGRAVATION`, or `ASSOCIATION_ONLY`; `causalMechanism`;
   `evidentiaryProfile.etiologicalConsensus`), conservative rationale, evidence
   gaps, and condition-specific source references satisfying the repository's
   current provenance rules.
3. **Verification:** record source URLs, `sourceCheckedOn`, and `sourceLocator`
   when checked. Keep `verified: false` unless a qualified human completes the
   Citation Verification SOP.
4. **Gate:** run `npm run kb:validate`, `npm run citations:audit`, `npm run
   audit:me-compliance`, `npm run test:composition`, and `npm test` before
   review.

### Records and further reading

- Completed identity-expansion record:
  `docs/condition-expansion-roadmap.md`
- Post-v2 promotion records: `docs/clinical-evidence-promotion-batch-1.md`
  through `docs/clinical-evidence-promotion-batch-11.md`

Contribution rules for humans and agents are in
`.github/copilot-instructions.md`.

<!-- Redeploy trigger: README touch on 2026-09-21 -->
