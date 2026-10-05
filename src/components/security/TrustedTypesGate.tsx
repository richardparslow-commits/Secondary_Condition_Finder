"use client";

import { useEffect } from "react";

import {
  buildTrustedTypesPolicyOptions,
  type TrustedTypePolicyFactoryLike,
} from "@/lib/security/trusted-types-policy";

/**
 * Trusted Types bootstrap mount point.
 *
 * The production CSP enforces `require-trusted-types-for 'script'` (verified:
 * the pinned tesseract.js v6 never calls `createPolicy`, and it constructs
 * its OCR worker from a plain string, so without a `default` policy the
 * Local OCR action would die in TT-enforcing browsers). This component
 * installs ONLY the `default` policy — the fallback the browser invokes for
 * any sink assignment from code that has not created its own policy.
 *
 * Installation happens in a mount effect, i.e. AFTER hydration. That is
 * deliberate, not an oversight: the only first-party script-URL sink (the
 * tesseract worker spawn, via `createLocalOcrWorker()` with
 * `workerBlobURL: false`) occurs on an explicit user action long after mount,
 * so a mount-time bootstrap is sufficient, and the policy is intentionally
 * not claimed to exist before hydration. The decision itself lives in
 * `src/lib/security/trusted-types-policy.ts` so tests execute the real policy
 * (same-origin script URLs only — framework chunks and the `/tesseract/`
 * worker ride the same gate; blob/data/cross-origin refused; createScript and
 * createHTML refused).
 *
 * The effect mirrors the CSP dev exemption (production-only enforcement), so
 * a component that renders in dev creates nothing. `data-tt-ready` marks the
 * completed bootstrap for ops verification.
 */
export function TrustedTypesGate() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (typeof window === "undefined") return;
    const factory = (window as unknown as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
    if (!factory) return;

    try {
      factory.createPolicy(
        "default",
        buildTrustedTypesPolicyOptions({
          origin: window.location.origin,
          href: window.location.href,
        }),
      );
      document.documentElement.setAttribute("data-tt-ready", "true");
    } catch {
      // A policy named `default` already existing (double mount, HMR) is fine;
      // any other failure must not break rendering — CSP enforcement is the
      // backstop, this component only opens the same-origin gate.
    }
  }, []);

  return null;
}
