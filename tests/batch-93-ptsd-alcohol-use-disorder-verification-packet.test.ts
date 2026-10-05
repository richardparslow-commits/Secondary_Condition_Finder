import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ADJUDICATION_PACKETS } from "./helpers/adjudication-packets";

/**
 * Batch 93 held-edge verification packet contract — packet-specific half.
 *
 * The packet's identity and posture (the three anchor PMIDs/URLs/dates and
 * their source-entity posture, the held edge's unregistered state, the open
 * decision slots with blank reviewer evidence, the no-decision framing, and
 * the queue-doc wiring) are pinned by the shared harness: the packet is
 * registered in `ADJUDICATION_PACKETS` (`tests/helpers/adjudication-packets.ts`)
 * and the shared suite (`tests/adjudication-packets-contract.test.ts`) keeps
 * it tied to the live corpus. This suite keeps the contracts only this packet
 * can carry:
 *
 * 1. The decision rule: four SOP outcomes per anchor, all-or-nothing landing,
 *    verbatim registration at rank 21, and the preservation of the publication
 *    counts that make verification the only blocker.
 * 2. The held context: `ptsd.json` stays published with its 20 registered
 *    suggestions and zero alcohol targets, and the umbrella
 *    `rel-ptsd-to-substance-use-disorder` window stays registered, so the
 *    landing review's parallel-targeting check has a real subject.
 * 3. The packet's baseline and re-derived landing ratchets match the live
 *    registry audit, and the held artifact's Stage-3a-era deltas are flagged as
 *    historical rather than landing numbers.
 * 4. Both mandatory landing reviews (CRG parallel-targeting against the
 *    umbrella window, and the transitive chain check with the withheld direct
 *    `ptsd` → `chronic-liver-disease` edge) and the digest policy are recorded.
 * 5. The queue doc keeps its own policy anchors, and the packet stays
 *    registered in the shared harness.
 */

const PACKET = "docs/batch-93-ptsd-alcohol-use-disorder-verification-packet.md";
const HELD = "docs/batch-93-ptsd-alcohol-use-disorder-held-edge.json";
const QUEUE = "docs/qualified-human-citation-verification-queue.md";
const SOP = "docs/citation-verification-sop.md";
const D1_PACKET = "docs/d1-citation-verification-packet-2026-09.md";
const KB_PTSD = "data/knowledge-base/ptsd.json";
const REGISTRY = "data/evidence/master-relationships.json";

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

type HeldReference = {
  citation: string;
  sourceUrl: string;
  verified: boolean;
  sourceCheckedOn: string;
};

type HeldArtifact = {
  status: string;
  id: string;
  targetMapping: string;
  heldEdges: Array<{
    conditionId: string;
    rank: number;
    sourceReferences: HeldReference[];
  }>;
};

type RegistryAudit = {
  status: string;
  relationships: number;
  explicitPublicationGuards: number;
  liveSourceReferenceUses: number;
  verifiedLiveSourceUses: number;
  pendingVerificationLiveSourceUses: number;
  liveClinicalUses: number;
  liveLegalUses: number;
  activeSourceEntities: number;
  activeClinicalSourceEntities: number;
  pendingVerificationSourceEntities: number;
  totalSourceEntities: number;
  published: number;
  draft: number;
  retiredVerifiedRelationshipSourceUses: number;
};

function liveAudit(): RegistryAudit {
  const output = execFileSync(process.execPath, ["scripts/audit-master-registry.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output) as RegistryAudit;
}

const held = JSON.parse(read(HELD)) as HeldArtifact;

const thousands = (value: number): string => value.toLocaleString("en-US");

describe("batch 93 held-edge verification packet", () => {
  it("keeps the held artifact's three anchors in lockstep with the packet", () => {
    const packet = read(PACKET);
    const refs = held.heldEdges[0].sourceReferences;

    // The packet-side identity (PMIDs, URLs, dates, source posture) is pinned
    // by the shared harness; this checks the held artifact still carries the
    // three pending references the packet enumerates.
    expect(refs).toHaveLength(3);
    for (const reference of refs) {
      const match = reference.citation.match(/PMID\s+(\d+)/);
      if (!match) throw new Error(`held reference without PMID: ${reference.citation}`);
      expect(reference.verified).toBe(false);
      expect(reference.sourceCheckedOn).toBe("2026-10-04");
      expect(reference.sourceUrl).toBe(`https://pubmed.ncbi.nlm.nih.gov/${match[1]}/`);
      expect(packet).toContain(`PMID ${match[1]}`);
    }
  });

  it("asks for exactly one of the four SOP outcomes per anchor and states the all-or-nothing landing rule", () => {
    const packet = read(PACKET);

    for (const decision of [
      "APPROVE AS WRITTEN",
      "APPROVE WITH NARROWING",
      "REJECT",
      "HOLD",
    ]) {
      expect(packet).toContain(decision);
    }
    expect(packet).toContain("all-or-nothing");
    expect(packet).toContain("Any REJECT or HOLD leaves the edge held");
    expect(packet).toContain("Partial approval does not register a partial edge");
    expect(packet).toContain("rank 21");
    expect(packet).toContain("verbatim");
    expect(packet).toContain("reviewer identity/role");
  });

  it("keeps the published-mapping context that forces the hold", () => {
    const packet = read(PACKET);
    const mapping = JSON.parse(read(KB_PTSD)) as {
      draft: boolean;
      suggestions: Array<{ conditionId: string }>;
    };
    const registry = read(REGISTRY);

    // The held edge's unregistered posture (no relationship row, no authored
    // suggestion, no source entity) is pinned by the shared harness; this test
    // keeps the context that makes verification the only blocker: ptsd stays
    // published with its 20 registered suggestions and no alcohol target.
    expect(mapping.draft).toBe(false);
    expect(mapping.suggestions).toHaveLength(20);
    expect(
      mapping.suggestions.some((suggestion) => suggestion.conditionId === "alcohol-use-disorder"),
    ).toBe(false);

    // The umbrella row the landing review targets stays registered.
    expect(registry).toContain("rel-ptsd-to-substance-use-disorder");

    expect(held.status.startsWith("HELD_2026-10-04")).toBe(true);
    expect(packet).toContain(HELD);
    expect(packet).toContain(SOP);
    expect(packet).toContain(D1_PACKET);
  });

  it("pins the packet's baseline and re-derived landing ratchets to the live registry audit", () => {
    const packet = read(PACKET);
    const audit = liveAudit();

    expect(audit.status).toBe("PASS");
    expect(audit.relationships).toBe(875);
    expect(audit.explicitPublicationGuards).toBe(801);
    expect(audit.liveSourceReferenceUses).toBe(1704);
    expect(audit.verifiedLiveSourceUses).toBe(398);
    expect(audit.pendingVerificationLiveSourceUses).toBe(1306);
    expect(audit.liveClinicalUses).toBe(1699);
    expect(audit.liveLegalUses).toBe(5);
    expect(audit.totalSourceEntities).toBe(1497);
    expect(audit.activeSourceEntities).toBe(360);
    expect(audit.activeClinicalSourceEntities).toBe(359);
    expect(audit.pendingVerificationSourceEntities).toBe(1128);
    expect(audit.published).toBe(140);
    expect(audit.draft).toBe(679);
    expect(audit.retiredVerifiedRelationshipSourceUses).toBe(6);

    // The packet records the batch-93-authoring-time baseline and the
    // re-derived landing deltas. They are pinned literally, not derived from
    // the live audit, because later batches advance the live registry while
    // the packet's table remains the dated snapshot it was written as; the
    // live-audit pins above guard the current state instead.
    for (const delta of [
      "873 → 874",
      "799 → 800",
      "1,699 → 1,702",
      "398 → 401",
      "1,301 (unchanged)",
      "1,694 → 1,697",
      "1,492 → 1,495",
      "360 → 363",
      "359 → 362",
      "1,123 (unchanged)",
    ]) {
      expect(packet, `packet lost landing delta: ${delta}`).toContain(delta);
    }

    // The held artifact's own deltas were written from the Stage-3a snapshot and
    // are explicitly historical at landing.
    expect(packet).toContain("Stage-3a snapshot");
    expect(packet).toContain("MUST NOT be applied");
    expect(packet).toContain("872 → 873");
    expect(packet).toContain(`${thousands(1696)} → ${thousands(1699)}`);
  });

  it("records both mandatory landing reviews and the transitive withhold", () => {
    const packet = read(PACKET);

    // (1) CRG parallel-targeting against the published umbrella window.
    expect(packet).toContain("rel-ptsd-to-substance-use-disorder");
    expect(packet).toContain("11481147");
    expect(packet).toContain("npm run audit:crg");
    // (2) Transitive chain check with the withheld direct edge.
    expect(packet).toContain("rel-alcohol-use-disorder-to-chronic-liver-disease");
    expect(packet).toContain("WITHHELD");
    expect(packet).toContain("audit:crg:graph");
    expect(packet).toContain("cirrhosis-of-the-liver");
  });

  it("carries an ordered landing procedure that closes every record on approval", () => {
    const packet = read(PACKET);

    expect(packet).toContain("## Landing procedure (ordered)");
    expect(packet).toContain("executes only after all three anchors are approved");
    for (const step of [
      "**Record the decision.**",
      "node scripts/preflight-source-status.js --pmids 35587413,32939901,24933396",
      "`landingRecord` in the batch-91 pattern",
      "LANDED_",
      "preserving the `heldEdges` body verbatim",
      "at rank 21 with the three references `verified: true`",
      "Registry lockstep at landing",
      "data/knowledge-base/graph/",
      "npm run audit:crg:graph",
      "**Update the pins.**",
      "docs/qualified-human-citation-verification-queue.md",
      "npm run citations:queue",
      "none of the steps above execute",
    ]) {
      expect(packet, `packet lost landing step: ${step}`).toContain(step);
    }

    // The procedure is decision-time only: the live artifact must stay held.
    expect(held.status.startsWith("HELD_2026-10-04")).toBe(true);
  });

  it("discloses the digest policy without authorizing a pin raise", () => {
    const packet = read(PACKET);

    expect(packet).toContain("contentDigest");
    expect(packet).toContain("dynamic per fetch");
    expect(packet).toContain("MAX_UNDIGESTED_VERIFIED_REFS");
    expect(packet).toContain("383");
    expect(packet).toContain("never raised");
  });

  it("stays wired from the queue doc with the queue's policy anchors", () => {
    const queue = read(QUEUE);

    // The no-decision/read-only posture and the queue wiring itself are pinned
    // by the shared harness; this test keeps the queue doc's own policy anchors.
    expect(queue).toContain(PACKET);
    expect(queue).toContain("generated, not transcribed");
    expect(queue).toContain("npm run citations:audit");
    expect(queue).toContain("npm run citations:queue");
  });

  it("is registered in the shared adjudication-packet harness", () => {
    expect(ADJUDICATION_PACKETS.some((spec) => spec.packetPath === PACKET)).toBe(true);
  });
});
