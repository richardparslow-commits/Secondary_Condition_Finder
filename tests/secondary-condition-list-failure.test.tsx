// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s1-condition-list-failure-hidden-1`.
 *
 * With saved selections, Steps 2 and 3 used to render their main forms against
 * an empty catalog: no questions, raw condition ids, and a disabled Continue,
 * with no alert. The corpus failure now short-circuits both steps before those
 * branches so the veteran sees the same "Condition list unavailable" message
 * Step 1 shows.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RatingsStep } from "@/components/secondary/steps/RatingsStep";
import { ServiceConnectedStep } from "@/components/secondary/steps/ServiceConnectedStep";

const mocks = vi.hoisted(() => ({
  persist: vi.fn(),
  clear: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/client-corpus", () => ({
  useClientCorpus: () => ({
    corpus: null,
    loading: false,
    error: "Client corpus request failed with status 500.",
  }),
}));

vi.mock("@/lib/secondary-workflow/use-browser-context", () => ({
  useBrowserWorkflowContext: () => ({
    context: {
      version: 1,
      diagnosedConditionIds: ["abdominal-migraine"],
      serviceConnectedConditionIds: ["abdominal-migraine"],
      ratingsByConditionId: {},
    },
    ready: true,
    persist: mocks.persist,
    clear: mocks.clear,
  }),
}));

afterEach(() => {
  cleanup();
  mocks.push.mockClear();
});

describe("condition-list failure is visible on Steps 2 and 3", () => {
  it("replaces the empty Step 2 form with the unavailable alert", () => {
    render(<ServiceConnectedStep />);

    expect(screen.getByText(/condition list unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/Select Your Service-Connected Conditions/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue to Step 3/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Back to diagnosed conditions/ })).toBeTruthy();
  });

  it("replaces the raw-id Step 3 form with the unavailable alert", () => {
    render(<RatingsStep />);

    expect(screen.getByText(/condition list unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/Enter Ratings for Selected Conditions/)).toBeNull();
    expect(screen.queryByText("abdominal-migraine")).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue to Step 4/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Back to service-connected status/ })).toBeTruthy();
  });
});
