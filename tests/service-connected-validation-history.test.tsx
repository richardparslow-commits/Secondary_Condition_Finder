// @vitest-environment jsdom
/**
 * Regression suite for the Step 2 counterpart of Heal defect
 * `s5-back-shows-stale-validation-1`.
 *
 * A failed submit pushes `/secondary/service-connected?error=...`. After the
 * visitor fixes the answers and submits again, that entry must be replaced so
 * browser Back does not restore the stale alert beside valid answers.
 */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceConnectedStep } from "@/components/secondary/steps/ServiceConnectedStep";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  persist: vi.fn(),
  clear: vi.fn(),
  search: new URLSearchParams(),
}));

const CONDITION = {
  id: "ptsd",
  name: "Post-Traumatic Stress Disorder",
  aliases: [],
  bodySystem: "Mental health",
};

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
    corpus: { conditions: [CONDITION] },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/lib/secondary-workflow/use-browser-context", () => ({
  useBrowserWorkflowContext: () => ({
    context: { version: 1, diagnosedConditionIds: [CONDITION.id] },
    ready: true,
    persist: mocks.persist,
    clear: mocks.clear,
  }),
}));

beforeEach(() => {
  mocks.search = new URLSearchParams();
  mocks.push.mockClear();
  mocks.replace.mockClear();
  mocks.persist.mockClear();
  mocks.clear.mockClear();
});

afterEach(cleanup);

describe("a Step 2 validation error is not restored after a corrected submit", () => {
  it("replaces the error entry with the next step", () => {
    mocks.search = new URLSearchParams("error=answer-service-connected");
    render(<ServiceConnectedStep />);

    fireEvent.click(screen.getByLabelText(/Yes, already service connected/i));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Step 3/ }));

    expect(mocks.persist).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/secondary/ratings");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
