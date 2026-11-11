import { describe, expect, it } from "vitest";
import type { ConditionCatalog } from "../src/lib/catalog/schema";
import {
  buildRecordConditionMatcher,
  discoverRecordConditionCandidates,
} from "../src/lib/evidence/record-condition-discovery";
import {
  clearRecordDerivedConditions, confirmRecordDerivedConditions,
  withdrawRecordCondition, withdrawRecordSource,
} from "../src/lib/secondary-workflow/record-derived-confirmation";
import {
  browserWorkflowContextStorageKey,
  readBrowserWorkflowContext, writeBrowserWorkflowContext,
} from "../src/lib/secondary-workflow/browser-context";
import {
  applyDiagnosedStep, applyServiceConnectedStep,
} from "../src/lib/secondary-workflow/client-steps";

const catalog: ConditionCatalog = [
  { id: "post-traumatic-stress-disorder", name: "Post Traumatic Stress Disorder", aliases: ["PTSD"],
    bodySystem: "mental", ratingSchedule: [], reviewNotes: [] },
  { id: "obstructive-sleep-apnea", name: "Obstructive Sleep Apnea", aliases: ["OSA"],
    bodySystem: "respiratory", ratingSchedule: [], reviewNotes: [] },
  { id: "migraine-headaches", name: "Migraine Headaches", aliases: ["Migraines"],
    bodySystem: "neurological", ratingSchedule: [], reviewNotes: [] },
];

const matcher = buildRecordConditionMatcher(catalog);
const source = (text: string, sourceId = "file-001") =>
  discoverRecordConditionCandidates(
    [{ text, locatorPrefix: "page 3" }],
    { sourceId, sourceName: "synthetic-record.txt", credential: "physician" },
    matcher,
  );
const base = {
  diagnosedConditionIds: ["post-traumatic-stress-disorder"],
  serviceConnectedConditionIds: ["post-traumatic-stress-disorder"],
  ratingsByConditionId: { "post-traumatic-stress-disorder": 70 },
};

describe("Veteran-entered-diagnoses-only workflow invariant", () => {
  it("cannot launder a record-origin diagnosis through a VA-rated yes then no", () => {
    const storageMap = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => storageMap.set(key, value),
    };
    // Legacy scenario: OSA was record-extracted, then marked VA-rated in Step 2.
    // PTSD and migraine were selected independently. All examples synthetic.
    const initial = {
      ...base, version: 1,
      diagnosedConditionIds: [
        "post-traumatic-stress-disorder", "obstructive-sleep-apnea", "migraine-headaches",
      ],
      serviceConnectedConditionIds: ["post-traumatic-stress-disorder", "obstructive-sleep-apnea"],
      serviceConnectedAnswerDraft: {
        "post-traumatic-stress-disorder": "yes" as const,
        "obstructive-sleep-apnea": "yes" as const,
        "migraine-headaches": "no" as const,
      },
      ratingsByConditionId: {
        "post-traumatic-stress-disorder": 70,
        "obstructive-sleep-apnea": 50,
      },
      permanentAndTotalConditionIds: ["post-traumatic-stress-disorder", "obstructive-sleep-apnea"],
      conditionTimeline: {
        "post-traumatic-stress-disorder": { onsetYear: 2014 },
        "obstructive-sleep-apnea": { diagnosisYear: 2018 },
      },
      recordDiscoveredConditionIds: ["obstructive-sleep-apnea"],
      recordClaimStatusByConditionId: { "obstructive-sleep-apnea": "pending" as const },
      recordSourceIdsByConditionId: { "obstructive-sleep-apnea": ["record-synthetic"] },
    };
    storage.setItem(browserWorkflowContextStorageKey, JSON.stringify(initial));
    const safe = readBrowserWorkflowContext(storage as unknown as Storage);
    expect(safe).not.toBeNull();
    expect(safe?.diagnosedConditionIds).toEqual([
      "post-traumatic-stress-disorder", "migraine-headaches",
    ]);
    expect(safe?.serviceConnectedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(safe?.ratingsByConditionId).toEqual({ "post-traumatic-stress-disorder": 70 });
    expect(safe?.permanentAndTotalConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(safe?.serviceConnectedAnswerDraft).toEqual({
      "post-traumatic-stress-disorder": "yes",
      "migraine-headaches": "no",
    });
    expect(safe?.conditionTimeline).toEqual({
      "post-traumatic-stress-disorder": { onsetYear: 2014 },
    });
    expect(safe?.recordDiscoveredConditionIds).toEqual([]);
    // Repeating the same legacy input through a stale *writer* must fail closed.
    writeBrowserWorkflowContext(storage as unknown as Storage, initial);
    expect(readBrowserWorkflowContext(storage as unknown as Storage)).toMatchObject({
      diagnosedConditionIds: ["post-traumatic-stress-disorder", "migraine-headaches"],
      serviceConnectedConditionIds: ["post-traumatic-stress-disorder"],
      recordDiscoveredConditionIds: [],
    });
    // Step 2 cannot offer the hidden old record-derived OSA as a "no" target.
    const step2Form = new FormData();
    step2Form.set("serviceConnected-post-traumatic-stress-disorder", "yes");
    step2Form.set("serviceConnected-migraine-headaches", "no");
    step2Form.set("serviceConnected-obstructive-sleep-apnea", "no");
    const step2 = applyServiceConnectedStep(safe!, step2Form, catalog);
    expect(step2.ok).toBe(true);
    if (step2.ok) {
      expect(step2.context.diagnosedConditionIds).toEqual([
        "post-traumatic-stress-disorder", "migraine-headaches",
      ]);
      expect(step2.context.serviceConnectedConditionIds).toEqual([
        "post-traumatic-stress-disorder",
      ]);
    }
    // The only way back into intake is a fresh explicit Step 1 selection.
    const step1Form = new FormData();
    step1Form.append("diagnosed", "post-traumatic-stress-disorder");
    step1Form.append("diagnosed", "obstructive-sleep-apnea");
    const step1 = applyDiagnosedStep(safe!, step1Form, catalog);
    expect(step1.ok).toBe(true);
    if (step1.ok) expect(step1.context.diagnosedConditionIds).toContain("obstructive-sleep-apnea");
  });

  it("drops every old record-extracted target on reading a legacy tab", () => {
    const storageMap = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => storageMap.set(key, value),
    };
    storageMap.set(browserWorkflowContextStorageKey, JSON.stringify({
      ...base,
      version: 1,
      diagnosedConditionIds: ["post-traumatic-stress-disorder", "obstructive-sleep-apnea"],
      recordDiscoveredConditionIds: ["obstructive-sleep-apnea"],
      recordClaimStatusByConditionId: { "obstructive-sleep-apnea": "pending" },
      recordSourceIdsByConditionId: { "obstructive-sleep-apnea": ["old-review-file"] },
    }));
    const checked = readBrowserWorkflowContext(storage as unknown as Storage);
    expect(checked?.diagnosedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(checked?.ratingsByConditionId).toEqual(base.ratingsByConditionId);
    expect(checked?.serviceConnectedConditionIds).toEqual(base.serviceConnectedConditionIds);
    expect(checked?.recordDiscoveredConditionIds).toEqual([]);
    expect(checked?.recordSourceIdsByConditionId).toEqual({});
  });
});

describe("P0 record-derived condition discovery: local mentions, not diagnoses", () => {
  it("surfaces a new clinician-authored assessment with page/line provenance", () => {
    const found = source("Assessment:\nObstructive Sleep Apnea\nPlan:\nUse CPAP therapy.");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      conditionId: "obstructive-sleep-apnea",
      category: "diagnosis-statement", locator: "page 3, line 2",
      quote: "Obstructive Sleep Apnea", clinicianAuthored: true,
    });
  });

  it("does not label differential, negation, history or family history as confirmed", () => {
    expect(source("Rule out Obstructive Sleep Apnea")[0]?.category).toBe("ruled-out");
    expect(source("Possible Obstructive Sleep Apnea")[0]?.category).toBe("suspected");
    expect(source("History of Obstructive Sleep Apnea")[0]?.category).toBe("historical");
    expect(source("Family history of Obstructive Sleep Apnea")[0]?.category).toBe("family-history");
    expect(source("Screening for Obstructive Sleep Apnea")[0]?.category).toBe("symptom-only");
    expect(source("Obstructive Sleep Apnea mentioned in chart")[0]?.category).toBe("ambiguous");
  });

  it("never turns a policy example or absent condition into a candidate", () => {
    expect(source("38 CFR 3.310: Obstructive Sleep Apnea may be service connected")).toEqual([]);
    expect(source("The patient has hypertension.")).toEqual([]);
  });

  it("preserves same-named document identities and bounds repeated conditions", () => {
    const a = source("Diagnosis: Obstructive Sleep Apnea", "source-a");
    const b = source("Diagnosis: Obstructive Sleep Apnea", "source-b");
    expect(a[0].sourceId).not.toBe(b[0].sourceId);
    const repeated = source(Array.from({length:100},()=> "Dx: Obstructive Sleep Apnea").join("\n"));
    expect(repeated.filter((x)=>x.conditionId==="obstructive-sleep-apnea")).toHaveLength(1);
  });

  it("requires explicit reviewed status and preserves existing rated primaries", () => {
    const confirmed = confirmRecordDerivedConditions(base, [
      { conditionId:"obstructive-sleep-apnea", claimStatus:"not-yet-claimed", sourceIds:["source-a"] },
    ],catalog);
    expect(confirmed.diagnosedConditionIds).toContain("obstructive-sleep-apnea");
    expect(confirmed.serviceConnectedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(confirmed.recordClaimStatusByConditionId?.["obstructive-sleep-apnea"]).toBe("not-yet-claimed");
    expect(confirmed.recordSourceIdsByConditionId?.["obstructive-sleep-apnea"]).toEqual(["source-a"]);
    expect(() => confirmRecordDerivedConditions(base, [
      { conditionId:"post-traumatic-stress-disorder", claimStatus:"unknown", sourceIds:["source-a"] },
    ],catalog)).toThrow();
    expect(() => confirmRecordDerivedConditions(base, [
      { conditionId:"invented-condition", claimStatus:"unknown", sourceIds:["source-a"] },
    ],catalog)).toThrow();
  });

  it("revokes only the corresponding record-derived conditions after source withdrawal", () => {
    const context=confirmRecordDerivedConditions(base,[
      {conditionId:"obstructive-sleep-apnea",claimStatus:"pending",sourceIds:["file-1","file-2"]},
      {conditionId:"migraine-headaches",claimStatus:"denied",sourceIds:["file-1"]},
    ],catalog);
    const one=withdrawRecordSource(context,"file-1");
    expect(one.recordDiscoveredConditionIds).toEqual(["obstructive-sleep-apnea"]);
    expect(one.recordSourceIdsByConditionId?.["obstructive-sleep-apnea"]).toEqual(["file-2"]);
    const all=withdrawRecordSource(one,"file-2");
    expect(all.diagnosedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(all.recordDiscoveredConditionIds).toEqual([]);
    expect(all.serviceConnectedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
  });

  it("manual removal and clear preserve the primary condition and its VA rating", () => {
    const context=confirmRecordDerivedConditions(base,[
      {conditionId:"obstructive-sleep-apnea",claimStatus:"unknown",sourceIds:["file-1"]},
    ],catalog);
    expect(withdrawRecordCondition(context,"obstructive-sleep-apnea").diagnosedConditionIds)
      .toEqual(["post-traumatic-stress-disorder"]);
    const cleared=clearRecordDerivedConditions(context);
    expect(cleared.ratingsByConditionId).toEqual(base.ratingsByConditionId);
    expect(cleared.diagnosedConditionIds).toEqual(base.diagnosedConditionIds);
  });

  it("stores only IDs/status/opaque source IDs in the existing bounded tab context", () => {
    const context=confirmRecordDerivedConditions(base,[
      {conditionId:"obstructive-sleep-apnea",claimStatus:"unknown",sourceIds:["file-1"]},
    ],catalog);
    const map=new Map<string,string>();
    const storage={
      setItem:(key:string,value:string)=>map.set(key,value),
      getItem:(key:string)=>map.get(key)??null,
    };
    writeBrowserWorkflowContext(storage as unknown as Storage,context);
    const serialized=[...map.values()].join("");
    expect(serialized).not.toContain("synthetic-record.txt");
    expect(serialized).not.toContain("page 3");
    expect(serialized).not.toContain("Obstructive Sleep Apnea");
    // Record-extracted suggestions cannot persist or enter the comparison.
    expect(readBrowserWorkflowContext(storage as unknown as Storage)?.recordDiscoveredConditionIds)
      .toEqual([]);
    expect(readBrowserWorkflowContext(storage as unknown as Storage)?.diagnosedConditionIds)
      .toEqual(base.diagnosedConditionIds);
  });
});
