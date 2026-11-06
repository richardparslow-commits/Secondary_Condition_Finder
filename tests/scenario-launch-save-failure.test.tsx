// @vitest-environment jsdom
/**
 * Regression for Heal `s2-refused-scenario-save-erases-review-1`.
 *
 * The launcher used to clear the open review before persisting the scenario.
 * When browser storage refused the write, the old context and checklist were
 * already gone. The launch now persists first and only clears auxiliary state
 * after the scenario is safely stored.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import scenarios from "../data/demo-scenarios.json";
import { ScenarioLaunchForm } from "@/components/ScenarioLaunchForm";
import {
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
  type BrowserWorkflowContextInput,
} from "@/lib/secondary-workflow/browser-context";
import { pathwayRecordChecklistStorageKey } from "@/lib/secondary-workflow/local-state";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  persist: vi.fn(),
  useClientCorpus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/client-corpus", () => ({
  useClientCorpus: mocks.useClientCorpus,
}));

vi.mock("@/lib/secondary-workflow/use-browser-context", () => ({
  useBrowserWorkflowContext: () => ({ persist: mocks.persist }),
}));

const scenario = scenarios[0]!;
const conditionIds = [
  ...new Set(
    scenarios.flatMap((candidate) => candidate.workflow.diagnosedConditionIds),
  ),
];
const corpus = { conditions: conditionIds.map((id) => ({ id })) };

const oldContext: BrowserWorkflowContextInput = {
  diagnosedConditionIds: ["ptsd"],
  serviceConnectedConditionIds: ["ptsd"],
  ratingsByConditionId: { ptsd: 70 },
};

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.push.mockReset();
  mocks.persist.mockReset();
  mocks.useClientCorpus.mockReset();
  mocks.useClientCorpus.mockReturnValue({ corpus, loading: false, error: null });
  writeBrowserWorkflowContext(window.sessionStorage, oldContext);
  window.sessionStorage.setItem(pathwayRecordChecklistStorageKey, "old checklist");
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("scenario launch persistence", () => {
  it("keeps the existing review when the scenario cannot be saved", () => {
    mocks.persist.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    render(<ScenarioLaunchForm scenarioId={scenario.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Run scenario" }));

    expect(screen.getByRole("alert").textContent).toMatch(/could not be saved/i);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(readBrowserWorkflowContext(window.sessionStorage)).toEqual({
      ...oldContext,
      version: 1,
    });
    expect(
      window.sessionStorage.getItem(pathwayRecordChecklistStorageKey),
    ).toBe("old checklist");
  });

  it("saves the scenario before clearing supporting state", () => {
    mocks.persist.mockImplementation((input: BrowserWorkflowContextInput) => {
      writeBrowserWorkflowContext(window.sessionStorage, input);
    });

    render(<ScenarioLaunchForm scenarioId={scenario.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Run scenario" }));

    const saved = readBrowserWorkflowContext(window.sessionStorage);
    expect(saved?.diagnosedConditionIds).toEqual(
      scenario.workflow.diagnosedConditionIds,
    );
    expect(
      window.sessionStorage.getItem(pathwayRecordChecklistStorageKey),
    ).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith("/secondary/suggestions");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
