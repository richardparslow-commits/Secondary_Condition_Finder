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
