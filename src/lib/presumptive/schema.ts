import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Dates must be ISO yyyy-mm-dd.",
});

export const presumptiveSourceSchema = z
  .object({
    citation: z.string().min(1),
    note: z.string().min(1),
    /** Public URL a reviewer can open to check the citation. */
    url: z.string().url(),
    /**
     * True only after a qualified human has confirmed the citation. Never set by
     * an automated agent, same rule as the secondary-condition knowledge base.
     */
    verified: z.boolean(),
  })
  .refine((source) => source.verified === false, {
    message: "Source references cannot be marked verified without human review",
    path: ["verified"],
  });

/**
 * A location and date window that establishes presumed exposure. Presumptive
 * service connection turns on where and when someone served, not on any other
 * service-connected condition.
 */
export const qualifyingServiceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  locations: z.array(z.string().min(1)).min(1),
  startDate: isoDate,
  /** Null means the window is still open. */
  endDate: isoDate.nullable(),
  note: z.string().nullable(),
});

export const presumptiveConditionSchema = z.object({
  conditionId: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Grouping for display, e.g. "Cancers" or "Respiratory conditions". */
  group: z.string().min(1),
  /**
   * Conditions carrying an extra requirement beyond diagnosis, such as a
   * manifestation deadline or a timing rule. Null when none applies.
   */
  qualifier: z.string().nullable(),
});

export const exposureCategorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  authority: z.string().min(1),
  summary: z.string().min(1),
  qualifyingService: z.array(qualifyingServiceSchema).min(1),
  conditions: z.array(presumptiveConditionSchema).min(1),
  sourceReferences: z.array(presumptiveSourceSchema).min(1),
  /** Date the list was last checked against the VA source. */
  sourceCheckedOn: isoDate,
});

export const exposureCatalogSchema = z.array(exposureCategorySchema);

export type PresumptiveSource = z.infer<typeof presumptiveSourceSchema>;
export type QualifyingService = z.infer<typeof qualifyingServiceSchema>;
export type PresumptiveCondition = z.infer<typeof presumptiveConditionSchema>;
export type ExposureCategory = z.infer<typeof exposureCategorySchema>;
export type ExposureCatalog = z.infer<typeof exposureCatalogSchema>;
