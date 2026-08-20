import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMaster2026CurrentState } from "./helpers/master-2026-current";

const kbDir = path.join(process.cwd(), "data", "knowledge-base");
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

describe("Clinical Mapping Master Batch 2026", () => {
  it("preserves the approved mapping state with completed Master citation verification", () => {
    assertMaster2026CurrentState();
  });

  it("keeps all 197 held/no-supported master identities draft", () => {
    expect(heldIds).toHaveLength(197);
    for (const id of heldIds) {
      const mapping = JSON.parse(
        fs.readFileSync(path.join(kbDir, `${id}.json`), "utf8"),
      ) as { draft: boolean };
      expect(mapping.draft).toBe(true);
    }
  });

  it("records mapping approval separately from citation verification approval", () => {
    const mapping = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "docs",
          "clinical-mapping-master-2026-approved-disposition.json",
        ),
        "utf8",
      ),
    ) as { policy: { mappingApprovalSeparateFromCitationVerification: boolean } };
    const citation = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "docs",
          "clinical-mapping-master-2026-master-citation-verification-disposition.json",
        ),
        "utf8",
      ),
    ) as { status: string; qualifiedHumanApproval: string };
    expect(mapping.policy.mappingApprovalSeparateFromCitationVerification).toBe(true);
    expect(citation.status).toBe("APPROVED-AND-IMPLEMENTED-LOCALLY");
    expect(citation.qualifiedHumanApproval).toBe(
      "I approve Clinical Mapping Master Batch 2026 — Master Citation Verification Disposition",
    );
  });

  it("recognizes later PTH citation verification outside the Master batch", () => {
    const mild = JSON.parse(
      fs.readFileSync(path.join(kbDir, "mild-tbi.json"), "utf8"),
    ) as {
      suggestions: Array<{
        sourceReferences?: Array<{ citation?: string; verified?: boolean }>;
      }>;
    };
    const ref = mild.suggestions
      .flatMap((item) => item.sourceReferences ?? [])
      .find((item) => item.citation?.includes("PMID 38568491"));
    expect(ref).toBeDefined();
    expect(ref?.verified).toBe(true);
  });
});
