import type { Metadata } from "next";

import { workflowSessionRuntimeReady } from "@/lib/workflow-session-crypto";

// Same rule as /scenarios: a shipped route either titles itself or inherits a
// declared route-group title. Declared in `scripts/lib/public-routes.mjs`.
export const metadata: Metadata = {
  title: "Runtime Readiness | Secondary Condition Finder",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RuntimeReadinessPage() {
  const ready = workflowSessionRuntimeReady();
  const status = ready ? "ready" : "not_ready";

  return (
    <main data-runtime-readiness={status}>
      <h1>Runtime readiness</h1>
      <p>Workflow-session crypto: {status}</p>
    </main>
  );
}
