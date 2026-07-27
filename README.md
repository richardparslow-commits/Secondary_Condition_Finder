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
data/knowledge-base/   Secondary conditions, one JSON file per primary
data/presumptives/     Exposure categories, locations, and date windows
data/demo-scenarios.json
src/lib/kb/            Zod schema, loader, lookup
src/lib/engine/        Pure recommendation logic, no I/O
src/lib/presumptive/   Zod schema, loader, service-history matcher
src/lib/log/           Event logging behind an EventLogger interface
src/app/               App Router pages
src/components/        Presentational components
tests/                 Vitest
docs/                  Product spec, presumptive scope, phase planning
```

Routes: `/` chooser, `/secondary` and `/results`, `/presumptive` and
`/presumptive/results`, `/scenarios`.

## Adding a primary condition

Create `data/knowledge-base/<slug>.json` where the filename matches the `id`
field. Each suggestion needs `conditionId`, `condition`, `rank`, `prevalence`,
`rationale`, at least one evidence gap, and at least one source reference with
`verified: false`. Run `npm test` to check the integrity invariants.

### Draft entries

An entry may ship as `draft: true` with an empty `suggestions` array and a
`todo` checklist of what a reviewer must supply. Drafts are validated and
version controlled but never appear in the UI and never resolve through lookup,
so an unfinished entry cannot reach a veteran. Fourteen are staged now. Fill in
the content, clear the `todo`, then set `draft: false`.

Contribution rules for humans and agents alike are in
`.github/copilot-instructions.md`. The citation rules there are not optional.

## Privacy

No accounts, no personally identifying information, and no intake free text is
persisted. Event logs record resolved condition names, counts, and a timestamp
only, which is enough to explain why a given set of suggestions was produced.
