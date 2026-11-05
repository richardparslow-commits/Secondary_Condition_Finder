// @vitest-environment jsdom
/**
 * Regression for Heal defect `s4-offline-connect-blames-consent-1`.
 *
 * A rejected connect request means the browser never reached the connection
 * service. The visitor already ticked consent, so the alert must name the lost
 * connection instead.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SandboxConnectForm } from "@/components/va-account/SandboxConnectForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("sandbox connect form", () => {
  it("reports a lost connection instead of blaming consent", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    render(<SandboxConnectForm service="ratings" />);

    fireEvent.click(screen.getByRole("checkbox"));
    const form = screen
      .getByRole("button", { name: "Connect sandbox ratings" })
      .closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("connection could not be reached");
    expect(alert.textContent).toContain("internet connection");
    expect(alert.textContent).not.toContain("consent");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
