import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("automation and CI hardening", () => {
  it("keeps Azure preview cleanup retired and credential-free", () => {
    const source = read(".github/workflows/azure-static-web-apps-preview-cleanup.yml");

    expect(source).toContain("workflow_dispatch:");
    expect(source).not.toContain("schedule:");
    expect(source).not.toContain("cron:");
    expect(source).not.toContain("AZURE_STATIC_WEB_APPS_API_TOKEN");
    expect(source).not.toContain("Azure/static-web-apps-deploy@");
  });

  it("keeps ClickUp failure reporting metadata-only", () => {
    const source = read(".github/workflows/ci-to-clickup.yml");

    expect(source).toContain("CLICKUP_LIST_ID: ${{ secrets.CLICKUP_LIST_ID }}");
    expect(source).toContain(
      "Diagnostic logs and error excerpts remain in GitHub Actions and are not copied into ClickUp.",
    );
    expect(source).not.toContain("/logs");
    expect(source).not.toContain("ci-logs.zip");
    expect(source).not.toContain("ci-error-excerpts.txt");
  });

  it("keeps CI verification read-only while retaining diagnostics", () => {
    const source = read(".github/workflows/ci.yml");

    expect(source).toContain("permissions:\n  contents: read");
    expect(source).not.toContain("issues: write");
    expect(source).toContain("ci-diagnostic-summary.md");
    expect(source).toContain("ci-diagnostics-${{ github.run_id }}");
  });

  it("pins CI marketplace actions to immutable commits", () => {
    const source = read(".github/workflows/ci.yml");

    expect(source).toContain(
      "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
    );
    expect(source).toContain(
      "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
    );
    expect(source).toContain(
      "actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4",
    );
    expect(source).not.toMatch(/actions\/(?:checkout|setup-node|upload-artifact)@v\d+/);
  });

  it("keeps a real Chrome browser journey in the CI gate", () => {
    const workflow = read(".github/workflows/ci.yml");
    const browserJourney = read("e2e/secondary-workflow.mjs");

    expect(workflow).toContain("Run real-browser E2E workflow");
    expect(workflow).toContain("node e2e/secondary-workflow.mjs");
    expect(workflow).toContain("steps.e2e.outcome");
    expect(workflow).toContain("ci-e2e.log");
    expect(browserJourney).toContain('browserName: "chrome"');
    expect(browserJourney).toContain("chromedriver");
    expect(browserJourney).toContain("/session/${sessionId}/element");
  });

  it("bounds Chrome session startup retries without retrying browser journey failures", () => {
    const browserJourney = read("e2e/secondary-workflow.mjs");

    expect(browserJourney).toContain("const WEBDRIVER_SESSION_TIMEOUT_MS = 30_000;");
    expect(browserJourney).toContain("const WEBDRIVER_SESSION_ATTEMPTS = 2;");
    expect(browserJourney).toContain("function isTransientSessionTransportError(error)");
    expect(browserJourney).toContain(
      'error.message.startsWith("WebDriver POST /session request failed or timed out:")',
    );
    expect(browserJourney).toContain(
      "if (!isTransientSessionTransportError(error) || attempt === WEBDRIVER_SESSION_ATTEMPTS)",
    );
    expect(browserJourney).toContain("const session = await createWebDriverSession();");
    expect(browserJourney).toContain("await runJourney();");
    expect(browserJourney).not.toContain("runJourneyAttempt");
  });
});
