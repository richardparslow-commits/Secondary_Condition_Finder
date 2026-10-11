import { z } from "zod";

export const TRUSTED_LINK_REQUIREMENT = "must be a credential-free https URL";

/** @param {string} raw */
export function isTrustedHttpsUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Pure validation: used by the server adapter and the one-shot operator CLI.
export const trustedHttpsUrlSchema = z.string().refine(isTrustedHttpsUrl, {
  message: TRUSTED_LINK_REQUIREMENT,
});

const formIndexItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  attributes: z.object({
    form_name: z.string().min(1),
    url: trustedHttpsUrlSchema,
    title: z.string().min(1),
    last_revision_on: z.string().nullable().optional(),
    pages: z.number().int().nonnegative().optional(),
    sha256: z.string().nullable().optional(),
    valid_pdf: z.boolean().optional(),
    deleted_at: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough();

export const formsIndexSchema = z.object({
  data: z.array(formIndexItemSchema),
}).passthrough();

export const disabilityReferenceSchema = z.object({
  items: z.array(z.object({
    id: z.number().int(),
    name: z.string().min(1),
    endDateTime: z.string().nullable().optional(),
  }).passthrough()),
  totalItems: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
}).passthrough();

export const serviceBranchReferenceSchema = z.object({
  items: z.array(z.object({
    code: z.string().min(1),
    description: z.string().min(1),
  }).passthrough()),
}).passthrough();
