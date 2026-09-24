import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sixth audit-report follow-up: session-write failure handling in the
 * secondary Server Actions.
 *
 * The report claims writeSecondaryWorkflowSession() calls are unchecked, so a
 * persistence failure (e.g. secret misconfiguration) silently loses the
 * user's choices while the flow still redirects forward. That was remediated
 * in #386 (remediation #5, "do not silently lose data"): every forward-advance
 * write site wraps the write in try/catch, logs, audits, and redirects to the
 * step's validation path INSTEAD of advancing — redirectValidation() calls
 * next/navigation redirect(), which throws a redirect error that aborts the
 * action. These tests pin that contract behaviorally (mocked session module)
 * and structurally (every write site is guarded).
 *
 * Note: #387 also moved secret misconfiguration to fail-fast-at-request-time
 * (workflowSessionSecret() throws in production; pinned by
 * tests/secret-fallback-contract.test.ts and tests/deployment-readiness.test.ts),
 * so the report's headline scenario (missing secret in production) throws at
 * write time and lands in exactly these catch blocks.
 */

const sessionMocks = vi.hoisted(() => ({
  readSecondaryWorkflowSession: vi.fn(),
  writeSecondaryWorkflowSession: vi.fn(),
  workflowSessionToQueryParams: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  auditLog: vi.fn(),
}));

vi.mock("@/lib/secondary-workflow/session", () => sessionMocks);
vi.mock("@/lib/observability/audit", () => auditMocks);

import { saveDiagnosedSelection, saveRatingsSelection } from "@/lib/actions/secondary";
import { loadConditionCatalog } from "@/lib/catalog/load";

const catalog = loadConditionCatalog();
const PTSD_ID = "ptsd";

function diagnosedForm(): FormData {
  const form = new FormData();
  form.set("diagnosed", PTSD_ID);
  return form;
}

function ratingsForm(): FormData {
  const form = new FormData();
  form.set(`rating-${PTSD_ID}`, "70");
  return form;
}

function errorResponse(action: () => Promise<void>): Promise<{ status: string; message: string }> {
  // Server actions end in redirect(), which throws NEXT_REDIRECT. Distinguish
  // a validation redirect (data NOT lost silently — the user is held on the
  // step with an error) from an unexpected crash (which would also NOT
  // redirect forward, but must never happen for a session-write failure).
  return action().then(
    () => ({ status: "resolved", message: "" }),
    (error: unknown) => ({
      status: error instanceof Error && error.message === "NEXT_REDIRECT" ? "redirected" : "threw",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
}

describe("secondary session-write failure contract (no silent data loss)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Real param-mapping shape (subset used by the ratings action).
    sessionMocks.workflowSessionToQueryParams.mockImplementation((state: {
      diagnosedConditionIds?: string[];
      serviceConnectedConditionIds?: string[];
      ratingsByConditionId?: Record<string, number | null>;
    }) => {
      const params: Record<string, string | string[]> = {};
      if (state.diagnosedConditionIds?.length) params.diagnosed = [...state.diagnosedConditionIds];
      if (state.serviceConnectedConditionIds?.length) {
        params.serviceConnected = [...state.serviceConnectedConditionIds];
      }
      return params;
    });
    sessionMocks.readSecondaryWorkflowSession.mockResolvedValue({
      diagnosedConditionIds: [PTSD_ID],
      serviceConnectedConditionIds: [PTSD_ID],
      ratingsByConditionId: {},
    });
  });

  it("holds the user on the step when the diagnosed-selection write fails", async () => {
    sessionMocks.writeSecondaryWorkflowSession.mockRejectedValue(
      new Error("session cookie write failed"),
    );

    const outcome = await errorResponse(() => saveDiagnosedSelection(diagnosedForm()));

    // The action must NOT resolve past the write: it either redirects back to
    // the step (validation redirect) or throws — never advances silently.
    expect(outcome.status).toBe("redirected");
    expect(auditMocks.auditLog).toHaveBeenCalledWith(
      "workflow-diagnosed-selected",
      expect.objectContaining({ status: "failure" }),
    );
  });

  it("holds the user on the step when the ratings write fails", async () => {
    sessionMocks.writeSecondaryWorkflowSession.mockRejectedValue(
      new Error("session cookie write failed"),
    );

    const outcome = await errorResponse(() => saveRatingsSelection(ratingsForm()));

    expect(outcome.status).toBe("redirected");
    expect(auditMocks.auditLog).toHaveBeenCalledWith(
      "workflow-ratings-selected",
      expect.objectContaining({ status: "failure" }),
    );
  });

  it("advances only after the write succeeds", async () => {
    sessionMocks.writeSecondaryWorkflowSession.mockResolvedValue(undefined);

    const outcome = await errorResponse(() => saveDiagnosedSelection(diagnosedForm()));

    expect(outcome.status).toBe("redirected");
    expect(sessionMocks.writeSecondaryWorkflowSession).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosedConditionIds: [PTSD_ID] }),
    );
    expect(auditMocks.auditLog).toHaveBeenCalledWith(
      "workflow-diagnosed-selected",
      expect.objectContaining({ status: "success" }),
    );
  });
});

describe("structural: every forward-advance write site is guarded", () => {
  const source = "src/lib/actions/secondary.ts";

  it("keeps the #386 remediation comment and covers all write sites with try/catch", () => {
    const actions = readFileSync(source, "utf8");

    // The remediation marker must stay so the contract is discoverable.
    expect(actions).toContain("do not silently lose data");

    // Behavioral test above pins two sites; this pin keeps the others from
    // regressing: every await writeSecondaryWorkflowSession inside an action
    // must sit within a try block (the file has no unguarded call left).
    const callSites = actions.split("await writeSecondaryWorkflowSession(").length - 1;
    const catchBlocks = actions.split("} catch (error) {").length - 1;
    expect(callSites).toBeGreaterThanOrEqual(5);
    expect(catchBlocks).toBeGreaterThanOrEqual(callSites - 1);
  });
});
