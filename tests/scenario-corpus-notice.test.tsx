// @vitest-environment jsdom
/**
 * Regression for Heal `s1-scenarios-corpus-failure-hidden-1`.
 *
 * A failed condition-corpus fetch leaves every Run scenario button disabled.
 * The page must say the scenarios could not be loaded and offer a retry, not
 * leave the visitor with three greyed-out buttons and no explanation.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScenarioCorpusNotice } from "@/components/ScenarioCorpusNotice";

const { useClientCorpusMock } = vi.hoisted(() => ({
  useClientCorpusMock: vi.fn(),
}));

vi.mock("@/lib/client-corpus", () => ({
  useClientCorpus: useClientCorpusMock,
}));

beforeEach(() => {
  useClientCorpusMock.mockReset();
});

afterEach(cleanup);

describe("scenario corpus failure notice", () => {
  it("explains the failed load and offers a retry", () => {
    useClientCorpusMock.mockReturnValue({
      corpus: null,
      loading: false,
      error: "Client corpus request failed with status 500.",
    });
    const retry = vi.fn();

    render(<ScenarioCorpusNotice onRetry={retry} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Demo scenarios could not be loaded.");
    expect(alert.textContent).toContain("status 500");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders nothing once the corpus is available", () => {
    useClientCorpusMock.mockReturnValue({
      corpus: {},
      loading: false,
      error: null,
    });

    const { container } = render(<ScenarioCorpusNotice onRetry={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });
});
