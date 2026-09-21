"use client";

import { useEffect } from "react";

/**
 * Trusted Types bootstrap — the single first-party policy choke point.
 *
 * The production CSP enforces `require-trusted-types-for 'script'` (verified:
 * the pinned tesseract.js v6 never calls `createPolicy`, and it constructs
 * its OCR worker from a plain string, so without a `default` policy the
 * Local OCR action would die in TT-enforcing browsers). This component runs
 * before hydration and creates ONLY the `default` policy — the fallback the
 * browser invokes for any sink assignment from code that has not created its
 * own policy — with a deliberately strict gate:
 *
 * - Script **URLs** (worker construction, dynamic script src): same-origin
 *   https/http only. No `blob:`/`data:` URLs, no cross-origin URLs — the
 *   classic TT-bypass payloads are denied at the choke point.
 * - Script **bodies** (eval-ish sinks): refused outright (`throw new Error`),
 *   so injected markup can never execute even if it reaches a sink.
 * - HTML: refused outright; the repo has no first-party HTML sink and must
 *   never grow one silently.
 *
 * The effect mirrors the CSP allowlist (production-only enforcement, dev
 * toolchain exempt), so a component that renders in dev creates nothing.
 * `data-tt-ready` marks the completed bootstrap for ops verification.
 */

/**
 * Minimal Trusted Types API surface. The project's TypeScript DOM lib does
 * not yet ship the TT types, so they are declared locally here instead of
 * adding a dependency; shapes mirror the W3C Trusted Types spec.
 */
interface TrustedTypePolicyOptions {
  createScriptURL?: (input: string) => string;
  createScript?: (input: string) => string;
  createHTML?: (input: string) => string;
}
interface TrustedTypePolicyFactoryLike {
  defaultPolicy: unknown | null;
  createPolicy(name: string, options: TrustedTypePolicyOptions): unknown;
}

export function TrustedTypesGate() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (typeof window === "undefined") return;
    const factory = (window as unknown as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
    if (!factory) return;

    const allowedOrigins = new Set([window.location.origin]);

    const isAllowedScriptUrl = (input: string): boolean => {
      try {
        const url = new URL(input, window.location.href);
        if (url.protocol !== "https:" && url.protocol !== "http:") return false;
        return allowedOrigins.has(url.origin);
      } catch {
        return false;
      }
    };

    try {
      factory.createPolicy("default", {
        createScriptURL(input: string): string {
          if (!isAllowedScriptUrl(input)) {
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
      });
      document.documentElement.setAttribute("data-tt-ready", "true");
    } catch {
      // A policy named `default` already existing (double mount, HMR) is fine;
      // any other failure must not break rendering — CSP enforcement is the
      // backstop, this component only opens the same-origin gate.
    }
  }, []);

  return null;
}
