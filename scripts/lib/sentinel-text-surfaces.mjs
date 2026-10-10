import fs from "node:fs";
import path from "node:path";

// Next 16 keeps development output separate from builds. Never fall back to
// .next/trace: it can be a stale build trace unrelated to the server we drove.
export function sentinelDevTracePath(root = process.cwd()) {
  return path.join(root, ".next", "dev", "trace");
}

// Next rotates trace files and logs can be rewritten. Scan the whole current
// file up to the cap, not a suffix starting at the pre-run size. Missing/empty
// surfaces remain distinguishable so the walk can fail closed on either.
export function readSentinelTextSurface(file, limit, sizeBeforeRun = 0) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Text surface scan limit must be a positive integer.");
  }
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      text: "",
      observation: { path: file, status: "missing", bytes: 0, sizeBytes: 0, bytesBeforeRun: sizeBeforeRun, rewrittenDuringRun: false },
    };
  }
  const text = content.slice(Math.max(0, content.length - limit));
  return {
    text,
    observation: {
      path: file,
      status: "scanned",
      bytes: text.length,
      sizeBytes: content.length,
      bytesBeforeRun: sizeBeforeRun,
      rewrittenDuringRun: content.length < sizeBeforeRun,
    },
  };
}
