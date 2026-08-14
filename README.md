# Secondary Condition Finder

A claim-preparation research aid for VA disability claims. It keeps secondary
and presumptive service-connection research separate because they use different
legal and evidentiary frameworks.

- **Secondary** (38 CFR § 3.310): starts from established service-connected
  conditions and organizes diagnosed conditions that may warrant further
  research, along with authored pathways, evidence gaps, and source references.
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

The runtime contains environment-aware adapters for the VA Forms API and VA
Benefits Reference Data endpoints used for public reference information. Those
adapters are **disabled by default** and fall back to local reference data when
live access is disabled, unavailable, invalid, or rate-limited. Credentialed VA
sandbox proof and any future VA production transition are separate external
validation gates; repository automation must not claim those gates are complete
without objective credentialed evidence.

The browser-local evidence feature can extract text from supported PDF, DOCX,
and text files. Raw local document bytes and raw extracted document text remain
in the browser tab and are not submitted to the application server. Resource
limits are enforced before or during extraction, including per-file/batch
limits, a PDF page cap, a text-character cap, and DOCX archive-expansion
preflight bounds.

Published knowledge-base source references may still be marked **unverified**
until they are independently checked. Unverified references remain research
starting points, not verified authority. `npm run citations:audit` enforces
unsafe-provenance rules and a non-regression ratchet so verification debt cannot
silently increase.

## Stack

Next.js App Router, TypeScript, Tailwind, Zod, Vitest, Chrome/ChromeDriver E2E,
and Vercel. The condition catalog and knowledge base are JSON in version control
so mapping and citation changes remain reviewable diffs.

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
| `npm run test:composition` | Requires executable-test imports for 100% of the audited critical-module manifest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run kb:validate` | Knowledge-base structural/integrity validation |
| `npm run citations:audit` | Citation safety, provenance, and verification-debt audit |

CI also builds the production app and runs real Chrome/ChromeDriver journeys for
the secondary workflow and validation/error behavior. After successful `main`
CI, Production Runtime Readiness confirms the exact Vercel deployment, canonical
alias, the full public route matrix, and the runtime-session readiness marker.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKFLOW_SESSION_SECRET` | development-only fallback outside production | Server-only secret for AES-256-GCM workflow tokens. Production requires at least 32 characters and fails closed if missing/short. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | unset | Backward-compatible non-production fallback. Prefer `WORKFLOW_SESSION_SECRET`. |
| `VA_API_ENV` | `sandbox` | Selects the VA adapter environment: `sandbox` or `production`. |
| `VA_API_ENABLED` | disabled | Explicit generic enable flag. Production requests require this to be `true`. |
| `VA_SANDBOX_ENABLED` | disabled | Legacy sandbox-only enable flag when `VA_API_ENABLED` is unset. |
| `VA_FORMS_SANDBOX_API_KEY` | unset | VA Forms sandbox credential. |
| `VA_BENEFITS_REFERENCE_SANDBOX_API_KEY` | unset | Benefits Reference Data sandbox credential. |
| `VA_FORMS_PRODUCTION_API_KEY` | unset | VA Forms production credential; external production access is a separate gate. |
| `VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY` | unset | Benefits Reference Data production credential; external production access is a separate gate. |
| `VA_API_TIMEOUT_MS` | `4000` | Outbound VA request timeout. |

See `docs/va-api-runtime-configuration.md` for the complete environment-aware VA
runtime contract. Production secrets belong only in the deployment secret store;
do not expose them through `NEXT_PUBLIC_*` variables or commit them.

The VA public-reference cache is process-local and best-effort: five-minute TTL,
LRU-bounded entry count, and no durable/global semantics. Outbound VA requests
also have a process-local per-service request budget. Those controls reduce
single-process pressure but are not represented as distributed/global rate
limiting.

## Layout

```text
data/conditions/       Condition catalog, one JSON file per body system
data/knowledge-base/   Secondary mappings, one JSON file per primary
data/presumptives/     Exposure categories, locations, and date windows
data/demo-scenarios.json
src/lib/catalog/       Zod schema, loader, lookup; condition identity
src/lib/kb/            Zod schema, loader, mapping helpers
src/lib/engine/        Recommendation and export logic
src/lib/presumptive/   Service-history matcher and encrypted session wrapper
src/lib/evidence/      Browser-local evidence extraction/evaluation helpers
src/lib/va/            Environment-aware public-reference adapters/cache
src/app/               App Router pages
src/components/        UI components
tests/                 Vitest regression/contract tests
e2e/                   Real-browser Chrome/ChromeDriver journeys
docs/                  Product, operations, accessibility, and runtime docs
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
  - `/secondary/suggestions`
  - `/secondary/evidence`
- `/presumptive` and `/presumptive/results`
- `/scenarios`
- `/va-forms` and `/va-forms/finder`
- `/va-reference` and `/va-reference/service-branches`
- `/privacy`
- `/terms`
- `/runtime-readiness`

`/results` is a legacy redirect to `/secondary` and does not process query-based
health state.

## Workflow privacy

- Secondary health/disability state is submitted with server actions rather than
  encoded into query strings.
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
- Application Insights automatic route/AJAX/fetch tracking is disabled; the app
  does not persist a workflow/recommendation event-history application log.

## Knowledge-base coverage and authoring

193 catalog conditions have version-controlled mapping files. Draft mappings
remain excluded from recommendation output until publication requirements are
satisfied.

To add or change a condition:

1. **Catalog:** update `data/conditions/<body-system>.json` with a stable unique
   ID, display name, aliases, and traceable rating authority when available.
2. **Mapping:** update/create `data/knowledge-base/<id>.json`. Each published
   suggestion needs a condition ID, rank, prevalence label, conservative
   rationale, evidence gaps, and source references satisfying the repository's
   current provenance rules.
3. Run `npm run kb:validate`, `npm run citations:audit`, `npm run
   test:composition`, and `npm test` before review.

Strict Zod schemas reject unknown JSON keys, and referential-integrity tests keep
mapping IDs aligned with the catalog. Drafts may retain explicit TODO items but
cannot silently appear in recommendation output.

Contribution rules for humans and agents are in
`.github/copilot-instructions.md`.
