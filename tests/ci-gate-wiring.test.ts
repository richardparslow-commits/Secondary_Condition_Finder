import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * ci.yml marks each gate `continue-on-error: true` so every gate still runs and
 * its log is collected, then one final step re-fails the job from the recorded
 * step outcomes. That design is only safe if EVERY continue-on-error step is
 * named in the aggregator condition: a gate added without its id there becomes
 * a silent advisory check that can never fail a merge, while still appearing in
 * the workflow as though it were enforced.
 *
 * This test pins the invariant itself rather than a snapshot of today's gate
 * list, so the next gate added cannot quietly opt out of failing.
 */
describe("CI gate wiring", () => {
  const ci = read(".github/workflows/ci.yml");

  // Split on step boundaries (six-space indented list items under `steps:`).
  const stepBlocks = ci.split(/\n(?= {6}- )/);
  const advisory = stepBlocks
    .filter((block) => /continue-on-error:\s*true/.test(block))
    .map((block) => ({
      name: block.match(/- name:\s*(.+)/)?.[1]?.trim() ?? block.match(/- uses:\s*(.+)/)?.[1]?.trim() ?? "(unnamed)",
      id: block.match(/^\s+id:\s*(\S+)/m)?.[1],
    }));
  const aggregator = stepBlocks.find((block) => block.includes("Fail the job if any gate failed"));
  const diagnostics = stepBlocks.find((block) => block.includes("Collect diagnostic summary"));

  it("gives every continue-on-error gate a referenceable id", () => {
    expect(advisory.length).toBeGreaterThan(0);
    expect(advisory.filter((step) => !step.id).map((step) => step.name)).toEqual([]);
  });

  it("re-fails every continue-on-error gate in the final aggregator", () => {
    expect(aggregator, "ci.yml lost its 'Fail the job if any gate failed' step").toBeDefined();
    const unenforced = advisory
      .filter((step) => step.id && !aggregator!.includes(`steps.${step.id}.outcome`))
      .map((step) => `${step.name} (id: ${step.id})`);
    expect(
      unenforced,
      "these gates are continue-on-error but absent from the aggregator, so they can never fail CI",
    ).toEqual([]);
  });

  it("wires the CRG structural audits as enforced gates", () => {
    // audit:crg and audit:crg:graph are documented in README as gates, but no
    // workflow used to execute them — leaving CRG-SELF-LOOP, CRG-DUPLICATE-EDGE
    // and CRG-PURE-CAUSATION-CYCLE (and the adjacency audit's self-tightening
    // promise) unable to block anything.
    expect(ci).toContain("npm run audit:crg 2>&1 | tee ci-crg.log");
    expect(ci).toContain("npm run audit:crg:graph 2>&1 | tee ci-crg-graph.log");
    expect(aggregator).toContain("steps.crg.outcome");
    expect(aggregator).toContain("steps.crg_graph.outcome");
  });

  it("wires the fleet coordination simulation as an enforced, ratcheted gate", () => {
    // The fleet simulation pins the distributed VA coordination invariants.
    // Running it as its own named gate makes a coordination regression
    // attributable, and the budget wrapper (scripts/run-fleet-simulation.mjs)
    // makes an unbounded — merely slow — regression a gate failure instead of
    // a longer test run. The budget is a ratchet derived from committed
    // measurements, so it tightens as timing stabilizes instead of drifting
    // looser; --record is how a run feeds its real measurement back in.
    expect(ci).toContain("npm run test:fleet -- --record 2>&1 | tee ci-fleet.log");
    expect(aggregator).toContain("steps.fleet.outcome");
    expect(diagnostics).toContain("ci-fleet.log");
    expect(diagnostics).toContain("steps.fleet.outcome");
  });

  it("publishes the fleet ratchet state so a CI measurement can be ratified", () => {
    // A CI workspace is discarded at the end of the run, so without this the
    // recorded CI measurement would be lost and the CI budget could never
    // tighten. The state file rides the diagnostics artifact; the wiring test
    // for the gate itself lives in tests/fleet-simulation-gate.test.ts.
    const upload = stepBlocks.find((block) => block.includes("Upload diagnostic logs"));
    expect(upload, "ci.yml lost its diagnostic artifact step").toBeDefined();
    expect(upload).toContain(".github/fleet-budget-ratchet.json");
    expect(ci).toContain("Ratchet the fleet budget: commit .github/fleet-budget-ratchet.json");
  });

  it("collects the CRG gate logs and outcomes for diagnosis", () => {
    expect(diagnostics, "ci.yml lost its diagnostic summary step").toBeDefined();
    expect(diagnostics).toContain("ci-crg.log");
    expect(diagnostics).toContain("ci-crg-graph.log");
    expect(diagnostics).toContain("steps.crg.outcome");
    expect(diagnostics).toContain("steps.crg_graph.outcome");
  });

  it("keeps every gate log it collects in the uploaded artifact set", () => {
    // A gate whose log is grepped by the summary but not uploaded is only
    // diagnosable while the run's workspace survives.
    const upload = stepBlocks.find((block) => block.includes("Upload diagnostic logs"));
    expect(upload).toBeDefined();
    const collected = [...(diagnostics?.matchAll(/ci-[a-z0-9-]+\.log/g) ?? [])].map((m) => m[0]);
    expect(collected.length).toBeGreaterThan(0);
    // The artifact uses the `ci-*.log` glob, which covers every collected log.
    expect(upload).toContain("ci-*.log");
    for (const log of new Set(collected)) {
      expect(log).toMatch(/^ci-[a-z0-9-]+\.log$/);
    }
  });
});
