import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `freebuff.wrangler.jsonc` and `freebuff.open-next.config.ts` are emitted by
 * Freebuff Sites whenever the site is published, and they name local
 * placeholder resources (`*-local`, a `0000…` D1 id). Tracking them would make
 * generated state look like authored configuration, and the next publish would
 * overwrite any edit. The decision is to ignore them beside the artifact they
 * describe; `smoke:worker -- --sites` therefore requires a prepared checkout.
 */
const GENERATED_CONFIGS = ["freebuff.wrangler.jsonc", "freebuff.open-next.config.ts"];

function git(args: string[]) {
  return spawnSync("git", args, { encoding: "utf8" });
}

describe("generated Freebuff Sites configs", () => {
  it("are ignored and untracked", () => {
    for (const file of GENERATED_CONFIGS) {
      const ignored = git(["check-ignore", "-q", "--", file]);
      expect(ignored.status, `${file} is not gitignored`).toBe(0);

      const tracked = git(["ls-files", "--error-unmatch", "--", file]);
      expect(tracked.status, `${file} is tracked despite being generated`).not.toBe(0);
    }
  });

  it("are ignored beside the generated artifact they describe", () => {
    const ignoreFile = fs.readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
    expect(ignoreFile).toContain("/freebuff-sites-build/");
    expect(ignoreFile).toContain("/freebuff.wrangler.jsonc");
    expect(ignoreFile).toContain("/freebuff.open-next.config.ts");
    expect(ignoreFile.indexOf("/freebuff-sites-build/")).toBeLessThan(
      ignoreFile.indexOf("/freebuff.wrangler.jsonc"),
    );
  });

  it("are documented as regenerated state, not authored config", () => {
    const docs = fs.readFileSync(
      resolve(process.cwd(), "docs/deployment-readiness.md"),
      "utf8",
    );
    expect(docs).toContain("freebuff.wrangler.jsonc");
    expect(docs).toContain("freebuff.open-next.config.ts");
    expect(docs).toContain("gitignored alongside the artifact");
    expect(docs).toContain("local placeholder resources");
  });
});
