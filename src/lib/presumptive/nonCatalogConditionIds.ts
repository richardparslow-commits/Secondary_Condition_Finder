/**
 * Presumptive conditions whose id is deliberately NOT in the main condition
 * catalog (`data/conditions/*.json`).
 *
 * The two data spaces use different granularity on purpose:
 * - The catalog models conditions as they are rated and explored for
 *   secondary-connection research (e.g. `hodgkins-lymphoma`,
 *   `diabetes-mellitus-type-2`, `skin-cancer`).
 * - The presumptive files restate VA's own exposure lists (PACT Act, Agent
 *   Orange), which group conditions differently (e.g. "Lymphoma",
 *   "Melanoma", "Type 2 diabetes mellitus").
 *
 * Any presumptive `conditionId` that does not appear in the catalog MUST be
 * listed here with a reason, and every entry here MUST still be present in
 * the presumptive data. `tests/presumptive-catalog-integrity.test.ts`
 * enforces both directions so drift has to be a deliberate, reviewed change.
 */
export const NON_CATALOG_PRESUMPTIVE_IDS: Record<string, string> = {
  chloracne:
    "Catalog does not model chloracne/acneform disease; kept to VA's Agent Orange list wording.",
  "chronic-b-cell-leukemia":
    "Catalog models leukemia unsplit; VA's Agent Orange list splits out all chronic B-cell leukemias.",
  "gastrointestinal-cancer":
    "PACT Act umbrella site grouping; catalog splits cancers by specific diagnosis.",
  glioblastoma:
    "Catalog models brain cancer as an umbrella; PACT Act separately lists glioblastoma.",
  "granulomatous-disease":
    "Not modeled in the catalog; PACT Act list term.",
  "head-cancer":
    "PACT Act umbrella site grouping; catalog splits cancers by specific diagnosis.",
  "hodgkins-disease":
    "Catalog id is hodgkins-lymphoma; Agent Orange list uses VA's 'Hodgkin's disease' grouping.",
  lymphoma:
    "Catalog splits hodgkins-lymphoma / non-hodgkins-lymphoma; PACT Act lists lymphoma generically.",
  melanoma:
    "Catalog models skin cancers together (skin-cancer); PACT Act lists melanoma separately.",
  mgus: "Not modeled in the catalog; Agent Orange list term.",
  "myelodysplastic-syndromes":
    "Not modeled in the catalog; PACT Act list term.",
  myelofibrosis: "Not modeled in the catalog; PACT Act list term.",
  "neck-cancer":
    "PACT Act umbrella site grouping; catalog splits cancers by specific diagnosis.",
  parkinsonism:
    "Not modeled in the catalog; Agent Orange list term.",
  "parkinsons-disease":
    "Not modeled in the catalog; Agent Orange list term.",
  "peripheral-neuropathy-early-onset":
    "Catalog models peripheral neuropathy broadly; Agent Orange list splits out early-onset cases.",
  pleuritis: "Not modeled in the catalog; PACT Act list term.",
  "porphyria-cutanea-tarda":
    "Not modeled in the catalog; Agent Orange list term.",
  "reproductive-cancer":
    "PACT Act umbrella site grouping; catalog splits cancers by specific diagnosis.",
  "soft-tissue-sarcoma":
    "Not modeled in the catalog; Agent Orange list term.",
  "type-2-diabetes":
    "Catalog id is diabetes-mellitus-type-2; Agent Orange list uses VA's type-2-diabetes grouping.",
  "ureter-cancer":
    "Not modeled in the catalog (catalog has kidney-cancer and bladder-cancer); PACT Act lists ureter cancer separately.",
};
