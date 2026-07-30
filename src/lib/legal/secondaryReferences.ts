export interface LegalReference {
  id: string;
  label: string;
  citation: string;
  explanation: string;
  verified: false;
  sourceUrl?: string;
  sourceCheckedOn?: string;
  reviewNotes?: string[];
}

export const SECONDARY_LEGAL_REFERENCES: LegalReference[] = [
  {
    id: "secondary-basis",
    label: "Secondary service connection basis",
    citation: "38 CFR 3.310",
    explanation:
      "Secondary service connection addresses conditions that may be caused by, or aggravated by, an already service-connected condition.",
    verified: false,
    reviewNotes: ["TODO: Add source URL and sourceCheckedOn after qualified review."],
  },
  {
    id: "presumptive-distinction",
    label: "Presumptive distinction reference",
    citation: "38 CFR 3.307 and 3.309",
    explanation:
      "Presumptive service connection is a separate path based on qualifying service and exposure criteria.",
    verified: false,
    reviewNotes: ["TODO: Add source URL and sourceCheckedOn after qualified review."],
  },
];

export const SECONDARY_REFERENCE_BY_ID = Object.fromEntries(
  SECONDARY_LEGAL_REFERENCES.map((reference) => [reference.id, reference]),
);
