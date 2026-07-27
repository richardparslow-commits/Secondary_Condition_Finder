# Copilot instructions

## What this is

Secondary Condition Finder helps veterans, advocates, and claim-preparation
staff research VA disability claims. It is a research aid. It does not
diagnose, determine eligibility, or give medical or legal advice.

It covers two legally distinct paths. Do not merge them.

- **Secondary service connection** (38 CFR 3.310): condition B was caused or
  aggravated by service-connected condition A. Needs a nexus opinion. Data
  lives in `data/knowledge-base/`.
- **Presumptive service connection** (38 CFR 3.307 and 3.309): VA presumes the
  connection based on where and when someone served. No nexus, no other
  service-connected condition required. Data lives in `data/presumptives/`.

Presenting a presumptive condition as a secondary would push a veteran toward
a harder claim than the one they qualify for. Keep the tracks separate in data,
in code, and in copy.

Phase 1 runs with no live VA data. See `docs/product-spec.md` for scope and
`docs/phase-plan.md` for the roadmap.

## Non-negotiable rules

These exist because wrong output in a claims tool causes real harm.

1. **Never invent, alter, or reword a legal citation.** Do not add a `38 CFR`,
   `M21-1`, or statute reference unless it is supplied verbatim. If a
   suggestion needs a citation you do not have, leave a TODO and say so in the
   PR description.
2. **Never set `verified: true` on a source reference.** That flag means a
   qualified human confirmed the citation. Every new entry ships with
   `verified: false`. A test enforces this.
3. **Never use diagnostic or deterministic language.** Write "commonly explored
   alongside" or "may be relevant to", never "is caused by", "you have", or
   "you qualify for". No probabilities, no percentages, no approval odds.
4. **Never remove or weaken a disclaimer.** They appear on intake and results
   and are part of the Phase 3 compliance posture.
5. **Never persist intake free text.** The event log stores resolved condition
   names and counts only. No names, no dates of birth, no file numbers, no
   symptom text.
6. **Never edit a presumptive list, location, or date window from memory.**
   These come from va.gov and 38 CFR 3.309. Re-read the source, update
   `sourceCheckedOn`, and cite the URL you used. Getting a date wrong changes
   who the app tells a veteran they may be eligible.
7. **Never publish a draft entry.** Setting `draft: false` means the mappings
   and citations were authored and reviewed by a qualified human.

## Architecture

```
data/knowledge-base/*.json   Secondary conditions, one file per primary
data/presumptives/*.json     Exposure categories, locations, date windows
src/lib/kb/                  Zod schema, loader, lookup
src/lib/engine/              Pure recommendation logic. No I/O.
src/lib/presumptive/         Zod schema, loader, service-history matcher
src/lib/log/                 Event logging behind an EventLogger interface
src/app/                     App Router pages
src/components/              Presentational React components
tests/                       Vitest
```

Routes:

```
/                     Path chooser: secondary vs presumptive
/secondary            Secondary intake
/results              Secondary results
/presumptive          Service history intake
/presumptive/results  Presumptive results
/scenarios            Demo walkthroughs
```

Boundaries to respect:

- `src/lib/engine/` stays pure. It takes a knowledge base and an intake object
  and returns data. No filesystem, no network, no environment variables.
- Only `src/lib/kb/load.ts` and `src/lib/presumptive/load.ts` read data files
  from disk.
- `src/lib/presumptive/match.ts` stays pure, same rule as the engine.
- Swap storage by adding an `EventLogger` implementation. Never let a caller
  import `better-sqlite3` directly.
- Phase 2 VA API code belongs in a new `src/lib/va/` adapter layer. The engine
  must keep working when those calls fail.

## Conventions

- TypeScript strict. No `any`. No non-null assertions in `src/`; narrow instead.
- Validate every external input with Zod at the boundary. Never trust
  `searchParams`.
- Server Components by default. Add `"use client"` only for real interactivity.
- Named exports. Default exports only for Next.js pages and layouts.
- Tailwind utility classes inline. No CSS modules, no styled-components.
- Comments explain *why*, not *what*. Skip comments the code already states.

## Presumptive data edits

Each exposure category needs `qualifyingService` windows with ISO dates and at
least one `sourceReferences` entry carrying a public URL.

- `endDate: null` means the window is still open. Agent Orange windows are all
  closed; burn pit windows are open.
- Record any extra requirement in the condition's `qualifier`, such as a
  manifestation deadline or "diagnosed after service".
- Do not broaden a category. "Melanoma" is presumptive under burn pits; basal
  cell and squamous cell carcinoma are not. Precision here is the product.
- Bump `sourceCheckedOn` whenever you re-verify against va.gov.

## Knowledge base edits

Every entry needs `conditionId`, `condition`, `rank`, `prevalence`,
`rationale`, at least one `evidenceGaps` item, and at least one
`sourceReferences` item.

- `conditionId` is the merge key. The same clinical concept must use the same
  id and the same display label in every file. A test enforces this.
- `rank` must be unique and gapless within a file, starting at 1.
- A condition must not list itself as its own secondary.
- Changing a mapping or a citation is a substantive change. Call it out in the
  PR description so a human reviews it.

Draft entries (`draft: true`) are scaffolding awaiting human-authored mappings.
They are validated and version controlled but never surfaced in the UI. A draft
carries an empty `suggestions` array and a non-empty `todo` checklist. Fill in
the content, clear the `todo`, then set `draft: false`. Schema and tests
enforce both halves of that rule.

## Testing

- `npm test` must pass before any PR.
- Every behavior change needs a test. Bug fixes need a regression test that
  fails without the fix.
- Test behavior through the public function, not internals.
- Knowledge base changes need an integrity test if they introduce a new
  invariant.
- No snapshot tests for recommendation output. Assert the specific property
  that matters so failures explain themselves.

## Pull requests

- One concern per PR.
- Say plainly what you could not verify, especially citations.
- Never mark a checklist item complete that you did not actually do.
