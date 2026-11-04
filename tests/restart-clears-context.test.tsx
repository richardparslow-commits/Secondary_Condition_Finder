// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s1-restart-keeps-old-selections-1`.
 *
 * Restart clears every registered sessionStorage key and then navigates
 * client-side. The context store's validated snapshot is cached at module
 * scope, so removing the storage key alone left the next step reading the old
 * diagnoses. This mounts the real restart control and a real context consumer,
 * then asserts the consumer drops to empty before navigation completes.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SecondaryWorkflowCompletionActions } from "@/components/secondary/SecondaryWorkflowCompletionActions";
import { browserWorkflowContextStorageKey, writeBrowserWorkflowContext } from "@/lib/secondary-workflow/browser-context";
import {
  resetBrowserWorkflowContextSnapshot,
  useBrowserWorkflowContext,
} from "@/lib/secondary-workflow/use-browser-context";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function ContextProbe() {
  const { context, ready } = useBrowserWorkflowContext();
  return (
    <p data-testid="context">
      {ready ? (context?.diagnosedConditionIds?.join(",") ?? "empty") : "loading"}
    </p>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetBrowserWorkflowContextSnapshot();
  push.mockClear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("restart clears the cached workflow context", () => {
  it("drops the visible selections and the stored record before navigating", async () => {
    writeBrowserWorkflowContext(window.sessionStorage, {
      diagnosedConditionIds: ["ptsd", "migraine-headaches"],
    });

    render(
      <>
        <ContextProbe />
        <SecondaryWorkflowCompletionActions />
      </>,
    );

    expect(screen.getByTestId("context").textContent).toBe("ptsd,migraine-headaches");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Start a new review" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("context").textContent).toBe("empty");
    });
    expect(window.sessionStorage.getItem(browserWorkflowContextStorageKey)).toBeNull();
    expect(push).toHaveBeenCalledWith("/secondary/diagnosed");
  });
});
