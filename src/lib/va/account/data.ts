import "server-only";

import { z } from "zod";

import { ACCOUNT_HTTP_TIMEOUT_MS, type VaAccountConfig } from "./config";
import { parseRetryAfterMs } from "../circuit-breaker";
import { accountSessionKey, readAccountSession } from "./oauth";
import { boundedAccountJson, type AccountStore } from "./store";

const date = z.iso.date();
const rating = z.number().int().min(0).max(100);
export const ratingSummarySchema = z.object({
  data: z.object({
    attributes: z.object({
      combined_disability_rating: rating.nullable(),
      combined_effective_date: date.nullable(),
      legal_effective_date: date.nullable(),
      individual_ratings: z.array(z.object({
        decision: z.string().min(1).max(200).optional(),
        rating_percentage: rating.nullable().optional(),
        effective_date: date.nullable().optional(),
      })).max(200).nullable(),
    }),
  }),
}).transform((value) => value.data.attributes);

export const claimStatusesSchema = z.object({
  data: z.array(z.object({
    attributes: z.object({
      claim_type: z.string().min(1).max(100),
      date_filed: date,
      status: z.enum(["Claim received", "Initial review", "Evidence gathering, review, and decision", "Preparation for notification", "Complete"]),
      open: z.boolean(),
    }),
  })).max(200),
}).transform((value) => value.data.map((item) => item.attributes));

export type RatingSummary = z.infer<typeof ratingSummarySchema>;
export type ClaimStatuses = z.infer<typeof claimStatusesSchema>;
export type AccountDataResult =
  | { status: "connected"; service: "ratings"; data: RatingSummary }
  | { status: "connected"; service: "claims"; data: ClaimStatuses }
  | { status: "disconnected" | "unavailable" | "rate-limited" };

export async function loadAccountData(config: VaAccountConfig, store: AccountStore, handle: string): Promise<AccountDataResult> {
  const session = await readAccountSession(config, store, handle);
  if (!session) return { status: "disconnected" };
  const cooldownKey = `cooldown:${config.service}:${config.fingerprint}`;
  const cooldown = await store.read(cooldownKey);
  if (cooldown && typeof cooldown === "object" && "until" in cooldown &&
    typeof cooldown.until === "number" && cooldown.until > Date.now()) return { status: "rate-limited" };
  // Conservative one read per two seconds across this configured service.
  // Atomic NX admission, encrypted tombstone, TTL; no retries or PHI caching.
  if (!await store.put(`budget:${config.service}:${config.fingerprint}`, { kind: "budget" }, 2)) return { status: "rate-limited" };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ACCOUNT_HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(config.apiUrl, {
      headers: { Accept: "application/json", Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      // Delete only the generation used for this request; do not erase a newer
      // refresh or connection. An unreadable tombstone requires a new login.
      const key = accountSessionKey(config, handle);
      const current = await store.read(key);
      if (JSON.stringify(current) === JSON.stringify(session)) {
        await store.replace(key, session, { kind: "invalidated" }, 1);
      }
      return { status: "disconnected" };
    }
    if (response.status === 429) {
      const delayMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 60_000;
      const bounded = Math.min(Math.max(delayMs, 1_000), 24 * 60 * 60 * 1000);
      await store.put(cooldownKey, { kind: "cooldown", until: Date.now() + bounded }, Math.ceil(bounded / 1000));
      return { status: "rate-limited" };
    }
    if (!response.ok) return { status: "unavailable" };
    const json = await boundedAccountJson(response, 256 * 1024);
    if (config.service === "ratings") {
      const parsed = ratingSummarySchema.safeParse(json);
      return parsed.success ? { status: "connected", service: "ratings", data: parsed.data } : { status: "unavailable" };
    }
    const parsed = claimStatusesSchema.safeParse(json);
    return parsed.success ? { status: "connected", service: "claims", data: parsed.data } : { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
  finally { clearTimeout(timer); }
}

