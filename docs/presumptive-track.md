# Presumptive track

## Why this is separate from the knowledge base

Secondary and presumptive service connection are different legal mechanisms.

| | Secondary | Presumptive |
|---|---|---|
| Authority | 38 CFR 3.310 | 38 CFR 3.307, 3.309 |
| Turns on | An existing service-connected condition | Where and when you served |
| Needs a nexus opinion | Yes | No |
| Data | `data/knowledge-base/` | `data/presumptives/` |

Presenting a presumptive condition as a secondary would steer a veteran toward
the harder claim. A Gulf War veteran with asthma does not need a nexus opinion:
asthma diagnosed after service is presumptive for burn pit exposure. That is
why the two tracks have separate data, separate matchers, and separate screens,
with a chooser at `/` that explains the difference before either is used.

## Coverage

Two exposure categories, sourced from va.gov and 38 CFR 3.309(e) on 2026-07-27.

- **Burn pits and other airborne hazards** (PACT Act): 29 conditions, 2
  qualifying service windows, both open ended.
- **Agent Orange and other herbicides**: 19 conditions, 7 qualifying service
  windows, all closed.

## Not covered

These presumptive categories exist and are deliberately out of scope for now.
The results screen says so rather than implying the list is complete.

- Camp Lejeune contaminated water
- Radiation exposure
- Gulf War infectious diseases
- Undiagnosed illness and medically unexplained chronic multi-symptom illness
- Mustard gas and lewisite
- Former prisoners of war
- Tropical diseases
- COVID-19
- Chronic conditions manifesting within a presumptive period after service

## Matching behavior

`matchPresumptives` takes selected locations plus an optional service date
range and returns the categories whose windows overlap.

- Location match is exact against the strings in the data. No fuzzy matching.
- Dates are optional. When omitted, matches rest on location alone and the
  result sets `hasUnconfirmedDates`, which the UI surfaces explicitly.
- Overlap is inclusive at both boundaries. Service on 1990-08-02 matches a
  window opening 1990-08-02.
- Locations that match nothing are reported back, with a note that the veteran
  can still file with evidence linking the condition to service.

## What this screen does not do

It reports which presumptions **may** apply. It is not an eligibility
determination. VA also weighs discharge characterization, the diagnosis itself,
and evidence that can rebut a presumption under 38 CFR 3.307(d).

## Phase 2

The Benefits Reference Data API is the natural source to sync these lists
against, replacing the manual `sourceCheckedOn` process. The adapter belongs in
`src/lib/va/`, and `src/lib/presumptive/match.ts` must keep working when those
calls fail.
