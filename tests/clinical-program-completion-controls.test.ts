import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { loadKnowledgeBase } from "@/lib/kb/load";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("clinical program completion controls", () => {
  const catalog = loadConditionCatalog();
  const kb = loadKnowledgeBase();
  const byId = new Map(kb.map((mapping) => [mapping.id, mapping]));
  const ledger = JSON.parse(read("data/expansion-dispositions.json")) as {
    totalIdentities: number;
    waves: Array<{ identities: Array<{ id: string; disposition: string }> }>;
  };
  const ledgerEntries = ledger.waves.flatMap((wave) => wave.identities);
  const liveReferences = kb.flatMap((mapping) =>
    mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? []),
  );
  const liveUnverified = liveReferences.filter((reference) => reference.verified !== true).length;
  const publishedUnverified = kb.reduce(
    (count, mapping) => count + (mapping.draft
      ? 0
      : mapping.suggestions.flatMap((suggestion) => suggestion.sourceReferences ?? [])
          .filter((reference) => reference.verified !== true).length),
    0,
  );
  const liveClinicalWithUrls = liveReferences.filter(
    (reference) => reference.verificationScope === "clinical-evidence" && Boolean(reference.sourceUrl),
  ).length;

  it("preserves the frozen 300/300 universe", () => {
    expect(catalog).toHaveLength(300);
    expect(kb).toHaveLength(300);
  });

  it("keeps the current tracker synchronized to the machine-readable disposition and citation state", () => {
    const tracker = read("docs/kb-coverage-tracker.md");
    const published = ledgerEntries.filter((entry) => entry.disposition === "published-evidence-led").length;
    const safeDrafts = ledgerEntries.filter((entry) => entry.disposition === "safe-draft").length;
    const candidates = ledgerEntries.filter((entry) => entry.disposition === "promotion-candidate").length;

    expect(ledger.totalIdentities).toBe(107);
    expect(tracker).toContain(`**${published} published-evidence-led**`);
    expect(tracker).toContain(`**${safeDrafts} safe-draft**`);
    expect(tracker).toContain(`**${candidates} promotion-candidate**`);
    expect(tracker).toContain(`live references: **${liveReferences.length}**`);
    expect(tracker).toContain(`live unverified: **${liveUnverified}**`);
    expect(tracker).toContain(`published-unverified review findings: **${publishedUnverified}**`);
    expect(tracker).toContain(`live clinical-evidence references with canonical URLs: **${liveClinicalWithUrls}**`);
    expect(ledgerEntries.some((entry) => entry.id === "diabetes-mellitus-type-1")).toBe(false);
  });

  it("allows unsupported unverified-source withdrawal without weakening provenance controls", () => {
    const audit = read("scripts/audit-citation-verification.js");
    expect(audit).toMatch(/clinicalEvidenceUrlCoverageComplete\s*=\s*clinicalWithUrls\s*===\s*clinical/);
    expect(audit).toMatch(/verifiedProvenance\s*<\s*CITATION_DEBT_BASELINE\.verifiedProvenance/);
    expect(audit).toMatch(/retiredClinicalWithUrls\s*<\s*CITATION_DEBT_BASELINE\.retiredClinicalEvidenceWithUrls/);
    expect(audit).not.toContain("verified < CITATION_DEBT_BASELINE.liveVerified");
    expect(audit).not.toContain("clinicalWithUrls < CITATION_DEBT_BASELINE.liveClinicalEvidenceWithUrls");
    expect(audit).not.toContain("clinicalEvidenceProvenanceWithUrls < CITATION_DEBT_BASELINE.clinicalEvidenceProvenanceWithUrls");
  });

  it("keeps the three v2 modeling dispositions safe without deleting stable identities", () => {
    const modeling = read("docs/modeling-debt-dispositions.md");
    for (const id of ["contralateral-knee-condition", "micro-tbi", "cerebral-palsy"]) {
      expect(modeling).toContain(id);
      expect(byId.has(id), `missing stable KB identity ${id}`).toBe(true);
    }
    expect(byId.get("micro-tbi")?.draft).toBe(true);
    expect(byId.get("micro-tbi")?.suggestions).toEqual([]);
    expect(byId.get("cerebral-palsy")?.draft).toBe(true);
  });

  it("exposes the exact qualified-human published citation queue without auto-verifying sources", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["citations:queue"]).toContain("report-citation-verification-queue.js");
    const script = read("scripts/report-citation-verification-queue.js");
    expect(script).toMatch(/verified === true/);
    expect(script).toMatch(/reviewerDecision:\s*"PENDING"/);
    expect(script).toMatch(/qualified human/i);
    const instructions = read("docs/qualified-human-citation-verification-queue.md");
    expect(instructions).toContain(`${publishedUnverified} live unverified published references`);
    expect(instructions).toContain(`${liveUnverified} live unverified references`);
    expect(instructions).toMatch(/cannot.*qualified-human|not.*qualified-human|only a qualified human/i);
  });

  it("keeps external and human-only gates explicitly open rather than fabricating completion", () => {
    const gates = read("docs/external-manual-gates-status.md");
    expect(gates).toMatch(/Issue #189[\s\S]*OPEN \/ EXTERNALLY BLOCKED/i);
    expect(gates).toMatch(/Issue #195[\s\S]*OPEN \/ HUMAN-ONLY/i);
    expect(gates).toMatch(/Issue #213[\s\S]*COMPLETE \/ CLOSED/i);
    expect(gates).toMatch(/must not close #189/i);
    expect(gates).toMatch(/must not close #195/i);
  });
});
