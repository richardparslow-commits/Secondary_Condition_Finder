/**
 * Where is this process running, and does it own its runtime state?
 *
 * This module answers a **fact** — is this process one of several, in a known
 * serverless or multi-instance runtime — and deliberately says nothing about
 * what any caller should do with the answer.
 *
 * It exists because two modules were each deriving that fact privately and
 * reaching opposite conclusions about it:
 *
 *   - `src/lib/va/runtime-state.ts` treated process-local state as unsafe and
 *     failed closed, because a per-instance VA reference cache or outbound
 *     budget can serve a **wrong** answer relative to a global guarantee.
 *   - `src/lib/rate-limiter.ts` kept per-instance buckets and called it
 *     intentional, because a per-instance limiter can only be a **weaker**
 *     guard than intended, never a wrong one.
 *
 * Both verdicts are defensible. The defect was that they rested on two private
 * copies of the same detection logic, so the two modules could silently disagree
 * about the underlying fact while each looked locally reasonable, and nothing
 * failed if one copy was edited. The fact now lives here. The policies stay with
 * the modules that own them, stated explicitly in each — see the headers of
 * `va/runtime-state.ts` and `rate-limiter.ts`, and
 * `tests/process-local-state-contract.test.ts`, which pins both the shared fact
 * and the deliberate divergence.
 *
 * Deliberately carries no `server-only` marker: `src/proxy.ts` runs in the
 * middleware runtime and the rate limiter needs this classification there.
 */

export type RuntimeEnvironment = Record<string, string | undefined>;

/**
 * Runtimes where more than one process serves traffic and would hold its own
 * copy of any in-process state.
 */
export const DISTRIBUTED_RUNTIME_MARKERS = [
  "VERCEL",
  "AWS_LAMBDA_FUNCTION_NAME",
  "FUNCTIONS_WORKER_RUNTIME",
  "K_SERVICE",
] as const;

/**
 * A marker counts as set unless it is absent or explicitly disabled. `""`,
 * `"0"`, and `"false"` are all treated as unset, because several of these
 * variables get set to a placeholder in CI images, shell profiles, and test
 * harnesses — a `VERCEL=0` must not be read as "running on Vercel".
 */
function isMarkerSet(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return (
    trimmed !== undefined &&
    trimmed !== "" &&
    trimmed !== "0" &&
    trimmed.toLowerCase() !== "false"
  );
}

/**
 * True when this process is one of several.
 *
 * `NODE_ENV=production` counts, and is checked case-insensitively, because the
 * documented deployments are Vercel and Azure Static Web Apps: in production the
 * multi-instance case must be assumed rather than disproven.
 */
export function isDistributedRuntime(
  env: RuntimeEnvironment = process.env,
): boolean {
  if (env.NODE_ENV?.trim().toLowerCase() === "production") return true;

  return DISTRIBUTED_RUNTIME_MARKERS.some((key) => isMarkerSet(env[key]));
}
