import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Action-level contract for cookie-budget overflow: when the sealed workflow
 * cookie exceeds MAX_WORKFLOW_COOKIE_VALUE_BYTES, the secondary server actions
 * must hold the user on their step with the specific context-too-large
 * validation redirect — never advance, never lose the last good cookie, never
 * surface a generic server failure. (The real-module encoding/budget behavior
 * is pinned in cookie-budget-contract.test.ts.)
 */

const sessionMocks = vi.hoisted(() => ({
  readSecondaryWorkflowSession: vi.fn(),
  writeSecondaryWorkflowSession: vi.fn(),
  workflowSessionToQueryParams: vi.fn(),
  clearSecondaryWorkflowSession: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({ auditLog: vi.fn() }));

vi.mock("@/lib/secondary-workflow/session", () => sessionMocks);
vi.mock("@/lib/observability/audit", () => auditMocks);

import { saveRatingsSelection } from "@/lib/actions/secondary";

describe("cookie-budget action contract (context-too-large)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.readSecondaryWorkflowSession.mockResolvedValue({
      diagnosedConditionIds: ["ptsd"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: {},
    });
    sessionMocks.workflowSessionToQueryParams.mockImplementation((state: {
      diagnosedConditionIds?: string[];
      serviceConnectedConditionIds?: string[];
    }) => ({
      diagnosed: state.diagnosedConditionIds ?? [],
      serviceConnected: state.serviceConnectedConditionIds ?? [],
    }));
  });

  it("holds the user on the ratings step with the context-too-large code on budget overflow", async () => {
    const budgetError = new Error("Secondary workflow state exceeds the safe cookie value budget.");
    budgetError.name = "WorkflowCookieBudgetError";
    sessionMocks.writeSecondaryWorkflowSession.mockRejectedValue(budgetError);

    const formData = new FormData();
    formData.set("rating-ptsd", "70");

    const outcome: { status: string; message?: string; digest?: unknown } =
      await saveRatingsSelection(formData).then(
        () => ({ status: "resolved" }),
        (error: unknown) => ({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          digest: (error as { digest?: unknown }).digest,
        }),
      );

    expect(outcome.status).toBe("error");
    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/secondary/ratings?error=context-too-large");
  });

  it("keeps the generic failure path for non-budget write errors", async () => {
    sessionMocks.writeSecondaryWorkflowSession.mockRejectedValue(
      new Error("session cookie write failed"),
    );

    const formData = new FormData();
    formData.set("rating-ptsd", "70");

    const outcome: { status: string; message?: string; digest?: unknown } =
      await saveRatingsSelection(formData).then(
        () => ({ status: "resolved" }),
        (error: unknown) => ({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          digest: (error as { digest?: unknown }).digest,
        }),
      );

    expect(outcome.status).toBe("error");
    expect(String(outcome.digest)).toContain("/secondary/ratings?error=select-rating");
    expect(auditMocks.auditLog).toHaveBeenCalledWith(
      "workflow-ratings-selected",
      expect.objectContaining({ status: "failure" }),
    );
  });
});
