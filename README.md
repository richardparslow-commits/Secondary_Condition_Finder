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

**This is not medical or legal advice.** It does not diagnose conditions,
determine eligibility, or estimate ratings. Every suggestion is a possibility
to discuss with a qualified provider or an accredited representative.

## Status

Phase 1: web app with no live VA data. See `docs/product-spec.md` for scope and
`docs/phase-plan.md` for the full roadmap.

All source citations currently ship as **unverified**. They have not been
confirmed by a qualified reviewer and are displayed as starting points for your
own verification, not as authority.

## Stack

Next.js (App Router), TypeScript, Tailwind, Zod, Vitest. The knowledge base is
JSON in version control so every change to a condition mapping or a citation
arrives as a reviewable diff. SQLite backs local event logging.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Try `/scenarios` for repeatable demo walkthroughs.

> **Turbopack workspace-root warning.** If you keep a nested clone of this repo
> inside the working directory, or a `package-lock.json` exists in an ancestor
> directory (for example a stray one in your home folder), `next dev` and
> `next build` may print a warning that the workspace root was inferred from one
> of those lockfiles. The repo pins `turbopack.root` to itself and ignores the
> nested `Secondary_Condition_Finder/` clone (git and TypeScript), so serving is
> unaffected; the message is emitted before the config loads and is cosmetic.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `EVENT_LOG_SQLITE_PATH` | unset | Path to a SQLite file for recommendation event logs. When unset, events are written as structured stdout lines instead. |

## Layout

```
data/conditions/       Condition catalog, one JSON file per body system
data/knowledge-base/   Secondary mappings, one JSON file per primary
data/presumptives/     Exposure categories, locations, and date windows
data/demo-scenarios.json
src/lib/catalog/       Zod schema, loader, lookup. Condition identity.
src/lib/kb/            Zod schema, loader, mapping helpers
src/lib/engine/        Pure recommendation logic, no I/O
src/lib/presumptive/   Zod schema, loader, service-history matcher
src/lib/log/           Event logging behind an EventLogger interface
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
- `/results` legacy query-based secondary results (kept for scenario/demo compatibility)
- `/presumptive` and `/presumptive/results`
- `/scenarios`

Wizard notes:

- Later secondary steps are route-guarded and require valid prior-step query state.
- Back links preserve prior selections so users can revise choices without restarting.
- Suggestions and evidence pages require an explicit upload-step choice (`documentsShared`)
  even though file upload itself is optional.

## Coverage

193 conditions across 14 body systems are in the catalog.

- 193 have version-controlled mapping files.
- 193 are published (`draft: false`) and active in recommendations.


## Adding a condition

Two steps, and they are separate on purpose.

1. **Catalog.** Add it to the matching `data/conditions/<body-system>.json`
   with a unique id, name, aliases, and a rating citation if you have a real
   one. This makes the condition selectable.
2. **Mappings.** Create `data/knowledge-base/<id>.json` where the filename
   matches the `id`. Each suggestion needs `conditionId`, `rank`, `prevalence`,
   `rationale`, at least one evidence gap, and at least one source reference
   with `verified: false`. This makes it return results.

Run `npm test` to check the integrity invariants, including that every
`conditionId` resolves to a catalog entry. The app also validates these
references at load time, so drift fails fast before recommendations run.

### Draft mappings

A mapping may ship as `draft: true` with an empty `suggestions` array and a
`todo` checklist. Drafts are validated and version controlled but never appear
in the search, scenario, or recommendation UI flows, so unfinished research
cannot reach a veteran.

Contribution rules for humans and agents alike are in
`.github/copilot-instructions.md`. The citation rules there are not optional.

## Privacy

No accounts, no personally identifying information, and no intake free text is
persisted. Event logs record resolved condition names, counts, and a timestamp
only, which is enough to explain why a given set of suggestions was produced.
