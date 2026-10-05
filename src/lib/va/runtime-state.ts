import "server-only";

type RuntimeEnvironment = Record<string, string | undefined>;

const DISTRIBUTED_RUNTIME_MARKERS = [
  "VERCEL",
  "AWS_LAMBDA_FUNCTION_NAME",
  "FUNCTIONS_WORKER_RUNTIME",
  "K_SERVICE",
] as const;

/**
 * The current VA request budget and reference cache are intentionally process-local.
 * They are safe only where one process owns the runtime state. Production and known
 * serverless/distributed runtimes must fail closed until a shared coordinator exists.
 */
export function vaProcessLocalStateAllowed(
  env: RuntimeEnvironment = process.env,
): boolean {
  if (env.NODE_ENV?.trim().toLowerCase() === "production") return false;

  return !DISTRIBUTED_RUNTIME_MARKERS.some((key) => {
    const value = env[key]?.trim();
    return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
  });
}

export const VA_SHARED_STATE_REQUIRED_ERROR =
  "VA live integration is unavailable in production or distributed runtimes until a shared rate-limit/cache coordinator is configured.";

/**
 * The three deliberate VA public-reference runtime modes required by issue #287.
 *
 * `disabled` is the fail-closed default. `production` is reachable only after VA
 * grants production API access AND an operator explicitly records that grant, so
 * the #287 gate rule ("do not switch the application to VA production endpoints
 * until VA production access is granted") is enforced in code rather than prose.
 */
export type VaReferenceMode = "disabled" | "sandbox" | "production";

/** Environment selector accepted from `VA_API_ENV`. */
export type VaReferenceEnvironment = "sandbox" | "production";

/**
 * Explicit operator acknowledgement that VA has granted production API access.
 * Distinct from `VA_API_ENABLED`, which only expresses intent to make requests.
 * Requiring both prevents a single mis-set variable from pointing the public
 * reference surfaces at production endpoints or labelling data production-sourced.
 */
export const VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE =
  "VA_PRODUCTION_ACCESS_GRANTED";

export interface VaReferenceModeResolution {
  /** Consolidated tri-state mode. */
  mode: VaReferenceMode;
  /** Environment the resolved configuration targets; reflects the request even when disabled. */
  environment: VaReferenceEnvironment;
  /** True only when outbound VA requests are permitted. */
  enabled: boolean;
  /** Auditable, non-sensitive explanation of why this mode was resolved. */
  reason: string;
}

function readFlag(env: RuntimeEnvironment, key: string): boolean | undefined {
  const raw = env[key]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return undefined;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return undefined;
}

function resolveEnvironment(env: RuntimeEnvironment): VaReferenceEnvironment {
  return env.VA_API_ENV?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

/**
 * Resolve the deliberate VA public-reference runtime mode.
 *
 * Fails closed to `disabled` on any ambiguity: an unrecognised flag value, a
 * production selection without the access acknowledgement, or a production
 * selection without the service-specific production credentials. A production
 * selection is never silently downgraded to `sandbox`, because that would
 * mislabel the environment reported to users alongside the reference data.
 */
export function resolveVaReferenceMode(
  env: RuntimeEnvironment = process.env,
): VaReferenceModeResolution {
  const environment = resolveEnvironment(env);

  // Backward-compatible Phase 2 flag: VA_SANDBOX_ENABLED implies sandbox intent.
  const enabledFlag =
    readFlag(env, "VA_API_ENABLED") ??
    (environment === "sandbox" ? readFlag(env, "VA_SANDBOX_ENABLED") : undefined);

  if (enabledFlag !== true) {
    return {
      mode: "disabled",
      // Report the *requested* environment even when disabled, so operators and
      // source-status labels can distinguish "production requested but off" from
      // "sandbox requested but off" instead of silently implying sandbox.
      environment,
      enabled: false,
      reason:
        "VA public-reference access is disabled. Set VA_API_ENABLED=true (and VA_API_ENV to select the environment) to make outbound requests.",
    };
  }

  if (environment === "sandbox") {
    return {
      mode: "sandbox",
      environment: "sandbox",
      enabled: true,
      reason: "VA public-reference access is enabled against the VA sandbox environment.",
    };
  }

  if (readFlag(env, VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE) !== true) {
    return {
      mode: "disabled",
      environment: "production",
      enabled: false,
      reason:
        "VA production mode was requested but production access has not been acknowledged. " +
        `Set ${VA_PRODUCTION_ACCESS_ACKNOWLEDGEMENT_VARIABLE}=true only after VA grants the requested API access and authorizes the controlled connectivity check; keep issue #287 open until that check succeeds.`,
    };
  }

  const missingCredentials = (
    [
      ["VA_FORMS_PRODUCTION_API_KEY", "VA Forms"],
      ["VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY", "Benefits Reference Data"],
    ] as const
  )
    .filter(([key]) => !(env[key]?.trim()))
    .map(([, label]) => label);

  if (missingCredentials.length > 0) {
    return {
      mode: "disabled",
      environment: "production",
      enabled: false,
      reason:
        "VA production mode was acknowledged but service-specific production credentials are missing for: " +
        `${missingCredentials.join(", ")}. Production mode fails closed rather than falling back to sandbox URLs.`,
    };
  }

  return {
    mode: "production",
    environment: "production",
    enabled: true,
    reason:
      "VA public-reference access is enabled against the VA production environment with acknowledged production access.",
  };
}
