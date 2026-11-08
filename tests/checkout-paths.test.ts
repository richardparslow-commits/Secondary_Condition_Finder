import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { listCheckoutPaths } from "../scripts/lib/checkout-paths.mjs";

const fixtures: string[] = [];
afterEach(() => { for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function repository() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "scf-hygiene-")); fixtures.push(parent);
  const root = path.join(parent, "repo");
  execFileSync("git", ["init", "-q", root]);
  return { parent, root };
}
it("scans ordinary Git metadata and source while pruning generated trees", () => {
  const { root } = repository();
  fs.writeFileSync(path.join(root, "source 2.ts"), "duplicate");
  fs.writeFileSync(path.join(root, ".git", "index 2"), "duplicate");
  fs.mkdirSync(path.join(root, "node_modules")); fs.writeFileSync(path.join(root, "node_modules", "ignored 2.ts"), "vendor");
  expect(listCheckoutPaths(root)).toEqual(expect.arrayContaining([".git/HEAD", ".git/index 2", "source 2.ts"]));
  expect(listCheckoutPaths(root)).not.toContain("node_modules/ignored 2.ts");
});
it("scans both private and common Git metadata in an actual linked worktree", () => {
  const { parent, root } = repository();
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
  const linked = path.join(parent, "linked");
  execFileSync("git", ["-C", root, "worktree", "add", "-qb", "fixture-linked", linked]);
  const metadata = execFileSync("git", ["-C", linked, "rev-parse", "--absolute-git-dir"], { encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(metadata, "index 2"), "private duplicate");
  fs.writeFileSync(path.join(root, ".git", "config 2"), "shared duplicate");
  expect(fs.statSync(path.join(linked, ".git")).isFile()).toBe(true);
  expect(listCheckoutPaths(linked)).toEqual(expect.arrayContaining([".git/HEAD", ".git/index 2", ".git-common/config 2"]));
});
