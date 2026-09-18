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

The application is deployed on Vercel. The canonical production URL is
`https://secondary-condition-finder.vercel.app`.

The current knowledge-base snapshot contains **813 mappings, 363 relationships, 140 published mappings, and 673 draft mappings**. Citation verification is complete for the live snapshot: **379 live references, 379 verified, 0 unverified**.

The browser-local evidence feature reads supported PDF, DOCX, and text files
entirely in the browser tab: raw bytes and extracted text are never submitted to
the application server. Step 6 groups those excerpts under each authored claim
pathway in a **Pathway Evidence Mapping** table (research cues only — no
interpretation, no egress), alongside the per-gap coverage chips and checklist.
Step 4 (Supporting Documents) offers two analysis
depths — **Standard** (the default) and an opt-in **Extended** envelope for
large local sets such as full C-files — with file, batch, page, character, and
retention limits derived from one limits module and published verbatim on
`/privacy`. Each document carries its own author credential (physician,
psychologist, NP/PA, non-clinician, or unknown), so VA decision letters are not
counted as clinician-authored medical opinions. The classifier understands
clinical shorthand (`dx`, `2/2` = secondary to), normalizes hyphen/spelling
variants, treats `Diagnosis:`/`Assessment:` sections as diagnosis context, and
excludes regulatory boilerplate from nexus counts. Scanned or image-only PDFs
can be recognized with **Local OCR** that runs entirely in the tab against
same-origin tesseract.js assets, and the Step 6 evidence checklist marks which
evidence-gap questions your uploaded excerpts already address. Every boundary
is enforced before or during extraction, including DOCX archive-expansion
preflight bounds.

Published knowledge-base source references may still be marked **unverified**
until they are independently checked. Unverified references remain research
starting points, not verified authority. `npm run citations:audit` enforces
unsafe-provenance rules and a non-regression ratchet so verification debt cannot
silently increase. Automated authoring may record a canonical source URL,
source-check date, and source locator, but `verified: true` remains a
qualified-human decision under `docs/citation-verification-sop.md`.

Steps 5 and 6 of the secondary workflow surface research aids built from the
same authored data: condition comparison, combination insights, a rating
schedule guide, a prioritized action plan, and a **pathway-specific medical
record checklist** — for each claim pathway (service-connected primary →
diagnosed condition via a nexus theory and causal mechanism), it lists the
concrete records to request from providers or VA (for example, sleep study
results, neurology records, and sleep-specialist notes for a neurological-
mechanism theory), each with a short explanation of why it matters. Checkmarks
are kept only in the current browser tab and can be exported alone or combined
with the consultation summary.

Step 4 adds a **guided VA.gov medical-records download walkthrough** for
veterans who want their complete VA health record: downloading it is a
multi-page journey — VA.gov signs you in through ID.me (email, password, and a
multi-factor code), then the download tool asks for a date range, record type,
and file type before producing the PDF. The walkthrough mirrors that flow as a
14-step checklist with deep links that open VA.gov in a new tab. It never
collects, transmits, or stores VA.gov or ID.me credentials, MFA codes, or
session data — sign-in happens entirely on VA.gov — and its progress checkmarks
live only in the current browser tab. It appears on the secondary workflow's
document step and standalone at `/get-records`.

![Guided VA.gov medical-records download walkthrough: 14 steps from VA.gov
sign-in through ID.me MFA to the PDF report download, with deep links and a
clear progress store](docs/assets/va-gov-walkthrough.png)

The screenshot is regenerable with `node
scripts/capture-va-gov-walkthrough-screens.mjs` (starts a dev server and
headless Chrome, seals a dev-only workflow cookie, and captures the card via
the DevTools Protocol).

## Stack

Next.js App Router, TypeScript, Tailwind, Zod, Vitest, Chrome/ChromeDriver E2E,
and Vercel. The condition catalog and knowledge base are JSON in version control
so mapping and citation changes remain reviewable diffs. Server-side
OpenTelemetry is registered through `@vercel/otel` (`src/instrumentation.ts`);
there is no client analytics SDK, and production `connect-src` stays
first-party only.

## Getting started

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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run kb:validate` | Knowledge-base structural/integrity validation |
| `npm run citations:audit` | Citation safety, provenance, and verification-debt audit |
| `npm run audit:me-compliance` | Audits all mappings (incl. every ME-1..ME-33 relationship) against the CRG schema, nexus-arm, consensus, guard-honesty, citation, and quarantine rules |
| `npm run citations:decay` | Live link-rot/staleness probe for citations (deliberate maintainer gate, not per-PR CI) |
| `npm run citations:queue` | Reports the qualified-human citation-verification queue as markdown |
| `npm run evidence:architecture` | Audits the browser-local evidence parser architecture and its security boundaries |
| `npm run regulatory:validate` | Validates the provenanced regulatory-actions seed data |
| `npm run regulatory:audit` | Regulatory-intelligence audit (add `:markdown` for the report form) |

CI also builds the production app and runs real Chrome/ChromeDriver journeys for
the secondary workflow and validation/error behavior. After successful `main`
CI, Production Runtime Readiness confirms the exact Vercel deployment, canonical
alias, the full public route matrix, and the runtime-session readiness marker.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKFLOW_SESSION_SECRET` | development-only fallback outside production | Server-only secret for AES-256-GCM workflow tokens. Production requires at least 32 characters and fails closed if missing. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | unset | Backward-compatible non-production fallback. Prefer `WORKFLOW_SESSION_SECRET`. |
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

The VA public-reference cache is process-local and best-effort: five-minute TTL,
LRU-bounded entry count, and no durable/global semantics. Outbound VA requests
also have a process-local per-service request budget. Those controls reduce
single-process pressure but are not represented as distributed/global rate
limiting.

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
src/lib/actions/          All Server Actions ("use server") — secondary, presumptive, scenarios
src/lib/catalog/          Zod schema, loader, lookup; condition identity
src/lib/kb/               Zod schema, loader, mapping helpers
src/lib/engine/           Recommendation and export logic
src/lib/presumptive/      Service-history matcher and encrypted session wrapper
src/lib/evidence/         Browser-local evidence extraction/evaluation helpers
src/lib/regulatory/       Regulatory intelligence and preflight (Federal Register / OIRA / Regulations.gov)
src/lib/va/               Environment-aware public-reference adapters/cache
src/app/                  App Router pages
src/components/           UI components
tests/                    Vitest regression/contract tests
e2e/                      Real-browser Chrome/ChromeDriver journeys
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
reside in `src/lib/actions/`.

- Secondary health/disability state is submitted with server actions rather than
  encoded into query strings; the codebase does not expose a helper that
  serializes complete secondary-workflow state back into a URL.
- Presumptive service locations and dates are also submitted with a server
  action rather than GET query parameters.
- Workflow state is stored in short-lived encrypted/authenticated HttpOnly,
  SameSite=Strict cookies scoped to the appropriate workflow path. The server
  authenticates issuance and expiry inside the encrypted token rather than
  relying on browser `Max-Age` alone.
- Back links use clean route paths so selections do not enter browser history,
  referrer headers, or copied URLs.
- Optional local evidence documents are processed in-browser; raw bytes/text are
  not placed in workflow cookies or application logs.
- Local OCR runs entirely in the tab against same-origin assets; the production
  CSP adds only a narrow `'wasm-unsafe-eval'` allowance for the OCR WASM core
  while `connect-src` stays first-party only.
- The application does not initialize a client analytics/telemetry SDK or a
  workflow/recommendation event-history logger. Production `connect-src` remains
  first-party only.
- Production script execution uses a per-request nonce CSP generated by
  `src/proxy.ts`; production `script-src` does not use `'unsafe-inline'`.
  Request-time rendering is intentional so Next.js can attach the nonce to its
  framework and page scripts.

## Knowledge-base coverage and authoring

The catalog now holds **813 recognized conditions / 813 one-to-one
knowledge-base mappings** after the 2026-09 master-list expansion. That
expansion added **502 framework-only draft identities** across 14 body systems
(each with a TODO authoring checklist and zero fabricated clinical evidence),
consolidated 13 duplicate identities into pre-existing catalog entries (for
example the generic `arthritis` umbrella was retired in favor of
`osteoarthritis` / `rheumatoid-arthritis` / `gout`, and duplicate CRPS,
HIV/AIDS, hammertoe, epicondylitis, Paget's, osteomalacia, and frostbite
identities were folded into their existing entries), and renamed the ambiguous
`aneurysms` umbrella to `peripheral-aneurysm` so `aortic-aneurysm` keeps its
identity. Post-v2 maintenance still uses 33 catalog files. Fibromyalgia, hip
strain, and ankle strain are physically normalized in musculoskeletal
maintenance; diabetic retinopathy is in the ophthalmologic file; insomnia plus
substance-use disorder are in the mental-disorders catalog; and Cushing's
syndrome, Type 1 diabetes, Hyperthyroidism, Hyperparathyroidism, and
Hypoparathyroidism are now physically maintained in the endocrine catalog with
their current DC 7907, DC 7913, DC 7900, DC 7904, and DC 7905 frameworks.
`carried-over.json` remains reduced to the intentionally quarantined
`contralateral-knee-condition` laterality placeholder. None of these maintenance
changes alters the 813-condition universe.

Waves 1 through 7 added 107 conditions. Clinical Evidence Promotion Batches 1
through 11 still account for twelve individually reviewed **expansion** mappings:
`cardiomyopathy` → `congestive-heart-failure`, `urethral-stricture` →
`hydronephrosis`, `hypertensive-heart-disease` → `congestive-heart-failure`,
`chronic-pyelonephritis` → `chronic-kidney-disease`, `chronic-liver-disease` →
`cirrhosis-of-the-liver`, `acl-injury` → `osteoarthritis`, `pcl-injury` →
`osteoarthritis`, `barretts-esophagus` → `esophageal-cancer`, `achalasia` →
`esophageal-cancer`, `hyperaldosteronism` → `hypertension`, `acromegaly` →
`hypertension`, and `diabetes-mellitus-type-1` → `chronic-kidney-disease`.
**95 of the 107 expansion mappings remain safe drafts**. Batches 10 and 11
instead improve legacy coverage: primary-hyperparathyroidism/hypoparathyroidism
kidney-stone research, association-focused hypothyroidism/depression research,
bounded hypogonadism/osteoporosis research, and a clinically repaired ILD/OSA
association.

Safety review has returned `ankle-strain`, `knee-injury`, `osteoarthritis`,
`ageusia`, `agranulocytosis`, `al-amyloidosis`, `addisons-disease`,
`anorexia-nervosa`, `emphysema`, `chronic-bronchitis`, and `pulmonary-fibrosis`
to draft where previously published claims were stronger than the reviewed
evidence or relied on rating/legal authority rather than condition-specific
clinical evidence. Existing relationships for `amputation-or-loss-of-use` →
`depressive-disorder`, `anosmia` → `depressive-disorder`, `alopecia-areata` →
`depressive-disorder`, `hypertension`, and now `interstitial-lung-disease` →
`sleep-apnea` have been repaired with condition-specific clinical evidence and
conservative safeguards. Batch 8 also publishes `cushings-syndrome` →
`hypertension` under a bounded endocrine pathway. Batch 9 removes the
unsupported `erectile-dysfunction` → `gerd` treatment chain and clinically
repairs `erectile-dysfunction` → `depressive-disorder`; Batch 11 removes the
unsupported ILD→cardiac-arrhythmia edge while preserving only clinically sourced
ILD→OSA association research.

The knowledge base now holds **363 relationships across 813 mapping files**, with **379 live source references, 379 verified, and 0 unverified**. The authoritative master registry records **346 active + 17 tombstoned relationship entries**, and all published relationships are anchored to condition-specific source evidence.

ME-19 (batch 5) through ME-22 (batch 8) were the mapping-expansion batches over the 502 master-list framework-only identities, adding one rank-1 bounded suggestion each for twenty identities: `transient-ischemic-attack`, `cluster-headache`, `essential-tremor`, `myasthenia-gravis`, `peripheral-neuropathy`, `restless-leg-syndrome`, `sciatica`, `spinal-stenosis`, `thoracic-outlet-syndrome`, `trigeminal-neuralgia`, `bipolar-disorder`, `dissociative-disorder`, `obsessive-compulsive-disorder`, `somatic-symptom-disorder`, `acute-liver-failure`, `anal-fissure`, `cholelithiasis`, `chronic-pancreatitis`, `diverticulitis`, and `perianal-fistula`.

The knowledge base is a Causal Relational Graph (CRG), not a flat association
list: every suggestion is enforced by the Zod schema to carry the CRG trio
(`nexusClaim` as a `DIRECT_CAUSATION`/`AGGRAVATION`/`ASSOCIATION_ONLY`
discriminated union, `causalMechanism`, and `evidentiaryProfile` with
`etiologicalConsensus` replacing the deprecated `prevalence` field). `npm run audit:me-compliance` audits every mapping — including each of the 125 ME-1..ME-33
relationships — for nexus-arm validity, consensus/alignment consistency,
guard-disclaimer honesty, citation discipline, and quarantine compliance as a CI
gate. `npm run citations:decay` is the maintainer-run link-rot/staleness probe.

The completed identity-expansion record is maintained in
`docs/condition-expansion-roadmap.md`; the post-v2 promotion records are in
`docs/clinical-evidence-promotion-batch-1.md` through
`docs/clinical-evidence-promotion-batch-11.md`. The 813-condition catalog is the
2026-09 master-list expansion; catalog identities are a versioned product
target, not a claim that medicine or the VA rating schedule contains only these
conditions.

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
   current provenance rules. The research-guard posture decides the
   classification: never force a causation or aggravation claim when the guard
   or literature only supports association (`ASSOCIATION_ONLY` +
   `NOT_ESTABLISHED` + `hypothesizedOnly: true`). Legal or rating authority
   cannot substitute for clinical evidence of a medical relationship.
3. **Verification:** record source URLs, `sourceCheckedOn`, and `sourceLocator`
   when checked. Keep `verified: false` unless a qualified human completes the
   Citation Verification SOP.
4. Run `npm run kb:validate`, `npm run citations:audit`, `npm run
   audit:me-compliance`, `npm run test:composition`, and `npm test` before
   review.

Strict Zod schemas reject unknown JSON keys, and referential-integrity tests keep
mapping IDs aligned with the catalog. Drafts may retain explicit TODO items but
cannot silently appear in recommendation output.

Contribution rules for humans and agents are in
`.github/copilot-instructions.md`.

<!-- Redeploy trigger: README touch on 2026-09-14 -->
