import {
  installTrustedTypesDefaultPolicy,
  type TrustedTypesRuntime,
} from "@/lib/security/trusted-types-policy";

// Next.js runs this module after the document loads but before React hydrates
// (and before its route loader assigns script URLs). Production enforcement
// only — mirrors the CSP's development exemption.
if (process.env.NODE_ENV !== "development" && typeof window !== "undefined") {
  installTrustedTypesDefaultPolicy(window as unknown as TrustedTypesRuntime);
}
