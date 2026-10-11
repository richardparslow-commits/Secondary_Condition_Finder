import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { indexById } from "@/lib/catalog/lookup";
import { loadKbGraphFromDir, resetKbGraphCache } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";
import { conditionMappingSchema, type KnowledgeBase } from "@/lib/kb/schema";
import { validateKnowledgeBaseAgainstCatalog } from "@/lib/kb/validate";

/**
 * Reconciliation lock for the REL-01 quarantine (2026-10-07).
 *
 * The quarantine manifest's own restore instruction is `cp <quarantinePath>
 * <originalPath>`. That instruction is now wrong for all six entries: the
 * owner restored the registered `tinnitus` and `degenerative-disc-disease`
 * draft baseline on 2026-10-10, the `ptsd` and `depressive-disorder` files are published and
 * already carry the same secondary targets, `chronic-pain` has no catalog
 * identity and no medically equivalent candidate, and `tinnitus 2.json` can
 * never be accepted because its filename cannot equal its nodeId.
 *
 * This suite proves through the real loader, the real validator and the real
 * manifest hashes that a blind restore is refused, so the reconciliation
 * cannot be silently undone by copying files back, and the identity
 * determinations stay executable rather than prose.
 *
 * Human-readable record:
 * data/knowledge-base-quarantine/2026-10-07-rel-01/RECONCILIATION.md
 */

const QUARANTINE_SEGMENTS = ["data", "knowledge-base-quarantine", "2026-10-07-rel-01"];

type ManifestEntry = {
  originalPath: string;
  quarantinePath: string;
  sha256: string;
  bytes: number;
  reason: string;
};

const manifest = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), ...QUARANTINE_SEGMENTS, "MANIFEST.json"), "utf8"),
) as { files: ManifestEntry[] };

const restoredName = (entry: ManifestEntry) => path.basename(entry.originalPath);
const quarantineBytes = (entry: ManifestEntry) =>
  fs.readFileSync(path.join(process.cwd(), entry.quarantinePath));

/** Graph adjacency files under `data/knowledge-base/graph/`. */
const graphEntries = manifest.files.filter((entry) =>
  entry.originalPath.startsWith("data/knowledge-base/graph/"),
);
/** Identity-layer mappings under `data/knowledge-base/`. */
const mappingEntries = manifest.files.filter(
  (entry) =>
    entry.originalPath.startsWith("data/knowledge-base/") &&
    !entry.originalPath.startsWith("data/knowledge-base/graph/"),
);

/** Runs `action` and returns the refusal message, failing loudly if it passes. */
function refusal(action: () => void): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the restored draft to be refused, but it was accepted");
}

const temporary: string[] = [];

afterEach(() => {
  resetKbGraphCache();
  for (const directory of temporary.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("REL-01 quarantine reconcile (restore refusal)", () => {
  it("keeps all six drafts byte-for-byte and leaves every runtime path empty", () => {
    expect(manifest.files).toHaveLength(6);
    expect(graphEntries).toHaveLength(3);
    expect(mappingEntries).toHaveLength(3);

    for (const entry of manifest.files) {
      const bytes = quarantineBytes(entry);
      expect(
        crypto.createHash("sha256").update(bytes).digest("hex"),
        entry.quarantinePath,
      ).toBe(entry.sha256);
      expect(bytes.byteLength, entry.quarantinePath).toBe(entry.bytes);
      expect(
        fs.existsSync(path.join(process.cwd(), entry.originalPath)),
        entry.originalPath,
      ).toBe(false);
    }
  });

  it("refuses every quarantined adjacency file at its original graph path", () => {
    const expected: Record<string, RegExp> = {
      // Still schema-invalid: three nested `evidenceGaps` values are arrays.
      "tinnitus.json": /Invalid node mapping in tinnitus\.json/,
      // Both " 2" working copies fail the filename↔nodeId identity check, so
      // the loader can never accept them whatever their content.
      "tinnitus 2.json": /Node id mismatch in tinnitus 2\.json/,
      "degenerative-disc-disease 2.json": /Node id mismatch in degenerative-disc-disease 2\.json/,
    };

    for (const entry of graphEntries) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quarantine-restore-"));
      temporary.push(directory);
      const name = restoredName(entry);
      fs.copyFileSync(path.join(process.cwd(), entry.quarantinePath), path.join(directory, name));
      expect(refusal(() => loadKbGraphFromDir(directory)), name).toMatch(expected[name]);
    }
  });

  it("refuses the superseded copies even under an accepted filename", () => {
    // Reproduces what a well-meaning editor would try after fixing the two
    // reported filename/schema defects: the schema-valid `tinnitus 2.json`
    // content under the accepted name, and the DEGENERATIVE-disc-disease copy
    // under its own nodeId name. Both are still refused against the owner-
    // restored registered baseline; tinnitus's migraine target is unauthored.
    const accepted: Record<string, RegExp> = {
      "tinnitus.json": /Missing authored evidence.*tinnitus.*migraine-headaches/,
      "degenerative-disc-disease.json": /Nexus classification mismatch.*degenerative-disc-disease.*radiculopathy/,
    };
    const copies = [
      graphEntries.find((entry) => restoredName(entry) === "tinnitus 2.json"),
      graphEntries.find((entry) => restoredName(entry) === "degenerative-disc-disease 2.json"),
    ];
    expect(copies.every(Boolean)).toBe(true);

    for (const entry of copies) {
      if (!entry) continue;
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quarantine-restore-"));
      temporary.push(directory);
      // Write under the nodeId-derived name the loader accepts.
      const nodeId = path.basename(restoredName(entry), ".json").replace(/ 2$/, "");
      fs.copyFileSync(path.join(process.cwd(), entry.quarantinePath), path.join(directory, `${nodeId}.json`));
      expect(refusal(() => loadKbGraphFromDir(directory)), nodeId).toMatch(accepted[`${nodeId}.json`]);
    }
  });

  it("refuses every quarantined mapping at its original runtime path", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);

    for (const entry of mappingEntries) {
      const parsed = conditionMappingSchema.safeParse(
        JSON.parse(quarantineBytes(entry).toString("utf8")),
      );
      // Each stays schema-valid — the quarantine is an identity decision, not
      // a schema repair — so a copy back would pass parsing and then fail the
      // catalog identity contract at load time.
      expect(parsed.success, entry.quarantinePath).toBe(true);
      if (!parsed.success) continue;

      expect(byId.has(parsed.data.id), parsed.data.id).toBe(false);
      const kb = [...loadKnowledgeBase(), parsed.data] as KnowledgeBase;
      expect(
        refusal(() => validateKnowledgeBaseAgainstCatalog(catalog, kb)),
        entry.quarantinePath,
      ).toMatch(new RegExp(`^Mapping "${parsed.data.id}" has no matching condition in data/conditions\\.$`));
    }
  });

  describe("recorded identity determinations", () => {
    const catalog = loadConditionCatalog();
    const byId = indexById(catalog);
    const kb = loadKnowledgeBase();
    const mapping = (id: string) => {
      const found = kb.find((candidate) => candidate.id === id);
      if (!found) throw new Error(`test fixture drift: no mapping "${id}"`);
      return found;
    };

    it("chronic-pain: no catalog identity exists and the nearest candidate is a different construct", () => {
      expect(byId.has("chronic-pain")).toBe(false);
      // Not a re-root candidate: `unexplained-chronic-pain` is a distinct
      // diagnosis that authors nothing today, so the NSAID-aggravation claim
      // would be filed under a condition its evidence never described.
      expect(byId.has("unexplained-chronic-pain")).toBe(true);
      expect(mapping("unexplained-chronic-pain").suggestions).toEqual([]);
    });

    it("major-depressive-disorder: root maps to a published file that already carries the target class", () => {
      expect(byId.has("major-depressive-disorder")).toBe(false);
      expect(byId.has("sexual-dysfunction")).toBe(false);
      // The catalog splits "sexual dysfunction" into named identities, so the
      // target cannot be inferred; the published `depressive-disorder` file
      // already carries the male-specific one.
      expect(byId.has("erectile-dysfunction")).toBe(true);
      expect(byId.has("female-sexual-arousal-disorder")).toBe(true);
      const live = mapping("depressive-disorder");
      expect(live.draft).toBe(false);
      expect(live.suggestions.map((suggestion) => suggestion.conditionId)).toContain(
        "erectile-dysfunction",
      );
    });

    it("post-traumatic-stress-disorder: root maps to a published ptsd file that already carries the target", () => {
      expect(byId.has("post-traumatic-stress-disorder")).toBe(false);
      expect(byId.has("ptsd")).toBe(true);
      const live = mapping("ptsd");
      expect(live.draft).toBe(false);
      expect(live.suggestions.map((suggestion) => suggestion.conditionId)).toContain("sleep-apnea");
    });

    it("the retired adjacency copies remain incompatible with the registered draft baseline", () => {
      const tinnitus = mapping("tinnitus");
      expect(tinnitus.draft).toBe(true);
      expect(tinnitus.suggestions.map((suggestion) => suggestion.conditionId)).toEqual([
        "depressive-disorder", "insomnia",
      ]);
      expect(tinnitus.suggestions.map((suggestion) => suggestion.conditionId)).not.toContain(
        "migraine-headaches",
      );

      const discDisease = mapping("degenerative-disc-disease");
      expect(discDisease.suggestions.map((suggestion) => suggestion.conditionId)).toContain(
        "radiculopathy",
      );
      expect(discDisease.draft).toBe(true);
      // The quarantined adjacency copy still asserts DIRECT_CAUSATION.
      expect(discDisease.suggestions[0].nexusClaim.nexusClassification).toBe("ASSOCIATION_ONLY");
    });

    it("preserves both replacement drafts for review and restores the registered baseline byte-for-byte", () => {
      const packetDir = "docs/clinical-baseline-reconciliation-2026-10-10";
      const packet = JSON.parse(fs.readFileSync(path.join(process.cwd(), packetDir, "manifest.json"), "utf8")) as {
        status: string;
        baselineCommit: string;
        entries: Array<{ id: string; livePath: string; reviewOnlyPath: string; reviewOnlySha256: string; restoredSha256: string }>;
      };
      expect(packet.status).toBe("REVIEW-ONLY-NOT-APPROVED");
      expect(packet.baselineCommit).toBe("fb8a348562738a1043aea1015fb3acdd9525f94b");
      expect(packet.entries.map((entry) => entry.id)).toEqual(["tinnitus", "degenerative-disc-disease"]);
      for (const entry of packet.entries) {
        expect(entry.livePath).toBe(`data/knowledge-base/${entry.id}.json`);
        expect(entry.reviewOnlyPath).toBe(`${packetDir}/${entry.id}.json`);
        const preserved = fs.readFileSync(path.join(process.cwd(), entry.reviewOnlyPath));
        const restored = fs.readFileSync(path.join(process.cwd(), entry.livePath));
        expect(crypto.createHash("sha256").update(preserved).digest("hex")).toBe(entry.reviewOnlySha256);
        expect(crypto.createHash("sha256").update(restored).digest("hex")).toBe(entry.restoredSha256);
        expect(entry.reviewOnlySha256).not.toBe(entry.restoredSha256);
        const candidate = conditionMappingSchema.parse(JSON.parse(preserved.toString("utf8")));
        expect(candidate.draft).toBe(true);
        expect(candidate.suggestions.flatMap((suggestion) => suggestion.sourceReferences).every((ref) => ref.verified === false)).toBe(true);
        expect(mapping(entry.id).draft).toBe(true);
      }
    });
  });
});
