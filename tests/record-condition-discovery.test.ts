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
    expect(readBrowserWorkflowContext(storage as unknown as Storage)?.recordDiscoveredConditionIds)
      .toEqual(["obstructive-sleep-apnea"]);
  });
});

describe("P0 safety gate regression: common chart negation and family history", () => {
  it("does not describe a simple negative assessment as an affirmative diagnosis", () => {
    expect(source("Assessment:\nNo obstructive sleep apnea")[0]?.category).toBe("ruled-out");
    expect(source("Assessment:\nNo OSA")[0]?.category).toBe("ruled-out");
    expect(source("Diagnosis: OSA absent")[0]?.category).toBe("ruled-out");
  });

  it("holds first-degree relatives' illness and FHx shorthand as family history", () => {
    expect(source("Assessment:\nMother has obstructive sleep apnea")[0]?.category).toBe("family-history");
    expect(source("Assessment:\nFather diagnosed with obstructive sleep apnea")[0]?.category).toBe("family-history");
    expect(source("FHx: obstructive sleep apnea")[0]?.category).toBe("family-history");
  });

  it("marks tentative clinical shorthand as suspected rather than confirmed", () => {
    expect(source("Assessment:\nProbable OSA?")[0]?.category).toBe("suspected");
    expect(source("Assessment:\nOSA vs narcolepsy")[0]?.category).toBe("suspected");
  });

  it("recognizes curated common short aliases only in affirmative diagnostic context", () => {
    expect(source("Assessment:\nOSA")[0]).toMatchObject({
      conditionId:"obstructive-sleep-apnea", category:"diagnosis-statement",
    });
    expect(source("Dx: OSA")[0]?.category).toBe("diagnosis-statement");
    expect(source("Treatment:\nOSA equipment notice")).toEqual([]);
  });
});

describe("P0 migration: previously confirmed record topics require fresh review", () => {
  it("fails closed for old unsafe opt-ins while retaining manual rated diagnoses", () => {
    const storageMap = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => storageMap.set(key, value),
    };
    storageMap.set(browserWorkflowContextStorageKey, JSON.stringify({
      ...base, version: 1,
      diagnosedConditionIds: ["post-traumatic-stress-disorder", "obstructive-sleep-apnea"],
      recordDiscoveredConditionIds: ["obstructive-sleep-apnea"],
      recordClaimStatusByConditionId: { "obstructive-sleep-apnea": "pending" },
      recordSourceIdsByConditionId: { "obstructive-sleep-apnea": ["old-synthetic-doc"] },
      conditionTimeline: {
        "post-traumatic-stress-disorder": { onsetYear: 2010 },
        "obstructive-sleep-apnea": { diagnosisYear: 2018 },
      },
    }));
    const sanitized = readBrowserWorkflowContext(storage as unknown as Storage);
    expect(sanitized?.diagnosedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(sanitized?.serviceConnectedConditionIds).toEqual(["post-traumatic-stress-disorder"]);
    expect(sanitized?.ratingsByConditionId).toEqual(base.ratingsByConditionId);
    expect(sanitized?.conditionTimeline).toEqual({ "post-traumatic-stress-disorder": { onsetYear: 2010 } });
    expect(sanitized?.recordDiscoveredConditionIds).toEqual([]);
    expect(sanitized?.recordClaimStatusByConditionId).toEqual({});
    expect(sanitized?.recordSourceIdsByConditionId).toEqual({});
    expect(sanitized?.recordDerivedSafeguardVersion).toBe(2);
    expect(sanitized?.recordDerivedReReviewRequired).toBe(true);

    // A normal guarded save makes this safe projection the durable tab record.
    writeBrowserWorkflowContext(storage as unknown as Storage, sanitized!);
    expect(readBrowserWorkflowContext(storage as unknown as Storage)?.recordDerivedReReviewRequired).toBe(true);

    const reapproved = confirmRecordDerivedConditions(sanitized!, [{
      conditionId: "obstructive-sleep-apnea", claimStatus: "unknown", sourceIds: ["new-synthetic-doc"],
    }], catalog);
    expect(reapproved.recordDerivedSafeguardVersion).toBe(2);
    expect(reapproved.recordDerivedReReviewRequired).toBe(false);
    expect(reapproved.diagnosedConditionIds).toContain("obstructive-sleep-apnea");
  });

  it("does not invalidate already stamped, correctly reviewed record topics", () => {
    const newContext = confirmRecordDerivedConditions(base, [{
      conditionId: "obstructive-sleep-apnea", claimStatus: "denied", sourceIds: ["synthetic-new-source"],
    }], catalog);
    const stored = new Map<string,string>();
    const storage = {
      getItem: (key:string) => stored.get(key) ?? null,
      setItem: (key:string,value:string) => stored.set(key,value),
    };
    writeBrowserWorkflowContext(storage as unknown as Storage, newContext);
    const readBack = readBrowserWorkflowContext(storage as unknown as Storage);
    expect(readBack?.recordDiscoveredConditionIds).toEqual(["obstructive-sleep-apnea"]);
    expect(readBack?.recordDerivedReReviewRequired).toBe(false);
  });
});
