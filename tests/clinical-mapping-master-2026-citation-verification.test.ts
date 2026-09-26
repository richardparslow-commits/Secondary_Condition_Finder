import { assertMasterResolution2026CurrentState, isMasterResolution2026Active } from "./helpers/master-resolution-2026-current";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type SourceReference = {
  citation: string;
  sourceUrl: string;
  sourceLocator?: string;
  verified: boolean;
  verificationScope: string;
  sourceCheckedOn: string;
};

type Suggestion = {
  conditionId: string;
  rationale: string;
  sourceReferences: SourceReference[];
};

type Mapping = {
  id: string;
  draft: boolean;
  suggestions: Suggestion[];
};

const kbDir = path.join(process.cwd(), "data", "knowledge-base");
const rows = [
  {
    "primaryId": "actinomycosis",
    "targetId": "cardiac-inflammatory-disease",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "35383546",
    "finalPmid": "35383546"
  },
  {
    "primaryId": "ankylosing-spondylitis",
    "targetId": "osteoporosis",
    "claimType": "disease-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "20680529",
    "finalPmid": "20680529"
  },
  {
    "primaryId": "anorexia-nervosa",
    "targetId": "osteoporosis",
    "claimType": "disease-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "10326187",
    "finalPmid": "10326187"
  },
  {
    "primaryId": "anemia",
    "targetId": "chronic-kidney-disease",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "34406259",
    "finalPmid": "34406259"
  },
  {
    "primaryId": "benign-prostatic-hyperplasia",
    "targetId": "chronic-kidney-disease",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40196966",
    "finalPmid": "40196966"
  },
  {
    "primaryId": "bronchiolitis",
    "targetId": "asthma",
    "claimType": "population-specific-temporal-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "34049905",
    "finalPmid": "34049905"
  },
  {
    "primaryId": "brucellosis",
    "targetId": "cardiac-inflammatory-disease",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "34447668",
    "finalPmid": "34447668"
  },
  {
    "primaryId": "charcot-arthropathy",
    "targetId": "amputation-or-loss-of-use",
    "claimType": "complication-outcome-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "33829302",
    "finalPmid": "33829302"
  },
  {
    "primaryId": "cirrhosis-of-the-liver",
    "targetId": "osteoporosis",
    "claimType": "phenotype-specific-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "25061487",
    "finalPmid": "25061487"
  },
  {
    "primaryId": "celiac-disease",
    "targetId": "schizophrenia",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "29280918",
    "finalPmid": "29280918"
  },
  {
    "primaryId": "diabetes-mellitus-type-2",
    "targetId": "gerd",
    "claimType": "treatment-associated-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40658955",
    "finalPmid": "40658955"
  },
  {
    "primaryId": "emphysema",
    "targetId": "respiratory-cancer",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "27666776",
    "finalPmid": "27666776"
  },
  {
    "primaryId": "esophageal-cancer",
    "targetId": "cardiac-arrhythmia",
    "claimType": "treatment-associated-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "37574171",
    "finalPmid": "37574171"
  },
  {
    "primaryId": "gastroparesis",
    "targetId": "cardiac-arrhythmia",
    "claimType": "treatment-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "29157021",
    "finalPmid": "29157021"
  },
  {
    "primaryId": "gerd",
    "targetId": "asthma",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "bronchiectasis",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "copd",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "interstitial-lung-disease",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "pulmonary-fibrosis",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "respiratory-cancer",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gerd",
    "targetId": "tuberculosis",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40772230",
    "finalPmid": "40772230"
  },
  {
    "primaryId": "gout",
    "targetId": "aortic-aneurysm",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "37149284",
    "finalPmid": "37149284"
  },
  {
    "primaryId": "gout",
    "targetId": "macular-degeneration",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40632946",
    "finalPmid": "40632946"
  },
  {
    "primaryId": "hepatitis",
    "targetId": "osteoporosis",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "REPLACE-SOURCE",
    "oldPmid": "37230817",
    "finalPmid": "26683953"
  },
  {
    "primaryId": "hepatitis",
    "targetId": "pancreatic-cancer",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "32088651",
    "finalPmid": "32088651"
  },
  {
    "primaryId": "hepatitis",
    "targetId": "parkinsons-disease",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "37899363",
    "finalPmid": "37899363"
  },
  {
    "primaryId": "hiatal-hernia",
    "targetId": "barretts-esophagus",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "22694245",
    "finalPmid": "22694245"
  },
  {
    "primaryId": "hiv-aids",
    "targetId": "uveitis",
    "claimType": "treatment-associated-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "39046420",
    "finalPmid": "39046420"
  },
  {
    "primaryId": "hypothyroidism",
    "targetId": "tinnitus",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "35233053",
    "finalPmid": "35233053"
  },
  {
    "primaryId": "inflammatory-bowel-disease",
    "targetId": "colorectal-cancer",
    "claimType": "temporal-association-risk",
    "decision": "REPLACE-SOURCE",
    "oldPmid": "33385426",
    "finalPmid": "33433655"
  },
  {
    "primaryId": "ischemic-heart-disease",
    "targetId": "colorectal-cancer",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "36855430",
    "finalPmid": "36855430"
  },
  {
    "primaryId": "ischemic-heart-disease",
    "targetId": "respiratory-cancer",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "36855430",
    "finalPmid": "36855430"
  },
  {
    "primaryId": "narcolepsy",
    "targetId": "depressive-disorder",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "31203833",
    "finalPmid": "31203833"
  },
  {
    "primaryId": "nocardiosis",
    "targetId": "cardiac-inflammatory-disease",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "35787151",
    "finalPmid": "35787151"
  },
  {
    "primaryId": "osteoarthritis",
    "targetId": "sleep-apnea",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40329131",
    "finalPmid": "40329131"
  },
  {
    "primaryId": "osteoporosis",
    "targetId": "trigeminal-neuralgia",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "35334622",
    "finalPmid": "35334622"
  },
  {
    "primaryId": "osteoporosis",
    "targetId": "osteonecrosis-of-the-jaw",
    "claimType": "treatment-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "30393090",
    "finalPmid": "30393090"
  },
  {
    "primaryId": "pancreatitis",
    "targetId": "cardiac-inflammatory-disease",
    "claimType": "rare-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "39895893",
    "finalPmid": "39895893"
  },
  {
    "primaryId": "parkinsons-disease",
    "targetId": "depressive-disorder",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "20722714",
    "finalPmid": "20722714"
  },
  {
    "primaryId": "pelvic-inflammatory-disease",
    "targetId": "ovarian-cancer",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "28342087",
    "finalPmid": "28342087"
  },
  {
    "primaryId": "penetrating-head-trauma",
    "targetId": "seizure-disorder",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "REPLACE-SOURCE",
    "oldPmid": "31861595",
    "finalPmid": "20644150"
  },
  {
    "primaryId": "pneumoconiosis",
    "targetId": "sleep-apnea",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "38573463",
    "finalPmid": "38573463"
  },
  {
    "primaryId": "pneumoconiosis",
    "targetId": "tuberculosis",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "37349198",
    "finalPmid": "37349198"
  },
  {
    "primaryId": "psoriasis",
    "targetId": "colorectal-cancer",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "33011316",
    "finalPmid": "33011316"
  },
  {
    "primaryId": "psoriasis",
    "targetId": "erectile-dysfunction",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "29735408",
    "finalPmid": "29735408"
  },
  {
    "primaryId": "psoriasis",
    "targetId": "inflammatory-bowel-disease",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "30422277",
    "finalPmid": "30422277"
  },
  {
    "primaryId": "psoriasis",
    "targetId": "psoriatic-arthritis",
    "claimType": "temporal-association-risk",
    "decision": "REPLACE-SOURCE",
    "oldPmid": "38251522",
    "finalPmid": "34596875"
  },
  {
    "primaryId": "psoriasis",
    "targetId": "eczema",
    "claimType": "treatment-complication",
    "decision": "REPLACE-SOURCE",
    "oldPmid": "40420581",
    "finalPmid": "38055239"
  },
  {
    "primaryId": "psoriatic-arthritis",
    "targetId": "depressive-disorder",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "26882216",
    "finalPmid": "26882216"
  },
  {
    "primaryId": "psoriatic-arthritis",
    "targetId": "tuberculosis",
    "claimType": "treatment-associated-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "39963138",
    "finalPmid": "39963138"
  },
  {
    "primaryId": "pulmonary-fibrosis",
    "targetId": "respiratory-cancer",
    "claimType": "phenotype-specific-temporal-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "38355151",
    "finalPmid": "38355151"
  },
  {
    "primaryId": "q-fever",
    "targetId": "gallbladder-disease",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "31782315",
    "finalPmid": "31782315"
  },
  {
    "primaryId": "sarcoidosis",
    "targetId": "pulmonary-hypertension",
    "claimType": "disease-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40005458",
    "finalPmid": "40005458"
  },
  {
    "primaryId": "sarcoidosis",
    "targetId": "thrombocytopenia",
    "claimType": "rare-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "18038923",
    "finalPmid": "18038923"
  },
  {
    "primaryId": "schizophrenia",
    "targetId": "diabetes-mellitus-type-2",
    "claimType": "association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "39324122",
    "finalPmid": "39324122"
  },
  {
    "primaryId": "substance-use-disorder",
    "targetId": "depressive-disorder",
    "claimType": "phenotype-specific-association",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "37223912",
    "finalPmid": "37223912"
  },
  {
    "primaryId": "substance-use-disorder",
    "targetId": "bipolar-disorder",
    "claimType": "phenotype-specific-association",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "37223912",
    "finalPmid": "37223912"
  },
  {
    "primaryId": "systemic-lupus-erythematosus",
    "targetId": "cardiac-arrhythmia",
    "claimType": "temporal-association-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "35906745",
    "finalPmid": "35906745"
  },
  {
    "primaryId": "systemic-lupus-erythematosus",
    "targetId": "tuberculosis",
    "claimType": "treatment-associated-risk",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "40959074",
    "finalPmid": "40959074"
  },
  {
    "primaryId": "thromboangiitis-obliterans",
    "targetId": "amputation-or-loss-of-use",
    "claimType": "complication-outcome-risk",
    "decision": "VERIFY-WITH-NARROWING",
    "oldPmid": "39847853",
    "finalPmid": "39847853"
  },
  {
    "primaryId": "thyroid-cancer",
    "targetId": "hypoparathyroidism",
    "claimType": "treatment-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "38652139",
    "finalPmid": "38652139"
  },
  {
    "primaryId": "tuberculosis",
    "targetId": "aortic-aneurysm",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "35605220",
    "finalPmid": "35605220"
  },
  {
    "primaryId": "typhoid-fever",
    "targetId": "cardiac-inflammatory-disease",
    "claimType": "rare-infection-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "39005656",
    "finalPmid": "39005656"
  },
  {
    "primaryId": "hyperthyroidism",
    "targetId": "hypothyroidism",
    "claimType": "treatment-complication",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "30912336",
    "finalPmid": "30912336"
  },
  {
    "primaryId": "essential-thrombocythemia",
    "targetId": "leukemia",
    "claimType": "disease-transformation",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "38269572",
    "finalPmid": "38269572"
  },
  {
    "primaryId": "polycythemia-vera",
    "targetId": "leukemia",
    "claimType": "disease-transformation",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "37357958",
    "finalPmid": "37357958"
  },
  {
    "primaryId": "primary-myelofibrosis",
    "targetId": "leukemia",
    "claimType": "disease-transformation",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "36680511",
    "finalPmid": "36680511"
  },
  {
    "primaryId": "myelodysplastic-syndrome",
    "targetId": "leukemia",
    "claimType": "phenotype-specific-disease-transformation",
    "decision": "VERIFY-AS-WRITTEN",
    "oldPmid": "9371291",
    "finalPmid": "9371291"
  }
] as const;
const load = (id: string): Mapping =>
  JSON.parse(
    fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8"),
  ) as Mapping;

describe("Clinical Mapping Master 2026 citation verification", () => {
  it("implements exactly 55 as-written, 8 narrowed, and 5 replacement rows", () => {
    expect(rows).toHaveLength(68);
    expect(rows.filter((row) => row.decision === "VERIFY-AS-WRITTEN")).toHaveLength(55);
    expect(rows.filter((row) => row.decision === "VERIFY-WITH-NARROWING")).toHaveLength(8);
    expect(rows.filter((row) => row.decision === "REPLACE-SOURCE")).toHaveLength(5);
    expect(new Set(rows.map((row) => row.finalPmid)).size).toBe(60);
  });

  it("marks every approved Master source row verified with the final PMID", () => {
    for (const row of rows) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find(
        (item) => item.conditionId === row.targetId,
      );
      expect(suggestion).toBeDefined();
      expect(suggestion?.sourceReferences).toHaveLength(1);
      const source = suggestion?.sourceReferences?.[0];
      expect(source?.verified).toBe(true);
      expect(source?.verificationScope).toBe("clinical-evidence");
      expect(source?.sourceCheckedOn).toBe("2026-08-19");
      expect(source?.sourceUrl).toContain(`/${row.finalPmid}/`);
      expect(source?.citation).toContain(`PMID ${row.finalPmid}`);
    }
  });

  it("replaces the live citation/URL while preserving supersession provenance", () => {
    for (const row of rows.filter((item) => item.decision === "REPLACE-SOURCE")) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find(
        (item) => item.conditionId === row.targetId,
      );
      expect(suggestion?.sourceReferences).toHaveLength(1);
      const source = suggestion?.sourceReferences?.[0];

      expect(source?.citation).not.toContain(`PMID ${row.oldPmid}`);
      expect(source?.sourceUrl).not.toContain(`/${row.oldPmid}/`);
      expect(source?.citation).toContain(`PMID ${row.finalPmid}`);
      expect(source?.sourceUrl).toContain(`/${row.finalPmid}/`);

      expect(source?.sourceLocator).toContain(
        `supersedes unverified PMID ${row.oldPmid}`,
      );
    }
  });

  it("retains all eight approved source-specific narrowing tokens", () => {
    const tokens: Record<string, string> = {
      "brucellosis|cardiac-inflammatory-disease": "prosthetic",
      "charcot-arthropathy|amputation-or-loss-of-use": "lower-extremity",
      "emphysema|respiratory-cancer": "lung cancer",
      "esophageal-cancer|cardiac-arrhythmia": "atrial fibrillation",
      "hepatitis|parkinsons-disease": "hepatitis c",
      "ischemic-heart-disease|respiratory-cancer": "lung cancer",
      "osteoporosis|trigeminal-neuralgia": ">50",
      "thromboangiitis-obliterans|amputation-or-loss-of-use": "amputation",
    };
    for (const row of rows.filter(
      (item) => item.decision === "VERIFY-WITH-NARROWING",
    )) {
      const mapping = load(row.primaryId);
      const suggestion = mapping.suggestions.find(
        (item) => item.conditionId === row.targetId,
      );
      const token = tokens[`${row.primaryId}|${row.targetId}`];
      if (!token) {
        throw new Error(`missing narrowing token for ${row.primaryId} -> ${row.targetId}`);
      }
      expect(JSON.stringify(suggestion).toLowerCase()).toContain(
        token.toLowerCase(),
      );
    }
  });

  it("reaches the exact global post-verification live citation state", () => {
    // Master Resolution 2026 supersedes this historical current-state assertion while
    // preserving the original pre-resolution contract below for historical states.
    if (isMasterResolution2026Active()) {
      assertMasterResolution2026CurrentState();
      return;
    }

    const refs = fs
      .readdirSync(kbDir)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => {
        const mapping = JSON.parse(
          fs.readFileSync(path.join(kbDir, file), "utf8"),
        ) as Mapping;
        return mapping.suggestions.flatMap(
          (suggestion) => suggestion.sourceReferences ?? [],
        );
      });
    expect(refs).toHaveLength(160);
    expect(refs.filter((ref) => ref.verified === true)).toHaveLength(160);
    expect(refs.filter((r) => r.verified === false)).toHaveLength(827);
    const clinical = refs.filter(
      (ref) => ref.verificationScope === "clinical-evidence",
    );
    expect(clinical).toHaveLength(137);
    expect(clinical.every((ref) => Boolean(ref.sourceUrl))).toBe(true);
  });

  it("records the approval artifact without claiming an individual nexus", () => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "docs",
          "clinical-mapping-master-2026-master-citation-verification-disposition.json",
        ),
        "utf8",
      ),
    ) as {
      status: string;
      nonNegotiableBoundary: string;
      relationshipDispositions: Array<{ verifiedAfterImplementation: boolean }>;
    };
    expect(artifact.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(artifact.relationshipDispositions).toHaveLength(68);
    expect(
      artifact.relationshipDispositions.every(
        (row) => row.verifiedAfterImplementation === true,
      ),
    ).toBe(true);
    expect(artifact.nonNegotiableBoundary.toLowerCase()).toContain(
      "does not establish an individual va medical nexus",
    );
  });
});
