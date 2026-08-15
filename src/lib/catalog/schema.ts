import { z } from "zod";

export const ratingReferenceSchema = z.object({
  /** Rating schedule citation, e.g. "38 CFR 4.71a". */
  citation: z.string().min(1),
  note: z.string().min(1),
  /**
   * Set true only after a qualified human has confirmed the citation. Automated
   * agents must preserve the truthful status; the schema permits future human
   * verification without requiring a data-contract migration.
   */
  verified: z.boolean(),
}).strict();

/**
 * One condition, identified once for the whole app. The catalog answers "does
 * this condition exist and what is it called". It deliberately says nothing
 * about how a condition connects to service: that is the knowledge base
 * (secondary) and the presumptive data (exposure).
 *
 * A rating schedule citation describes how VA evaluates severity. It is not
 * evidence of service connection and must never be presented as such.
 */
export const catalogConditionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  bodySystem: z.string().min(1),
  /** May be empty when no citation was supplied. Never invent one. */
  ratingSchedule: z.array(ratingReferenceSchema),
  /** Open questions a reviewer must resolve. */
  reviewNotes: z.array(z.string().min(1)),
}).strict();

export const catalogFileSchema = z.object({
  bodySystem: z.string().min(1),
  conditions: z.array(catalogConditionSchema).min(1),
}).strict();

export const conditionCatalogSchema = z.array(catalogConditionSchema);

export type RatingReference = z.infer<typeof ratingReferenceSchema>;
export type CatalogCondition = z.infer<typeof catalogConditionSchema>;
export type ConditionCatalog = z.infer<typeof conditionCatalogSchema>;
