import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

const workflow = read(".github/workflows/secret-scan.yml");
const config = read(".gitleaks.toml");
const ignore = read(".gitleaksignore");
const readme = read("README.md");
const securityOperations = read("docs/security-operations.md");
const healthRoute = read("src/app/api/health/route.ts");

/** Every action reference must be a 40-character commit, not a tag. */
function actionRefs(source: string): string[] {
  return [...source.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
}

function filesUnder(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(relative);
    return entry.isFile() ? [relative] : [];
  });
}

describe("secret scan — gitleaks over the full history", () => {
  it("runs on pull requests, main pushes, and by hand", () => {
    expect(workflow).toContain("name: Secret scan");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("branches:\n      - main");
    expect(workflow).toContain("workflow_dispatch:");
    // No schedule: a scheduled gate that fails must be able to open a tracking
    // issue (tests/sast-monitor-handoff.test.ts), and this gate's failure signal
    // is the check on the change that introduced the finding.
    expect(workflow).not.toContain("schedule:");
    // Read-only token: the scan never writes to the repository.
    expect(workflow).toMatch(/permissions:\n  contents: read/);
    expect(workflow).not.toContain("continue-on-error");
  });

  it("checks out the whole history, because a diff-only scan cannot see a committed key", () => {
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).not.toMatch(/fetch-depth:\s*1\b/);
    // The scan is over commits, not over the working directory.
    expect(workflow).toContain("/tmp/gitleaks git");
    expect(workflow).not.toContain("gitleaks dir");
  });

  it("pins the scanner version and verifies the published artefact checksum", () => {
    // A floating scanner version silently changes the rule set; a tag-pinned
    // action does too. The binary is downloaded and hashed instead.
    expect(workflow).toContain('GITLEAKS_VERSION: "8.30.1"');
    expect(workflow).toContain(
      'GITLEAKS_LINUX_X64_SHA256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"',
    );
    expect(workflow).toContain("sha256sum --check --strict");
    expect(workflow).toContain("gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz");
    for (const ref of actionRefs(workflow)) {
      expect(ref, `unpinned action: ${ref}`).toMatch(/^[^@]+@[0-9a-f]{40}$/);
    }
  });

  it("redacts findings and keeps the report as failure evidence", () => {
    expect(workflow).toContain("--redact");
    expect(workflow).toContain("--exit-code 1");
    expect(workflow).toContain("--report-path gitleaks-report.json");
    expect(workflow).toMatch(/if: failure\(\)/);
    expect(workflow).toContain("path: gitleaks-report.json");
  });

  it("extends the scanner's own rules instead of replacing or disabling them", () => {
    expect(config).toContain("[extend]\nuseDefault = true");
    expect(config).not.toContain("useDefault = false");
    expect(config).not.toContain("[[rules]]");
    // No allowlist: gitleaks evaluates an allowlist entry's fields
    // independently, so a regex-only entry suppresses the literal across the
    // whole scan. False positives are annotated at the line instead.
    expect(config).not.toContain("[[allowlists]]");
    expect(config).not.toContain("[allowlist]");
  });

  it("annotates the reviewed false positive at its line, not across the tree", () => {
    // The dashboard's localStorage key NAME is not a credential. The annotation
    // sits on the line that defines it, so copying the literal into any other
    // file is still reported — which an allowlist regex did not do.
    const annotated = 'var STORE_KEY = "citation-verification-decisions-v1"; // gitleaks:allow';
    expect(read("scripts/generate-citation-verification-dashboard.js")).toContain(annotated);
    expect(read("docs/citation-verification-dashboard.html")).toContain(annotated);

    // Every allow annotation in the tree must be that reviewed line, so a new
    // one has to arrive with a test change rather than a quiet edit.
    const offScope = [
      ...filesUnder("docs"),
      ...filesUnder("src"),
      ...filesUnder("scripts"),
      ...filesUnder("tests"),
    ]
      // Code only: prose in an operator document may name the mechanism.
      .filter((file) => /\.(ts|tsx|js|mjs|json|html)$/.test(file))
      // This suite names the annotation by design; it is the thing doing the
      // asserting, not a second exemption.
      .filter((file) => file !== "tests/secret-scan-gate.test.ts")
      .flatMap((file) =>
        readFileSync(join(root, file), "utf8")
          .split("\n")
          .filter((line) => line.includes("gitleaks:allow") && !line.trim().startsWith(annotated))
          .map((line) => `${file}: ${line.trim()}`),
      );
    expect(offScope).toEqual([]);
  });

  it("records reviewed history findings by exact fingerprint, never by path", () => {
    const lines = ignore
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const fingerprints = lines.filter((line) => !line.startsWith("#"));
    expect(fingerprints.length).toBeGreaterThan(0);
    for (const fingerprint of fingerprints) {
      expect(fingerprint, "a fingerprint is commit:file:rule:line").toMatch(
        /^[0-9a-f]{40}:[^:]+:[a-z0-9-]+:\d+$/,
      );
      // A wildcard would exempt far more than the reviewed finding.
      expect(fingerprint).not.toContain("*");
    }
    // Each group of fingerprints carries a written reason above it.
    expect(ignore.split("\n").filter((line) => line.startsWith("#")).length).toBeGreaterThanOrEqual(
      fingerprints.length,
    );
    // The real exposure is named, and so is the action it still needs.
    expect(ignore).toContain(
      "0e0465d27cceefde82a01d037dd2460475f9d82a:docs/langsmith-correctness-audit-2026-09-13.md:generic-api-key:177",
    );
    expect(ignore.toLowerCase()).toContain("rotate");
  });

  it("no longer carries the exposed LangSmith key anywhere in the tracked tree", () => {
    // A long `lsv2_pt_…` value is a project key; the short prefixes in setup
    // docs and `.env.example` are documentation, not credentials.
    const offenders = [...filesUnder("docs"), ...filesUnder("src"), ...filesUnder("scripts"), ...filesUnder("tests")]
      .filter((file) => /\.(md|ts|tsx|js|mjs|json|html|example)$/.test(file))
      .filter((file) => {
        const text = readFileSync(join(root, file), "utf8");
        return /lsv2_pt_[A-Za-z0-9_]{20,}/.test(text);
      });
    expect(offenders).toEqual([]);
    // The document that held it states the removal and the rotation requirement.
    const doc = read("docs/langsmith-correctness-audit-2026-09-13.md");
    expect(doc).toContain("Exposure (2026-10-22)");
    expect(doc.toLowerCase()).toContain("rotate");
  });

  it("generates the health probe secret instead of hardcoding a credential-shaped literal", () => {
    expect(healthRoute).toContain('randomBytes(32).toString("base64url")');
    expect(healthRoute).not.toContain("health-probe-ephemeral-secret");
  });

  it("is described where an operator will look for the security controls", () => {
    expect(readme).toContain(".github/workflows/secret-scan.yml");
    expect(readme).toContain("full commit history");
    expect(securityOperations).toContain("secret-scan.yml");
    expect(securityOperations).toContain("gitleaks `8.30.1`");
    expect(securityOperations).toContain("Secret scanning and the LangSmith key exposure");
  });
});
