# Secondary Condition Finder - Repository Guidelines

## Project Purpose

Web application helping veterans research secondary and presumptive
service-connection for VA disability claims (38 CFR §§ 3.307, 3.309, 3.310).
It organizes authored, source-referenced research pathways; it does not
diagnose conditions, determine eligibility, or estimate ratings. The condition
catalog and knowledge base are versioned JSON, so data changes are reviewable
diffs.

## Tech Stack

- Framework: Next.js (App Router) on Node 22, deployed on Vercel
- Language: TypeScript (strict mode)
- Validation: Zod (strict schemas reject unknown JSON keys)
- Styling: Tailwind CSS v4
- Testing: Vitest (plus real-Chrome E2E journeys)
- Deployment: Vercel (Azure Static Web Apps is a legacy manual fallback only)

Note: this repo has no Python/Streamlit code; an early prototype was retired.

## Layout

```
data/conditions/       Condition catalog (33 files, 813 conditions)
data/knowledge-base/   One mapping file per primary condition (813 files)
data/presumptives/     Exposure categories, locations, date windows
data/evidence/         Master relationship & source registries
src/proxy.ts           Edge proxy: per-request nonce CSP, security headers
src/lib/actions/       ALL Server Actions ("use server")
src/lib/catalog/       Catalog Zod schema, loader, lookup
src/lib/kb/            Knowledge-base Zod schema, loader, lookup
src/lib/engine/        Recommendation/export logic
src/lib/secondary-workflow/   Browser-local secondary workflow state and transport
src/lib/presumptive/   Service-history matcher + browser-local history store
src/lib/evidence/      Browser-local evidence extraction (client-side only)
src/lib/va/            Environment-aware VA API adapters (disabled by default)
src/app/               App Router pages; only one API route (regulatory preflight)
tests/                 Vitest regression/contract tests
e2e/                   Real-browser Chrome/ChromeDriver journeys
docs/                  master-specification.md is the consolidated spec
```

## Developer Guardrails

1. Never commit directly to `main`. Create a feature branch and submit a Pull
   Request.
2. Run the full gate before review: `npm run kb:validate`,
   `npm run citations:audit`, `npm run test:composition`, `npm run lint`,
   `npm run typecheck`, and `npm test`.
3. There is no rating math to validate: the app collects user-supplied ratings
   and deliberately does not estimate, combine, or predict VA ratings.

## Data Architecture & Integrity Rules (CRITICAL)

1. **ID format:** all `id`/`conditionId` values match `/^[a-z0-9-]+$/` —
   lowercase alphanumeric plus hyphens only.
2. **Referential integrity:** every `conditionId` referenced in a
   `data/knowledge-base/*.json` `suggestions` array must exist as a primary
   `id` in a catalog file, and the mapping filename must equal its `id`.
3. **CRG trio (mandatory):** the knowledge base is a Causal Relational Graph.
   Every suggestion carries `nexusClaim` (`DIRECT_CAUSATION`,
   `AGGRAVATION`, or `ASSOCIATION_ONLY`), `causalMechanism`, and
   `evidentiaryProfile` with `etiologicalConsensus`. The deprecated
   `prevalence` field is rejected by schema.
4. **Honest classification:** never force a causation/aggravation claim the
   literature does not support. Association-only relationships use
   `ASSOCIATION_ONLY` + `NOT_ESTABLISHED` + `hypothesizedOnly: true`. Legal or
   rating authority (e.g., 38 CFR 3.310) is never clinical evidence.
5. **Citations:** never invent or guess URLs. New/automated edits ship with
   `verified: false`; only qualified-human review under
   `docs/citation-verification-sop.md` may set `verified: true`.
6. **Draft status:** new mappings start `"draft": true` and never surface in
   recommendation output until published.

## Security & Architecture Guardrails

1. **Track separation:** secondary (knowledge-base) and presumptive
   (regulatory) data, schemas, and loaders never share files or modules; the
   two workflow libraries must not import each other. `npm run
   test:composition` enforces this.
2. **Server Actions only:** all Server Actions live in `src/lib/actions/`.
   Workflow state never travels in GET query strings or URLs.
3. **Browser-local research workflows:** secondary and presumptive context lives in
   versioned, schema-bounded browser `sessionStorage`; the application does not
   persist it in workflow cookies or URLs. The optional VA-account sandbox uses
   separate server-side encrypted sessions and is disabled by default. The legacy
   `WORKFLOW_SESSION_SECRET` is a crypto-readiness marker, not a research-workflow key.
4. **Browser-local evidence:** raw document bytes/text never reach the server;
   `src/lib/evidence/` parsers are imported only from client components.
5. **CSP:** never weaken the per-request nonce CSP in `src/proxy.ts` (no
   `'unsafe-inline'` for scripts, and none for styles in production — styles are
   Tailwind classes, SVG presentation attributes, drawn SVG shapes, or CSSOM
   writes, never a JSX style attribute; `connect-src 'self'` only, no
   third-party or analytics SDKs).
6. **No secret leakage:** production secrets live only in the deployment
   secret store; never commit them or expose them via `NEXT_PUBLIC_*`.

Contribution rules for humans and agents are in
`.github/copilot-instructions.md`; the consolidated specification is
`docs/master-specification.md`.
