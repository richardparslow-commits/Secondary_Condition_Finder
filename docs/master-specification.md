# Secondary Condition Finder — Master Specification

This is the consolidated source-of-truth reference for the Secondary Condition Finder platform. It covers knowledge-base coverage and authoring, codebase layout and routing, workflow privacy and browser security, and CI/CD enforcement. It supersedes ad-hoc proposals and reflects the currently implemented architecture. Product behavior, phase gates, and external acceptance criteria are tracked separately in `docs/product-spec.md`, `docs/phase-plan.md`, and `docs/phase-gates.md`.

Status: implemented master specification (current `main`).

## Part 1 — Knowledge-Base Coverage and Authoring

The knowledge base strictly separates **Secondary Service Connection** (probabilistic Causal Relational Graph) from **Presumptive Service Connection** (deterministic temporal/geographic logic). Legal authority (the CFR) dictates how to rate; it never constitutes clinical evidence of a medical nexus.

### 1.1 The Secondary Causal Relational Graph (CRG)

- Regulatory basis: 38 CFR § 3.310.
- Architecture: probabilistic Causal Relational Graph — nodes are conditions (`data/conditions/`), edges are causal pathways (`data/knowledge-base/<primary-id>.json`).
- Schema: `src/lib/kb/schema.ts`, validated by Zod. Every suggestion (edge) must carry the CRG trio:

```jsonc
{
  "nexusClaim": "DIRECT_CAUSATION", // DIRECT_CAUSATION | AGGRAVATION | ASSOCIATION_ONLY
  "causalMechanism": {
    "mechanismCategory": "MICROVASCULAR_METABOLIC", // see schema enum
    "primaryVector": "Chronic hyperglycemia causes microvascular damage...",
    "hypothesizedOnly": false,
    "iatrogenic": false
  },
  "evidentiaryProfile": {
    "etiologicalConsensus": "WELL_ESTABLISHED", // WELL_ESTABLISHED..NOT_ESTABLISHED
    "vaNexusProbabilityAlignment": "AT_LEAST_AS_LIKELY_AS_NOT",
    "conservativeRationale": "...",
    "evidenceGaps": "Must rule out B12 deficiency, alcohol use...",
    "alternativeEtiologiesToRuleOut": ["B12 deficiency", "Alcoholic neuropathy"]
  }
}
```

- The discriminated union enforces pathway-specific fields: `DIRECT_CAUSATION` requires `etiologicalTrigger`; `AGGRAVATION` requires `baselineProgression` + `aggravatingFactor`; `ASSOCIATION_ONLY` requires `associationBasis` + `causationStatus` and forces `hypothesizedOnly: true`.
- `ASSOCIATION_ONLY` is the honest third arm required by this knowledge base: most authored guards explicitly disclaim individual causation (population-level association is not an individual nexus). Never force a row into a causation arm that its guard or literature does not support.
- `prevalence` is deprecated and removed. Use `evidentiaryProfile.etiologicalConsensus`.
- Every suggestion reuses the registry row object in `data/evidence/master-relationships.json`; the master-registry audit hashes the full suggestion objects and fails on any drift.

### 1.2 The Deterministic Presumptive Engine

- Regulatory basis: 38 CFR §§ 3.307 and 3.309.
- Architecture: deterministic boolean logic — triggers are locations/dates, outputs are recognized conditions.
- Data lives exclusively in `data/presumptives/<exposure-category>.json` (e.g., `agent-orange.json`, `burn-pits.json`); logic lives in `src/lib/presumptive/` (`match.ts`, `session.ts`, `pactAct.ts`, `schema.ts`). Presumptive data does not require clinical nexus evidence.
- Track separation is enforced by `npm run test:composition`: `src/lib/secondary-workflow/` must not import `@/lib/presumptive/*` logic, and vice versa.

### 1.3 Citation Debt Eradication Protocol

- **Purity threshold:** `npm run kb:validate` downgrades any mapping with > 30% unverified citations to `"draft": true` (excluded from recommendation output) and quarantines single-unverified-citation mappings.
- **Amnesty & purge:** human reviewers Verify, Replace, or Purge unverified citations. If clinical evidence does not exist, the CRG edge does not exist.
- **Automated decay:** `npm run citations:decay` flags URLs returning 404/5xx as decayed and `sourceCheckedOn` dates older than 365 days as stale. A host that refuses the automated probe — throttling (425/429, or `Retry-After`), a bot wall, or a timeout on a host that answers other URLs — is reported as unverifiable-by-probe with the run's coverage, never as a dead link, so the gate only fails on verdicts it actually obtained. Runs live network probes, so it is a deliberate maintainer gate, not per-PR CI.
- **Hard ceiling:** `npm run citations:audit` fails the pipeline if unverified citation count exceeds the audited baseline.

## Part 2 — Codebase Layout, Routing, and Architecture

Next.js App Router (Next 16). The edge proxy uses the Next.js `proxy`/middleware convention (`src/proxy.ts`) for per-request CSP nonce generation.

```
data/
├── conditions/               # Node registry: condition catalog, grouped by body system
├── knowledge-base/           # Edge registry: secondary CRG mappings (one JSON per primary)
├── presumptives/             # Deterministic engine: exposure categories, locations, date windows
├── evidence/                 # Master relationship/source registries (registry-of-record)
└── demo-scenarios.json       # E2E testing fixtures

src/
├── proxy.ts                  # Edge proxy (Next 16 middleware): CSP nonce, x-nonce, route headers
├── app/
│   ├── layout.tsx            # Root layout (request-time render for nonce CSP)
│   ├── page.tsx              # Home (/)
│   ├── secondary/            # Secondary workflow route group
│   │   ├── page.tsx          # Entry point (/secondary)
│   │   ├── condition-caused-by/   # Direct causation UI (DIRECT_CAUSATION)
│   │   ├── condition-aggravation/ # Aggravation UI (AGGRAVATION)
│   │   ├── upload/           # Browser-local evidence review (/secondary/upload)
│   │   └── suggestions/      # CRG output / recommendation engine UI
│   ├── presumptive/          # Presumptive workflow (/presumptive, /presumptive/results)
│   ├── results/              # LEGACY: hard redirect to /secondary, processes no query state
│   └── [static routes]       # /about, /privacy, /terms, /va-forms, /va-reference, ...
├── components/               # React components (only interactive ones are "use client")
└── lib/
    ├── actions/              # Server Actions ("use server"); currently the bounded public accredited-representative lookup
    ├── catalog/              # Zod schema, loader, lookup; condition identity (nodes)
    ├── kb/                   # Zod schema, loader, mapping helpers; CRG traversal (edges)
    ├── engine/               # Recommendation scoring, export, consensus ordering
    ├── presumptive/          # Service-history matcher and boolean logic
    ├── evidence/             # Browser-local evidence extraction/evaluation (pdf.js-backed parsers)
    ├── secondary-workflow/   # Session state, parsers, local (browser) state
    └── va/                   # VA reference data, forms finder, sandbox (disabled)

tests/     # Vitest unit/regression/contract tests
e2e/       # Playwright/ChromeDriver browser journeys
docs/      # Product, operations, security, and expansion documentation
scripts/   # Audits, validators, generators (all wired as npm scripts)
```

### 2.1 Routing and Data Layer Rules

- **Causation vs. aggravation split:** the UI strictly separates `/secondary/condition-caused-by` and `/secondary/condition-aggravation` so users cannot conflate the two legal/medical pathways.
- **Legacy redirect:** `/results` is a hard redirect to `/secondary` and does not process query-based health state (no PHI via URL).
- **Build-time indexer (deferred):** a `build:kb` sharded runtime indexer is a documented future backlog item; the runtime loader currently reads `data/` from disk (`outputFileTracingIncludes` keeps it in server bundles for Vercel and Azure standalone).

## Part 3 — Workflow Privacy, Browser Security, and Infrastructure

Zero-trust, privacy-first architecture — no PHI leakage, XSS, or CSRF surface. The application does not connect to a production Veteran's VA account, submit claims, or persist evidence documents server-side. The only exception is the disabled-by-default sandbox account experiment (`/privacy` §6: read-only sandbox reads, encrypted server-side session store, no production). Full boundary statement: `SECURITY.md`; operations runbook: `docs/security-operations.md`.

### 3.1 State Management & Transit

- **No URL state:** workflow state, condition selections, and service history never travel in GET/URL query parameters, and neither workflow posts them in a request body.
- **Browser-local workflow state:** both the secondary workflow (PRIV-01, accepted 2026-10-07) and the presumptive/DD-214 track (2026-10-08) keep their context in versioned, schema-bounded browser storage. The retired `secondary-workflow-v2` and `presumptive-workflow-v1` cookies are tombstoned by the edge proxy if a browser still presents one, and no workflow sets a cookie. Session crypto (`src/lib/workflow-session-crypto.ts`) now protects only the VA-account server session store, whose OAuth tokens never live in browser storage.
- **Browser-local state:** client-side convenience state (e.g., evidence review) lives in `sessionStorage` and is cleared on workflow completion.

### 3.2 Content Security Policy

Generated per-request in `src/proxy.ts` (Next 16 edge proxy), with the per-request nonce propagated via the `x-nonce` request header:

- `script-src 'self' 'nonce-<n>' 'strict-dynamic'` — no `'unsafe-inline'` (dev adds `'unsafe-eval'` only).
- `style-src 'self' 'nonce-<n>'` + `style-src-attr 'none'` — production authorizes styles by nonce and refuses the style attribute; `'unsafe-inline'` is development-only (audit SEC-03).
- `connect-src 'self'` (plus `ws:`/`wss:` in dev) — no third-party APIs, no analytics SDKs.
- `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`, `base-uri 'self'`, `script-src-attr 'none'`, `upgrade-insecure-requests`.
- Route-wide security headers (HSTS, `no-referrer`, `nosniff`, `DENY`, Permissions-Policy) ship from `next.config.ts`.

### 3.3 Telemetry vs. Audit Logging

- **Client telemetry:** prohibited — no analytics SDKs, no event-history loggers. Production `connect-src` remains first-party only.
- **Server-side audit logging:** PHI-stripped only — timestamps, session id hashes, action types, HTTP status. Condition IDs, PII, service locations, and recommendation text are never logged (see `docs/security-operations.md`).

### 3.4 Payload & Edge Hardening

- **Document processing:** raw file bytes never pass through Server Actions. PDFs/images are processed browser-local (`src/lib/evidence/`); only sanitized, bounded extracted text is surfaced.
- **Rate limiting:** edge-level WAF/DDoS/rate-limiting on Server Action routes and dynamic data routes is the deployment responsibility of the hosting edge (Vercel primary). DoS/brute-force testing is out of scope for researchers (see `SECURITY.md`).
- **Server Action payload limits:** any future change to action payload limits is a boundary change requiring security review (see `SECURITY.md`).

## Part 4 — CI/CD Enforcement and Agent Guardrails

Hardcoded directives live in `.github/copilot-instructions.md` (CRG authoring, track separation, security/privacy, file placement).

### 4.1 Mandatory CI/CD Gates

Every PR must pass, enforced by `.github/workflows/ci.yml`:

| Gate | Command | Enforces |
| --- | --- | --- |
| Knowledge-base validation | `npm run kb:validate` | Strict Zod schema, referential integrity, citation purity threshold |
| ME / CRG compliance | `npm run audit:me-compliance` | CRG trio, nexus-arm discriminated union, consensus/alignment consistency, guard-disclaimer honesty, citation discipline, quarantine, and a two-way join of every ME approval ledger (`rows`/`relationships`/`mappings` shapes) against the authored corpus — an unreadable, unrecognized-shape, or declared-but-absent relationship fails closed |
| Citation audit | `npm run citations:audit` | Unverified citation ceiling vs. baseline |
| Composition / architecture audit | `npm run test:composition` | Critical-module test coverage + server-action placement + client boundary + track separation + evidence-parser boundary |
| Lint | `npm run lint` | ESLint |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Unit/contract tests | `npm test` | Full Vitest suite |
| Build + e2e | `npm run build`, e2e job | Production build and real-browser journeys |
| PRIV-01 browser sentinel | `node scripts/acceptance-browser-sentinel.mjs` | Browser-local privacy: no sentinel in any request, response body, HTML/RSC payload, log, trace or browser storage. Its own job (`priv01_sentinel`) with its own wall-clock ceiling and a smaller budget for the walk inside it, so it cannot spend another gate's time or be truncated by one. Pull requests touching the workflow scope in `scripts/priv01-sentinel-scope.mjs` (answered by the `priv01_scope` job), plus every non-PR event. Fails rather than skipping when the runner cannot host the walk |

`npm run citations:decay` (live link-rot/staleness probes) is a deliberate maintainer gate and is intentionally not wired into per-PR CI.

## Governance

- The 38 CFR is legal framework, never clinical evidence; it must never be cited as a `condition_specific_source`.
- New mappings ship `"verified": false`; only qualified human review may set `verified: true`.
- New mappings ship `"draft": true` until fully populated and tested.