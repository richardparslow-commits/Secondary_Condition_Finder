/**
 * Service history templates — pre-fill helper for the presumptive matcher.
 * Each template maps to authorship from data/presumptives/*.json so a reviewer
 * can cross-check. Templates never auto-submit; they only populate the form
 * state via client interaction (no cookie write until the user submits).
 */

export interface PresumptiveTemplate {
  id: string;
  label: string;
  description: string;
  locations: string[];
  serviceStart?: string;
  serviceEnd?: string;
  categoryId: string;
  authorityNote: string;
  /** Hint which fields the template touches */
  hint: string;
}

export const PRESUMPTIVE_TEMPLATES: PresumptiveTemplate[] = [
  {
    id: "pact-burn-pit-southwest-asia",
    label: "PACT Act — burn-pit Southwest Asia (Aug 1990 onward)",
    description:
      "Switches/SW Asia theater on or after 2 Aug 1990. Covers Iraq, Kuwait, Saudi Arabia, Bahrain, Qatar, UAE, Oman, Somalia and Gulf waters/airspace.",
    locations: ["Iraq", "Kuwait", "Saudi Arabia", "Bahrain", "Qatar", "United Arab Emirates", "Oman", "Persian Gulf"],
    serviceStart: "1990-08-02",
    categoryId: "burn-pits",
    authorityNote: "38 CFR 3.320 / PACT Act — burn pits & airborne hazards",
    hint: "Location + start date filled; add your exact end date.",
  },
  {
    id: "pact-burn-pit-post911",
    label: "PACT Act — post-9/11 (Afghanistan/Djibouti/Egypt/Jordan/Lebanon/Syria/Uzbekistan/Yemen)",
    description:
      "Additional PACT Act locations on or after 11 Sept 2001. Matches the same presumptive category but different qualifying window.",
    locations: ["Afghanistan", "Djibouti", "Egypt", "Jordan", "Lebanon", "Syria", "Uzbekistan", "Yemen"],
    serviceStart: "2001-09-11",
    categoryId: "burn-pits",
    authorityNote: "38 CFR 3.320 / PACT Act — post-9/11 locations",
    hint: "Location + start date filled; add your exact end date.",
  },
  {
    id: "agent-orange-vietnam",
    label: "Agent Orange — Republic of Vietnam (Jan 1962 – May 1975)",
    description:
      "Inland waterways and territorial waters within 12 nautical miles. This is the broadest herbicide window.",
    locations: ["Republic of Vietnam"],
    serviceStart: "1962-01-09",
    serviceEnd: "1975-05-07",
    categoryId: "agent-orange",
    authorityNote: "38 CFR 3.309(e) + 3.307(a)(6) — herbicide exposure",
    hint: "Full window filled — narrow to your actual dates.",
  },
  {
    id: "agent-orange-korea-dmz",
    label: "Agent Orange — Korean DMZ (Sept 1967 – Aug 1971)",
    description: "Korean Demilitarized Zone herbicide window.",
    locations: ["Korean Demilitarized Zone"],
    serviceStart: "1967-09-01",
    serviceEnd: "1971-08-31",
    categoryId: "agent-orange",
    authorityNote: "38 CFR 3.309(e) — herbicide presumption",
    hint: "Full window filled — narrow to your actual dates.",
  },
  {
    id: "agent-orange-thailand",
    label: "Agent Orange — Thailand bases (Jan 1962 – Jun 1976)",
    description: "Any U.S. or Royal Thai base, regardless of duty location on base.",
    locations: ["Thailand"],
    serviceStart: "1962-01-09",
    serviceEnd: "1976-06-30",
    categoryId: "agent-orange",
    authorityNote: "38 CFR 3.309(e) — Thailand herbicide presumption",
    hint: "Full window filled — narrow to your actual dates.",
  },
  {
    id: "agent-orange-guam-samoa",
    label: "Agent Orange — Guam / American Samoa (Jan 1962 – Jul 1980)",
    description: "Includes territorial waters.",
    locations: ["Guam", "American Samoa"],
    serviceStart: "1962-01-09",
    serviceEnd: "1980-07-31",
    categoryId: "agent-orange",
    authorityNote: "38 CFR 3.309(e) — herbicide presumption",
    hint: "Full window filled — narrow to your actual dates.",
  },
];
