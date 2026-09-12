import { describe, expect, it } from "vitest";

import {
  deploymentIdFromTargetUrl,
  formatWorkbookRows,
  parseArgs,
} from "../scripts/resolve-review-build-identity.mjs";

/**
 * Unit coverage for the pure helpers behind the Section 508 build-identity
 * resolver. These verify *identity formatting* only. Nothing here is
 * accessibility evidence, and no test in this file may produce a PASS result.
 */
describe("resolve-review-build-identity helpers", () => {
  describe("parseArgs", () => {
    it("defaults to the canonical production URL and non-JSON output", () => {
      const args = parseArgs([]);

      expect(args.json).toBe(false);
      expect(args.sha).toBeNull();
      expect(args.url).toBe("https://secondary-condition-finder.vercel.app");
    });

    it("accepts sha, url, and json overrides", () => {
      const args = parseArgs([
        "--sha=abc123",
        "--url=https://example.test",
        "--json",
      ]);

      expect(args.sha).toBe("abc123");
      expect(args.url).toBe("https://example.test");
      expect(args.json).toBe(true);
    });

    it("falls back to the default URL when given an empty override", () => {
      expect(parseArgs(["--url=  "]).url).toBe(
        "https://secondary-condition-finder.vercel.app",
      );
    });

    it("treats an empty sha override as unset", () => {
      expect(parseArgs(["--sha="]).sha).toBeNull();
    });
  });

  describe("deploymentIdFromTargetUrl", () => {
    it("prefixes a bare deployment slug", () => {
      expect(
        deploymentIdFromTargetUrl("https://vercel.com/org/proj/AbC123XyZ"),
      ).toBe("dpl_AbC123XyZ");
    });

    it("does not double-prefix an id that already carries dpl_", () => {
      expect(
        deploymentIdFromTargetUrl("https://vercel.com/org/proj/dpl_AbC123XyZ"),
      ).toBe("dpl_AbC123XyZ");
    });

    it("tolerates trailing slashes and surrounding whitespace", () => {
      expect(
        deploymentIdFromTargetUrl("  https://vercel.com/org/proj/AbC123XyZ///  "),
      ).toBe("dpl_AbC123XyZ");
    });

    it("returns null for unusable input", () => {
      expect(deploymentIdFromTargetUrl("")).toBeNull();
      expect(deploymentIdFromTargetUrl("   ")).toBeNull();
      expect(deploymentIdFromTargetUrl("/")).toBeNull();
      expect(deploymentIdFromTargetUrl(undefined)).toBeNull();
      expect(deploymentIdFromTargetUrl(null)).toBeNull();
      expect(deploymentIdFromTargetUrl(42)).toBeNull();
    });
  });

  describe("formatWorkbookRows", () => {
    const fullIdentity = {
      sha: "a".repeat(40),
      url: "https://secondary-condition-finder.vercel.app",
      deploymentId: "dpl_AbC123XyZ",
      vercelState: "success",
      ciRun: "111",
      ciConclusion: "success",
      readinessRun: "222",
      readinessConclusion: "success",
      httpStatus: "200",
    };

    it("renders every session-identity field when fully resolved", () => {
      const rows = formatWorkbookRows(fullIdentity);

      expect(rows).toContain("| Deployed `main` commit SHA | `" + fullIdentity.sha + "` |");
      expect(rows).toContain("| Vercel production deployment ID | `dpl_AbC123XyZ` |");
      expect(rows).toContain("| Main CI run | 111 (success) |");
      expect(rows).toContain("| Production Runtime Readiness run | 222 (success) |");
      expect(rows).toContain("| Production URL reachability (HTTP status only) | 200 |");
    });

    it("marks unresolved fields explicitly instead of guessing", () => {
      const rows = formatWorkbookRows({
        sha: null,
        url: fullIdentity.url,
        deploymentId: null,
        vercelState: null,
        ciRun: null,
        ciConclusion: null,
        readinessRun: null,
        readinessConclusion: null,
        httpStatus: null,
      });

      expect(rows).toContain("| Deployed `main` commit SHA | UNRESOLVED |");
      expect(rows).toContain("| Vercel production deployment ID | UNRESOLVED |");
      expect(rows).not.toContain("success");
    });

    it("emits Markdown table rows only — never an accessibility verdict", () => {
      const rows = formatWorkbookRows(fullIdentity);

      for (const line of rows.split("\n")) {
        expect(line.startsWith("| ")).toBe(true);
        expect(line.endsWith(" |")).toBe(true);
      }
      // Guard: identity output must not be mistakable for human test results.
      expect(rows).not.toContain("PASS");
      expect(rows).not.toContain("FAIL");
      expect(rows).not.toContain("NOT TESTED");
      expect(rows).not.toContain("Tester");
    });
  });
});
