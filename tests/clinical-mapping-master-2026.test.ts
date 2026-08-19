/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const kbDir = path.join(process.cwd(), "data", "knowledge-base");
const approved = [
  {
    "primaryId": "actinomycosis",
    "targetId": "cardiac-inflammatory-disease",
    "pmid": "35383546",
    "pathway": false
  },
  {
    "primaryId": "ankylosing-spondylitis",
    "targetId": "osteoporosis",
    "pmid": "20680529",
    "pathway": false
  },
  {
    "primaryId": "anorexia-nervosa",
    "targetId": "osteoporosis",
    "pmid": "10326187",
    "pathway": false
  },
  {
    "primaryId": "anemia",
    "targetId": "chronic-kidney-disease",
    "pmid": "34406259",
    "pathway": false
  },
  {
    "primaryId": "benign-prostatic-hyperplasia",
    "targetId": "chronic-kidney-disease",
    "pmid": "40196966",
    "pathway": false
  },
  {
    "primaryId": "bronchiolitis",
    "targetId": "asthma",
    "pmid": "34049905",
    "pathway": false
  },
  {
    "primaryId": "brucellosis",
    "targetId": "cardiac-inflammatory-disease",
    "pmid": "34447668",
    "pathway": false
  },
  {
    "primaryId": "charcot-arthropathy",
    "targetId": "amputation-or-loss-of-use",
    "pmid": "33829302",
    "pathway": false
  },
  {
    "primaryId": "cirrhosis-of-the-liver",
    "targetId": "osteoporosis",
    "pmid": "25061487",
    "pathway": false
  },
  {
    "primaryId": "celiac-disease",
    "targetId": "schizophrenia",
    "pmid": "29280918",
    "pathway": false
  },
  {
    "primaryId": "diabetes-mellitus-type-2",
    "targetId": "gerd",
    "pmid": "40658955",
    "pathway": false
  },
  {
    "primaryId": "emphysema",
    "targetId": "respiratory-cancer",
    "pmid": "27666776",
    "pathway": false
  },
  {
    "primaryId": "esophageal-cancer",
    "targetId": "cardiac-arrhythmia",
    "pmid": "37574171",
    "pathway": false
  },
  {
    "primaryId": "gastroparesis",
    "targetId": "cardiac-arrhythmia",
    "pmid": "29157021",
    "pathway": true
  },
  {
    "primaryId": "gerd",
    "targetId": "asthma",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "bronchiectasis",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "copd",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "interstitial-lung-disease",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "pulmonary-fibrosis",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "respiratory-cancer",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gerd",
    "targetId": "tuberculosis",
    "pmid": "40772230",
    "pathway": false
  },
  {
    "primaryId": "gout",
    "targetId": "aortic-aneurysm",
    "pmid": "37149284",
    "pathway": false
  },
  {
    "primaryId": "gout",
    "targetId": "macular-degeneration",
    "pmid": "40632946",
    "pathway": false
  },
  {
    "primaryId": "hepatitis",
    "targetId": "osteoporosis",
    "pmid": "37230817",
    "pathway": false
  },
  {
    "primaryId": "hepatitis",
    "targetId": "pancreatic-cancer",
    "pmid": "32088651",
    "pathway": false
  },
  {
    "primaryId": "hepatitis",
    "targetId": "parkinsons-disease",
    "pmid": "37899363",
    "pathway": false
  },
  {
    "primaryId": "hiatal-hernia",
    "targetId": "barretts-esophagus",
    "pmid": "22694245",
    "pathway": false
  },
  {
    "primaryId": "hiv-aids",
    "targetId": "uveitis",
    "pmid": "39046420",
    "pathway": false
  },
  {
    "primaryId": "hypothyroidism",
    "targetId": "tinnitus",
    "pmid": "35233053",
    "pathway": false
  },
  {
    "primaryId": "inflammatory-bowel-disease",
    "targetId": "colorectal-cancer",
    "pmid": "33385426",
    "pathway": false
  },
  {
    "primaryId": "ischemic-heart-disease",
    "targetId": "colorectal-cancer",
    "pmid": "36855430",
    "pathway": false
  },
  {
    "primaryId": "ischemic-heart-disease",
    "targetId": "respiratory-cancer",
    "pmid": "36855430",
    "pathway": false
  },
  {
    "primaryId": "narcolepsy",
    "targetId": "depressive-disorder",
    "pmid": "31203833",
    "pathway": false
  },
  {
    "primaryId": "nocardiosis",
    "targetId": "cardiac-inflammatory-disease",
    "pmid": "35787151",
    "pathway": false
  },
  {
    "primaryId": "osteoarthritis",
    "targetId": "sleep-apnea",
    "pmid": "40329131",
    "pathway": false
  },
  {
    "primaryId": "osteoporosis",
    "targetId": "trigeminal-neuralgia",
    "pmid": "35334622",
    "pathway": false
  },
  {
    "primaryId": "osteoporosis",
    "targetId": "osteonecrosis-of-the-jaw",
    "pmid": "30393090",
    "pathway": true
  },
  {
    "primaryId": "pancreatitis",
    "targetId": "cardiac-inflammatory-disease",
    "pmid": "39895893",
    "pathway": false
  },
  {
    "primaryId": "parkinsons-disease",
    "targetId": "depressive-disorder",
    "pmid": "20722714",
    "pathway": false
  },
  {
    "primaryId": "pelvic-inflammatory-disease",
    "targetId": "ovarian-cancer",
    "pmid": "28342087",
    "pathway": false
  },
  {
    "primaryId": "penetrating-head-trauma",
    "targetId": "seizure-disorder",
    "pmid": "31861595",
    "pathway": false
  },
  {
    "primaryId": "pneumoconiosis",
    "targetId": "sleep-apnea",
    "pmid": "38573463",
    "pathway": false
  },
  {
    "primaryId": "pneumoconiosis",
    "targetId": "tuberculosis",
    "pmid": "37349198",
    "pathway": false
  },
  {
    "primaryId": "psoriasis",
    "targetId": "colorectal-cancer",
    "pmid": "33011316",
    "pathway": false
  },
  {
    "primaryId": "psoriasis",
    "targetId": "erectile-dysfunction",
    "pmid": "29735408",
    "pathway": false
  },
  {
    "primaryId": "psoriasis",
    "targetId": "inflammatory-bowel-disease",
    "pmid": "30422277",
    "pathway": false
  },
  {
    "primaryId": "psoriasis",
    "targetId": "psoriatic-arthritis",
    "pmid": "38251522",
    "pathway": false
  },
  {
    "primaryId": "psoriasis",
    "targetId": "eczema",
    "pmid": "40420581",
    "pathway": true
  },
  {
    "primaryId": "psoriatic-arthritis",
    "targetId": "depressive-disorder",
    "pmid": "26882216",
    "pathway": false
  },
  {
    "primaryId": "psoriatic-arthritis",
    "targetId": "tuberculosis",
    "pmid": "39963138",
    "pathway": false
  },
  {
    "primaryId": "pulmonary-fibrosis",
    "targetId": "respiratory-cancer",
    "pmid": "38355151",
    "pathway": false
  },
  {
    "primaryId": "q-fever",
    "targetId": "gallbladder-disease",
    "pmid": "31782315",
    "pathway": false
  },
  {
    "primaryId": "sarcoidosis",
    "targetId": "pulmonary-hypertension",
    "pmid": "40005458",
    "pathway": false
  },
  {
    "primaryId": "sarcoidosis",
    "targetId": "thrombocytopenia",
    "pmid": "18038923",
    "pathway": false
  },
  {
    "primaryId": "schizophrenia",
    "targetId": "diabetes-mellitus-type-2",
    "pmid": "39324122",
    "pathway": false
  },
  {
    "primaryId": "substance-use-disorder",
    "targetId": "depressive-disorder",
    "pmid": "37223912",
    "pathway": false
  },
  {
    "primaryId": "substance-use-disorder",
    "targetId": "bipolar-disorder",
    "pmid": "37223912",
    "pathway": false
  },
  {
    "primaryId": "systemic-lupus-erythematosus",
    "targetId": "cardiac-arrhythmia",
    "pmid": "35906745",
    "pathway": false
  },
  {
    "primaryId": "systemic-lupus-erythematosus",
    "targetId": "tuberculosis",
    "pmid": "40959074",
    "pathway": false
  },
  {
    "primaryId": "thromboangiitis-obliterans",
    "targetId": "amputation-or-loss-of-use",
    "pmid": "39847853",
    "pathway": false
  },
  {
    "primaryId": "thyroid-cancer",
    "targetId": "hypoparathyroidism",
    "pmid": "38652139",
    "pathway": true
  },
  {
    "primaryId": "tuberculosis",
    "targetId": "aortic-aneurysm",
    "pmid": "35605220",
    "pathway": false
  },
  {
    "primaryId": "typhoid-fever",
    "targetId": "cardiac-inflammatory-disease",
    "pmid": "39005656",
    "pathway": false
  },
  {
    "primaryId": "hyperthyroidism",
    "targetId": "hypothyroidism",
    "pmid": "30912336",
    "pathway": true
  },
  {
    "primaryId": "essential-thrombocythemia",
    "targetId": "leukemia",
    "pmid": "38269572",
    "pathway": false
  },
  {
    "primaryId": "polycythemia-vera",
    "targetId": "leukemia",
    "pmid": "37357958",
    "pathway": false
  },
  {
    "primaryId": "primary-myelofibrosis",
    "targetId": "leukemia",
    "pmid": "36680511",
    "pathway": false
  },
  {
    "primaryId": "myelodysplastic-syndrome",
    "targetId": "leukemia",
    "pmid": "9371291",
    "pathway": false
  }
] as const;
const heldIds = [
  "acne",
  "addisons-disease",
  "adjustment-disorder",
  "ageusia",
  "agoraphobia",
  "agranulocytosis",
  "al-amyloidosis",
  "alopecia-areata",
  "als",
  "amebiasis",
  "ankle-strain",
  "anosmia",
  "anxiety-disorder",
  "aortic-aneurysm",
  "aphonia",
  "bacterial-rhinitis",
  "binge-eating-disorder",
  "bipolar-disorder",
  "bladder-cancer",
  "body-dysmorphic-disorder",
  "brain-cancer",
  "breast-cancer",
  "bronchiectasis",
  "bulimia-nervosa",
  "bursitis",
  "campylobacter-jejuni-infection",
  "cardiac-arrhythmia",
  "cardiac-inflammatory-disease",
  "carpal-tunnel-syndrome",
  "cataracts",
  "cerebral-contusion-diffuse-axonal-injury",
  "cerebral-palsy",
  "cervical-strain",
  "chronic-bronchitis",
  "chronic-fatigue-syndrome",
  "chronic-kidney-disease",
  "chronic-laryngitis",
  "cold-injury-residuals",
  "colorectal-cancer",
  "common-peroneal-neuropathy",
  "complex-regional-pain-syndrome",
  "contralateral-knee-condition",
  "coronary-bypass-residuals",
  "cranial-nerve-palsy",
  "cyclothymic-disorder",
  "cystitis-or-neurogenic-bladder",
  "deep-vein-thrombosis",
  "degenerative-disc-disease",
  "delusional-disorder",
  "depersonalization-derealization-disorder",
  "dermatitis",
  "deviated-nasal-septum",
  "diabetes-insipidus",
  "diabetic-retinopathy",
  "diaphragm-paralysis",
  "diplopia",
  "dissociative-disorder",
  "diverticulitis",
  "dry-eye-syndrome",
  "eczema",
  "endometriosis",
  "epicondylitis",
  "epididymitis-orchitis",
  "epidural-hematoma",
  "esophageal-stricture",
  "fecal-incontinence",
  "female-sexual-arousal-disorder",
  "femoral-neuropathy",
  "fibromyalgia",
  "flatfoot",
  "functional-neurological-symptom-disorder",
  "fungal-skin-infection",
  "gallbladder-disease",
  "gastritis",
  "glaucoma",
  "granulomatous-rhinitis",
  "greater-trochanteric-pain-syndrome",
  "hallux-rigidus",
  "hallux-valgus",
  "hammertoe",
  "heart-transplant-residuals",
  "heart-valve-disorders",
  "hemorrhoids",
  "heterotopic-ossification",
  "hidradenitis-suppurativa",
  "hip-labral-tear",
  "hip-strain",
  "histoplasmosis",
  "hoarding-disorder",
  "hodgkins-lymphoma",
  "hydronephrosis",
  "hyperhidrosis",
  "illness-anxiety-disorder",
  "intervertebral-disc-syndrome",
  "intracranial-injury-without-skull-fracture",
  "irritable-bowel-syndrome",
  "keratitis",
  "kidney-cancer",
  "kidney-stones",
  "knee-injury",
  "labyrinthitis",
  "laryngeal-stenosis",
  "leishmaniasis",
  "leukemia",
  "liver-cancer",
  "loss-of-teeth",
  "lumbar-strain",
  "lyme-disease",
  "macular-degeneration",
  "malaria",
  "mandibular-nonunion",
  "maxillofacial-fracture",
  "median-neuropathy",
  "menieres-disease",
  "meralgia-paresthetica",
  "metatarsalgia",
  "micro-tbi",
  "multiple-myeloma",
  "multiple-sclerosis",
  "muscle-injury",
  "myasthenia-gravis",
  "myocardial-infarction",
  "myositis",
  "noise-induced-hearing-loss",
  "non-hodgkins-lymphoma",
  "nontoxic-thyroid-enlargement",
  "nontuberculous-mycobacterial-infections",
  "nystagmus",
  "ocd",
  "optic-neuritis",
  "osteomalacia",
  "osteomyelitis",
  "osteonecrosis-of-the-jaw",
  "otitis-media",
  "pancreatic-cancer",
  "panic-disorder",
  "patellar-instability",
  "patellofemoral-pain-syndrome",
  "peptic-ulcer-disease",
  "periodontal-disease",
  "peripheral-neuropathy",
  "peripheral-vascular-disease",
  "peritoneal-adhesions",
  "persistent-depressive-disorder",
  "pes-cavus",
  "plantar-fasciitis",
  "polycystic-ovary-syndrome",
  "post-concussion-syndrome",
  "post-traumatic-osteoarthritis",
  "prostate-cancer",
  "prostatitis",
  "pulmonary-vascular-disease",
  "radial-neuropathy",
  "radiculopathy",
  "radiculopathy-femoral",
  "radiculopathy-sciatic",
  "radiculopathy-upper-extremity",
  "raynauds-syndrome",
  "rem-sleep-disorder",
  "respiratory-cancer",
  "retinal-detachment",
  "rickettsial-ehrlichial-anaplasma-infection",
  "rotator-cuff-injury",
  "sacroiliac-joint-dysfunction",
  "scarring-alopecia",
  "scars",
  "schizoaffective-disorder",
  "scoliosis",
  "seizure-disorder",
  "shigella-or-salmonella",
  "shin-splints",
  "short-bowel-syndrome",
  "shoulder-condition",
  "skin-cancer",
  "skull-fracture-non-basilar-and-basal",
  "somatic-symptom-disorder",
  "specific-phobia",
  "spinal-stenosis",
  "strongyloidiasis",
  "subdural-hematoma",
  "tarsal-metatarsal-malunion-nonunion",
  "tendinopathy",
  "thrombocytopenia",
  "tibial-neuropathy",
  "tinnitus",
  "tmj-disorder",
  "traumatic-subarachnoid-hemorrhage",
  "ulnar-neuropathy",
  "urinary-incontinence",
  "urticaria",
  "uterine-fibroids",
  "varicocele-hydrocele",
  "varicose-veins",
  "vestibular-disorder",
  "visual-impairment",
  "vitiligo",
  "vocal-cord-paralysis"
] as const;
const waveIds = [
  "actinomycosis",
  "charcot-arthropathy",
  "essential-thrombocythemia",
  "gastroparesis",
  "gout",
  "myelodysplastic-syndrome",
  "narcolepsy",
  "nocardiosis",
  "osteoporosis",
  "parkinsons-disease",
  "primary-myelofibrosis",
  "psoriatic-arthritis",
  "thromboangiitis-obliterans"
] as const;
const load = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8"));

describe("Clinical Mapping Master Batch 2026", () => {
  it("publishes exactly the 68 approved relationships with unverified sources", () => {
    expect(approved).toHaveLength(68);
    expect(new Set(approved.map((r) => r.primaryId)).size).toBe(48);
    for (const row of approved) {
      const mapping = load(row.primaryId);
      expect(mapping.draft).toBe(false);
      const s = mapping.suggestions.find((x: any) => x.conditionId === row.targetId);
      expect(s).toBeTruthy();
      expect(s.sourceReferences).toHaveLength(1);
      expect(s.sourceReferences[0].verified).toBe(false);
      expect(s.sourceReferences[0].verificationScope).toBe("clinical-evidence");
      expect(s.sourceReferences[0].sourceUrl).toContain(`/${row.pmid}/`);
      if (row.pathway) {
        expect(s.pathwayIntelligence?.pathways).toEqual(["treatment-complication"]);
      } else {
        expect(s.pathwayIntelligence).toBeUndefined();
      }
    }
  });

  it("keeps all 197 held/no-supported master identities draft", () => {
    expect(heldIds).toHaveLength(197);
    for (const id of heldIds) expect(load(id).draft).toBe(true);
  });

  it("updates the Wave ledger only for the 13 approved Wave identities", () => {
    const ledger = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "data", "expansion-dispositions.json"),
        "utf8",
      ),
    );
    const rows = ledger.waves.flatMap((w: any) => w.identities);
    const byId = new Map(rows.map((r: any) => [r.id, r.disposition]));
    expect(waveIds).toHaveLength(13);
    for (const id of waveIds) expect(byId.get(id)).toBe("published-evidence-led");
    expect(rows.filter((r: any) => r.disposition === "published-evidence-led")).toHaveLength(44);
    expect(rows.filter((r: any) => r.disposition === "safe-draft")).toHaveLength(63);
  });

  it("does not fabricate citation verification", () => {
    const refs = fs
      .readdirSync(kbDir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => {
        const m = JSON.parse(fs.readFileSync(path.join(kbDir, f), "utf8"));
        return (m.suggestions ?? []).flatMap((s: any) => s.sourceReferences ?? []);
      });
    expect(refs).toHaveLength(141);
    expect(refs.filter((r: any) => r.verified === true)).toHaveLength(68);
    expect(refs.filter((r: any) => r.verified !== true)).toHaveLength(73);
    const clinical = refs.filter((r: any) => r.verificationScope === "clinical-evidence");
    expect(clinical).toHaveLength(136);
    expect(clinical.every((r: any) => Boolean(r.sourceUrl))).toBe(true);
  });

  it("records the exhaustive disposition provenance", () => {
    const d = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "docs",
          "clinical-mapping-master-2026-approved-disposition.json",
        ),
        "utf8",
      ),
    );
    expect(d.parentHead).toBe("7b3848066b36b186f20ffe0170a3aa0489d578ea");
    expect(d.conditionDispositions).toHaveLength(245);
    expect(d.approvedRelationships).toHaveLength(68);
    expect(d.policy.mappingApprovalSeparateFromCitationVerification).toBe(true);
  });
});
