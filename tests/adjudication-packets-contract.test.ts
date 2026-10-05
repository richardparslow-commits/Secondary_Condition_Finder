import { describe, expect, it } from "vitest";

import {
  ADJUDICATION_PACKETS,
  evaluateAdjudicationPacket,
  loadAdjudicationCorpus,
  type AdjudicationCorpus,
  type AdjudicationPacketSpec,
} from "./helpers/adjudication-packets";
import { readRepoMarkdown } from "./helpers/doc-lint";

/**
 * Shared adjudication-packet harness contract.
 *
 * Every packet registered in `ADJUDICATION_PACKETS` is pinned here to the live
 * corpus — identity (subject registration posture, forbidden window-discipline
 * pairs, anchor PMIDs/URLs/dates/source entities) and posture (open decision
 * slots, framing markers, living-doc wiring). A future packet joins by adding
 * a row to the table; it needs no bespoke identity/posture suite of its own.
 *
 * The self-tests below exercise the same harness against a synthetic corpus,
 * so a rule that silently stops firing (an anchor check that can never fail,
 * a wiring check that passes vacuously) is itself caught instead of
 * protecting the registered packets vacuously.
 */

const repoRoot = process.cwd();
const corpus = loadAdjudicationCorpus(repoRoot);
const readText = (relativePath: string): string =>
  readRepoMarkdown(repoRoot, relativePath);

describe("adjudication packet harness", () => {
  it("registers each packet once, resolvable and well-formed", () => {
    expect(ADJUDICATION_PACKETS.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const spec of ADJUDICATION_PACKETS) {
      expect(spec.label, "every packet needs a label").not.toBe("");
      expect(
        seen.has(spec.packetPath),
        `${spec.packetPath} is registered twice`,
      ).toBe(false);
      seen.add(spec.packetPath);
      expect(
        spec.subjects.length,
        `${spec.label} registers no subjects`,
      ).toBeGreaterThan(0);
      expect(() => readText(spec.packetPath)).not.toThrow();
      const pmids = (spec.anchors ?? []).map((anchor) => anchor.pmid);
      expect(new Set(pmids).size, `${spec.label} repeats an anchor PMID`).toBe(
        pmids.length,
      );
      if (spec.decisionSlots) {
        expect(
          pmids.length,
          `${spec.label} declares decision slots without anchors`,
        ).toBeGreaterThan(0);
      }
      expect(
        spec.wiredFrom?.length ?? 0,
        `${spec.label} declares no wiring`,
      ).toBeGreaterThan(0);
    }
  });

  for (const spec of ADJUDICATION_PACKETS) {
    describe(spec.label, () => {
      it("pins identity and posture against the live corpus", () => {
        const report = evaluateAdjudicationPacket(spec, {
          packetText: readText(spec.packetPath),
          corpus,
          readText,
        });
        expect(
          report.problems,
          `identity/posture drift in ${spec.packetPath}:\n${report.problems.join("\n")}`,
        ).toEqual([]);
      });
    });
  }

  describe("self-tests against a synthetic corpus", () => {
    const syntheticCorpus: AdjudicationCorpus = {
      registryRows: [
        { relationshipId: "rel-a-to-b", primaryId: "a", targetId: "b" },
      ],
      kbSuggestions: [{ sourceId: "a", targetId: "b" }],
      sourceEntities: [{ sourceId: "pmid-111", pmid: "111" }],
    };

    const syntheticSpec: AdjudicationPacketSpec = {
      label: "synthetic held packet",
      packetPath: "docs/synthetic-packet.md",
      subjects: [
        {
          label: "held edge a → c",
          relationshipId: "rel-a-to-c",
          sourceId: "a",
          targetId: "c",
          registered: false,
        },
      ],
      forbiddenPairs: [
        { label: "forbidden b ↔ c", sourceId: "b", targetId: "c" },
      ],
      anchors: [
        {
          pmid: "111",
          sourceCheckedOn: "2026-01-01",
          sourceEntityRegistered: true,
        },
      ],
      decisionSlots: {
        markers: ["[ ] APPROVE"],
        blankMarkers: ["Reviewer: —"],
      },
      postureMarkers: [
        {
          marker: "records no decision",
          count: 1,
          description: "no-decision posture",
        },
      ],
      wiredFrom: ["docs/wired.md"],
    };

    const packetText = [
      "PMID 111",
      "https://pubmed.ncbi.nlm.nih.gov/111/",
      "2026-01-01",
      "[ ] APPROVE",
      "Reviewer: —",
      "records no decision",
    ].join("\n");

    const syntheticReadText = (relativePath: string): string =>
      relativePath === "docs/wired.md"
        ? "the packet is docs/synthetic-packet.md"
        : "";

    function evaluateSynthetic(
      overrides: {
        spec?: Partial<AdjudicationPacketSpec>;
        packetText?: string;
        corpus?: AdjudicationCorpus;
        readText?: (relativePath: string) => string;
      } = {},
    ): string[] {
      const spec: AdjudicationPacketSpec = {
        ...syntheticSpec,
        ...overrides.spec,
      };
      return evaluateAdjudicationPacket(spec, {
        packetText: overrides.packetText ?? packetText,
        corpus: overrides.corpus ?? syntheticCorpus,
        readText: overrides.readText ?? syntheticReadText,
      }).problems;
    }

    it("passes a fully pinned packet and reports nothing", () => {
      expect(evaluateSynthetic()).toEqual([]);
    });

    it("reports anchor identity drift: PMID, URL, date, and source posture", () => {
      expect(evaluateSynthetic({ packetText: "no anchors here" })).toEqual(
        expect.arrayContaining([
          expect.stringContaining("PMID 111 is not enumerated"),
          expect.stringContaining("canonical URL"),
          expect.stringContaining("source-checked date 2026-01-01"),
        ]),
      );
      expect(
        evaluateSynthetic({
          corpus: { ...syntheticCorpus, sourceEntities: [] },
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining("has no master-sources entity"),
        ]),
      );
    });

    it("reports registration posture mismatches in both directions", () => {
      const heldButRegistered = evaluateSynthetic({
        corpus: {
          ...syntheticCorpus,
          registryRows: [
            ...syntheticCorpus.registryRows,
            { relationshipId: "rel-a-to-c", primaryId: "a", targetId: "c" },
          ],
        },
      });
      expect(heldButRegistered).toEqual(
        expect.arrayContaining([
          expect.stringContaining("held edge a → c is registered"),
          expect.stringContaining("rel-a-to-c already exists"),
        ]),
      );

      const premiseMissing = evaluateSynthetic({
        spec: {
          ...syntheticSpec,
          subjects: [
            {
              label: "premise edge a → b",
              relationshipId: "rel-a-to-b",
              sourceId: "a",
              targetId: "b",
              registered: true,
            },
          ],
        },
        corpus: { ...syntheticCorpus, registryRows: [], kbSuggestions: [] },
      });
      expect(premiseMissing).toEqual(
        expect.arrayContaining([
          expect.stringContaining("no live registry row registers a → b"),
          expect.stringContaining("no authored mapping registers"),
        ]),
      );
    });

    it("reports forbidden pairs registered in either orientation", () => {
      const reverse = evaluateSynthetic({
        corpus: {
          ...syntheticCorpus,
          registryRows: [
            ...syntheticCorpus.registryRows,
            { relationshipId: "rel-c-to-b", primaryId: "c", targetId: "b" },
          ],
          kbSuggestions: [
            ...syntheticCorpus.kbSuggestions,
            { sourceId: "c", targetId: "b" },
          ],
        },
      });
      expect(reverse).toEqual(
        expect.arrayContaining([
          expect.stringContaining("forbidden pair is registered"),
          expect.stringContaining(
            "forbidden pair has an authored mapping suggestion",
          ),
        ]),
      );
    });

    it("reports decision-slot counts and blank-evidence drift", () => {
      expect(
        evaluateSynthetic({
          packetText: packetText.replace("[ ] APPROVE", ""),
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'decision marker "[ ] APPROVE" appears 0 time(s); expected 1',
          ),
        ]),
      );
      expect(
        evaluateSynthetic({
          packetText: packetText.replace("Reviewer: —", ""),
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'decision marker "Reviewer: —" appears 0 time(s)',
          ),
        ]),
      );
    });

    it("reports posture-marker drift, including wrong counts", () => {
      expect(
        evaluateSynthetic({
          packetText: packetText.replace("records no decision", ""),
        }),
      ).toEqual(
        expect.arrayContaining([expect.stringContaining("no-decision posture")]),
      );
      expect(
        evaluateSynthetic({ packetText: `${packetText}\nrecords no decision` }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining("appears 2 time(s); expected 1"),
        ]),
      );
    });

    it("reports missing wiring references and unreadable wiring docs", () => {
      expect(evaluateSynthetic({ readText: () => "no pointer here" })).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "no longer points at docs/synthetic-packet.md",
          ),
        ]),
      );
      expect(
        evaluateSynthetic({
          readText: () => {
            throw new Error("missing");
          },
        }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining("wired document docs/wired.md could not be read"),
        ]),
      );
    });

    it("reports decision slots declared without anchors", () => {
      expect(
        evaluateSynthetic({ spec: { ...syntheticSpec, anchors: [] } }),
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining("registers no anchors"),
        ]),
      );
    });
  });
});
