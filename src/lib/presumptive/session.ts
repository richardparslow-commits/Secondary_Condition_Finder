import { cookies } from "next/headers";

import {
  openSessionPayload,
  sealSessionPayload,
} from "@/lib/workflow-session-crypto";
import { serviceHistorySchema, type ServiceHistory } from "./match";

const PRESUMPTIVE_COOKIE = "presumptive-workflow-v1";
const PRESUMPTIVE_MAX_AGE_SECONDS = 30 * 60;

export async function readPresumptiveSession(): Promise<ServiceHistory | null> {
  const jar = await cookies();
  const raw = jar.get(PRESUMPTIVE_COOKIE)?.value;
  if (!raw) return null;

  try {
    return serviceHistorySchema.parse(openSessionPayload(raw));
  } catch {
    return null;
  }
}

export async function writePresumptiveSession(
  history: ServiceHistory,
): Promise<void> {
  const jar = await cookies();
  const validated = serviceHistorySchema.parse(history);

  jar.set(PRESUMPTIVE_COOKIE, sealSessionPayload(validated), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/presumptive",
    maxAge: PRESUMPTIVE_MAX_AGE_SECONDS,
  });
}

export async function clearPresumptiveSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PRESUMPTIVE_COOKIE);
}
