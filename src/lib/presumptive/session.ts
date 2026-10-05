import { cookies } from "next/headers";

import {
  openSessionPayload,
  sealSessionPayload,
  WORKFLOW_SESSION_MAX_AGE_SECONDS,
} from "@/lib/workflow-session-crypto";
import { serviceHistorySchema, type ServiceHistory } from "./match";

const PRESUMPTIVE_COOKIE = "presumptive-workflow-v1";

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

  jar.set(
    PRESUMPTIVE_COOKIE,
    sealSessionPayload(validated, undefined, {
      maxAgeSeconds: WORKFLOW_SESSION_MAX_AGE_SECONDS,
    }),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/presumptive",
      maxAge: WORKFLOW_SESSION_MAX_AGE_SECONDS,
    },
  );
}

export async function clearPresumptiveSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: PRESUMPTIVE_COOKIE, path: "/presumptive" });
}
