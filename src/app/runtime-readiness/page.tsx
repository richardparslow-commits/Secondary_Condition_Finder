import { workflowSessionRuntimeReady } from "@/lib/workflow-session-crypto";

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
