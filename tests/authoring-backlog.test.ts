import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.join(process.cwd(), "scripts/report-authoring-backlog.js");
const kbDir = path.join(process.cwd(), "data", "knowledge-base");
const dispositionFiles = [
  "docs/clinical-mapping-master-2026-approved-disposition.json",
  "docs/clinical-mapping-master-resolution-2026-approved-disposition.json",
];

const run = () =>
  JSON.parse(execFileSync(process.execPath, [script, "--json"], { encoding: "utf8" }));

const collectIds = (value: unknown, into: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, into);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((key === "id" || key === "conditionId") && typeof child === "string") into.add(child);
      collectIds(child, into);
    }
  }
};

describe("authoring backlog report", () => {
  it("is deterministic across runs", () => {
    const first = execFileSync(process.execPath, [script, "--json"], { encoding: "utf8" });
    const second = execFileSync(process.execPath, [script, "--json"], { encoding: "utf8" });
    expect(second).toBe(first);
  });

  it("reports self-consistent counts and a gapless head of queue", () => {
    const report = run();

    expect(report.zeroEdgeDrafts).toBe(
      report.markedZeroEdgeDrafts + report.unmarkedZeroEdgeDrafts,
    );
    expect(report.unmarkedZeroEdgeDrafts).toBe(
      report.dispositionedUnmarkedZeroEdgeDrafts + report.backlogCount,
    );
    expect(report.backlogCount).toBe(report.backlogIds.length);
    expect(report.nextFive).toEqual(report.backlogIds.slice(0, 5));

    const sorted = [...report.backlogIds].sort();
    expect(report.backlogIds).toEqual(sorted);
    expect(new Set(report.backlogIds).size).toBe(report.backlogIds.length);
  });

  it("lists only genuine undispositioned zero-edge drafts in the backlog", () => {
    const report = run();

    const dispositioned = new Set<string>();
    for (const file of dispositionFiles) {
      collectIds(JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8")), dispositioned);
    }

    for (const id of report.backlogIds) {
      const data = JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8"));
      expect(data.id).toBe(id);
      expect(data.draft).toBe(true);
      expect(data.suggestions ?? []).toEqual([]);
      expect(data.governanceNotes ?? []).toEqual([]);
      const todos: string[] = data.todo ?? [];
      expect(todos.length).toBeGreaterThan(0);
      for (const todo of todos) {
        expect(
          todo.startsWith("Author condition-specific") || todo.startsWith("Review "),
        ).toBe(true);
      }
      expect(dispositioned.has(id)).toBe(false);
    }
  });

  it("prints a human report consistent with the machine report", () => {
    const report = run();
    const output = execFileSync(process.execPath, [script], { encoding: "utf8" });

    expect(output).toContain("zero-edge authoring backlog");
    expect(output).toContain(`backlog (undispositioned zero-edge drafts):  ${report.backlogCount}`);
    for (const id of report.nextFive) {
      expect(output).toContain(id);
    }
  });
});
