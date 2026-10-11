#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import {
  formsIndexSchema,
  disabilityReferenceSchema,
  serviceBranchReferenceSchema,
} from "../src/lib/va/public-reference-schemas.mjs";

export const PROBE_TIMEOUT_MS = 4_000;
export const PROBE_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const checks = [
  {
    service: "va-forms",
    url: "https://api.va.gov/services/va_forms/v0/forms?query=21-526EZ",
    key: "VA_FORMS_PRODUCTION_API_KEY",
    schema: formsIndexSchema,
  },
  {
    service: "disabilities",
    url: "https://api.va.gov/services/benefits-reference-data/v1/disabilities",
    key: "VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY",
    schema: disabilityReferenceSchema,
  },
  {
    service: "service-branches",
    url: "https://api.va.gov/services/benefits-reference-data/v1/service-branches",
    key: "VA_BENEFITS_REFERENCE_PRODUCTION_API_KEY",
    schema: serviceBranchReferenceSchema,
  },
] as const;

type Env = Record<string, string | undefined>;
interface CheckEvidence {
  service: string;
  requestId: string;
  status: number | null;
  outcome: "validated" | "http-error" | "invalid-payload" | "response-too-large" | "timeout" | "network-error";
  count?: number;
}

// No error messages, validation errors, headers, URLs, or payload fields reach
// evidence. Only the caller-generated UUID and fixed diagnostic vocabulary do.
async function readBody(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > PROBE_MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new RangeError();
  }
  if (!response.body) throw new SyntaxError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > PROBE_MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function verifyProductionReference({
  env = process.env,
  confirmed = false,
  fetchImpl = fetch,
}: { env?: Env; confirmed?: boolean; fetchImpl?: typeof fetch } = {}) {
  const evidence = {
    timestamp: new Date().toISOString(),
    scope: "controlled-production-connectivity-only",
    applicationActivated: false,
    passed: false,
    refusal: null as string | null,
    checks: [] as CheckEvidence[],
  };
  if (!confirmed || env.VA_PRODUCTION_ACCESS_GRANTED !== "true") {
    evidence.refusal = "VA grant acknowledgement and --confirm-va-production-access are required.";
    return evidence;
  }
  if ([env.VA_API_ENABLED, env.VA_SANDBOX_ENABLED].some((flag) =>
    flag !== undefined && flag.trim().toLowerCase() !== "false" && flag.trim() !== "0" && flag.trim().toLowerCase() !== "no"
  )) {
    evidence.refusal = "Keep application VA access disabled during the controlled check.";
    return evidence;
  }
  if (checks.some((check) => !env[check.key]?.trim())) {
    evidence.refusal = "Both service-specific production API keys are required; sandbox keys are never used.";
    return evidence;
  }
  // Fixed destinations only: no URL/host/query/endpoint CLI or env overrides.
  for (const check of checks) {
    const row: CheckEvidence = {
      service: check.service, requestId: randomUUID(), status: null, outcome: "network-error",
    };
    evidence.checks.push(row);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetchImpl(check.url, {
        method: "GET",
        headers: { Accept: "application/json", apikey: env[check.key]!.trim(), "X-Request-ID": row.requestId },
        redirect: "error",
        signal: controller.signal,
      });
      row.status = response.status;
      if (response.status !== 200) {
        row.outcome = "http-error";
        await response.body?.cancel();
        return evidence;
      }
      const parsed = check.schema.safeParse(await readBody(response));
      if (!parsed.success) {
        row.outcome = "invalid-payload";
        return evidence;
      }
      const rows = check.service === "va-forms" ? parsed.data.data : parsed.data.items;
      const count = Array.isArray(rows) ? rows.length : 0;
      if (count === 0) {
        row.outcome = "invalid-payload";
        return evidence;
      }
      row.outcome = "validated";
      row.count = count;
    } catch (error) {
      row.outcome = controller.signal.aborted ? "timeout"
        : error instanceof RangeError ? "response-too-large"
        : error instanceof SyntaxError ? "invalid-payload" : "network-error";
      return evidence;
    } finally {
      clearTimeout(timer);
    }
  }
  evidence.passed = true;
  return evidence;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/verify-va-production-reference.mts --confirm-va-production-access\nRequires a real VA production grant and both production keys in server-only environment variables. Does not activate the app, test the deployed runtime, or close #287.");
    return;
  }
  if (args.length !== 1 || args[0] !== "--confirm-va-production-access") {
    console.error("Refused: supply only --confirm-va-production-access after VA grants access. No endpoints or credentials are accepted as arguments.");
    process.exitCode = 1;
    return;
  }
  const evidence = await verifyProductionReference({ confirmed: true });
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Production reference check failed; no upstream details retained.");
    process.exitCode = 1;
  });
}
