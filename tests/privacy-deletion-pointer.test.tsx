// @vitest-environment jsdom
/**
 * The privacy-request pointer travels with every control that clears
 * browser-local state (R-01 / B-02).
 *
 * The secondary track's Finish/restart controls carried it first
 * (`tests/workflow-completion-privacy.test.ts`). The presumptive track's
 * "Clear saved service history" control cleared this browser and said nothing
 * about the data the *application* keeps, so the one surface a visitor reaches
 * after clearing their service history was the one place the deletion right was
 * not reachable — the same omission, in the other track.
 *
 * One shared component now states the pointer for both, and this suite holds the
 * shared half (destination, distinction, no second channel) plus both call
 * sites. The presumptive half is mounted: the real results view renders the cue,
 * and the clear control still clears and then leaves, because a pointer beside a
 * control that stopped clearing would be worse than no pointer at all.
 */
import fs from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PresumptiveResults } from "@/components/presumptive/PresumptiveResults";
import { PrivacyDeletionCue } from "@/components/privacy/PrivacyDeletionCue";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_INTAKE_PATH,
} from "@/lib/privacy/intake";
import {
  presumptiveHistoryStorageKey,
  presumptiveLocalStorageKeys,
  writePresumptiveHistory,
} from "@/lib/presumptive/browser-history";
import type { ServiceHistory } from "@/lib/presumptive/match";
import { loadExposureCatalog } from "@/lib/presumptive/load";

import { expectNoBlockingA11yViolations } from "./setup/accessibility";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

afterEach(cleanup);

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const SECONDARY_CONTROLS = "src/components/secondary/SecondaryWorkflowCompletionActions.tsx";
const PRESUMPTIVE_RESULTS = "src/components/presumptive/PresumptiveResults.tsx";

const VIETNAM = "Republic of Vietnam";

const history: ServiceHistory = {
  serviceBranchCodes: ["ARMY"],
  locations: [VIETNAM],
  serviceStart: "1968-09-12",
  serviceEnd: "1971-05-24",
};

describe("the shared pointer states one deletion right for every clearing surface", () => {
  it("binds the published intake and the policy from the single-sourced constants", () => {
    const cue = readSource("src/components/privacy/PrivacyDeletionCue.tsx");

    // The route comes from the intake module — the same constant the intake
    // page's own guard pins — instead of a literal retyped here, so the
    // destination cannot drift out from under either surface.
    expect(cue).toContain('from "@/lib/privacy/intake"');
    expect(cue).toMatch(/href=\{PRIVACY_INTAKE_PATH\}/);
    expect(cue, "the intake path must stay single-sourced from @/lib/privacy/intake").not.toContain(
      'href="/privacy/request"',
    );

    // The policy stays one click away for the commitment and its exceptions.
    expect(cue).toContain('href="/privacy"');

    // The monitored mailbox is published on the intake page only; a second
    // hand-rolled channel here would be a channel nobody verified.
    expect(cue).not.toContain("mailto:");
    expect(cue).not.toContain(PRIVACY_CONTACT_EMAIL);
  });

  it("names both sides of the boundary it rests on", () => {
    const cue = readSource("src/components/privacy/PrivacyDeletionCue.tsx");
    expect(cue, "the half a clearing control performs").toMatch(/this browser/);
    expect(cue, "and the half it cannot reach").toMatch(/application/);
  });

  it("is rendered by both clearing surfaces, and neither retypes the destination", () => {
    for (const file of [SECONDARY_CONTROLS, PRESUMPTIVE_RESULTS]) {
      const source = readSource(file);
      expect(source, `${file} must render the shared cue`).toContain(
        'from "@/components/privacy/PrivacyDeletionCue"',
      );
      expect(source, `${file} must render it`).toMatch(/<PrivacyDeletionCue/);
      expect(source, `${file} must not retype the intake route`).not.toContain(
        'href="/privacy/request"',
      );
      expect(source, `${file} must not import the intake module directly`).not.toContain(
        'from "@/lib/privacy/intake"',
      );
    }
  });

  it("travels with the service-history clearing control, not merely with the page", () => {
    const results = readSource(PRESUMPTIVE_RESULTS);
    const clearControl = results.slice(results.indexOf("Clear saved service history"));
    // The cue follows the control in the rendered order, so the sentence about
    // what was just cleared is the sentence the visitor reads next.
    expect(clearControl).toContain("PrivacyDeletionCue");
    expect(clearControl).toContain(
      'clearedStatement="Clearing saved service history clears what this browser holds."',
    );
  });

  it("keeps the secondary call site's own sentence", () => {
    const controls = readSource(SECONDARY_CONTROLS);
    expect(controls).toContain(
      'clearedStatement="Finishing or restarting clears what this browser holds."',
    );
  });
});

describe("the cue renders the distinction a reader must not lose", () => {
  it("renders the presumptive sentence with the used intake and policy links", () => {
    render(
      <PrivacyDeletionCue clearedStatement="Clearing saved service history clears what this browser holds." />,
    );

    expect(screen.getByText(/Clearing saved service history clears what this browser holds\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "privacy request" }).getAttribute("href")).toBe(
      PRIVACY_INTAKE_PATH,
    );
    expect(PRIVACY_INTAKE_PATH).toBe("/privacy/request");
    expect(screen.getByRole("link", { name: "privacy policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(screen.getByText(/application itself keeps/)).toBeTruthy();
  });

  it("passes the automated WCAG 2.1 AA gate", async () => {
    const { container } = render(
      <PrivacyDeletionCue clearedStatement="Clearing saved service history clears what this browser holds." />,
    );
    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);
  });
});

describe("the presumptive results surface carries the pointer beside its clearing control", () => {
  const catalog = loadExposureCatalog();

  it("renders the pointer, and clearing still clears and then leaves", async () => {
    // The record is seeded the way the real flow writes it, before the mount:
    // the read binding caches its first snapshot.
    window.sessionStorage.clear();
    writePresumptiveHistory(window.sessionStorage, history);
    expect(window.sessionStorage.getItem(presumptiveHistoryStorageKey)).toBeTruthy();
    pushMock.mockClear();

    const { container } = render(
      <PresumptiveResults
        categories={catalog}
        crossLinkIndex={{ byTargetConditionId: {}, namesById: {} }}
        branchReference={null}
      />,
    );

    // The control and its sentence about what it does.
    const clear = screen.getByRole("button", { name: "Clear saved service history" });
    expect(
      screen.getByText(/Clearing saved service history clears what this browser holds\./),
    ).toBeTruthy();

    // The pointer, on the surface where the question is asked.
    expect(screen.getByRole("link", { name: "privacy request" }).getAttribute("href")).toBe(
      PRIVACY_INTAKE_PATH,
    );
    expect(screen.getByRole("link", { name: "privacy policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
    expect(container.textContent).toMatch(/application itself keeps/);

    // Clearing still comes first and still leaves: the pointer is an addition,
    // not a replacement for the control it travels with.
    fireEvent.click(clear);

    for (const key of presumptiveLocalStorageKeys) {
      expect(window.sessionStorage.getItem(key), `${key} must be cleared`).toBeNull();
    }
    expect(pushMock).toHaveBeenCalledWith("/presumptive");

    // New markup arrives already passing the automated portion of the gate.
    const summary = await expectNoBlockingA11yViolations(container);
    expect(summary.passes).toBeGreaterThan(0);

    window.sessionStorage.clear();
  });

  it("keeps the modified results shell free of any network or URL primitive", () => {
    const results = readSource(PRESUMPTIVE_RESULTS);
    expect(results).not.toMatch(/\bfetch\s*\(/);
    expect(results).not.toContain("sendBeacon");
    expect(results).not.toContain("document.cookie");
    expect(results).not.toMatch(/location\.search|URLSearchParams|window\.location/);
  });
});
