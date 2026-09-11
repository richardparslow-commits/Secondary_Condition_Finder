# Technical Specification: Secondary Condition Finder (v2)

> **Provenance (2026-09-11 conformance audit @ `main` `08cda5b`):** this document supersedes the
> circulated v1.0 technical-spec paste, which predates the six-step workflow consolidation and the
> Phase 1–3 research aids. Every claim below was verified against source during the audit. The living,
> line-level source of truth remains `docs/technical-specification.md` (v1.6); this v2 exists as the
> corrected standalone narrative for circulation, mirroring `docs/executive-specification-v2.md`.

## Architecture Overview

Secondary Condition Finder is a full-stack Next.js application deployed on Vercel with an optional
Azure Static Web Apps fallback. It implements a privacy-first, browser-local architecture: sensitive
workflow state stays client-side and encrypted, while the server provides stateless recommendation
logic, curated knowledge-base data, and credential-gated public reference integrations.

Core layers:

- **Edge & Proxy Layer** — `src/proxy.ts`: per-request cryptographically unique CSP nonce, security
  headers, nonce propagation via `x-nonce` (consumed in `src/app/layout.tsx` through `connection()`).
- **Application Layer** — Next.js App Router with Server Actions; all mutations are POST form
  submissions; workflow routes are `force-dynamic` and cookie-backed (no query-state routing).
- **Data Layer** — JSON condition catalog, knowledge base, and presumptive/exposure catalogs in
  version control, loaded synchronously and cached in-process; no database.
- **Client Layer** — React 19 interactive UI; browser-local evidence processing (pdf.js,
  Tesseract.js WASM OCR, Mammoth). Raw evidence bytes never leave the browser tab.
- **Observability** — server-side OpenTelemetry only (`@vercel/otel`, `src/instrumentation.ts`);
  no client telemetry SDKs, `connect-src 'self'` enforced by CSP.

## Technology Stack

| Component | Technology | Justification |
|---|---|---|
| Runtime & Framework | Next.js 16.3 (App Router), Node.js 22.x | Full-stack React with server components, server actions, edge proxy; Node 22 LTS |
| UI Framework | React 19.2, TypeScript ^5 | Type safety, JSX, hooks |
| Styling | Tailwind CSS ^4 | Utility-first CSS; postcss plugin |
| State Management | Server Actions (POST) + HttpOnly encrypted cookies | No client-side global state; workflow state AES-256-GCM encrypted in cookies |
| Schema & Validation | Zod ^4.5 | Runtime validation of JSON data and form inputs; strict unknown-key rejection |
| Testing | Vitest ^4.1 (204 files / 1101 tests) + Chrome/ChromeDriver E2E | Fast ESM-native regression suite; real-browser journey gates in CI |
| Document Processing | pdfjs-dist 6.3, Tesseract.js ^6.0 (WASM OCR), Mammoth 1.12 | Browser-local PDF/DOCX extraction; OCR without server transmission |
| Cryptography | Node.js crypto (AES-256-GCM) | Encrypted/authenticated workflow cookies; no external crypto libraries |
| Observability | @vercel/otel 2.1, @opentelemetry/api 1.9 | Server-side instrumentation only |
| Build & Deployment | Vercel (primary), Azure Static Web Apps (`npm run build:azure` standalone packaging; legacy, manual) | Serverless deployment, edge middleware, build caching |
| HTTP Client | Native fetch (Node 22) | VA reference adapters and regulatory preflight |

## Component & Service Breakdown

### C1: Edge Proxy (`src/proxy.ts`)

- Generates a per-request nonce (`Buffer.from(crypto.randomUUID()).toString("base64")`).
- Injects nonce into `Content-Security-Policy` (`script-src 'self' 'nonce-<n>' 'strict-dynamic' …`)
  and propagates it via the `x-nonce` request/response header pair.
- Applies security headers: HSTS, `no-referrer`, `nosniff`, `frame-ancestors 'none'`.
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and prefetch requests.
- Cost: a few milliseconds per request.

### C2: App Router & Pages (`src/app/`)

Route structure (all workflow steps live under the `/secondary/` group — there are **no** flat
`/diagnosed`, `/suggestions`, `/upload` routes):

- `/` — home (track selection).
- `/secondary/` — secondary workflow group:
  `condition-caused-by/`, `condition-aggravation/` (entry points + 38 CFR §3.310 explainers),
  `legal/` (§3.310 authority content — informational page, not a form step),
  `diagnosed/` (Step 1), `service-connected/` (Step 2), `ratings/` (Step 3),
  `upload/` (Step 4, browser-local evidence), `suggestions/` (Step 5),
  `evidence/` (Step 6 — evidence review, pathway mapping, checklists).
- `/presumptive/` — presumptive workflow entry; `/results/` — deterministic match output.
- `/va-forms/`, `/va-reference/` — credential-gated reference explorers.
- `/scenarios/` — demo workflow launcher (`data/demo-scenarios.json`, bounded `scenarioId`).
- `/about/`, `/privacy/`, `/terms/` — static content.
- `/runtime-readiness/` — post-deploy identity/readiness validation.
- `/api/health`, `/api/regulatory/preflight` — the only API routes.

Server Components by default; interactive elements are Client Components (`"use client"`); all
mutations go through Server Actions.

### C3: Server Actions (`src/lib/actions/`)

Verified exported actions (names matter — the v1.0 paste invented several):

- `secondary.ts`: `saveDiagnosedSelection`, `saveServiceConnectedSelection`, `saveRatingsSelection`,
  `saveDocumentsSelection`, `finishSecondaryWorkflow`, `restartSecondaryWorkflow`.
- `presumptive.ts`: `saveServiceHistory`.
- `scenarios.ts`: `launchDemoScenario` (bounded `z.string().min(1).max(80)` id, catalog lookup,
  session write, redirect to `/secondary/suggestions`).

Error handling follows the validation-redirect pattern (`?error={code}` → `role=alert` surface),
never JSON errors to the client. There is **no** `saveLegalTrack` (the legal step is a content
page between service-connected and ratings) and **no** `saveDocumentsShared` (the real action is
`saveDocumentsSelection`, which records the `documentsShared` flag plus bounded context fields).

### C4: Condition Catalog (`src/lib/catalog/`)

- Data: `data/conditions/` — **33 JSON files** (base body-system files + numbered expansion-wave
  files) covering **14 distinct body-system categories**, **813 conditions** total.
- Modules: `schema.ts` (strict Zod), `load.ts` (synchronous load + cache), `lookup.ts`
  (id/name/alias search, body-system filtering), `exposure-tags.ts`.
- Validation: `npm run kb:validate` enforces schema and referential integrity on every PR.

### C5: Knowledge Base / CRG (`src/lib/kb/`)

- Data: `data/knowledge-base/` — **813 mapping files** (one per condition id), of which **140 are
  published** and **673 draft**; the published set carries **363 authored causal relationships**
  (units matter: files are counted by publication state, relationships by authored edges).
- Each mapping is a set of CRG edges carrying the trio: `nexusClaim` (discriminated union:
  `DIRECT_CAUSATION` requires `etiologicalTrigger ≥ 50`; `AGGRAVATION` requires
  `baselineProgression ≥ 50` + `aggravatingFactor ≥ 50`; `ASSOCIATION_ONLY` requires
  `associationBasis ≥ 50` + `hypothesizedOnly: true` and forbids `WELL_ESTABLISHED`),
  `causalMechanism` (`mechanismCategory` from a 16-value union + vectors), and
  `evidentiaryProfile` (`etiologicalConsensus` from a **five-value** union:
  `WELL_ESTABLISHED | PROBABLE | CONTESTED_REQUIRES_SPECIFIC_EVIDENCE |
  IATROGENIC_TREATMENT_EFFECT | NOT_ESTABLISHED`, VA nexus-probability alignment, conservative
  rationale, ≥1 alternative etiology to rule out).
- Mappings with >30% unverified citations are demoted to draft (excluded from suggestions).
- Modules: `schema.ts`, `load.ts`, `lookup.ts`, `validate.ts`, `evidence-architecture.ts`.
- Gates: `npm run kb:validate`, `audit:me-compliance`, `citations:audit` (CI), `citations:decay`
  (maintainer-run), `evidence:architecture` (master-registry sync).

### C6: Recommendation Engine (`src/lib/engine/`)

- Entry point: `recommend(intake, catalog, knowledgeBase) -> RecommendationResult`.
- **Verified output shape**: `{ recommendations, recognizedPrimaries, unmappedPrimaries,
  unrecognizedPrimaries }`. The v1.0 paste's claim that research aids live on the engine result
  is wrong: research aids are separate modules (`src/lib/secondary-workflow/` — medical record
  checklist, pathway record checklist, combination insights, rating guide, action plan — plus
  engine-side comparison rows), rendered by the Step 5/6 pages.
- Each `Recommendation` carries: condition identity, `etiologicalConsensus` (5-value union),
  score, `contributingPrimaries`, `evidenceGaps`, complete `sourceReferences` (provenance is
  never dropped downstream), and advisory-only `clinicalFrictionWarnings` /
  `chronologyWarnings` / `intermediatePathways`.
- Ranking: consensus tier, then authored rank weight, then multi-primary contribution.
  Measured cost in E2E runs: single-digit milliseconds; budget <200ms.

### C7: Presumptive Matcher (`src/lib/presumptive/`)

- Modules: `schema.ts`, `load.ts`, `match.ts` (deterministic location/date-window Boolean
  matching — no probabilistic judgment), `pactAct.ts` (burn-pit alias/open-window handling),
  `session.ts` (encrypted HttpOnly service-history cookie), `dd214-adapter.ts`, `templates.ts`,
  `types.ts`.
- Data: `data/presumptives/` (2 authored categories: PACT Act burn-pit + Agent Orange).
- Incomplete date ranges produce an explicit "unconfirmed dates" warning rather than a match.

### C8: Evidence Processing (`src/lib/evidence/`) — browser-local only

- Modules: `extract.ts` (orchestrator), `document-extract.ts` (pdf.js), `document-kind.ts`,
  `condition-terms.ts`, `pathway-mapper.ts` (deterministic projection of stored excerpts onto
  authored pathways — theory-matched tiering, no interpretation beyond stored classification),
  `storage.ts` (sessionStorage; cleared on workflow completion/reset), `dd214-extract.ts`,
  `gap-coverage.ts`, `limits.ts` (**single** limits module, published verbatim at `/privacy`,
  enforced by the `privacy-limits-contract` E2E assertion).
- OCR: Tesseract.js WASM in-tab; CSP grants `'wasm-unsafe-eval'` for exactly this use; no
  external OCR service exists.

### C9: Workflow Session & State (`src/lib/secondary-workflow/`, `src/lib/workflow-session-crypto.ts`)

- State (`SecondaryWorkflowState`): diagnosed/service-connected condition id lists,
  `ratingsByConditionId`, `documentsShared`, optional `medications`/`treatments`/`history`,
  optional `symptomIds` symptom bridge, optional `conditionTimeline` (onset/diagnosis years).
- Crypto: AES-256-GCM; `WORKFLOW_SESSION_SECRET` (≥32 chars enforced in production; missing →
  fail-closed session ops and `/runtime-readiness` reports not-ready); 30-minute embedded TTL;
  `HttpOnly; Secure; SameSite=Strict` cookie; no URL serialization of state.

### C10: VA Public Reference Adapters (`src/lib/va/`)

- Per-service credential gating: `VA_FORMS_*`, `VA_BENEFITS_REFERENCE_*`,
  `VA_ACCREDITED_REP_*` (each: optional `_ENABLED`-style flag, sandbox/production API key, and
  exact-origin `https` `_BASE_URL` validation via `loadVaApiConfig`).
- Timeout: `VA_API_TIMEOUT_MS` (default **4000ms**); cache: process-local 5-minute TTL LRU.
- Circuit breakers per service (`va-forms`, `benefits-reference-data`,
  `accredited-representatives`) surfaced on `/api/health`; fail-closed local fallback with
  explicit "not VA data" notice; in distributed production, process-local state is disallowed
  until the #287 shared coordinator exists (`local-fallback` posture).
- Consumers: `/va-forms/finder`, `/va-reference/`, and the Find Help accredited-representative
  locator on `/secondary/suggestions`.

### C11: Regulatory Intelligence (`src/lib/regulatory/`, `src/lib/regulatory/preflight/`)

- Adapters: Federal Register, OIRA, Regulations.gov (8s per-source HTTP timeouts, env-overridable).
- Preflight: bearer-protected `GET /api/regulatory/preflight`
  (`REGULATORY_SYNC_SECRET ?? CRON_SECRET`, `timingSafeEqual`), 24h freshness ceiling, optional
  on-disk cache (`REGULATORY_PREFLIGHT_CACHE_DIR`, atomic writes, 20-snapshot cap).
- Seed data: `data/regulatory-actions/` (provenanced records, e.g., Spicer v. McDonough, 2026).

## Data Architecture

- `data/conditions/` — 33 files, 14 body-system categories, 813 conditions.
- `data/knowledge-base/` — 813 mapping files (140 published / 673 draft), 363 authored
  relationships; the 813/813 catalog-to-KB coverage invariant is validated in CI.
- `data/presumptives/` — exposure categories and qualifying windows.
- `data/evidence/` — `master-sources.json`, `master-relationships.json`, `regulatory-actions/`.
- `data/demo-scenarios.json` — E2E/demo fixtures.

Secondary data flow: form → Server Action → Zod validation against catalog → encrypted cookie
write → clean redirect (no URL state) → next step renders from cookie → optional browser-local
document extraction at Step 4 (`sessionStorage`, only the `documentsShared` flag + bounded
context reach the server) → Step 5 locks a regulatory snapshot (`regSnapshot`) before
`recommend()` → Step 6 reviews evidence against the same locked snapshot → completion clears
sessionStorage and destroys the cookie.

Presumptive data flow: service history form → `saveServiceHistory` → encrypted cookie →
results page reads cookie → `matchPresumptives()` deterministic match → user can refine inputs.

CI gates on data: `kb:validate` (schema + referential integrity + draft/published rules),
`audit:me-compliance` (ME-1..ME-39), `citations:audit` (unverified-citation ceiling ratchet),
`regulatory:validate` + `regulatory:audit`, `evidence:architecture` (registry sync).

## Security Architecture

**S1 — AuthN/AuthZ:** no user authentication; anonymous workflow scoped to an encrypted
HttpOnly cookie; all routes public. Adding login requires a separate security review.

**S2 — Input validation:** every Server Action parses `FormData` through Zod and redirects with
a validation code on failure; catalog/KB data validated at load with strict schemas (unknown
keys rejected); no eval or dynamic code execution; client-side constraints are UX only and
never trusted.

**S3 — Output encoding & CSP (verified against `src/proxy.ts`):**

- `script-src 'self' 'nonce-<per-request>' 'strict-dynamic'` + `'wasm-unsafe-eval'` (Tesseract
  OCR) + `'unsafe-eval'` in development only; `script-src-attr 'none'`. No `'unsafe-inline'`
  for scripts.
- `style-src 'self' 'unsafe-inline'` (React/Next styles; the script nonce is the audit
  boundary).
- `img-src 'self' data: blob:`, `font-src 'self' data:`, `worker-src 'self' blob:`,
  `media-src 'self' blob:`, `manifest-src 'self'`, `frame-src 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests`.
- `connect-src 'self'` in production (first-party only; `ws: wss:` added in development).
- Evidence excerpts are sanitized (control characters stripped, character limits enforced)
  before display; no Markdown/HTML rendering of extracted text.

**S4 — Secrets:** `WORKFLOW_SESSION_SECRET` (cookie crypto), per-service `VA_*_API_KEY`s,
`REGULATIONS_GOV_API_KEY` (optional), `REGULATORY_SYNC_SECRET`/`CRON_SECRET` (preflight
bearer). Server-only modules; never committed; rotation via deployment secret store.

**S5 — Incident response:** private advisory channel per `SECURITY.md`; remediation through
reviewed PR + full CI gate; good-faith safe-harbor for researchers.

## Infrastructure & Deployment

- **Primary:** Vercel (edge-accelerated serverless). `next build` includes
  `outputFileTracingIncludes` so `data/**/*.json` ships with the serverless output.
- **Fallback:** Azure Static Web Apps — legacy, manual; `npm run build:azure` builds the
  standalone server and packages it via `scripts/package-next-standalone.mjs`
  (`AZURE_STATIC_WEB_APPS_BUILD=1` switches output mode at build time).
- **CI (`.github/workflows/ci.yml`)** — every PR runs, in order: governance verification
  (main-commit-provenance + active main rules), `audit:high`, `citations:audit`, `kb:validate`,
  `audit:me-compliance`, `lint`, `typecheck`, `test:composition`, the Vitest suite
  (204 files / 1101 tests, fail-on-any), `next build`, and **real-browser E2E**
  (`e2e/secondary-workflow.mjs` + `e2e/validation-errors.mjs` under Chrome/ChromeDriver), with
  diagnostic-log collection and an explicit fail-the-job aggregation step.
- **Post-merge:** automatic Vercel deploy; `/runtime-readiness` confirms deployment identity;
  `/api/health` returns component latencies + circuit-breaker snapshot.
- **Manual gates:** `citations:decay` (link-rot probe), `deploy:guard:vercel` (deploy freeze).

## API Design

- **A1 — Server Actions** (`FormData`-based, type-safe, CSRF-protected by framework design):
  see C3 for the verified action inventory. Redirect-on-success, `?error={code}`-on-failure.
- **A2 — Public API routes** (the only two): `GET /api/health` (component health + breaker
  snapshot) and bearer-protected `GET /api/regulatory/preflight`.
- **A3 — Reference/workflow routes are SSR HTML only** (no JSON API): `/secondary/suggestions`,
  `/va-forms/finder`, `/va-reference/`.

## Testing Strategy

- **T1 — Unit/integration (Vitest):** catalog, KB, engine, presumptive matcher, evidence
  parsers, session crypto, workflow state parsers, research-aid contracts, locator contracts —
  204 files / 1101 tests, enforced fail-on-any per PR.
- **T2 — Composition/architecture:** `npm run test:composition` — critical-module test imports,
  Server Action placement, client boundaries, secondary/presumptive track separation,
  no-evidence-extraction-in-Server-Actions rule.
- **T3 — Knowledge-base audits:** `kb:validate`, `audit:me-compliance`, `citations:audit`
  (CI-blocking); `citations:decay` (maintainer-run); `evidence:architecture`,
  `regulatory:validate`/`regulatory:audit`, `audit:high` in the verify gate.
- **T4 — E2E (real Chrome):** six-step secondary journey (including consensus badges, pathway
  checklists with reload persistence, Find Help locator segment, evidence mapping, reset
  semantics) and the validation-error journey (`?error={code}` → `role=alert` /
  `aria-describedby` contracts, `/privacy` limits verbatim). Runs in CI after build; the
  fail-the-job step aggregates every gate outcome.

## Performance Targets

| Operation | Target | Notes |
|---|---|---|
| Catalog load | <10ms | In-memory at startup |
| KB load | <50ms | In-memory at startup |
| Recommendation engine | <200ms budget | Measured single-digit ms on E2E journeys |
| PDF extraction (10 pages) | <500ms | Browser-local pdf.js |
| OCR per scanned page | 500ms–3s | Browser-dependent WASM |
| Server Action latency | <100ms | Validate + encrypt + set cookie + redirect |
| Edge CSP nonce | <10ms | Per-request crypto |
| First Contentful Paint | <1.5s | Vercel edge |
| Time to Interactive | <2.5s | Hydration |

## Future Roadmap (Deferred)

- Build-time sharded CRG indexer (current load is synchronous JSON).
- Authenticated user sessions (claim-history persistence; representative multi-client
  management) — requires separate security review.
- Credentialed VA API integration (auto-fetch service history) — separate security review.
- Rating automation beyond the informational Rating Guide (currently manual VA lookup).
- Multilingual support.

---

**Version**: 2.0 — regenerated from the 2026-09-11 conformance audit (`08cda5b`); supersedes the
v1.0 circulated paste. Living source of truth: `docs/technical-specification.md` (v1.6).
