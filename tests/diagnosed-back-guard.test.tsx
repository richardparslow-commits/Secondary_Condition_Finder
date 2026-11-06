// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s5-diagnosed-back-wipes-ticks-1`.
 *
 * Step 1 checkboxes are uncontrolled and the browser-local context is written
 * only on Continue. Back therefore discarded any ticks without a word. The
 * guard compares the form with the saved selection and requires an explicit
 * discard decision before leaving.
 */
import React from "react";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiagnosedStep } from "@/components/secondary/steps/DiagnosedStep";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  persist: vi.fn(),
  clear: vi.fn(),
  search: new URLSearchParams(),
}));

const CONDITIONS = [
  {
    id: "ptsd",
    name: "Post-Traumatic Stress Disorder",
    aliases: [],
    bodySystem: "Mental health",
  },
  {
    id: "tinnitus",
    name: "Tinnitus",
    aliases: [],
    bodySystem: "Hearing",
  },
];

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
    corpus: { conditions: CONDITIONS, publishedMappings: [] },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/lib/secondary-workflow/use-browser-context", () => ({
  useBrowserWorkflowContext: () => ({
    context: { version: 1, diagnosedConditionIds: [] },
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

describe("leaving Step 1 with changed checkbox selections", () => {
  it("blocks Back and keeps the tick until an explicit discard", () => {
    render(<DiagnosedStep />);

    const checkbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const back = screen.getByRole("link", { name: /Back/ });
    const click = createEvent.click(back);
    fireEvent(back, click);

    expect(click.defaultPrevented).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "Your selections have not been saved.",
    );
    expect(
      screen.getByRole("link", { name: "Leave and discard" }).getAttribute("href"),
    ).toBe("/secondary");
    expect(checkbox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(checkbox.checked).toBe(true);
  });

  it("does not interrupt Back when the saved selection is unchanged", () => {
    render(<DiagnosedStep />);

    const back = screen.getByRole("link", { name: /Back/ });
    const click = createEvent.click(back);
    fireEvent(back, click);

    expect(click.defaultPrevented).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("replaces the validation entry when the fixed selection succeeds", () => {
    mocks.search = new URLSearchParams("error=select-diagnosed");
    render(<DiagnosedStep />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Step 2/ }));

    expect(mocks.persist).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/secondary/service-connected");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
