import { indexById } from "@/lib/catalog/lookup";
import type { ConditionCatalog } from "@/lib/catalog/schema";

import type { BrowserWorkflowContext, BrowserWorkflowContextInput } from "./browser-context";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
  parseDiagnosedSelection,
  parseDocumentsSelection,
  parseRatingsSelection,
  parseServiceConnectedSelection,
  type QueryParams,
} from "./state";
import { workflowSessionToQueryParams } from "./transport";
import type { SecondaryValidationCode } from "./validation";

/**
 * Browser-side step logic for the six-step secondary workflow (PRIV-01
 * stage 2). These functions are the client-side replacements for the retired
 * PHI-bearing Server Actions in `src/lib/actions/secondary.ts`; they keep the
 * exact validation, allowlist, draft-carry and downstream-reset semantics so
 * the migration changes where state lives, not what the wizard accepts.
 *
 * They are pure: no storage, no navigation, no React. Callers persist the
 * returned context through `browser-context.ts` and route to `next` (or render
 * the validation message for `code`). Unit-tested in
 * `tests/privacy-client-steps.test.ts`.
 */

/**
 * Outcome of persisting a successful step result. A failed write must never
 * navigate: the caller holds the user on the step with `context-too-large`
 * instead (the browser-local successor of the cookie-budget guidance).
 */
export type StepPersistenceOutcome =
  | { ok: true; next: string }
  | { ok: false; code: SecondaryValidationCode };

export type StepContextOutcome =
  | { ok: true }
  | { ok: false; code: SecondaryValidationCode };

export function persistStepContext(
  persist: (input: BrowserWorkflowContextInput) => void,
  context: BrowserWorkflowContextInput,
): StepContextOutcome {
  try {
    persist(context);
    return { ok: true };
  } catch {
    return { ok: false, code: "context-too-large" };
  }
}

export function persistStepResult(
  persist: (input: BrowserWorkflowContextInput) => void,
  result: { context: BrowserWorkflowContextInput; next: string },
): StepPersistenceOutcome {
  const outcome = persistStepContext(persist, result.context);
  return outcome.ok ? { ok: true, next: result.next } : outcome;
}

/** Redirect-target codes keep the legacy cross-step error transport intact. */
export type ClientStepResult =
  | { ok: true; context: BrowserWorkflowContextInput; next: string }
  | {
      ok: false;
      code: SecondaryValidationCode;
      /** Context to persist before showing the error (drafts must survive). */
      context?: BrowserWorkflowContextInput;
      /** Navigate here to show the error on the owning step. */
      next?: string;
    };

function toInput(context: BrowserWorkflowContext | null): BrowserWorkflowContextInput {
  if (!context) return {};
  const input: Record<string, unknown> = { ...context };
  delete input.version;
  return input as BrowserWorkflowContextInput;
}

/**
 * Merge only the fields the current step owns.
 *
 * Mirrors the retired action allowlist: a late-step submission can never
 * overpost earlier-step fields (diagnosed, serviceConnected, ratings) and
 * satisfy a self-consistent but wrong-stage validation.
 */
function appendFormData(
  params: QueryParams,
  formData: FormData,
  allowKey: (key: string) => boolean,
): QueryParams {
  const next: QueryParams = { ...params };
  const keys = new Set<string>();

  for (const [key] of formData.entries()) {
    if (allowKey(key)) keys.add(key);
  }

  for (const key of keys) {
    const values = formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
    if (values.length === 1) next[key] = values[0];
    if (values.length > 1) next[key] = values;
  }

  return next;
}

function nonEmptyValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function contextEntries(formData: FormData, key: string): string[] {
  const value = formData.get(key);
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean))];
}

function contextWithinBounds(formData: FormData): boolean {
  for (const key of ["medications", "treatments", "history"] as const) {
    const entries = contextEntries(formData, key);
    if (
      entries.length > MAX_CONTEXT_ITEMS ||
      entries.some((entry) => entry.length > MAX_CONTEXT_ITEM_LENGTH)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Step 1 — save diagnosed condition selections. Success replaces the whole
 * record with the new diagnosed list (re-entering Step 1 intentionally resets
 * downstream steps, exactly like the legacy cookie write did).
 */
export function applyDiagnosedStep(
  context: BrowserWorkflowContext | null,
  formData: FormData,
  catalog: ConditionCatalog,
): ClientStepResult {
  if (nonEmptyValues(formData, "diagnosed").length === 0) {
    return { ok: false, code: "select-diagnosed", next: "/secondary/diagnosed" };
  }

  try {
    const parsed = parseDiagnosedSelection(
      appendFormData({}, formData, (key) => key === "diagnosed"),
      catalog,
    );
    return {
      ok: true,
      context: { diagnosedConditionIds: parsed.diagnosedConditionIds },
      next: "/secondary/service-connected",
    };
  } catch {
    return { ok: false, code: "select-diagnosed", next: "/secondary/diagnosed" };
  }
}

/** Builds the yes/no answer map for the diagnosed conditions present in the form. */
function collectServiceConnectedAnswers(
  diagnosedConditionIds: string[],
  answers: Array<FormDataEntryValue | null>,
): Record<string, "yes" | "no"> {
  const draft: Record<string, "yes" | "no"> = {};
  diagnosedConditionIds.forEach((id, index) => {
    const answer = answers[index];
    if (answer === "yes" || answer === "no") {
      draft[id] = answer;
    }
  });
  return draft;
}

/**
 * Step 2 — save service-connected selections. Partial answers are preserved in
 * `serviceConnectedAnswerDraft` so the re-rendered radios keep the veteran's
 * completed answers, and an all-"no" submission persists an empty
 * service-connected list before showing the guidance.
 */
export function applyServiceConnectedStep(
  context: BrowserWorkflowContext | null,
  formData: FormData,
  catalog: ConditionCatalog,
): ClientStepResult {
  const knownConditionIds = new Set(catalog.map((condition) => condition.id));
  const diagnosedConditionIds = (context?.diagnosedConditionIds ?? []).filter((id) =>
    knownConditionIds.has(id),
  );

  if (diagnosedConditionIds.length === 0) {
    return { ok: false, code: "select-diagnosed", next: "/secondary/diagnosed" };
  }

  const answers = diagnosedConditionIds.map((id) => formData.get(`serviceConnected-${id}`));
  if (answers.some((answer) => answer !== "yes" && answer !== "no")) {
    return {
      ok: false,
      code: "answer-service-connected",
      next: "/secondary/service-connected",
      context: {
        diagnosedConditionIds,
        serviceConnectedAnswerDraft: collectServiceConnectedAnswers(
          diagnosedConditionIds,
          answers,
        ),
      },
    };
  }
  if (!answers.some((answer) => answer === "yes")) {
    return {
      ok: false,
      code: "no-service-connected",
      next: "/secondary/service-connected",
      context: {
        diagnosedConditionIds,
        serviceConnectedConditionIds: [],
        ratingsByConditionId: {},
        serviceConnectedAnswerDraft: collectServiceConnectedAnswers(
          diagnosedConditionIds,
          answers,
        ),
      },
    };
  }

  const currentParams = workflowSessionToQueryParams({
    ...toInput(context),
    diagnosedConditionIds,
  });
  delete currentParams.serviceConnected;
  const diagnosedIdSet = new Set(diagnosedConditionIds);

  try {
    const parsed = parseServiceConnectedSelection(
      appendFormData(
        currentParams,
        formData,
        (key) =>
          key === "serviceConnected" ||
          (key.startsWith("serviceConnected-") &&
            diagnosedIdSet.has(key.slice("serviceConnected-".length))),
      ),
      catalog,
    );
    return {
      ok: true,
      context: {
        diagnosedConditionIds: parsed.diagnosedConditionIds,
        serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
        ratingsByConditionId: {},
      },
      next: "/secondary/ratings",
    };
  } catch {
    return { ok: false, code: "answer-service-connected", next: "/secondary/service-connected" };
  }
}

/**
 * Step 3 — save disability ratings. Every service-connected condition must
 * carry an answer (`decline` or a whole number 0–100), mirroring the retired
 * action's field loop plus parse.
 */
export function applyRatingsStep(
  context: BrowserWorkflowContext | null,
  formData: FormData,
  catalog: ConditionCatalog,
): ClientStepResult {
  const serviceConnectedConditionIds = context?.serviceConnectedConditionIds ?? [];

  if (serviceConnectedConditionIds.length === 0) {
    return { ok: false, code: "no-service-connected", next: "/secondary/service-connected" };
  }

  for (const id of serviceConnectedConditionIds) {
    const value = formData.get(`rating-${id}`);
    if (typeof value !== "string" || value === "") {
      return { ok: false, code: "select-rating", next: "/secondary/ratings" };
    }
    if (value !== "decline") {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 0 || rating > 100) {
        return { ok: false, code: "invalid-rating", next: "/secondary/ratings" };
      }
    }
  }

  const serviceConnectedIdSet = new Set(serviceConnectedConditionIds);
  try {
    const parsed = parseRatingsSelection(
      appendFormData(
        workflowSessionToQueryParams(toInput(context)),
        formData,
        (key) =>
          key.startsWith("rating-") &&
          serviceConnectedIdSet.has(key.slice("rating-".length)),
      ),
      catalog,
    );
    return {
      ok: true,
      context: {
        diagnosedConditionIds: parsed.diagnosedConditionIds,
        serviceConnectedConditionIds: parsed.serviceConnectedConditionIds,
        ratingsByConditionId: parsed.ratingsByConditionId,
      },
      next: "/secondary/upload",
    };
  } catch {
    return { ok: false, code: "invalid-rating", next: "/secondary/ratings" };
  }
}

const DOCUMENTS_CONTEXT_KEYS = new Set([
  "documentsShared",
  "medications",
  "treatments",
  "history",
  "symptomIds",
]);

/**
 * Step 4 — save document availability, bounded context (medications,
 * treatments, history), symptom prompts and chronology. Bounds are checked
 * before parsing so oversized entries surface as `invalid-context` instead of
 * being silently truncated.
 */
export function applyDocumentsStep(
  context: BrowserWorkflowContext | null,
  formData: FormData,
  catalog: ConditionCatalog,
): ClientStepResult {
  const documentsShared = formData.get("documentsShared");
  if (documentsShared !== "yes" && documentsShared !== "no") {
    return { ok: false, code: "select-documents" };
  }
  if (!contextWithinBounds(formData)) {
    return { ok: false, code: "invalid-context" };
  }

  const diagnosedIdSet = new Set(context?.diagnosedConditionIds ?? []);
  if (diagnosedIdSet.size === 0) {
    return { ok: false, code: "select-diagnosed", next: "/secondary/diagnosed" };
  }

  try {
    const parsed = parseDocumentsSelection(
      appendFormData(workflowSessionToQueryParams(toInput(context)), formData, (key) => {
        if (DOCUMENTS_CONTEXT_KEYS.has(key)) return true;
        const timelineMatch = /^(?:onsetYear|diagnosisYear)-(.+)$/.exec(key);
        return timelineMatch !== null && diagnosedIdSet.has(timelineMatch[1]);
      }),
      catalog,
    );
    return { ok: true, context: parsed, next: "/secondary/suggestions" };
  } catch {
    return { ok: false, code: "invalid-context" };
  }
}

/** Exposes the same bounded-entry reader the upload step form uses. */
export { contextEntries };

export type { BrowserWorkflowContext, BrowserWorkflowContextInput };
