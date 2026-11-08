import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PRUNED = new Set(["node_modules", ".next", ".open-next"]);

function walk(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (PRUNED.has(entry.name)) return [];
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return [relative, ...(entry.isDirectory() ? walk(path.join(directory, entry.name), relative) : [])];
  });
}

// Linked worktrees use a .git file; scan their real private and shared metadata
// rather than assuming .git is a directory or silently skipping it.
export function listCheckoutPaths(root) {
  const gitPath = (flag) => execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", flag], { encoding: "utf8" }).trim();
  const privateGit = gitPath("--git-dir");
  const commonGit = gitPath("--git-common-dir");
  return [...new Set([
    ...walk(root),
    ...walk(privateGit, ".git"),
    ...(commonGit !== privateGit ? walk(commonGit, ".git-common") : []),
  ])];
}
