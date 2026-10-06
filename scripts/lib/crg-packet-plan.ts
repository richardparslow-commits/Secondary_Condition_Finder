// Explicit identity resolution, in packet row order. This is not publication approval.
// Alternatives are drawn from each packet's differential, not inferred from its DC.
export type PacketRowPlan = {
  host: string;
  target: string;
  alternatives: string[];
  baselineProgression?: string;
  aggravatingFactor?: string;
};

function row(host: string, target: string, ...alternatives: string[]): PacketRowPlan {
  return { host, target, alternatives };
}

export const CRG_PACKET_PLAN: PacketRowPlan[][] = [
  [
    row("traumatic-brain-injury-residuals", "post-traumatic-headache", "Primary migraine or tension-type headache predating injury", "Medication-overuse or cervicogenic headache"),
    row("diabetes-mellitus-type-2", "peripheral-neuropathy", "Vitamin B12 deficiency, including metformin-associated deficiency", "Alcohol-related neuropathy, hypothyroidism, or renal disease"),
    row("rheumatoid-arthritis", "cataracts", "Age-related nuclear or cortical cataract", "Diabetes, ocular trauma, or intraocular inflammation"),
    row("traumatic-brain-injury-residuals", "vestibular-disorder", "Pre-existing or idiopathic benign paroxysmal positional vertigo", "Vestibular migraine, Meniere's disease, or central vestibular disease"),
    row("traumatic-brain-injury-residuals", "hypopituitarism", "Pituitary adenoma or another sellar mass", "Hypophysitis, cranial radiotherapy, or infiltrative disease"),
  ],
  [
    {
      ...row("tinnitus", "migraine-headaches", "Medication-overuse headache", "Independent progression of migraine or structural/vascular headache"),
      baselineProgression: "No patient baseline has been supplied. Retrieve contemporaneous pre-aggravation migraine frequency, duration, prostration and disability; compare the documented course with independent natural migraine progression and medication-overuse headache before attributing any increment to tinnitus.",
      aggravatingFactor: "Proposed, not patient-established: persistent tinnitus-associated distress, auditory sensory load and sleep fragmentation could lower migraine attack threshold through central sensitization. The packet discloses predominantly cross-sectional evidence and reverse-direction weighting; chronology and a measured attributable increase are required.",
    },
    row("osteoarthritis", "gerd", "Hiatus hernia or another anatomic reflux driver", "Obesity, smoking, alcohol, or an independent motility disorder"),
    row("traumatic-brain-injury-residuals", "seizure-disorder", "Pre-existing epilepsy or alcohol-withdrawal seizures", "Metabolic, infectious, neoplastic, or medication-related seizures"),
    row("traumatic-brain-injury-residuals", "dementia", "Independent Alzheimer, vascular, Parkinson, or Lewy body disease", "Alcohol-related cognitive impairment, medication effects, or depression"),
    row("depressive-disorder", "anorgasmia", "Depression itself or relationship/psychosocial factors", "Hypogonadism, diabetes, pelvic treatment, or other medication effects"),
  ],
  [
    row("diabetes-mellitus-type-2", "hepatic-steatosis", "Alcohol-related or viral/autoimmune liver disease", "Obesity, dyslipidemia, or steatogenic medication exposure"),
    row("rheumatoid-arthritis", "osteopenia", "Postmenopausal, age-related, or hypogonadal bone loss", "Vitamin D/calcium deficiency, malabsorption, or renal bone disease"),
    row("hypothyroidism", "carpal-tunnel-syndrome", "Repetitive occupational loading or idiopathic median entrapment", "Diabetes, obesity, inflammatory arthritis, or a space-occupying lesion"),
    row("degenerative-disc-disease", "hypogonadism", "Primary testicular failure or pituitary/hypothalamic disease", "Obesity, sleep apnea, chronic illness, or age-related androgen decline"),
    row("traumatic-brain-injury-residuals", "insomnia", "Sleep apnea, restless legs syndrome, or a circadian disorder", "Pain, PTSD, depression, substance/medication effects, or pre-existing insomnia"),
  ],
  [
    row("asthma", "avascular-necrosis", "Alcohol-related osteonecrosis or prior trauma", "Hemoglobinopathy, coagulation disorder, or idiopathic osteonecrosis"),
    row("diabetes-mellitus-type-2", "diabetic-gastroparesis", "Opioid, GLP-1 agonist, or anticholinergic medication effects", "Prior gastrointestinal surgery, hypothyroidism, or neurologic disease"),
    row("hypothyroidism", "sleep-apnea", "Obesity or anatomic upper-airway obstruction", "Alcohol, sedative, or opioid exposure and age-related susceptibility"),
    row("osteoarthritis", "peptic-ulcer-disease", "Helicobacter pylori infection", "Critical-illness stress, gastric malignancy, or another ulcerogenic exposure"),
    row("rheumatoid-arthritis", "glaucoma", "Primary open-angle or angle-closure glaucoma", "Uveitis, pseudoexfoliation, or pigment dispersion"),
  ],
  [
    row("gerd", "barretts-esophagus", "Obesity and central adiposity as competing contributors", "Smoking and age/sex susceptibility independent of the asserted reflux contribution"),
    row("alcohol-use-disorder", "peripheral-neuropathy", "Diabetes mellitus or renal neuropathy", "Vitamin B12/folate deficiency, paraproteinemia, or inherited neuropathy"),
    row("diabetes-mellitus-type-2", "diabetic-nephropathy", "Hypertensive nephrosclerosis or glomerulonephritis", "Toxic/interstitial nephropathy, amyloidosis, or viral renal disease"),
    row("hypertension", "hypertensive-retinopathy", "Diabetic retinopathy", "Retinal vein occlusion or hematologic/coagulation-related retinopathy"),
    row("hypertension", "gout", "Alcohol exposure, renal urate retention, or obesity/metabolic syndrome", "Dietary/genetic susceptibility or another urate-raising medication"),
  ],
  [
    row("degenerative-disc-disease", "radiculopathy-sciatic", "Diabetic polyneuropathy, peroneal entrapment, or plexopathy", "Hip disease, vascular claudication, or an independent spinal lesion"),
    row("degenerative-disc-disease", "radiculopathy-upper-extremity", "Median/ulnar entrapment or brachial plexopathy", "Shoulder pathology, generalized neuropathy, or an independent spinal process"),
    row("gerd", "esophageal-stricture", "Esophageal malignancy or eosinophilic esophagitis", "Caustic, radiation, anastomotic, or pill-induced esophageal injury"),
    row("schizophrenia", "drug-induced-parkinsonism", "Idiopathic Parkinson disease or vascular parkinsonism", "Essential tremor, psychomotor slowing, or another drug-induced movement disorder"),
    {
      ...row("chronic-kidney-disease", "restless-leg-syndrome", "Nonrenal iron loss or longstanding familial restless legs syndrome", "Untreated sleep apnea, medication effects, or dopamine-agonist augmentation"),
      baselineProgression: "No patient baseline has been supplied. Confirm RLS predating advanced renal disease and retrieve symptom frequency, duration, sleep/function impact, treatment requirements and available severity scores. Familial disease and nonrenal iron loss can progress independently; compare those natural trajectories with the qualifying pre-aggravation medical evidence.",
      aggravatingFactor: "Proposed, not patient-established: uremic illness and altered iron availability during renal progression or dialysis could increase pre-existing RLS burden. The packet states that a single established biochemical cascade is not demonstrated; repeated clinical assessments, renal/iron changes and medication chronology must support an actual attributable increase.",
    },
  ],
  [
    row("asthma", "oral-candidiasis", "Diabetes, immunosuppression, or another corticosteroid exposure", "Antibiotic exposure, dentures, or local oral factors"),
    row("prostatitis", "achilles-tendinopathy-rupture", "Mechanical overuse, trauma, or pre-existing tendon degeneration", "Systemic corticosteroid exposure, diabetes, or renal disease"),
    row("testicular-cancer", "hearing-loss", "Noise exposure or age-related hearing loss", "Other ototoxic agents or pre-existing auditory disease"),
    row("benign-prostatic-hyperplasia", "hydronephrosis", "Stone, ureteral stricture, or upper-tract malignancy", "Neurogenic bladder or another outlet-obstruction cause"),
    row("diabetes-mellitus-type-2", "osteomyelitis", "Direct inoculation after trauma or surgery", "Hematogenous infection or a non-diabetic infectious route"),
  ],
  [
    row("cerebrovascular-accident-stroke-residuals", "complex-regional-pain-syndrome", "Post-stroke spasticity or contracture", "Peripheral nerve injury or an independent musculoskeletal lesion"),
    row("rheumatoid-arthritis", "addisons-disease", "Primary autoimmune adrenal failure", "Pituitary disease, infiltrative adrenal disease, or another adrenal-suppression exposure"),
    row("gerd", "tardive-dyskinesia", "Antipsychotic or another dopamine-receptor-blocking exposure", "A primary movement disorder or another dyskinesia syndrome"),
    row("oral-cancer", "osteonecrosis-of-the-jaw", "Antiresorptive medication-related jaw osteonecrosis", "Recurrent malignancy, odontogenic infection, or traumatic jaw injury"),
    row("traumatic-brain-injury-residuals", "heterotopic-ossification", "Local fracture, surgery, or orthopedic trauma", "Spinal cord injury, burns, or an independent predisposition"),
  ],
  [
    row("gerd", "dental-abrasion-erosion-abfraction", "Dietary acid exposure or vomiting from another cause", "Mechanical abrasion, bruxism, or salivary hypofunction"),
    row("copd", "stress-urinary-incontinence", "Childbirth/pelvic-floor injury or obesity", "Pelvic surgery or an independent continence disorder"),
    row("diabetes-mellitus-type-2", "urge-urinary-incontinence", "Urinary infection or an independent overactive bladder syndrome", "Outlet obstruction, neurologic disease, or medication effects"),
    row("congestive-heart-failure", "pleural-effusion", "Malignancy, infection, or pulmonary embolism", "Cirrhosis, renal disease, or another noncardiac fluid-balance disorder"),
    row("diabetes-mellitus-type-2", "rotator-cuff-tear", "Acute traumatic tear or age-related degeneration", "Overhead loading, impingement, or inflammatory shoulder disease"),
  ],
  [
    {
      ...row("hypertension", "aortic-aneurysm", "Smoking and age-related degenerative aortopathy", "Family history, connective-tissue disease, bicuspid valve, or prior dissection"),
      baselineProgression: "No patient baseline has been supplied. Retrieve earlier imaging with aortic site and dimensions, then compare serial growth with the expected natural course of the pre-existing degenerative or genetic aortopathy. Smoking, age and familial disease can independently drive progression; a qualifying baseline cannot be invented from a population estimate.",
      aggravatingFactor: "Proposed, not patient-established: sustained elevated blood pressure adds cyclic wall strain and remodeling to an already abnormal aorta. The packet explicitly distinguishes association with aneurysm presence from weaker evidence for expansion; serial imaging and contemporaneous blood-pressure history must demonstrate an attributable increase beyond natural progression.",
    },
    row("diabetes-mellitus-type-2", "trigger-finger", "Repetitive manual loading, local trauma, or idiopathic stenosing tenosynovitis", "Inflammatory arthritis, hypothyroidism, amyloid, or crystal arthropathy"),
    row("copd", "xerostomia", "Other xerogenic medication or Sjogren syndrome", "Head/neck radiation, dehydration, diabetes, or mouth breathing"),
    row("rheumatoid-arthritis", "flatfoot", "Congenital pes planus or noninflammatory posterior tibial tendon dysfunction", "Charcot arthropathy, obesity, tarsal coalition, or prior trauma"),
    row("diabetes-mellitus-type-2", "femoral-neuropathy", "Lumbar radiculopathy or structural femoral nerve compression", "Malignant/radiation plexopathy, vasculitis, or toxic myopathy"),
  ],
  [
    row("cirrhosis-of-the-liver", "cholelithiasis", "Obesity/metabolic susceptibility or rapid weight loss", "Independent hemolysis, ileal disease, or lithogenic medication"),
    row("hypothyroidism", "fibromyalgia", "Primary sleep disturbance, depression/anxiety, or deconditioning", "Other autoimmune disease, medication myalgia, or small-fiber neuropathy"),
    row("traumatic-brain-injury-residuals", "menieres-disease", "Idiopathic Meniere's disease or vestibular migraine", "Viral/autoimmune inner-ear disease or independent acoustic injury"),
    row("hyperthyroidism", "dry-eye-syndrome", "Age-related tear deficiency or meibomian gland dysfunction", "Sjogren syndrome, contact-lens/environmental exposure, or medication effects"),
    row("diabetes-mellitus-type-2", "meralgia-paresthetica", "Obesity or compression from belts, garments, or body armor", "Prior surgery, groin trauma, pelvic mass, or another metabolic neuropathy"),
  ],
  [
    row("chronic-kidney-disease", "osteomalacia", "Dietary vitamin D deficiency or malabsorption", "Medication-related/inherited phosphate wasting or coexisting osteoporosis"),
    row("nontoxic-thyroid-enlargement", "vocal-cord-paralysis", "Intubation trauma or pre-existing compressive/idiopathic palsy", "Central neurologic disease, viral neuritis, or laryngeal malignancy"),
    row("prostatitis", "tendinopathy", "Degenerative tendon disease, trauma, or mechanical loading", "Systemic steroids, diabetes, renal disease, or inflammatory arthropathy"),
    row("scleroderma", "raynauds-syndrome", "Primary Raynaud's disease or cold-injury residuals", "Vasoconstrictor medication, vibration exposure, or another connective-tissue disease"),
    row("hypertension", "subacute-cutaneous-lupus", "Idiopathic subacute cutaneous or systemic lupus", "Another photosensitizing medication or a different photosensitive dermatosis"),
  ],
  [
    row("hypertension", "myositis", "Self-limited toxic statin myopathy or hypothyroidism", "Non-statin inflammatory, paraneoplastic, infectious, or inherited myopathy"),
    row("diabetes-mellitus-type-2", "tarsal-tunnel-syndrome", "Diffuse diabetic polyneuropathy or lumbosacral radiculopathy", "Ankle trauma/deformity, ganglion, tenosynovitis, or another metabolic neuropathy"),
    row("gout", "toxic-epidermal-necrolysis", "Another high-risk co-prescribed culprit medication", "DRESS, staphylococcal scalded skin, pemphigus, or another blistering disorder"),
    row("cholelithiasis", "peritoneal-adhesions", "Other prior surgery, endometriosis, or peritonitis", "Hernia, malignancy, Crohn's disease, or another obstruction cause"),
    row("ptsd", "takotsubo-cardiomyopathy", "Acute coronary syndrome, coronary dissection, or pheochromocytoma", "Sepsis, intracranial events, thyrotoxicosis, stimulant exposure, or perioperative stress"),
  ],
];
