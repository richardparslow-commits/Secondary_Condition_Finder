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

/**
 * Official VA host policy (audit A04, link-origin provenance).
 *
 * A credential-free HTTPS link is still an arbitrary third-party destination:
 * `https://collect.example/` passes the generic rule, and a link is the one
 * cached field a reader will click. Surfaces whose own data is expected to be
 * VA-hosted (VA Forms metadata and the single-form reference) therefore use the
 * stricter rule below. Directory records legitimately point at a VSO's or
 * attorney's own site, so they stay on `isTrustedHttpsUrl` — that divergence is
 * deliberate and is documented where each rule is applied.
 */
export const VA_OFFICIAL_LINK_REQUIREMENT =
  "must be a credential-free https URL on va.gov";

/** Registrable VA hosts; a subdomain of any of these is accepted. */
export const VA_OFFICIAL_LINK_HOSTS = ["va.gov"];

/** @param {string} raw */
export function isTrustedVaOfficialUrl(raw) {
  if (!isTrustedHttpsUrl(raw)) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return VA_OFFICIAL_LINK_HOSTS.some(
      (root) => host === root || host.endsWith(`.${root}`),
    );
  } catch {
    return false;
  }
}

// Pure validation: used by the server adapter and the one-shot operator CLI.
export const trustedHttpsUrlSchema = z.string().refine(isTrustedHttpsUrl, {
  message: TRUSTED_LINK_REQUIREMENT,
});

export const vaOfficialHttpsUrlSchema = z
  .string()
  .refine(isTrustedVaOfficialUrl, { message: VA_OFFICIAL_LINK_REQUIREMENT });

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

/**
 * VA Forms payloads are validated record by record. One malformed record (a
 * missing form name, a non-VA link) used to fail the entire array, which the
 * adapter reported as `invalid-payload` and the finder rendered as "VA Forms
 * is unavailable" even though every other record was readable. Readable
 * records are kept and the odd one is skipped. The envelope still fails
 * closed: `data` must be an array, and a non-empty array in which no record is
 * readable is rejected rather than presented as a genuine empty result.
 */
export const formsIndexSchema = z
  .object({ data: z.array(z.unknown()) })
  .passthrough()
  .transform((payload, ctx) => {
    /** @type {Array<import("zod").infer<typeof formIndexItemSchema>>} */
    const data = [];
    for (const candidate of payload.data) {
      const parsed = formIndexItemSchema.safeParse(candidate);
      if (parsed.success) data.push(parsed.data);
    }
    if (payload.data.length > 0 && data.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "No readable VA Forms records in payload",
        path: ["data"],
      });
      return z.NEVER;
    }
    return { ...payload, data };
  });

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
  totalItems: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().nonnegative().optional(),
}).passthrough();
