import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared contract harness for adjudication packets.
 *
 * An adjudication packet is a dated document that prepares or records a
 * qualified-human decision about one edge or window question (a held edge's
 * verification packet, a redundancy adjudication, and so on). While the
 * packet is open, every load-bearing claim it makes about the corpus must
 * stay true; a packet that silently describes a graph or registry that moved
 * is worse than no packet at all.
 *
 * This harness pins two families of claims for every registered packet:
 *
 * - IDENTITY — the packet's subjects and anchors exist in the live corpus in
 *   the state the packet describes: a held edge is absent from
 *   `master-relationships.json` and the authored mappings; an adjudicated
 *   premise edge is present under its relationship id; forbidden
 *   window-discipline pairs are absent in either orientation; each anchor's
 *   PMID, canonical URL, and source-checked date are enumerated; and each
 *   anchor's source-entity registration posture matches.
 *
 * - POSTURE — the packet's own framing is pinned: open decision slots appear
 *   exactly once per anchor with blank reviewer evidence, framing markers
 *   appear with their exact counts, and every declared living document still
 *   points at the packet.
 *
 * Register a future packet by adding a row to `ADJUDICATION_PACKETS`; the
 * shared suite (`tests/adjudication-packets-contract.test.ts`) then pins its
 * identity and posture automatically. A bespoke suite is only needed for
 * packet-specific contracts (ratchets, mandatory landing reviews, tripwires),
 * not for the shared pinning.
 *
 * The evaluator is pure: it takes the packet text, a live-corpus snapshot,
 * and a document reader, and returns a list of problems. That keeps the
 * self-tests in the shared suite honest — every rule can be exercised against
 * a synthetic corpus without touching the repository.
 */

/** One row of `data/evidence/master-relationships.json`. */
export type AdjudicationRegistryRow = {
  relationshipId: string;
  primaryId: string;
  targetId: string;
};

/** One authored-mapping suggestion (`source` mapping → target condition). */
export type AdjudicationKbSuggestion = {
  sourceId: string;
  targetId: string;
};

/** One `data/evidence/master-sources.json` entity, keyed by its PMID. */
export type AdjudicationSourceEntity = {
  sourceId: string;
  pmid: string | null;
};

/** Live-corpus snapshot the packet's identity claims are checked against. */
export type AdjudicationCorpus = {
  registryRows: readonly AdjudicationRegistryRow[];
  kbSuggestions: readonly AdjudicationKbSuggestion[];
  sourceEntities: readonly AdjudicationSourceEntity[];
};

/**
 * Collect every registry row recursively, so a future schema that nests the
 * rows deeper cannot silently empty the identity checks.
 */
export function collectRegistryRows(
  value: unknown,
  rows: AdjudicationRegistryRow[] = [],
): AdjudicationRegistryRow[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRegistryRows(item, rows);
    return rows;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (
      typeof record.relationshipId === "string" &&
      typeof record.primaryId === "string" &&
      typeof record.targetId === "string"
    ) {
      rows.push({
        relationshipId: record.relationshipId,
        primaryId: record.primaryId,
        targetId: record.targetId,
      });
    }
    for (const item of Object.values(record)) collectRegistryRows(item, rows);
  }
  return rows;
}

/** Every suggestion across the authored mappings under `kbDir`. */
export function collectKbSuggestions(kbDir: string): AdjudicationKbSuggestion[] {
  const suggestions: AdjudicationKbSuggestion[] = [];
  for (const entry of readdirSync(kbDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const mapping = JSON.parse(
      readFileSync(join(kbDir, entry.name), "utf8"),
    ) as { id?: string; suggestions?: Array<{ conditionId?: string }> };
    for (const suggestion of mapping.suggestions ?? []) {
      if (
        typeof mapping.id === "string" &&
        typeof suggestion.conditionId === "string"
      ) {
        suggestions.push({
          sourceId: mapping.id,
          targetId: suggestion.conditionId,
        });
      }
    }
  }
  return suggestions;
}

/** Every source entity in `master-sources.json`, keyed by PMID. */
export function collectSourceEntities(
  sourcesFilePath: string,
): AdjudicationSourceEntity[] {
  const parsed = JSON.parse(readFileSync(sourcesFilePath, "utf8")) as {
    sources?: Array<{ sourceId?: string; pmid?: string | null }>;
  };
  return (parsed.sources ?? [])
    .filter((entity) => typeof entity.sourceId === "string")
    .map((entity) => ({
      sourceId: entity.sourceId as string,
      pmid: typeof entity.pmid === "string" ? entity.pmid : null,
    }));
}

/** Read the live registry, authored mappings, and source entities once. */
export function loadAdjudicationCorpus(
  repoRoot: string = process.cwd(),
): AdjudicationCorpus {
  return {
    registryRows: collectRegistryRows(
      JSON.parse(
        readFileSync(
          join(repoRoot, "data", "evidence", "master-relationships.json"),
          "utf8",
        ),
      ),
    ),
    kbSuggestions: collectKbSuggestions(
      join(repoRoot, "data", "knowledge-base"),
    ),
    sourceEntities: collectSourceEntities(
      join(repoRoot, "data", "evidence", "master-sources.json"),
    ),
  };
}

/* ─── Packet specifications ──────────────────────────────────────────── */

export type AdjudicationAnchorSpec = {
  pmid: string;
  /** Canonical record URL; defaults to the PubMed record URL for the PMID. */
  sourceUrl?: string;
  /** Date the source was checked; asserted present when declared. */
  sourceCheckedOn?: string;
  /**
   * Source-entity registration posture: false requires the PMID to appear on
   * no master-sources entity (a held anchor); true requires it to appear.
   * Undefined skips the check.
   */
  sourceEntityRegistered?: boolean;
};

export type AdjudicationSubjectSpec = {
  /** Human label for failure messages. */
  label: string;
  /**
   * Relationship id the packet names; asserted absent while the edge is held,
   * and required on the matching row once the edge is registered.
   */
  relationshipId?: string;
  sourceId: string;
  targetId: string;
  /** Registration posture the packet rests on for this edge. */
  registered: boolean;
};

export type AdjudicationForbiddenPairSpec = {
  label: string;
  sourceId: string;
  targetId: string;
};

export type AdjudicationDecisionSlotsSpec = {
  /** Decision markers, one occurrence per anchor while the review is open. */
  markers: readonly string[];
  /** Blank reviewer-evidence markers, one occurrence per anchor. */
  blankMarkers?: readonly string[];
};

export type AdjudicationPostureMarker = {
  marker: string;
  /** Exact required count; omit to require mere presence. */
  count?: number;
  description: string;
};

export type AdjudicationPacketSpec = {
  label: string;
  /** Repo-relative packet path; the reference its wiring docs must carry. */
  packetPath: string;
  subjects: readonly AdjudicationSubjectSpec[];
  /** Pairs that must not exist in either orientation (window discipline). */
  forbiddenPairs?: readonly AdjudicationForbiddenPairSpec[];
  anchors?: readonly AdjudicationAnchorSpec[];
  decisionSlots?: AdjudicationDecisionSlotsSpec;
  postureMarkers?: readonly AdjudicationPostureMarker[];
  wiredFrom?: readonly string[];
};

/**
 * The registered adjudication packets. Add a row here when a new packet
 * lands; do not loosen a pin to make a moved corpus pass — update the packet
 * (or supersede it with a dated record) instead.
 */
export const ADJUDICATION_PACKETS: readonly AdjudicationPacketSpec[] = [
  {
    label: "batch 93 held-edge verification packet (ptsd → alcohol-use-disorder)",
    packetPath: "docs/batch-93-ptsd-alcohol-use-disorder-verification-packet.md",
    subjects: [
      {
        label: "held edge ptsd → alcohol-use-disorder",
        relationshipId: "rel-ptsd-to-alcohol-use-disorder",
        sourceId: "ptsd",
        targetId: "alcohol-use-disorder",
        registered: false,
      },
    ],
    anchors: [
      {
        pmid: "35587413",
        sourceCheckedOn: "2026-10-04",
        sourceEntityRegistered: false,
      },
      {
        pmid: "32939901",
        sourceCheckedOn: "2026-10-04",
        sourceEntityRegistered: false,
      },
      {
        pmid: "24933396",
        sourceCheckedOn: "2026-10-04",
        sourceEntityRegistered: false,
      },
    ],
    decisionSlots: {
      markers: [
        "[ ] APPROVE AS WRITTEN",
        "[ ] APPROVE WITH NARROWING",
        "[ ] REJECT",
        "[ ] HOLD",
      ],
      blankMarkers: ["Reviewer identity/role: —", "Digest decision: —"],
    },
    postureMarkers: [
      {
        marker: "This packet records no decision",
        count: 1,
        description: "the packet states that it records no decision",
      },
      {
        marker: "read-only",
        count: 1,
        description: "the packet states its read-only scope",
      },
      {
        marker: "The decision belongs to the qualified human",
        count: 1,
        description: "the packet defers the decision to the qualified human",
      },
      {
        marker: "Current state:** `verified: false`",
        count: 3,
        description: "each held anchor's pending state is stated once",
      },
    ],
    wiredFrom: ["docs/qualified-human-citation-verification-queue.md"],
  },
  {
    label: "cirrhosis-of-the-liver → sarcopenia redundancy adjudication",
    packetPath:
      "docs/cirrhosis-of-the-liver-sarcopenia-redundancy-adjudication-2026-disposition.md",
    subjects: [
      {
        label: "adjudicated premise pair liver-cancer → sarcopenia",
        relationshipId: "rel-liver-cancer-to-sarcopenia",
        sourceId: "liver-cancer",
        targetId: "sarcopenia",
        registered: true,
      },
    ],
    forbiddenPairs: [
      {
        label: "the never-authored liver-cancer ↔ cirrhosis-of-the-liver hop",
        sourceId: "liver-cancer",
        targetId: "cirrhosis-of-the-liver",
      },
      {
        label: "the not-yet-authored cirrhosis-of-the-liver → sarcopenia window",
        sourceId: "cirrhosis-of-the-liver",
        targetId: "sarcopenia",
      },
    ],
    postureMarkers: [
      {
        marker: "adjudicated window-discipline disposition (read-only)",
        count: 1,
        description: "the record carries its read-only adjudication status",
      },
      {
        marker: "Supersession trigger",
        count: 1,
        description: "the record states its supersession trigger",
      },
    ],
    wiredFrom: [
      "docs/catalog-identity-migration-design-2026-09-29.md",
      "docs/liver-cancer-sarcopenia-citation-verification-2026-disposition.md",
      "docs/crg-adjacency-migration-checklist.md",
    ],
  },
];

/* ─── Evaluation ────────────────────────────────────────────────────── */

/** PubMed record URL for one PMID — the canonical anchor identity URL. */
function pubmedRecordUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

function countOccurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

export type AdjudicationPacketEvaluation = {
  packetText: string;
  corpus: AdjudicationCorpus;
  /** Reads a repo-relative document for wiring checks. */
  readText: (relativePath: string) => string;
};

export type AdjudicationPacketReport = {
  label: string;
  packetPath: string;
  problems: string[];
};

/**
 * Check one packet's identity and posture claims against the live corpus and
 * return every violation as a self-describing line. Pure: the caller supplies
 * the packet text, the corpus snapshot, and the document reader.
 */
export function evaluateAdjudicationPacket(
  spec: AdjudicationPacketSpec,
  input: AdjudicationPacketEvaluation,
): AdjudicationPacketReport {
  const { packetText, corpus, readText } = input;
  const problems: string[] = [];
  const anchors = spec.anchors ?? [];

  // Identity: subject edges against the live registry and authored mappings.
  for (const subject of spec.subjects) {
    const edge = `${subject.sourceId} → ${subject.targetId}`;
    const registryMatches = corpus.registryRows.filter(
      (row) =>
        row.primaryId === subject.sourceId && row.targetId === subject.targetId,
    );
    const kbMatch = corpus.kbSuggestions.some(
      (suggestion) =>
        suggestion.sourceId === subject.sourceId &&
        suggestion.targetId === subject.targetId,
    );

    if (subject.registered) {
      if (registryMatches.length === 0) {
        problems.push(
          `${subject.label}: no live registry row registers ${edge}, but the packet rests on it being registered.`,
        );
      } else if (
        subject.relationshipId &&
        !registryMatches.some(
          (row) => row.relationshipId === subject.relationshipId,
        )
      ) {
        problems.push(
          `${subject.label}: live registry registers ${edge} without relationship id ${subject.relationshipId}.`,
        );
      }
      if (!kbMatch) {
        problems.push(
          `${subject.label}: no authored mapping registers the ${edge} suggestion.`,
        );
      }
    } else {
      if (registryMatches.length > 0) {
        problems.push(
          `${subject.label}: the held edge ${edge} is registered in master-relationships.json (${registryMatches
            .map((row) => row.relationshipId)
            .join(", ")}).`,
        );
      }
      if (
        subject.relationshipId &&
        corpus.registryRows.some(
          (row) => row.relationshipId === subject.relationshipId,
        )
      ) {
        problems.push(
          `${subject.label}: relationship id ${subject.relationshipId} already exists in master-relationships.json.`,
        );
      }
      if (kbMatch) {
        problems.push(
          `${subject.label}: the held edge ${edge} has an authored mapping suggestion.`,
        );
      }
    }
  }

  // Identity: window-discipline pairs must stay unauthored in either orientation.
  for (const pair of spec.forbiddenPairs ?? []) {
    const registryHits = corpus.registryRows.filter(
      (row) =>
        (row.primaryId === pair.sourceId && row.targetId === pair.targetId) ||
        (row.primaryId === pair.targetId && row.targetId === pair.sourceId),
    );
    if (registryHits.length > 0) {
      problems.push(
        `${pair.label}: the forbidden pair is registered in master-relationships.json (${registryHits
          .map((row) => row.relationshipId)
          .join(", ")}).`,
      );
    }
    const kbHits = corpus.kbSuggestions.filter(
      (suggestion) =>
        (suggestion.sourceId === pair.sourceId &&
          suggestion.targetId === pair.targetId) ||
        (suggestion.sourceId === pair.targetId &&
          suggestion.targetId === pair.sourceId),
    );
    if (kbHits.length > 0) {
      problems.push(
        `${pair.label}: the forbidden pair has an authored mapping suggestion (${kbHits
          .map((hit) => `${hit.sourceId} → ${hit.targetId}`)
          .join(", ")}).`,
      );
    }
  }

  // Identity: every anchor is enumerated with URL, date, and source posture.
  for (const anchor of anchors) {
    const sourceUrl = anchor.sourceUrl ?? pubmedRecordUrl(anchor.pmid);
    if (!packetText.includes(`PMID ${anchor.pmid}`)) {
      problems.push(`anchor PMID ${anchor.pmid} is not enumerated in the packet.`);
    }
    if (!packetText.includes(sourceUrl)) {
      problems.push(
        `anchor PMID ${anchor.pmid} does not carry its canonical URL ${sourceUrl}.`,
      );
    }
    if (anchor.sourceCheckedOn && !packetText.includes(anchor.sourceCheckedOn)) {
      problems.push(
        `anchor PMID ${anchor.pmid} does not record its source-checked date ${anchor.sourceCheckedOn}.`,
      );
    }
    if (anchor.sourceEntityRegistered !== undefined) {
      const registered = corpus.sourceEntities.some(
        (entity) => entity.pmid === anchor.pmid,
      );
      if (registered !== anchor.sourceEntityRegistered) {
        problems.push(
          anchor.sourceEntityRegistered
            ? `anchor PMID ${anchor.pmid} has no master-sources entity, but the packet rests on it being registered.`
            : `anchor PMID ${anchor.pmid} is already a master-sources entity while the packet describes it as unregistered.`,
        );
      }
    }
  }

  // Posture: open decision slots and blank reviewer evidence, one per anchor.
  if (spec.decisionSlots) {
    if (anchors.length === 0) {
      problems.push(
        "decision slots are declared but the specification registers no anchors.",
      );
    }
    for (const marker of [
      ...spec.decisionSlots.markers,
      ...(spec.decisionSlots.blankMarkers ?? []),
    ]) {
      const count = countOccurrences(packetText, marker);
      if (count !== anchors.length) {
        problems.push(
          `decision marker "${marker}" appears ${count} time(s); expected ${anchors.length} (one per anchor).`,
        );
      }
    }
  }

  // Posture: framing markers with their exact counts.
  for (const pin of spec.postureMarkers ?? []) {
    const count = countOccurrences(packetText, pin.marker);
    const expected = pin.count;
    if (count === 0 || (expected !== undefined && count !== expected)) {
      problems.push(
        `${pin.description}: marker "${pin.marker}" appears ${count} time(s)${
          expected === undefined ? "" : `; expected ${expected}`
        }.`,
      );
    }
  }

  // Posture: every declared living document still points at the packet.
  for (const doc of spec.wiredFrom ?? []) {
    let text: string;
    try {
      text = readText(doc);
    } catch {
      problems.push(`wired document ${doc} could not be read.`);
      continue;
    }
    if (!text.includes(spec.packetPath)) {
      problems.push(
        `wired document ${doc} no longer points at ${spec.packetPath}.`,
      );
    }
  }

  return { label: spec.label, packetPath: spec.packetPath, problems };
}

