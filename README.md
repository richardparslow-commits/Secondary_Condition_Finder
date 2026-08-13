# Secondary Condition Finder

A claim-preparation research aid for VA disability claims. It covers two
legally distinct paths and keeps them separate, because they need different
evidence.

- **Secondary** (38 CFR 3.310): given a service-connected condition, returns
  ranked conditions to explore, each with reasoning, evidence gaps, and
  citations. Needs a nexus opinion.
- **Presumptive** (38 CFR 3.307 and 3.309): given where and when you served,
  returns the exposure presumptions that may apply. No nexus opinion needed.

Covers the PACT Act burn pit list and the Agent Orange list. See
`docs/presumptive-track.md` for scope and what is deliberately excluded.
Data governance rules for condition IDs, schema strictness, and citation
quality are in `docs/data-governance-note.md`.

**This is not medical or legal advice.** It does not diagnose conditions,
determine eligibility, or estimate ratings. Every suggestion is a possibility
to discuss with a qualified provider or an accredited representative.

## Status

Phase 1: web app with no live VA data. See `docs/product-spec.md` for scope and
`docs/phase-plan.md` for the full roadmap.

Published sources may still be marked **unverified** until a qualified reviewer
has independently checked them. Unverified references are displayed as starting
points for review, not as independently verified authority.

## Stack

Next.js (App Router), TypeScript, Tailwind, Zod, Vitest. The knowledge base is
JSON in version control so every change to a condition mapping or a citation
arrives as a reviewable diff.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Try `/scenarios` for repeatable demo walkthroughs.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Hydration troubleshooting

If you see a hydration warning that shows an attribute mismatch with little or
no useful server/client diff, test once in a clean browser profile with
extensions disabled. Some extensions inject or rewrite DOM attributes before
React hydrates, which can cause this warning even when app markup is stable.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `WORKFLOW_SESSION_SECRET` | development-only fallback outside production | Preferred server-only secret used to encrypt and authenticate secondary and presumptive workflow cookies with AES-256-GCM. Production requires at least 32 characters and fails closed if it is missing or too short. |
| `SECONDARY_WORKFLOW_SESSION_SECRET` | unset | Backward-compatible fallback for deployments created during the secondary-workflow privacy migration. Prefer `WORKFLOW_SESSION_SECRET` for new deployments. |

For production, generate `WORKFLOW_SESSION_SECRET` with a cryptographically
secure secret manager or random generator and store it only as a server-side
deployment secret. Do not expose it through a `NEXT_PUBLIC_*` variable or commit
it to the repository.

## Layout

```
data/conditions/       Condition catalog, one JSON file per body system
data/knowledge-base/   Secondary mappings, one JSON file per primary
data/presumptives/     Exposure categories, locations, and date windows
data/demo-scenarios.json
src/lib/catalog/       Zod schema, loader, lookup. Condition identity.
src/lib/kb/            Zod schema, loader, mapping helpers
src/lib/engine/        Pure recommendation logic, no I/O
src/lib/presumptive/   Zod schema, loader, service-history matcher/session
src/app/               App Router pages
src/components/        Presentational components
tests/                 Vitest
docs/                  Product spec, catalog and presumptive scope, planning
```

Routes:

- `/` chooser
- `/secondary` workflow overview plus:
  - `/secondary/diagnosed`
  - `/secondary/service-connected`
  - `/secondary/ratings`
  - `/secondary/upload` (optional checklist flag only; no file parsing or medical interpretation)
  - `/secondary/suggestions`
  - `/secondary/evidence`
- `/results` legacy route that now redirects to `/secondary` and does not process query-based health state
- `/presumptive` and `/presumptive/results`
- `/scenarios`

Workflow notes:

- Secondary health/disability state is submitted with server actions rather
  than encoded into query strings.
- Presumptive service locations and service dates are also submitted with a
  server action rather than `GET` query parameters.
- Later steps read prior state from short-lived encrypted, authenticated,
  HttpOnly, SameSite=Strict cookies scoped to their respective workflow paths.
- Back links use clean route paths so selections do not enter browser history,
  referrer headers, or copied URLs.
- Suggestions and evidence pages require an explicit upload-step choice
  (`documentsShared`) even though file upload itself is optional.

## Coverage

193 conditions are present in the catalog and have version-controlled mapping
files. Draft mappings remain excluded from recommendation output until their
publication requirements are satisfied.

## Adding a condition

Two steps, and they are separate on purpose.

1. **Catalog.** Add it to the matching `data/conditions/<body-system>.json`
   with a unique id, name, aliases, and a rating citation if you have a real
   one. This makes the condition selectable.
2. **Mappings.** Create `data/knowledge-base/<id>.json` where the filename
   matches the `id`. Each published suggestion needs `conditionId`, `rank`,
   `prevalence`, `rationale`, evidence gaps, and source references that satisfy
   the repository's current citation and publication rules.

Run `npm run kb:validate`, `npm run citations:audit`, and `npm test` to check the
integrity invariants. The app also validates references at load time, so drift
fails fast before recommendations run. Strict schema parsing rejects unknown
JSON keys so data-contract drift cannot be silently accepted.

### Draft mappings

A mapping may ship as `draft: true` with an empty `suggestions` array and a
`todo` checklist. Drafts are validated and version controlled but never appear
in the search, scenario, or recommendation UI flows, so unfinished research
cannot reach a veteran.

Contribution rules for humans and agents alike are in
`.github/copilot-instructions.md`. The citation rules there are not optional.

## Privacy

The secondary workflow does not place diagnosis, service-connected status,
rating choices, or document-checklist state in URLs. The presumptive workflow
does not place selected service locations or service dates in URLs. Both use
short-lived workflow cookies that are encrypted and authenticated before being
sent to the browser. Application Insights is configured for path-only page
views with automatic route/AJAX/fetch tracking disabled.
