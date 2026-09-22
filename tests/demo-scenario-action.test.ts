import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

/**
 * Behavioral contract for the hardened demo-scenario launch action
 * (src/lib/actions/scenarios.ts).
 *
 * The session module is mocked so each guard can be exercised in isolation;
 * `next/navigation`'s real `redirect()` is used, which throws a
 * NEXT_REDIRECT error whose digest embeds the target URL — the same
 * observation pattern as tests/cookie-budget-action-contract.test.ts.
 */
const sessionMocks = vi.hoisted(() => ({
  parseStoredSecondaryWorkflowState: vi.fn(),
  workflowSessionToQueryParams: vi.fn(),
  writeSecondaryWorkflowSession: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  parseWorkflowState: vi.fn(),
}));

vi.mock("@/lib/secondary-workflow/session", () => sessionMocks);

vi.mock("@/lib/secondary-workflow/state", () => stateMocks);

vi.mock("@/lib/catalog/load", () => ({
  loadConditionCatalog: vi.fn(() => ({}) as never),
}));

import { launchDemoScenario } from "../src/lib/actions/scenarios";

/** Observe how the action terminated: redirect (with digest), resolved, or threw. */
async function observe(
  formData: FormData,
): Promise<{ status: string; message?: string; digest?: unknown }> {
  return launchDemoScenario(formData).then(
    () => ({ status: "resolved" }),
    (error: unknown) => ({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      digest: (error as { digest?: unknown }).digest,
    }),
  );
}

function formWith(scenarioId: string | File | null): FormData {
  const formData = new FormData();
  if (scenarioId !== null) formData.set("scenarioId", scenarioId);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.parseStoredSecondaryWorkflowState.mockImplementation(
    (value: unknown) => value,
  );
  sessionMocks.workflowSessionToQueryParams.mockReturnValue({});
  sessionMocks.writeSecondaryWorkflowSession.mockResolvedValue(undefined);
  stateMocks.parseWorkflowState.mockReturnValue({});
});

describe("launchDemoScenario guardrails", () => {
  it("redirects to /scenarios for a missing, empty, or malformed scenario id", async () => {
    for (const bad of [null, "", "../etc/passwd", "UPPER-CASE", "x".repeat(81)]) {
      const outcome = await observe(formWith(bad as string));
      expect(outcome.status).toBe("error");
      expect(outcome.message).toBe("NEXT_REDIRECT");
      expect(String(outcome.digest)).toContain("/scenarios");
    }
    expect(sessionMocks.writeSecondaryWorkflowSession).not.toHaveBeenCalled();
  });

  it("never invokes the parsers when the FormData field is a File upload", async () => {
    const outcome = await observe(
      formWith(new File(["single-primary-ptsd"], "f.txt", { type: "text/plain" })),
    );

    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/scenarios");
    expect(sessionMocks.parseStoredSecondaryWorkflowState).not.toHaveBeenCalled();
    expect(sessionMocks.writeSecondaryWorkflowSession).not.toHaveBeenCalled();
  });

  it("redirects to /scenarios for an unknown scenario id", async () => {
    const outcome = await observe(formWith("no-such-scenario"));

    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/scenarios");
    expect(String(outcome.digest)).not.toContain("error=invalid_state");
    expect(sessionMocks.writeSecondaryWorkflowSession).not.toHaveBeenCalled();
  });

  it("lands on /secondary/suggestions on the happy path", async () => {
    const outcome = await observe(formWith("single-primary-ptsd"));

    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/secondary/suggestions");
    expect(sessionMocks.parseStoredSecondaryWorkflowState).toHaveBeenCalled();
    expect(sessionMocks.writeSecondaryWorkflowSession).toHaveBeenCalled();
  });

  it("routes parser throws to /scenarios?error=invalid_state, not a 500", async () => {
    sessionMocks.parseStoredSecondaryWorkflowState.mockImplementation(() => {
      throw new Error("Invalid input: expected object, received string");
    });

    const outcome = await observe(formWith("single-primary-ptsd"));

    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/scenarios?error=invalid_state");
    expect(sessionMocks.writeSecondaryWorkflowSession).not.toHaveBeenCalled();
  });

  it("routes cookie-budget write failures to /scenarios?error=invalid_state", async () => {
    sessionMocks.writeSecondaryWorkflowSession.mockRejectedValue(
      new Error("Secondary workflow state exceeds the safe cookie value budget."),
    );

    const outcome = await observe(formWith("single-primary-ptsd"));

    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain("/scenarios?error=invalid_state");
  });

  it("re-throws framework redirect errors from inside the guarded region", async () => {
    // If a guarded call redirects (the framework communicates via a thrown
    // NEXT_REDIRECT error whose digest encodes the target), the boundary
    // must re-throw it untouched — never swallow it as a generic
    // validation failure. The real redirect() is used inside the mock to
    // produce a genuine redirect error, not one simulated by message text.
    sessionMocks.workflowSessionToQueryParams.mockImplementation(() => {
      redirect("/secondary/ratings?error=boundary-probe");
    });

    const outcome = await observe(formWith("single-primary-ptsd"));

    expect(outcome.status).toBe("error");
    expect(outcome.message).toBe("NEXT_REDIRECT");
    expect(String(outcome.digest)).toContain(
      "/secondary/ratings?error=boundary-probe",
    );
    expect(String(outcome.digest)).not.toContain("error=invalid_state");
  });
});
