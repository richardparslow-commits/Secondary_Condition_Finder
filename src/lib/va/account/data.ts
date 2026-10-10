import "server-only";

import { z } from "zod";

import { type VaAccountConfig } from "./config";
import { accountSessionKey, readAccountSession } from "./oauth";
import { type AccountStore } from "./store";
import { callVaApi, type VaApiOutcome } from "../client";

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
  | { status: "disconnected" | "unavailable" | "rate-limited" };/**
 * Maps a failed platform outcome onto this module's result vocabulary.
 *
 * The request itself belongs to `../client`, which owns the credential, the
 * deadline and the single 401 refresh-and-replay. What stays here is the policy
 * about what a failure *means* for the connection:
 *   - `unauthorized` is the end of the session: the client already refreshed and
 *     replayed once, and the refresh path invalidates the generation when it
 *     cannot complete, so there is nothing left to retry.
 *   - 403 keeps its original meaning: the platform refused this credential for
 *     this data, so the connection is invalidated (this generation only) rather
 *     than left in place to fail again.
 *   - 429 is a cooldown the platform asked for, honoured with its own
 *     `Retry-After` when present.
 */
async function failure(
  outcome: Extract<VaApiOutcome<unknown>, { ok: false }>,
  config: VaAccountConfig,
  store: AccountStore,
  handle: string,
  session: unknown,
): Promise<AccountDataResult> {
  if (outcome.status === 403) {
    // Delete only the generation used for this request; do not erase a newer
    // refresh or connection. An unreadable tombstone requires a new login.
    const key = accountSessionKey(config, handle);
    const current = await store.read(key);
    if (JSON.stringify(current) === JSON.stringify(session)) {
      await store.replace(key, session, { kind: "invalidated" }, 1);
    }
    return { status: "disconnected" };
  }
  if (outcome.status === 429) {
    const delayMs = outcome.retryAfterMs ?? 60_000;
    const bounded = Math.min(Math.max(delayMs, 1_000), 24 * 60 * 60 * 1000);
    await store.put(`cooldown:${config.service}:${config.fingerprint}`, { kind: "cooldown", until: Date.now() + bounded }, Math.ceil(bounded / 1000));
    return { status: "rate-limited" };
  }
  if (outcome.reason === "unauthorized") return { status: "disconnected" };
  return { status: "unavailable" };
}

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
  if (config.service === "ratings") {
    const outcome = await callVaApi(config, store, handle, config.apiUrl, ratingSummarySchema);
    if (outcome.ok) return { status: "connected", service: "ratings", data: outcome.data };
    return failure(outcome, config, store, handle, session);
  }
  const outcome = await callVaApi(config, store, handle, config.apiUrl, claimStatusesSchema);
  if (outcome.ok) return { status: "connected", service: "claims", data: outcome.data };
  return failure(outcome, config, store, handle, session);
}

