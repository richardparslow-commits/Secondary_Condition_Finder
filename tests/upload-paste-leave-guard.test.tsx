// @vitest-environment jsdom
/**
 * Regression suite for Heal defect `s10-pasted-text-wiped-on-leave-1`.
 *
 * Step 4 kept pasted text only in the analyzer's React state, and its Back link
 * navigated away without a word. The text remains visible now, and Back opens
 * an explicit discard decision instead of silently dropping it.
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

import { UploadStep } from "@/components/secondary/steps/UploadStep";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  persist: vi.fn(),
  clear: vi.fn(),
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
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
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
    context: {
      version: 1,
      diagnosedConditionIds: [CONDITION.id],
      serviceConnectedConditionIds: [CONDITION.id],
      ratingsByConditionId: { [CONDITION.id]: 70 },
      permanentAndTotalConditionIds: [],
      documentsShared: false,
      medications: [],
      treatments: [],
      history: [],
      symptomIds: [],
      conditionTimeline: {},
    },
    ready: true,
    persist: mocks.persist,
    clear: mocks.clear,
  }),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.push.mockClear();
  mocks.persist.mockClear();
  mocks.clear.mockClear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function pasteText(value: string): HTMLTextAreaElement {
  const textarea = screen.getByLabelText(/Paste exact extracted text/i) as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value } });
  return textarea;
}

describe("leaving Step 4 with unanalyzed pasted text", () => {
  it("blocks Back and requires an explicit discard choice", () => {
    render(<UploadStep />);

    const textarea = pasteText("Synthetic pasted medical record text");

    expect(
      screen.getByText(
        "This pasted text has not been analyzed yet. It will be discarded if you leave this step before analyzing it.",
      ),
    ).toBeTruthy();

    const back = screen.getByRole("link", { name: /Back to Step 3/i });
    const click = createEvent.click(back);
    fireEvent(back, click);

    expect(click.defaultPrevented).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "Pasted text has not been analyzed.",
    );
    expect(
      screen.getByRole("link", { name: "Leave and discard" }).getAttribute("href"),
    ).toBe("/secondary/ratings");
    expect(textarea.value).toBe("Synthetic pasted medical record text");

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(textarea.value).toBe("Synthetic pasted medical record text");
  });

  it("does not interrupt Back when there is no unanalyzed paste", () => {
    render(<UploadStep />);

    const back = screen.getByRole("link", { name: /Back to Step 3/i });
    const click = createEvent.click(back);
    fireEvent(back, click);

    expect(click.defaultPrevented).toBe(false);
    expect(screen.queryByText(/Pasted text has not been analyzed/)).toBeNull();
  });
});
