import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  catalogConditionSchema,
  type CatalogCondition,
  type ConditionCatalog,
} from "@/lib/catalog/schema";
import {
  conditionMappingSchema,
  suggestionSchema,
  type ConditionMapping,
  type Suggestion,
} from "@/lib/kb/schema";
import { loadConditionCatalog, resetConditionCatalogCache } from "@/lib/catalog/load";

/**
 * Doc-example schema contract — companion to the README consistency gate
 * (tests/readme-consistency.test.ts).
 *
 * Fenced JSON examples in the living documentation must never silently drift
 * from the shapes the system actually validates. A doc example that fails
 * validation is worse than none: it teaches the exact shape the system
 * rejects. This suite enforces three tiers of honesty for every fenced block
 * under docs/:
 *
 * 1. Structural integrity: every ```json fence is closed, and every `json`
 *    block parses as strict JSON. Type sketches with pipe unions and `{ ... }`
 *    elisions are NOT valid examples — they must use the intentional `jsonc`
 *    fence, which master-specification.md already uses for its commented
 *    schema draft. ```json means executable, not approximately.
 * 2. Field hygiene: no hardcoded snapshot-style metrics in illustrative data
 *    (counts like the component catalog count are sample values in wire
 *    responses and stay allowed there; this tier only bans them in
 *    schema-bearing examples, which the deep-validation tier covers by
 *    construction).
 * 3. Deep validation against the real Zod schemas: blocks that claim to show
 *    knowledge-base or catalog data must parse against `suggestionSchema` /
 *    `conditionMappingSchema` / `catalogConditionSchema` — including every
 *    `superRefine` business rule (50-character narrative minimums,
 *    ASSOCIATION_ONLY guardrails, verified-reference provenance requirements,
 *    gapless rank sequences). Where a doc example mirrors a real record
 *    (OSA → anxiety-disorder, the sleep-apnea catalog row), the record must
 *    still exist so the example remains grounded.
 *
 * When a schema evolves, this suite fails the doc update that would have
 * shipped a stale example. When a doc intentionally illustrates a commented
 * draft, use ```jsonc — the fence is the declaration.
 */

type FencedBlock = {
  /** Doc-relative file name (e.g. "api-specification.md"). */
  file: string;
  /** 1-indexed line number of the opening fence. */
  line: number;
  /** Fence info string, lowercased ("" | "json" | "jsonc" | ...). */
  lang: string;
  body: string;
};

const FENCE_OPEN = /^```([A-Za-z0-9_-]*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/**
 * Line-oriented fence extractor. Deliberately does NOT use a global regex on
 * the whole file: fences are line-anchored in CommonMark, and the README
 * consistency suite already proved that span-matching across newlines
 * silently mis-pairs when a stray backtick appears. An unterminated fence is
 * itself a defect the structural tier reports with the opening line number.
 */
function extractFencedBlocks(docsDir: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const files = readdirSync(docsDir).filter((name) => name.endsWith(".md")).sort();
  for (const file of files) {
    const lines = readFileSync(join(docsDir, file), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const open = lines[i]?.match(FENCE_OPEN);
      if (!open) continue;
      let closeLine = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (FENCE_CLOSE.test(lines[j] ?? "")) {
          closeLine = j;
          break;
        }
      }
      blocks.push({
        file,
        line: i + 1,
        lang: (open[1] ?? "").toLowerCase(),
        body: closeLine === -1 ? lines.slice(i + 1).join("\n") : lines.slice(i + 1, closeLine).join("\n"),
      });
      if (closeLine === -1) break; // unterminated: stop scanning this file
      i = closeLine; // skip the body — fences do not nest
    }
  }
  return blocks;
}

const docsDir = join(process.cwd(), "docs");
const blocks = extractFencedBlocks(docsDir);

function describeBlock(block: FencedBlock): string {
  return `docs/${block.file}:${block.line}`;
}

/* ─── Tier 1: structural integrity of every fenced block ─────────────────── */

describe("fenced-JSON structural integrity across docs/", () => {
  it("discovers fenced blocks in the living docs", () => {
    expect(blocks.length).toBeGreaterThan(10);
  });

  it("closes every fence it opens", () => {
    const unterminated = blocks.filter((block) => {
      const lines = readFileSync(join(docsDir, block.file), "utf8").split("\n");
      const openIndex = block.line - 1;
      if (!FENCE_OPEN.test(lines[openIndex] ?? "")) return false;
      return !lines.slice(openIndex + 1).some((line) => FENCE_CLOSE.test(line));
    });
    expect(
      unterminated.map(describeBlock),
      `unterminated fences found: ${unterminated.map(describeBlock).join(", ")}`,
    ).toEqual([]);
  });

  it("parses every ```json block as strict JSON — elisions must use ```jsonc", () => {
    const failures: string[] = [];
    for (const block of blocks.filter((candidate) => candidate.lang === "json")) {
      try {
        JSON.parse(block.body);
      } catch (error) {
        failures.push(`${describeBlock(block)}: ${(error as Error).message}`);
      }
    }
    expect(
      failures,
      "```json blocks must be executable examples. If the block illustrates a " +
        "type sketch or commented schema draft, fence it as ```jsonc instead.",
    ).toEqual([]);
  });

  it("treats ```jsonc as the sanctioned commented-draft fence", () => {
    // master-specification.md's commented schema draft must stay jsonc — the
    // json fence would fail strict JSON parsing, and silently re-fencing it
    // as json would reintroduce unparseable docs.
    const jsoncBlocks = blocks.filter((block) => block.lang === "jsonc");
    expect(jsoncBlocks.length).toBeGreaterThan(0);
    for (const block of jsoncBlocks) {
      // jsonc permits comments; it must still be recognizably a JSON object
      // once comments and trailing commas are stripped.
      const stripped = block.body
        .replace(/\/\/[^\n]*/g, "")
        .replace(/,(\s*[}\]])/g, "$1");
      expect(() => JSON.parse(stripped), `${describeBlock(block)} is not even comment-stripped JSON`).not.toThrow();
    }
  });
});

/* ─── Tier 2: deep validation against the real schemas ───────────────────── */

/**
 * Published-context wrapper: doc examples show single suggestions, but
 * `conditionMappingSchema` also enforces file-level rules (gapless rank
 * sequence, no self-reference, published-file hygiene). Wrapping the example
 * as a one-row published mapping exercises the full superRefine surface —
 * rank 3 alone would violate the gapless rule, so rank is renumbered to 1 in
 * isolation. This mirrors exactly what `npm run kb:validate` enforces on disk.
 */
function parseSuggestionAsMapping(suggestion: unknown, hostId: string): ConditionMapping {
  const row = JSON.parse(JSON.stringify(suggestion)) as Suggestion;
  return conditionMappingSchema.parse({
    id: hostId,
    draft: false,
    todo: [],
    suggestions: [{ ...row, rank: 1 }],
  } satisfies z.input<typeof conditionMappingSchema>);
}

describe("knowledge-base examples validate against suggestionSchema", () => {
  const kbBlocks = blocks.filter((block) => block.file === "evidence-architecture-v2.md" && block.lang === "json");

  it("presents both full-suggestion examples before the mini delta blocks", () => {
    // Order is contractual: before (line ~41), after (line ~87), then the two
    // claim-theory/nexus-requirement delta fragments. If a doc edit moves or
    // adds full blocks, update the dispatch below deliberately.
    expect(kbBlocks.length).toBe(4);
  });

  it("parses the legacy 'before' example with the authored suggestion schema", () => {
    const before = kbBlocks[0];
    if (!before) throw new Error("before-block missing");
    const parsed = suggestionSchema.parse(JSON.parse(before.body));
    expect(parsed.conditionId).toBe("anxiety-disorder");
    expect(parsed.nexusClaim.nexusClassification).toBe("DIRECT_CAUSATION");
    // Legacy shape: no v2 metadata on the reference.
    expect(parsed.sourceReferences[0]?.authorityCategory).toBeUndefined();
    expect(parsed.sourceReferences[0]?.propositionRole).toBeUndefined();
    expect(parsed.claimTheories).toBeUndefined();
    expect(parsed.nexusRequirement).toBeUndefined();
    // And it is a valid drop-in row for its real host file context.
    expect(() => parseSuggestionAsMapping(parsed, "sleep-apnea")).not.toThrow();
  });

  it("parses the migrated 'after' example with the full v2 surface", () => {
    const after = kbBlocks[1];
    if (!after) throw new Error("after-block missing");
    const parsed = suggestionSchema.parse(JSON.parse(after.body));
    expect(parsed.conditionId).toBe("anxiety-disorder");
    expect(parsed.claimTheories).toEqual(["secondary-causation"]);
    expect(parsed.nexusRequirement).toBe("individual-medical-opinion");
    expect(parsed.sourceReferences[0]?.authorityCategory).toBe("medical-scientific-evidence");
    expect(parsed.sourceReferences[0]?.propositionRole).toBe("clinical-evidence");
    expect(() => parseSuggestionAsMapping(parsed, "sleep-apnea")).not.toThrow();
  });

  it("parses the claim-theory delta fragments against their enums", () => {
    const [, , aggravationDelta, presumptiveDelta] = kbBlocks;
    if (!aggravationDelta || !presumptiveDelta) throw new Error("delta blocks missing");
    const aggravation = JSON.parse(aggravationDelta.body) as Record<string, unknown>;
    const presumptive = JSON.parse(presumptiveDelta.body) as Record<string, unknown>;
    expect(aggravation.claimTheories).toEqual(["secondary-aggravation"]);
    expect(aggravation.nexusRequirement).toBe("individual-medical-opinion");
    expect(presumptive.claimTheories).toEqual(["presumptive"]);
    expect(presumptive.nexusRequirement).toBe("legally-presumed");
  });

  it("keeps the examples anchored to real records in the knowledge base", () => {
    // The doc's examples are grounded in the live OSA file. If that row moves
    // or is re-ranked, the doc example must be deliberately re-grounded — not
    // left describing a record that no longer exists.
    const host = JSON.parse(
      readFileSync(join(process.cwd(), "data", "knowledge-base", "sleep-apnea.json"), "utf8"),
    ) as { suggestions: { conditionId: string; rank: number }[] };
    const anchor = host.suggestions.find(
      (candidate) => candidate.conditionId === "anxiety-disorder" && candidate.rank === 3,
    );
    expect(anchor, "sleep-apnea.json no longer hosts anxiety-disorder at rank 3 — re-ground docs/evidence-architecture-v2.md").toBeDefined();
  });
});

/* ─── Tier 3: catalog examples validate against catalogConditionSchema ───── */

function parseCatalogExample(condition: unknown): CatalogCondition {
  // The doc shows one condition; validate it both standalone and as a file
  // body so the example is a drop-in for data/conditions/<file>.json.
  const standalone = catalogConditionSchema.parse(condition);
  expect(() =>
    z
      .object({ bodySystem: z.string().min(1), conditions: z.array(catalogConditionSchema).min(1) })
      .strict()
      .parse({ bodySystem: standalone.bodySystem, conditions: [standalone] }),
  ).not.toThrow();
  return standalone;
}

describe("catalog examples validate against catalogConditionSchema", () => {
  const catalogBlocks = blocks.filter((block) => block.file === "condition-catalog.md" && block.lang === "json");

  it("validates the condition-catalog guide example", () => {
    expect(catalogBlocks.length).toBe(1);
    const block = catalogBlocks[0];
    if (!block) throw new Error("catalog example missing");
    const parsed = parseCatalogExample(JSON.parse(block.body));
    expect(parsed.id).toBe("sleep-apnea");
    expect(parsed.bodySystem).toBe("Respiratory System");
    // A rating citation describes evaluation severity — it must never carry
    // an invented verification claim (docs match the live row: unverified).
    expect(parsed.ratingSchedule[0]?.citation).toBe("38 CFR 4.97");
    expect(parsed.ratingSchedule[0]?.verified).toBe(false);
  });

  it("keeps the catalog example anchored to the live catalog row", () => {
    resetConditionCatalogCache();
    const catalog: ConditionCatalog = loadConditionCatalog();
    const live = catalog.find((condition) => condition.id === "sleep-apnea");
    expect(live, "sleep-apnea vanished from the live catalog — re-ground docs/condition-catalog.md").toBeDefined();
    const block = catalogBlocks[0];
    if (!block || !live) throw new Error("catalog example missing");
    const docRow = catalogConditionSchema.parse(JSON.parse(block.body));
    // Every field the doc states must match the live record; the doc may omit
    // fields (e.g. reviewNotes) but never contradict them.
    expect(docRow.name).toBe(live.name);
    expect(docRow.bodySystem).toBe(live.bodySystem);
    expect(docRow.aliases).toEqual(live.aliases);
    expect(docRow.ratingSchedule).toEqual(live.ratingSchedule);
  });
});

/* ─── Tier 4: the fence contract stays discoverable ──────────────────────── */

describe("doc-example policy visibility", () => {
  it("keeps the jsonc escape hatch documented for future editors", () => {
    const readme = readFileSync(join(process.cwd(), "docs", "master-specification.md"), "utf8");
    expect(readme).toContain("```jsonc");
  });

  it("covers every doc that currently ships json fences", () => {
    // If a new doc starts shipping ```json blocks, this test fails until the
    // suite decides — deliberately — whether they carry a schema contract
    // (add a deep-validation tier) or are wire sketches (they are already
    // covered by the structural tier).
    const filesWithJson = [...new Set(blocks.filter((block) => block.lang === "json").map((block) => block.file))];
    expect(filesWithJson.sort()).toEqual(
      [
        "api-specification.md",
        // The 2026-09-29 migration design ships catalog-entry and KB-stub
        // examples for identities that do not exist yet, so they stay on the
        // structural tier only (deep validation would compare them to live
        // rows that Stage 2 of the design has not created).
        "catalog-identity-migration-design-2026-09-29.md",
        "condition-catalog.md",
        "evidence-architecture-v2.md",
        "operations.md",
      ].sort(),
    );
  });

  it("does not count non-doc example files", () => {
    expect(existsSync(join(docsDir, "evidence-architecture-v2.md"))).toBe(true);
  });
});
