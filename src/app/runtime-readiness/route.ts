import { NextResponse } from "next/server";

import { workflowSessionRuntimeReady } from "@/lib/workflow-session-crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = workflowSessionRuntimeReady();

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks: {
        workflowSessionCrypto: ready,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
