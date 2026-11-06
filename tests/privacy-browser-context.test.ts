import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConditionCatalog } from "@/lib/catalog/load";
import { recommend } from "@/lib/engine/recommend";
import {
  buildClientCorpus,
  CLIENT_CORPUS_PATH,
  CLIENT_CORPUS_VERSION,
  isClientCorpus,
  parseClientCorpus,
} from "@/lib/client-corpus";
import { loadKbGraph } from "@/lib/kb/graph";
import { loadKnowledgeBase } from "@/lib/kb/load";
import {
  BrowserWorkflowContextTooLargeError,
  browserWorkflowContextIsEmpty,
  browserWorkflowContextStorageKey,
  clearBrowserWorkflowContext,
  readBrowserWorkflowContext,
  writeBrowserWorkflowContext,
} from "@/lib/secondary-workflow/browser-context";
import {
  clearSecondaryWorkflowLocalState,
  secondaryWorkflowLocalStorageKeys,
} from "@/lib/secondary-workflow/local-state";
import { buildSecondaryRecommendationIntake } from "@/lib/secondary-workflow/recommendation-intake";
import type { SecondaryWorkflowState } from "@/lib/secondary-workflow/state";
import {
  MAX_CONTEXT_ITEM_LENGTH,
  MAX_CONTEXT_ITEMS,
} from "@/lib/secondary-workflow/state";

/**
 * PRIV-01 acceptance (contract accepted 2026-10-07): ALL veteran health
 * context stays browser-local. These tests pin the two things that make that
 * architecture possible: a bounded browser-local store for the private
 * context, and a PUBLIC client corpus that reproduces the engine's output
 * without any veteran data — plus the guarantee that the corpus itself carries
 * no context keys.
 */

const SENTINEL_MEDICATION = "PHI-SENTINEL-MEDICATION-7f3a";
const SENTINEL_TREATMENT = "PHI-SENTINEL-TREATMENT-91bc";
const SENTINEL_HISTORY = "PHI-SENTINEL-HISTORY-4d21";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    get size() {
      return data.size;
    },
    raw: data,
  };
  return storage;
}

function fullContext() {
  return {
    diagnosedConditionIds: ["depressive-disorder", "hypertension"],
    serviceConnectedConditionIds: ["abdominal-hernia", "acromegaly"],
    serviceConnectedAnswerDraft: { "abdominal-hernia": "yes" as const },
    ratingsByConditionId: { "abdominal-hernia": 30 },
    documentsShared: true,
    medications: [SENTINEL_MEDICATION],
    treatments: [SENTINEL_TREATMENT],
    history: [SENTINEL_HISTORY],
    symptomIds: ["fatigue"],
    conditionTimeline: { "abdominal-hernia": { onsetYear: 2015 } },
  };
}

describe("browser-local workflow context (PRIV-01)", () => {
  it("round-trips every private field in browser storage", () => {
    const storage = fakeStorage();
    writeBrowserWorkflowContext(storage, fullContext());

    const raw = storage.getItem(browserWorkflowContextStorageKey);
    expect(raw).toBeTruthy();
    expect(raw).toContain(SENTINEL_MEDICATION);

    const read = readBrowserWorkflowContext(storage);
    expect(read).not.toBeNull();
    expect(read).toEqual({ version: 1, ...fullContext() });
    expect(browserWorkflowContextIsEmpty(read)).toBe(false);
  });

  it("treats missing, corrupt, or out-of-version records as absent", () => {
    expect(readBrowserWorkflowContext(fakeStorage())).toBeNull();
    expect(
      readBrowserWorkflowContext(
        fakeStorage({ [browserWorkflowContextStorageKey]: "{not json" }),
      ),
    ).toBeNull();
    expect(
      readBrowserWorkflowContext(
        fakeStorage({
          [browserWorkflowContextStorageKey]: JSON.stringify({
            version: 0,
            diagnosedConditionIds: ["liver-cancer"],
          }),
        }),
      ),
    ).toBeNull();
    expect(
      readBrowserWorkflowContext(
        fakeStorage({
          [browserWorkflowContextStorageKey]: JSON.stringify({
            version: 1,
            medications: ["x".repeat(MAX_CONTEXT_ITEM_LENGTH + 1)],
          }),
        }),
      ),
    ).toBeNull();
  });

  it("rejects out-of-bounds context instead of truncating it", () => {
    const storage = fakeStorage();
    const tooMany = Array.from({ length: MAX_CONTEXT_ITEMS + 1 }, (_, i) => `med-${i}`);
    expect(() =>
      writeBrowserWorkflowContext(storage, { medications: tooMany }),
    ).toThrow(BrowserWorkflowContextTooLargeError);
    expect(storage.size).toBe(0);
    expect(() =>
      writeBrowserWorkflowContext(storage, {
        history: ["x".repeat(MAX_CONTEXT_ITEM_LENGTH + 1)],
      }),
    ).toThrow(BrowserWorkflowContextTooLargeError);
    expect(storage.size).toBe(0);
  });

  it("clears the context directly and through the shared clear-all", () => {
    const direct = fakeStorage();
    writeBrowserWorkflowContext(direct, fullContext());
    clearBrowserWorkflowContext(direct);
    expect(readBrowserWorkflowContext(direct)).toBeNull();

    const shared = fakeStorage({
      "secondary-condition-finder:evidence-depth:v1": "deep",
      "secondary-condition-finder:ocr-checkpoint:v1": "{}",
    });
    writeBrowserWorkflowContext(shared, fullContext());
    expect(shared.size).toBe(3);
    clearSecondaryWorkflowLocalState(shared);
    expect(shared.size).toBe(0);
    expect(readBrowserWorkflowContext(shared)).toBeNull();
  });

  it("is listed among the workflow's clearable storage keys", () => {
    expect(secondaryWorkflowLocalStorageKeys).toContain(
      browserWorkflowContextStorageKey,
    );
    for (const key of secondaryWorkflowLocalStorageKeys) {
      expect(key.startsWith("secondary-condition-finder:")).toBe(true);
    }
  });
});

describe("public client corpus (PRIV-01)", () => {
  const artifactPath = join(process.cwd(), "public", "kb", "client-corpus.json");
  const artifactRaw = readFileSync(artifactPath, "utf8");
  const artifact = parseClientCorpus(JSON.parse(artifactRaw));

  it("is generated and structurally a client corpus", () => {
    expect(artifactRaw.length).toBeLessThan(3 * 1024 * 1024);
    expect(artifact.version).toBe(CLIENT_CORPUS_VERSION);
    expect(CLIENT_CORPUS_PATH).toBe("/kb/client-corpus.json");
    expect(isClientCorpus(artifact)).toBe(true);
    expect(Object.keys(artifact).sort()).toEqual([
      "conditions",
      "graph",
      "graphAnchors",
      "publishedMappings",
      "version",
    ]);
  });

  it("ships the public graph anchors the /pathways explorer already renders", () => {
    const liverRoute = artifact.graphAnchors.find(
      (entry) =>
        entry.sourceConditionId === "liver-cancer" &&
        entry.targetConditionId === "sarcopenia",
    );
    expect(liverRoute).toBeTruthy();
    expect(liverRoute!.anchors.map((anchor) => anchor.label)).toEqual([
      "PMID 37274463",
      "PMID 36590214",
      "PMID 26266324",
    ]);
    expect(liverRoute!.anchors.every((anchor) => anchor.verified)).toBe(true);

    const alcoholRoute = artifact.graphAnchors.find(
      (entry) =>
        entry.sourceConditionId === "alcohol-use-disorder" &&
        entry.targetConditionId === "chronic-liver-disease",
    );
    expect(alcoholRoute).toBeTruthy();
    expect(alcoholRoute!.anchors.every((anchor) => !anchor.verified)).toBe(true);
  });

  it("matches buildClientCorpus() over the live loaders exactly", () => {
    const expected = buildClientCorpus(
      loadConditionCatalog(),
      loadKnowledgeBase(),
      [...loadKbGraph().values()],
    );
    expect(artifact).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it("ships catalog, published mappings and graph — never drafts", () => {
    expect(artifact.conditions.length).toBeGreaterThan(0);
    expect(artifact.publishedMappings.length).toBeGreaterThan(0);
    for (const mapping of artifact.publishedMappings) {
      expect(mapping.draft).toBe(false);
      expect(mapping.suggestions.length).toBeGreaterThan(0);
    }
    expect(artifact.graph.length).toBeGreaterThan(0);
  });

  it("reproduces the server engine's recommendations with no veteran data", () => {
    const liveCatalog = loadConditionCatalog();
    const liveKb = loadKnowledgeBase();

    const states: SecondaryWorkflowState[] = [
      {
        diagnosedConditionIds: ["depressive-disorder", "hypertension"],
        serviceConnectedConditionIds: ["abdominal-hernia", "acromegaly"],
        ratingsByConditionId: { "abdominal-hernia": 30 },
        documentsShared: false,
      },
      {
        ...fullContext(),
      } as SecondaryWorkflowState,
    ];

    for (const state of states) {
      const intake = buildSecondaryRecommendationIntake(state);
      const clientResult = recommend(
        artifact.conditions,
        artifact.publishedMappings,
        intake,
      );
      const serverResult = recommend(liveCatalog, liveKb, intake);
      expect(clientResult).toEqual(serverResult);
      expect(clientResult.recommendations.length).toBeGreaterThan(0);
    }
  });

  it("carries no workflow-context keys anywhere at the root", () => {
    const forbidden = [
      "diagnosedConditionIds",
      "serviceConnectedConditionIds",
      "ratingsByConditionId",
      "permanentAndTotalConditionIds",
      "medications",
      "treatments",
      "history",
      "symptomIds",
      "conditionTimeline",
    ];
    for (const key of forbidden) expect(key in artifact).toBe(false);
  });
});
