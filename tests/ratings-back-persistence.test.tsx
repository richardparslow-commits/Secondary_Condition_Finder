// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s6-ratings-back-wipes-choice-1`.
 *
 * Step 3 held a chosen rating only in component-local draft state. Leaving for
 * Step 2 unmounted the step, so returning through browser Back showed an empty
 * select and silently dropped the choice. Each change is now persisted to the
 * browser-local context immediately, while Continue still performs the full
 * step validation.
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RatingsStep } from "@/components/secondary/steps/RatingsStep";

const mocks = vi.hoisted(() => ({
  context: {
    version: 1 as const,
    diagnosedConditionIds: ["ptsd"],
    serviceConnectedConditionIds: ["ptsd"],
    ratingsByConditionId: {} as Record<string, number | null>,
  },
  persist: vi.fn(),
  clear: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}));

vi.mock("@/lib/client-corpus", () => ({
  useClientCorpus: () => ({
    corpus: {
      conditions: [
        {
          id: "ptsd",
          name: "Post-Traumatic Stress Disorder",
          aliases: [],
          bodySystem: "Mental health",
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/lib/secondary-workflow/use-browser-context", () => ({
  useBrowserWorkflowContext: () => ({
    context: mocks.context,
    ready: true,
    persist: mocks.persist,
    clear: mocks.clear,
  }),
}));

beforeEach(() => {
  mocks.context = {
    version: 1,
    diagnosedConditionIds: ["ptsd"],
    serviceConnectedConditionIds: ["ptsd"],
    ratingsByConditionId: {},
  };
  mocks.persist.mockClear();
  mocks.clear.mockClear();
  mocks.push.mockClear();
  mocks.replace.mockClear();
  mocks.search = new URLSearchParams();
});

afterEach(cleanup);

function ratingSelect(): HTMLSelectElement {
  return screen.getByLabelText(
    /Rating for Post-Traumatic Stress Disorder/i,
  ) as HTMLSelectElement;
}

describe("a Step 3 rating survives leaving and returning", () => {
  it("persists the choice and restores it when the step remounts", () => {
    const first = render(<RatingsStep />);

    fireEvent.change(ratingSelect(), { target: { value: "20" } });

    expect(mocks.persist).toHaveBeenCalledTimes(1);
    const persisted = mocks.persist.mock.calls[0]?.[0] as
      | Partial<typeof mocks.context>
      | undefined;
    expect(persisted).toMatchObject({ ratingsByConditionId: { ptsd: 20 } });
    if (!persisted) throw new Error("The rating choice was not persisted.");

    // Simulate the step having been unmounted by Back to Step 2 and restored by
    // browser Back. The persisted context is the only surviving source.
    mocks.context = { ...mocks.context, ...persisted };
    first.unmount();
    render(<RatingsStep />);

    expect(ratingSelect().value).toBe("20");
  });

  it("replaces the validation entry when the missing rating is fixed", () => {
    mocks.search = new URLSearchParams("error=select-rating");
    render(<RatingsStep />);

    fireEvent.change(ratingSelect(), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue to Step 4/ }));

    expect(mocks.replace).toHaveBeenCalledWith("/secondary/upload");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
