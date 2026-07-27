# Secondary Condition Finder

A claim-preparation research aid for exploring possible secondary VA
conditions. Given one or more service-connected primary conditions, it returns
ranked conditions to explore, each with reasoning, the evidence a claim would
typically need, and citations to verify.

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
data/knowledge-base/   Source of truth, one JSON file per primary condition
data/demo-scenarios.json
src/lib/kb/            Zod schema, loader, lookup
src/lib/engine/        Pure recommendation logic, no I/O
src/lib/log/           Event logging behind an EventLogger interface
src/app/               App Router pages
src/components/        Presentational components
tests/                 Vitest
docs/                  Product spec and phase planning
```

## Adding a primary condition

Create `data/knowledge-base/<slug>.json` where the filename matches the `id`
field. Each suggestion needs `conditionId`, `condition`, `rank`, `prevalence`,
`rationale`, at least one evidence gap, and at least one source reference with
`verified: false`. Run `npm test` to check the integrity invariants.

Contribution rules for humans and agents alike are in
`.github/copilot-instructions.md`. The citation rules there are not optional.

## Privacy

No accounts, no personally identifying information, and no intake free text is
persisted. Event logs record resolved condition names, counts, and a timestamp
only, which is enough to explain why a given set of suggestions was produced.
