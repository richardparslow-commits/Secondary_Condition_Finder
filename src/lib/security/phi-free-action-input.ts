/**
 * PHI-free Server Action input contract (HIPAA boundary).
 *
 * The accepted privacy contract (`docs/privacy-acceptance-contract-2026-10-07.md`)
 * keeps every piece of veteran health context in the browser. This module is
 * the *input* half of that boundary: a Server Action is a public POST
 * entrypoint (an action identifier is a reference, not authorization), so an
 * action that accepted clinical free text, a direct identifier, or an evidence
 * payload would put PHI on the server the moment it was invoked — no logging
 * mistake required.
 *
 * Two properties are deliberate and are pinned by
 * `tests/phi-free-action-input.test.ts`:
 *
 *   1. **Default-deny by name and by shape.** An input object is refused when
 *      it carries a PHI-shaped field *name* (`ssn`, `rawText`, `dbq…`), when it
 *      carries a key outside the declared schema (unknown keys are rejected
 *      rather than ignored), or when any string value exceeds the operational
 *      length ceiling — clinical prose and document text do not fit in the
 *      bounded fields a stateless action legitimately needs.
 *   2. **No reflection.** A refusal names at most a *canonical constant* from
 *      this module (`rating-` rather than the caller's `rating-<crafted>`) and
 *      never a value, a Zod message, or a caller-supplied key. The refusal body
 *      therefore cannot be used as a channel to echo the values the contract
 *      forbids the server from holding — the same rule the edge guard follows
 *      (`private-context-request-guard.ts`).
 *
 * Dependency-free on purpose (Zod only): it is importable from a server-action
 * module without pulling in Node built-ins, `server-only` loaders, or the
 * observability layer.
 *
 * This is the *sanctioned* way to build a new action input. The vocabulary is
 * kept in sync with the log-side blocklist by a test, so a field that must
 * never be logged can also never be accepted.
 */
import { z } from "zod";

/**
 * PHI-shaped field **names** (never values). Case-insensitive.
 *
 * Grouped by the reason the field is refused, because the groups have different
 * remediation: an identifier must be dropped from the action's interface, while
 * `rawText`-family fields mean the caller is trying to move browser-local work
 * onto the server and should keep it in the client.
 */
export const PHI_INPUT_FIELD_NAMES: readonly string[] = [
  // Direct identifiers and quasi-identifiers.
  //
  // `zip` is deliberately ABSENT while every other logged-prohibited
  // quasi-identifier is present, and that difference is pinned by
  // tests/phi-logging-boundary.test.ts rather than left to drift.
  // `searchAccreditedRepresentatives` must accept a ZIP to look up the public
  // VSO/attorney directory — the ZIP is the query, not health context — and it
  // already validates `^\d{5}$` and deliberately omits the value from its audit
  // event. It stays on the logger's blocklist (PROHIBITED_LOG_FIELDS) because it
  // is still a quasi-identifier with respect to what may be *emitted*.
  "name", "firstName", "lastName", "middleName", "patientName", "fullName",
  "ssn", "fullSsn", "last4", "dob", "dateOfBirth", "birthDate",
  "address", "streetAddress", "city", "state", "zipCode", "postalCode",
  "phone", "phoneNumber", "email", "emailAddress",
  // Clinical free text and document payloads.
  "freeText", "rawText", "rawNotes", "clinicalNotes", "notes", "narrative",
  "dbq", "dbqText", "dbqData", "diagnosisText", "symptomText", "symptomDescription",
  "evidence", "evidenceText", "documentText", "extractedText", "ocrText",
  "payload", "file", "files", "upload", "base64", "buffer", "blob", "dataUrl",
  "medications", "treatments", "history", "medicalHistory",
  // Secrets and session material (a public action must never accept these).
  "cookie", "cookies", "secret", "apiKey", "api_key", "token", "accessToken",
  "refreshToken", "authorization", "password", "session", "sessionId",
];

/**
 * Per-condition parameter families, `<prefix><conditionId>`.
 *
 * Matched by prefix because a condition id is unbounded in principle — the same
 * reason `private-context-request-guard.ts` matches the retired transports by
 * prefix rather than enumerating them. These are the retired flat transport
 * names (`rating-<id>`, `serviceConnected-<id>`, `onsetYear-<id>`,
 * `diagnosisYear-<id>`), which is exactly what a replayed or cached form
 * carries.
 */
export const PHI_INPUT_FIELD_PREFIXES: readonly string[] = [
  "rating-",
  "serviceConnected-",
  "onsetYear-",
  "diagnosisYear-",
];

/** Canonical form of every refused name, for O(1) case-insensitive matching. */
const PHI_NAME_BY_LOWER_CASE = new Map<string, string>(
  PHI_INPUT_FIELD_NAMES.map((field) => [field.toLowerCase(), field]),
);

/**
 * Default ceiling for a single string input value.
 *
 * Operational fields a stateless action legitimately needs are short: a
 * 5-digit ZIP, a radius, a condition id, an allowlisted route. Clinical prose,
 * OCR output, and pasted DBQ text are all far longer, so the ceiling refuses
 * the *shape* of PHI even when the caller renames the field to something
 * innocuous. Overridable per call when a future action justifies a longer
 * bounded field (and that justification then shows up in review).
 */
export const DEFAULT_MAX_INPUT_STRING_LENGTH = 400;

/** Why an input was refused. Stable strings for tests, logs, and redirect codes. */
export type PhiInputRefusalCode =
  | "phi-shaped-field"
  | "oversized-value";

export interface PhiInputRefusal {
  ok: false;
  code: PhiInputRefusalCode;
  /**
   * Canonical constant from this module — never caller text. Present for
   * `phi-shaped-field` (the matched field name or prefix) and for
   * `oversized-value` when the offending key is itself an allowlisted constant.
   */
  field?: string;
}

export type PhiInputResult<T> = { ok: true; data: T } | PhiInputRefusal;

/**
 * First refused field in `names`, canonicalized to a constant from this module,
 * or `null` when every name is acceptable.
 *
 * Returns the *constant*, not the caller's key: a crafted key such as
 * `rating-<script>` matches the `rating-` prefix and would otherwise be
 * reflected into a refusal. Repeated keys are reported once by the URL/form
 * parser, so the first match refuses the whole input.
 */
export function findPhiInputField(names: Iterable<string>): string | null {
  for (const name of names) {
    const lower = name.toLowerCase();
    const exact = PHI_NAME_BY_LOWER_CASE.get(lower);
    if (exact) return exact;
    const prefix = PHI_INPUT_FIELD_PREFIXES.find((candidate) =>
      lower.startsWith(candidate.toLowerCase()),
    );
    if (prefix) return prefix;
  }
  return null;
}

/**
 * Explicitly strip PHI-shaped fields from a mixed record instead of refusing
 * the whole input.
 *
 * Provided for callers that receive a *known* envelope containing both
 * operational and private keys (for example a future adapter around a legacy
 * form). Because dropping keys silently loses the signal that a private field
 * was offered at all, the removed entries are returned so the caller can log a
 * count and refuse the request — the recommended use is deliberately not to
 * continue with `data` when `removed` is non-empty.
 *
 * `removed` holds canonical constants, never caller-supplied key text.
 */
export function stripPhiFields(input: Record<string, unknown>): {
  data: Record<string, unknown>;
  removed: readonly string[];
} {
  const data: Record<string, unknown> = {};
  const removed = new Set<string>();
  for (const [key, value] of Object.entries(input)) {
    const refused = findPhiInputField([key]);
    if (refused) {
      removed.add(refused);
      continue;
    }
    data[key] = value;
  }
  return { data, removed: [...removed] };
}

/**
 * Longest string value in `input`, or `null` when every value is short enough.
 *
 * Only the *key* of the offending entry is reported, and only when the key is
 * already an accepted field name. The value is never inspected further, never
 * sliced, and never returned: a truncated fragment of clinical text is still
 * clinical text.
 */
function findOversizedValue(
  input: unknown,
  limit: number,
  depth = 0,
): { key: string | null } | null {
  if (depth > 4 || input === null || typeof input !== "object") return null;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") {
      if (value.length > limit) {
        // Report the key only when it is a plain identifier-shaped name; an
        // arbitrary caller key is not echoed.
        return { key: /^[A-Za-z0-9_-]{1,40}$/.test(key) ? key : null };
      }
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) continue;
    const nested = findOversizedValue(value, limit, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/**
 * Wrap a Server Action input shape in the PHI-free contract.
 *
 * The result is a **strict** object schema — a key outside `shape` is a
 * validation error rather than an ignored extra — refined so a PHI-shaped name
 * is refused with a precise, non-reflecting message even when a caller added it
 * to the shape by mistake.
 *
 * Usage in an action:
 *
 *   const input = sanitizeActionInput(phiFreeActionInput({
 *     conditionIds: conditionIdListSchema(),
 *   }), rawInput);
 *   if (!input.ok) return refusalFor(input);
 *   // `input.data.conditionIds` are catalog ids, bounded, PHI-free.
 */
export function phiFreeActionInput<S extends z.ZodRawShape>(shape: S) {
  return z
    .object(shape)
    .strict()
    .superRefine((value, ctx) => {
      const field = findPhiInputField(Object.keys(value as Record<string, unknown>));
      if (field) {
        ctx.addIssue({
          code: "custom",
          // The message names a constant from this module, never a value.
          message: `Server Action inputs must be PHI-free; "${field}" is a declared private field.`,
        });
      }
    });
}

/**
 * Parse an action input through a PHI-free schema, failing closed.
 *
 * Never returns a Zod error object or message: `unrecognized_keys` messages
 * quote the caller's own key names, which would make the refusal a reflection
 * channel. Callers get a stable code plus, at most, a canonical constant.
 */
export function sanitizeActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  options: { maxStringLength?: number } = {},
): PhiInputResult<T> {
  const limit = options.maxStringLength ?? DEFAULT_MAX_INPUT_STRING_LENGTH;

  // Name check first: it is the specific, actionable refusal and must win over
  // a generic schema error when both apply.
  // FormData first: it is also a non-null, non-array object, so the generic
  // branch below would match it and `Object.keys(formData)` is always empty —
  // which silently defeated the form-key check.
  let names: string[] = [];
  if (input instanceof FormData) {
    names = [...new Set(input.keys())];
  } else if (input && typeof input === "object" && !Array.isArray(input)) {
    names = Object.keys(input as Record<string, unknown>);
  }
  const field = findPhiInputField(names);
  if (field) return { ok: false, code: "phi-shaped-field", field };

  const oversized = findOversizedValue(input, limit);
  if (oversized) {
    return {
      ok: false,
      code: "oversized-value",
      ...(oversized.key ? { field: oversized.key } : {}),
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Deliberately unadorned: no issue list, no caller key, no value.
    return { ok: false, code: "phi-shaped-field" };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Bounded, id-shaped condition identifiers — the only workflow input an action
 * may legitimately receive, because the engine resolves everything else from the
 * public catalog.
 *
 * Shape is `^[a-z0-9-]+$`, matching the authored id convention
 * (`data/knowledge-base/`, `data/conditions/`), so a free-text condition *name*
 * or a pasted diagnosis cannot pass. `known` optionally pins membership to the
 * loaded catalog; when supplied, an id that is not in the catalog is refused
 * before the query reaches `src/lib/engine/`.
 */
export function conditionIdListSchema(options: {
  max?: number;
  /** Catalog ids; when supplied, membership is enforced. */
  known?: ReadonlySet<string>;
} = {}) {
  const max = options.max ?? 32;
  const base = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Condition ids are lowercase slug identifiers");
  // `.refine` on the element keeps the failure inside the array's issue path and
  // never quotes the received value back to the caller.
  const element = options.known
    ? base.refine((id) => options.known!.has(id), "Unknown condition id")
    : base;
  return z.array(element).min(1).max(max);
}

/**
 * Refusal body for a Server Action, safe to return to the browser.
 *
 * Carries a stable code and, at most, a canonical constant from this module —
 * so a crafted input can never make the response echo what it sent.
 */
export function phiInputRefusalBody(refusal: PhiInputRefusal): {
  error: string;
  code: PhiInputRefusalCode;
  field?: string;
} {
  return {
    error:
      "This action accepts sanitized, PHI-free input only. Veteran health context is processed in the browser.",
    code: refusal.code,
    ...(refusal.field ? { field: refusal.field } : {}),
  };
}
