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

describe("workflow privacy", () => {
  it("does not propagate sensitive secondary-workflow state through URLs", () => {
    for (const file of workflowPages) {
      const source = read(file);
      expect(source).not.toContain("workflowStateToSearchParams");
      expect(source).not.toMatch(/method=["']get["']/i);
      expect(source).not.toMatch(/secondary\/(?:diagnosed|service-connected|ratings|upload|suggestions|evidence)\?[^\n]*(?:diagnosed|serviceConnected|rating-)/);
    }
  });

  it("keeps presumptive service history out of query strings", () => {
    const form = read("src/components/ServiceHistoryForm.tsx");
    const results = read("src/app/presumptive/results/page.tsx");

    expect(form).toContain("action={saveServiceHistory}");
    expect(form).not.toMatch(/method=["']get["']/i);
    expect(form).not.toContain('action="/presumptive/results"');
    expect(results).not.toContain("searchParams");
    expect(results).not.toContain("params.location");
    expect(results).not.toContain("params.serviceStart");
    expect(results).not.toContain("params.serviceEnd");
  });

  it("stores workflow state in short-lived hardened first-party cookies", () => {
    const secondary = read("src/lib/secondary-workflow/session.ts");
    const presumptive = read("src/lib/presumptive/session.ts");
    const crypto = read("src/lib/workflow-session-crypto.ts");

    for (const source of [secondary, presumptive]) {
      expect(source).toContain("httpOnly: true");
      expect(source).toContain('sameSite: "strict"');
      expect(source).toContain("30 * 60");
    }
    expect(secondary).toContain('path: "/secondary"');
    expect(presumptive).toContain('path: "/presumptive"');
    expect(crypto).toContain('createCipheriv("aes-256-gcm"');
    expect(crypto).toContain("WORKFLOW_SESSION_SECRET");
  });

  it("encrypts secondary workflow state without exposing condition IDs or ratings", () => {
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
    const parts = sealed.split(".");
    const ciphertext = Buffer.from(parts[2], "base64url");
    ciphertext[0] = ciphertext[0] ^ 0x01;
    parts[2] = ciphertext.toString("base64url");
    const tampered = parts.join(".");

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
