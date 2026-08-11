import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  openWorkflowState,
  sealWorkflowState,
} from "@/lib/secondary-workflow/session";

const workflowPages = [
  "src/app/secondary/diagnosed/page.tsx",
  "src/app/secondary/service-connected/page.tsx",
  "src/app/secondary/ratings/page.tsx",
  "src/app/secondary/upload/page.tsx",
  "src/app/secondary/suggestions/page.tsx",
  "src/app/secondary/evidence/page.tsx",
];

const TEST_SECRET = "test-secondary-workflow-session-secret-32-plus-characters";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("secondary workflow privacy", () => {
  it("does not propagate sensitive workflow state through URLs", () => {
    for (const file of workflowPages) {
      const source = read(file);
      expect(source).not.toContain("workflowStateToSearchParams");
      expect(source).not.toMatch(/method=["']get["']/i);
      expect(source).not.toMatch(/secondary\/(?:diagnosed|service-connected|ratings|upload|suggestions|evidence)\?[^\n]*(?:diagnosed|serviceConnected|rating-)/);
    }
  });

  it("stores workflow state in a short-lived hardened first-party cookie", () => {
    const source = read("src/lib/secondary-workflow/session.ts");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain('sameSite: "strict"');
    expect(source).toContain('path: "/secondary"');
    expect(source).toContain("30 * 60");
    expect(source).toContain('createCipheriv("aes-256-gcm"');
  });

  it("encrypts workflow state without exposing condition IDs or ratings", () => {
    const state = {
      diagnosedConditionIds: ["ptsd", "sleep-apnea"],
      serviceConnectedConditionIds: ["ptsd"],
      ratingsByConditionId: { ptsd: 100 },
      documentsShared: true,
    };

    const sealed = sealWorkflowState(state, TEST_SECRET);

    expect(sealed).not.toContain("ptsd");
    expect(sealed).not.toContain("sleep-apnea");
    expect(sealed).not.toContain("100");
    expect(openWorkflowState(sealed, TEST_SECRET)).toEqual(state);
  });

  it("rejects tampered or incorrectly keyed workflow cookies", () => {
    const sealed = sealWorkflowState(
      { diagnosedConditionIds: ["ptsd"] },
      TEST_SECRET,
    );
    const tampered = `${sealed.slice(0, -1)}${sealed.endsWith("A") ? "B" : "A"}`;

    expect(openWorkflowState(tampered, TEST_SECRET)).toBeNull();
    expect(
      openWorkflowState(
        sealed,
        "different-test-secondary-workflow-secret-32-plus-characters",
      ),
    ).toBeNull();
  });

  it("disables automatic telemetry route and network tracking", () => {
    const source = read("src/lib/appInsights.ts");
    expect(source).toContain("enableAutoRouteTracking: false");
    expect(source).toContain("disableAjaxTracking: true");
    expect(source).toContain("disableFetchTracking: true");
  });
});
