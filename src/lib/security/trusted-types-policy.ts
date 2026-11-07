/**
 * Trusted Types `default`-policy gate (pure decision surface).
 *
 * Production enforces `require-trusted-types-for 'script'` and allowlists
 * `default` as the one first-party fallback policy. The policy is installed by
 * `src/instrumentation-client.ts` synchronously before React hydration. The
 * framework assigns script URLs while its route loader runs, so the fallback
 * must already exist before any application code executes. Keeping the
 * decision here lets tests execute the real policy rather than pattern-match.
 *
 * - Script **URLs**: same-origin http(s) only. Same-origin is *required*, not
 *   merely tolerated — framework chunk loading assigns script URLs under
 *   `/_next/static/…` during client navigation, and those assignments reach
 *   the fallback policy for callers that do not create their own policy.
 *   The OCR worker path `/tesseract/worker.min.js` rides the same gate: all
 *   OCR entry points spawn it through `createLocalOcrWorker()` with
 *   `workerBlobURL: false`, so tesseract does not wrap the path in a Blob.
 *   `blob:`, `data:`, `javascript:`, and cross-origin URLs are refused —
 *   the blob wrapping is exactly what broke production-local OCR before that
 *   contract existed, and `worker-src 'self'` (no `blob:`) now makes such a
 *   regression fail in every browser rather than only TT-enforcing ones.
 * - Script **bodies** (`createScript`) and HTML (`createHTML`): refused
 *   outright. The app has no first-party sink for either and must never grow
 *   one silently.
 */

/** Minimal Trusted Types API surface; the DOM lib does not yet ship TT types. */
export interface TrustedTypePolicyOptions {
  createScriptURL?: (input: string) => string;
  createScript?: (input: string) => string;
  createHTML?: (input: string) => string;
}

export interface TrustedTypePolicyFactoryLike {
  defaultPolicy: unknown | null;
  createPolicy(name: string, options: TrustedTypePolicyOptions): unknown;
}

/** The page context a policy is bound to (origin + base href). */
export interface TrustedTypesTarget {
  origin: string;
  href: string;
}

/** Minimal page surface needed to install and verify the default policy. */
export interface TrustedTypesRuntime {
  trustedTypes?: TrustedTypePolicyFactoryLike;
  location: TrustedTypesTarget;
  document?: {
    documentElement?: {
      setAttribute(name: string, value: string): void;
    };
  };
}

/**
 * Whether a script URL is the same origin as the page over http(s). Relative
 * URLs resolve against the page href; anything unparseable is refused.
 */
export function isAllowedTrustedScriptUrl(input: string, target: TrustedTypesTarget): boolean {
  try {
    const url = new URL(input, target.href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return url.origin === target.origin;
  } catch {
    return false;
  }
}

/** Build the `default` policy options for a page context. */
export function buildTrustedTypesPolicyOptions(target: TrustedTypesTarget): TrustedTypePolicyOptions {
  return {
    createScriptURL(input: string): string {
      if (!isAllowedTrustedScriptUrl(input, target)) {
        throw new Error(
          `Trusted Types: refused non-same-origin script URL (${input.slice(0, 80)})`,
        );
      }
      return input;
    },
    createScript(): string {
      // The app has no first-party eval-style sink; refuse unconditionally.
      throw new Error("Trusted Types: createScript is not permitted by the default policy");
    },
    createHTML(): string {
      // The app has no first-party innerHTML-style sink; refuse unconditionally.
      throw new Error("Trusted Types: createHTML is not permitted by the default policy");
    },
  };
}

/**
 * Install the `default` policy and mark the document for ops verification.
 *
 * Must be called synchronously from the client instrumentation hook, before
 * React hydration. Failure is non-fatal: without a factory the page simply
 * runs without a fallback policy, and the readiness marker stays absent.
 */
export function installTrustedTypesDefaultPolicy(target: TrustedTypesRuntime): boolean {
  const factory = target.trustedTypes;
  if (!factory) return false;

  try {
    factory.createPolicy(
      "default",
      buildTrustedTypesPolicyOptions({
        origin: target.location.origin,
        href: target.location.href,
      }),
    );
    target.document?.documentElement?.setAttribute("data-tt-ready", "true");
    return true;
  } catch {
    return false;
  }
}
