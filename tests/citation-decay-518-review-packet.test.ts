import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import snapshot from "../docs/citation-decay-518-review-inputs.json";
import { buildReport } from "../scripts/audit-citation-decay";
import { findDigestExemption, loadDigestExemptions } from "../scripts/lib/citation-digest-exemptions";

type Reference = Record<string, unknown> & { verified?: boolean; sourceUrl?: string; contentDigest?: string };
type Suggestion = {
  conditionId: string; rank: number; sourceReferences?: Reference[];
  rationale: string; nexusClaim: unknown; causalMechanism: unknown; evidentiaryProfile: unknown;
};
type Mapping = { id: string; draft: boolean; suggestions?: Suggestion[] };
const PACKET = "docs/citation-decay-518-review-packet.md";
const packet = readFileSync(PACKET, "utf8");
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const files = readdirSync("data/knowledge-base").filter(file => file.endsWith(".json")).sort().map(file => ({
  file, data: JSON.parse(readFileSync(`data/knowledge-base/${file}`, "utf8")) as Mapping,
}));
const loaded = loadDigestExemptions();
const rows = files.flatMap(({ file, data }) => (data.suggestions ?? []).flatMap((suggestion, i) =>
  (suggestion.sourceReferences ?? []).map((reference, j) => ({
    path: `data/knowledge-base/${file}`, jsonPointer: `/suggestions/${i}/sourceReferences/${j}`,
    primary: data.id, target: suggestion.conditionId, rank: suggestion.rank, draft: data.draft,
    reference, suggestion,
  })),
));

function matchInventory(id: string) {
  return rows.filter(row => {
    if (row.reference.verified !== true) return false;
    const match = findDigestExemption(row.reference.sourceUrl, loaded.compiled);
    return match && !match.mismatchedHost && match.entry.id === id;
  }).map(({ path, jsonPointer, primary, target, rank, draft, reference }) => ({
    path, jsonPointer, primary, target, rank, draft,
    sourceUrl: reference.sourceUrl, sourceCheckedOn: reference.sourceCheckedOn,
    verificationScope: reference.verificationScope,
  }));
}

describe("#518 unsigned qualified-human review packet", () => {
  it("binds its audit/policy inputs and all top-level corpus bytes to the extracted snapshot", () => {
    for (const input of snapshot.inputFiles) {
      expect(sha256(readFileSync(input.path)), `Review input changed: ${input.path}; regenerate and re-review the packet`).toBe(input.sha256);
    }
    const corpusFiles = files.map(({ file }) => ({ path: `data/knowledge-base/${file}`, sha256: sha256(readFileSync(`data/knowledge-base/${file}`)) }));
    expect(corpusFiles).toHaveLength(snapshot.corpusBinding.fileCount);
    expect(sha256(JSON.stringify(corpusFiles))).toBe(snapshot.corpusBinding.sha256);
  });

  it("copies all three proposals and their full affected-use inventory exactly, without approvals", () => {
    expect(loaded.problems).toEqual([]);
    expect(snapshot.exemptions).toHaveLength(3);
    expect(snapshot.exemptions.map(entry => entry.proposal)).toEqual(loaded.entries);
    for (const entry of snapshot.exemptions) {
      const inventory = matchInventory(entry.proposal.id);
      expect(entry.affectedReferences).toEqual(inventory);
      expect(entry.verifiedReferenceUses).toBe(inventory.length);
      expect(entry.uniqueSourceUrls).toBe(new Set(inventory.map(row => row.sourceUrl)).size);
      expect(entry.proposal.review).toMatchObject({ status: "pending-qualified-human", reviewer: null, reviewedOn: null });
      expect(packet).toContain(entry.proposal.id);
      expect(packet).toContain(entry.proposal.urlPattern);
      for (const url of entry.proposal.assessment.sampleUrls) expect(packet).toContain(url);
    }
    expect(snapshot.exemptions.map(entry => entry.verifiedReferenceUses)).toEqual([392, 1, 1]);
    expect(snapshot.exemptions.map(entry => entry.uniqueSourceUrls)).toEqual([358, 1, 1]);
  });

  it("identifies all four Cornell reference uses with exact pointers, metadata, and relationship context", () => {
    const expected = rows.filter(row => row.reference.verified === true && row.reference.sourceUrl === "https://www.law.cornell.edu/cfr/text/38/3.310")
      .map(({ suggestion, ...row }, i) => ({
        worksheetId: `C${i + 1}`, ...row, rationale: suggestion.rationale,
        nexusClaim: suggestion.nexusClaim, causalMechanism: suggestion.causalMechanism,
        evidentiaryProfile: suggestion.evidentiaryProfile,
      }));
    expect(snapshot.cornellReferences).toEqual(expected);
    expect(expected).toHaveLength(4);
    for (const row of snapshot.cornellReferences) {
      expect(packet).toContain(`### ${row.worksheetId} — ${row.primary} → ${row.target}`);
      expect(packet).toContain(row.path.replace(/^data\//, "../data/"));
      expect(packet).toContain(row.jsonPointer);
      expect(packet).toContain(row.rationale);
      for (const value of [row.reference.note, row.reference.sourceCheckedOn, row.reference.sourceLocator, row.reference.verificationScope]) {
        expect(packet).toContain(value);
      }
      expect(row.reference).not.toHaveProperty("contentDigest");
    }
  });

  it("reports the unchanged blocked baseline without implying any network probe or new verification", () => {
    const report = buildReport(files, new Map(), snapshot.preparedOn, loaded);
    expect(snapshot.baseline).toEqual({
      liveReferences: report.liveReferences, verifiedReferences: report.verifiedReferenceCount,
      verifiedWithDigest: report.verifiedWithDigestCount, approvedExemptReferences: report.verifiedDigestExemptCount,
      pendingExemptionReferences: report.verifiedDigestExemptionPendingCount,
      actionableUndigestedReferences: report.verifiedUndigestedActionableCount,
      proposedActionableRatchet: report.maxUndigestedVerifiedRefs,
      contentDriftCoveragePercent: report.contentDriftCoveragePercent,
      offlineStructuralStatus: report.status, networkProbesPerformed: 0,
    });
    expect(snapshot.status).toBe("PREPARED_UNREVIEWED");
    expect(snapshot.qualifiedHumanDecisionsRecorded).toBe(false);
    expect(snapshot.liveNetworkReassessmentPerformed).toBe(false);
    expect(report.status).toBe("FAIL");
    expect(report.verifiedDigestExemptCount).toBe(0);
  });

  it("provides seven unsigned worksheets and the separate policy decision with evidence limits", () => {
    for (const id of ["P0", "E1", "E2", "E3", "C1", "C2", "C3", "C4"]) {
      expect(packet).toContain(`| ${id} |`);
    }
    expect(packet.match(/\| — \| — \| — \| — \|$/gm)).toHaveLength(8);
    expect(packet).not.toMatch(/\[[xX]\]/);
    expect(packet.match(/\[ \] APPROVE AS SCOPED/g)).toHaveLength(3);
    expect(packet.match(/\[ \] RE-VERIFIED AS WRITTEN/g)).toHaveLength(4);
    for (const limit of ["No approvals or new source-verification decisions recorded", "carried-forward claims", "does not identify an exact sample PMID", "No raw response/hash set", "policy/denominator change", "not a runtime input or an approval file", "separate applicability decision", "Do not backfill", "not an extra machine status"]) {
      expect(packet).toContain(limit);
    }
  });

  it("has resolvable local evidence links and is discoverable from the existing handoff", () => {
    for (const match of packet.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^https?:/.test(target)) continue;
      const file = decodeURIComponent(target.split("#")[0]);
      expect(existsSync(path.resolve(path.dirname(PACKET), file)), `Broken evidence link: ${target}`).toBe(true);
    }
    const handoff = readFileSync("docs/citation-decay-518-handoff.md", "utf8");
    expect(handoff).toContain("citation-decay-518-review-packet.md");
    expect(handoff).toContain("citation-decay-518-review-inputs.json");
  });
});
