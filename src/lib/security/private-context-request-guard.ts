/**
 * PRIV-01 request guard — refuse a server request that carries veteran health
 * context.
 *
 * The accepted contract (`docs/privacy-acceptance-contract-2026-10-07.md`) is
 * that all veteran health context stays in the browser: diagnoses,
 * service-connected selections, ratings, chronology, medications, treatments,
 * history, symptoms and uploaded evidence. Before PRIV-01 those values reached
 * the server as flat form/query fields (`diagnosed`, `serviceConnected`,
 * `rating-<id>`, `onsetYear-<id>`, …) parsed by
 * `src/lib/secondary-workflow/state.ts`; the workflow now lives entirely in
 * the browser and no server loader reads them.
 *
 * "Nothing reads it any more" is not the same as "the server refuses it". This
 * module is the refusal: the edge proxy (`src/proxy.ts`) answers a request that
 * presents a private context parameter — on **any** path, because the contract's
 * prohibited flow names no route — or that uses a write method on the workflow
 * paths, with a 400 before any loader runs. Two properties matter and are pinned
 * by tests:
 *
 *   1. **No value is ever echoed.** The refusal names at most the offending
 *      *parameter name*, which is a fixed constant from this list — never its
 *      value, which is the private part.
 *   2. **The list is derived from, and pinned to, the data model.** Every field
 *      of the browser-local record (`browser-context.ts`) and every retired
 *      transport field name (`state.ts`) is covered, so adding a private field
 *      without extending this guard fails the test suite rather than silently
 *      reopening a server path.
 *
 * Dependency-free on purpose: this runs in the edge proxy next to
 * `api-route-policies.ts` and `rate-limiter.ts`, which must not pull in Node
 * APIs or server-only modules.
 */

/**
 * The workflow's route area. These paths are read-only for a visitor: the step
 * pages are uniform shells that render client steps, so a write method here is
 * a retired Server Action transport or a crafted replay, not a legitimate
 * interaction.
 */
export const RETIRED_WORKFLOW_PATH_PREFIX = "/secondary";

/**
 * Exact private parameter names, in two groups:
 *
 * - the record's own field names (`browser-context.ts`), which are what a
 *   naive future transport would reach for; and
 * - the retired flat transport names (`state.ts`), which is what a stale
 *   browser bookmark, a cached form, or a replayed request still carries.
 */
export const PRIVATE_CONTEXT_PARAMETER_NAMES: readonly string[] = [
  // Browser-local record fields.
  "diagnosedConditionIds",
  "serviceConnectedConditionIds",
  "serviceConnectedAnswerDraft",
  "ratingsByConditionId",
  "documentsShared",
  "medications",
  "treatments",
  "history",
  "symptomIds",
  "conditionTimeline",
  // Retired flat transport fields.
  "diagnosed",
  "serviceConnected",
];

/**
 * Per-condition parameter families, each `<prefix><conditionId>`. The retired
 * helpers built exactly these names (`ratingFieldName`, `timelineField`, and
 * `serviceConnected-<id>`), and a condition id is unbounded in principle, so
 * these are matched by prefix rather than enumerated.
 */
export const PRIVATE_CONTEXT_PARAMETER_PREFIXES: readonly string[] = [
  "rating-",
  "serviceConnected-",
  "onsetYear-",
  "diagnosisYear-",
];

/** Reasons a workflow request is refused. Stable strings for tests and logs. */
export type PrivateContextRefusalCode =
  | "private-context-parameter"
  | "retired-workflow-write";

export interface PrivateContextRefusal {
  status: 400;
  code: PrivateContextRefusalCode;
  /**
   * The offending parameter *name* (always one of the constants above) when the
   * refusal is name-based. Never a parameter value and never free text from the
   * request.
   */
  parameter?: string;
}

/** True for `/secondary` and everything beneath it. */
export function isRetiredWorkflowPath(pathname: string): boolean {
  return (
    pathname === RETIRED_WORKFLOW_PATH_PREFIX ||
    pathname.startsWith(`${RETIRED_WORKFLOW_PATH_PREFIX}/`)
  );
}

function isPrivateContextParameter(name: string): boolean {
  return (
    PRIVATE_CONTEXT_PARAMETER_NAMES.includes(name) ||
    PRIVATE_CONTEXT_PARAMETER_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

/**
 * First parameter name in `names` that carries private context, or `null`.
 * Repeated keys are reported once by the URL parser, so the first match is
 * enough to refuse the whole request.
 */
export function findPrivateContextParameter(
  names: Iterable<string>,
): string | null {
  for (const name of names) {
    if (isPrivateContextParameter(name)) return name;
  }
  return null;
}

/**
 * Methods the browser-local workflow legitimately uses. `OPTIONS` is included
 * because a preflight carries no context and must stay answerable; everything
 * else on a workflow path is a retired write transport.
 */
const READ_ONLY_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Decide whether to refuse `method pathname` with query parameter names
 * `parameterNames`. Returns `null` when the request is allowed, so the caller
 * keeps a single choke point and there is no default-to-refuse path that a
 * mistake in this list could turn into an app-wide outage.
 *
 * The two rules have deliberately different scopes:
 *
 * - a private context **parameter** is refused on every path, because the
 *   contract's first prohibited flow ("Server Actions, route handlers or API
 *   endpoints receiving any field above") names no route — so a future route
 *   cannot silently reopen a server path for these values; and
 * - a **write method** is refused only inside the workflow area, since those
 *   pages are read-only shells now while other tracks (presumptive service
 *   history, accredited representatives) legitimately POST Server Actions.
 */
export function guardPrivateContextRequest(
  method: string,
  pathname: string,
  parameterNames: Iterable<string>,
): PrivateContextRefusal | null {
  const parameter = findPrivateContextParameter(parameterNames);
  if (parameter) {
    return { status: 400, code: "private-context-parameter", parameter };
  }

  if (
    isRetiredWorkflowPath(pathname) &&
    !READ_ONLY_METHODS.has(method.toUpperCase())
  ) {
    return { status: 400, code: "retired-workflow-write" };
  }

  return null;
}

/**
 * Refusal body. Deliberately carries no request content beyond the offending
 * constant parameter name, so the response cannot become a reflection channel
 * for the values the contract forbids the server from holding.
 */
export function privateContextRefusalBody(refusal: PrivateContextRefusal): {
  error: string;
  code: PrivateContextRefusalCode;
  parameter?: string;
} {
  return {
    error:
      "This request carried private workflow context and was refused. Veteran health context is processed in the browser only.",
    code: refusal.code,
    ...(refusal.parameter ? { parameter: refusal.parameter } : {}),
  };
}
