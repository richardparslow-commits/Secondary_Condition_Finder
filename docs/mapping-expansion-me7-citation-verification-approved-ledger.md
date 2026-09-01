# Mapping Expansion ME-7 — Qualified-Human Citation Verification Approved Ledger

- Required implementation baseline: `68eb1eb082d43d7dcd6053746b78482e93e208a9`
- Status: **APPROVED-AND-APPLIED-LOCALLY**
- Disposition: **2 as-implemented / 2 narrowed / 1 narrowed + bibliographic correction / 0 replacement / 0 reject**
- Citation promotion: **5 KB references + 5 master sources**
- Relationship/proposition narrowing rows: **3**
- Publication-guard narrowing rows: **3**
- Bibliographic correction rows: **1**
- Source-identity changes: **0**
- Remote writes: **NOT AUTHORIZED**

## Approved rows

### 1. `benign-prostatic-hyperplasia -> urethral-stricture`
- PMID **37561537**
- DOI `10.1177/03000605231190763`
- Decision: **approve-as-implemented**
- Implementation citation: Chen F, Chen Y, Zou Y, Wang Y, Wu X, Chen M. Comparison of holmium laser enucleation and transurethral resection of prostate in benign prostatic hyperplasia: a systematic review and meta-analysis. J Int Med Res. 2023;51(8):3000605231190763. PMID 37561537. doi:10.1177/03000605231190763.
- Final citation: Chen F, Chen Y, Zou Y, Wang Y, Wu X, Chen M. Comparison of holmium laser enucleation and transurethral resection of prostate in benign prostatic hyperplasia: a systematic review and meta-analysis. J Int Med Res. 2023;51(8):3000605231190763. PMID 37561537. doi:10.1177/03000605231190763.
- Implementation proposition: Treatment-mediated urethral-stricture risk after TURP or HoLEP performed for documented benign prostatic hyperplasia.
- Final approved proposition: Treatment-mediated urethral-stricture risk after TURP or HoLEP performed for documented benign prostatic hyperplasia.
- Implementation phenotype boundary: treatment-related urethral stricture after TURP or HoLEP for BPH
- Final phenotype boundary: treatment-related urethral stricture after TURP or HoLEP for BPH
- Implementation guard: Require documented benign prostatic hyperplasia, documented transurethral resection of the prostate (TURP) or holmium laser enucleation of the prostate (HoLEP), and a separately established urethral stricture arising after that procedure with compatible chronology. Do not infer urethral stricture from untreated BPH, lower urinary tract symptoms, or bladder-outlet obstruction alone. Preserve prior urethral instrumentation or trauma, infection, lichen sclerosus, prior pelvic surgery or radiation, and other recognized causes of urethral stricture.
- Final approved guard: Require documented benign prostatic hyperplasia, documented transurethral resection of the prostate (TURP) or holmium laser enucleation of the prostate (HoLEP), and a separately established urethral stricture arising after that procedure with compatible chronology. Do not infer urethral stricture from untreated BPH, lower urinary tract symptoms, or bladder-outlet obstruction alone. Preserve prior urethral instrumentation or trauma, infection, lichen sclerosus, prior pelvic surgery or radiation, and other recognized causes of urethral stricture.

### 2. `q-fever -> hepatitis`
- PMID **29543806**
- DOI `10.1371/journal.pntd.0006338`
- Decision: **approve-with-narrowing**
- Implementation citation: Alende-Castro V, Macía-Rodríguez C, Novo-Veleiro I, et al. Q fever in Spain: Description of a new series, and systematic review. PLoS Negl Trop Dis. 2018;12(3):e0006338. PMID 29543806. doi:10.1371/journal.pntd.0006338.
- Final citation: Alende-Castro V, Macía-Rodríguez C, Novo-Veleiro I, et al. Q fever in Spain: Description of a new series, and systematic review. PLoS Negl Trop Dis. 2018;12(3):e0006338. PMID 29543806. doi:10.1371/journal.pntd.0006338.
- Implementation proposition: Acute Q-fever-associated hepatitis or hepatic injury as a recognized acute manifestation/complication.
- Final approved proposition: Acute hepatitis as a recognized clinical manifestation of acute Q fever.
- Implementation phenotype boundary: acute Q-fever-associated hepatitis/hepatic injury
- Final phenotype boundary: acute Q-fever-associated hepatitis
- Implementation guard: Require clinically established acute Q fever using appropriate Coxiella burnetii diagnostic evidence and separately established acute hepatitis or hepatic injury with compatible timing. Do not generalize this edge to chronic hepatitis, cirrhosis, or an isolated nonspecific liver-enzyme elevation without a compatible acute Q-fever syndrome. Preserve viral hepatitis, alcohol-associated liver disease, metabolic liver disease, autoimmune hepatitis, drug- or toxin-induced injury, ischemic injury, biliary disease, and other hepatic causes.
- Final approved guard: Require clinically established acute Q fever using appropriate Coxiella burnetii diagnostic evidence and separately established acute hepatitis with compatible timing. Do not generalize this edge to chronic hepatitis, cirrhosis, or an isolated nonspecific liver-enzyme elevation without a compatible acute Q-fever syndrome. Preserve viral hepatitis, alcohol-associated liver disease, metabolic liver disease, autoimmune hepatitis, drug- or toxin-induced injury, ischemic injury, biliary disease, and other hepatic causes.

### 3. `polycythemia-vera -> pulmonary-hypertension`
- PMID **37311222**
- DOI `10.1164/rccm.202210-1941OC`
- Decision: **approve-with-narrowing**
- Implementation citation: Montani D, Thoré P, Mignard X, et al. Clinical Phenotype and Outcomes of Pulmonary Hypertension Associated with Myeloproliferative Neoplasms: A Population-based Study. Am J Respir Crit Care Med. 2023;208(5):600-612. PMID 37311222. doi:10.1164/rccm.202210-1941OC.
- Final citation: Montani D, Thoré P, Mignard X, et al. Clinical Phenotype and Outcomes of Pulmonary Hypertension Associated with Myeloproliferative Neoplasms: A Population-based Study. Am J Respir Crit Care Med. 2023;208(5):600-612. PMID 37311222. doi:10.1164/rccm.202210-1941OC.
- Implementation proposition: Hemodynamically established pulmonary hypertension associated with myeloproliferative neoplasms, including PV-associated CTEPH/group-5 phenotypes.
- Final approved proposition: Hemodynamically established precapillary pulmonary hypertension can occur with myeloproliferative neoplasms; in polycythemia vera the registry evidence is strongest for chronic thromboembolic pulmonary hypertension, while group-5 PH is also represented across the MPN cohort.
- Implementation phenotype boundary: hemodynamically confirmed MPN-associated precapillary PH, including CTEPH or group-5 PH
- Final phenotype boundary: hemodynamically confirmed precapillary PH, with CTEPH versus group-5 classification when applicable
- Implementation guard: Require confirmed polycythemia vera and a separately established pulmonary-hypertension diagnosis using appropriate hemodynamic evaluation, with classification of chronic thromboembolic pulmonary hypertension versus group-5 or other PH mechanisms. Do not infer pulmonary hypertension from polycythemia vera, dyspnea, hypoxemia, or an isolated echocardiographic estimate alone. Treat the registry as population-level complication evidence rather than automatic individual causation. Preserve left-heart disease, chronic lung disease or hypoxia, sleep-disordered breathing, unrelated thromboembolic disease, medications, and other recognized pulmonary-hypertension causes.
- Final approved guard: Require confirmed polycythemia vera and separately established precapillary pulmonary hypertension using appropriate hemodynamic evaluation, with classification of chronic thromboembolic pulmonary hypertension versus group-5 PH when applicable. The source is strongest for CTEPH in polycythemia vera/essential thrombocythemia and does not support postcapillary pulmonary hypertension caused by left-heart disease. Do not infer pulmonary hypertension from polycythemia vera, dyspnea, hypoxemia, or an isolated echocardiographic estimate alone. Treat the registry as population-level complication evidence rather than automatic individual causation. Preserve left-heart disease, chronic lung disease or hypoxia, sleep-disordered breathing, unrelated thromboembolic disease, medications, and other recognized pulmonary-hypertension causes.

### 4. `hiatal-hernia -> gerd`
- PMID **10482693**
- DOI `10.1016/S1091-255X(99)80057-2`
- Decision: **approve-as-implemented**
- Implementation citation: Fein M, Ritter MP, DeMeester TR, et al. Role of the lower esophageal sphincter and hiatal hernia in the pathogenesis of gastroesophageal reflux disease. J Gastrointest Surg. 1999;3(4):405-410. PMID 10482693. doi:10.1016/S1091-255X(99)80057-2.
- Final citation: Fein M, Ritter MP, DeMeester TR, et al. Role of the lower esophageal sphincter and hiatal hernia in the pathogenesis of gastroesophageal reflux disease. J Gastrointest Surg. 1999;3(4):405-410. PMID 10482693. doi:10.1016/S1091-255X(99)80057-2.
- Implementation proposition: Physiologically relevant hiatal hernia as an anatomic contributor to objectively established gastroesophageal reflux disease.
- Final approved proposition: Physiologically relevant hiatal hernia as an anatomic contributor to objectively established gastroesophageal reflux disease.
- Implementation phenotype boundary: physiologically relevant/sliding hiatal hernia with separately established GERD
- Final phenotype boundary: physiologically relevant/sliding hiatal hernia with separately established GERD
- Implementation guard: Require a documented hiatal hernia, with the source proposition most directly applicable to a sliding or otherwise physiologically relevant gastroesophageal-junction hernia, and a separately established diagnosis of GERD using appropriate clinical, endoscopic, or reflux-monitoring evidence. Do not infer GERD solely from the presence of a hiatal hernia. Preserve lower-esophageal-sphincter dysfunction, obesity, medications, delayed gastric emptying, dietary or behavioral contributors, prior foregut surgery, and other reflux causes.
- Final approved guard: Require a documented hiatal hernia, with the source proposition most directly applicable to a sliding or otherwise physiologically relevant gastroesophageal-junction hernia, and a separately established diagnosis of GERD using appropriate clinical, endoscopic, or reflux-monitoring evidence. Do not infer GERD solely from the presence of a hiatal hernia. Preserve lower-esophageal-sphincter dysfunction, obesity, medications, delayed gastric emptying, dietary or behavioral contributors, prior foregut surgery, and other reflux causes.

### 5. `esophageal-cancer -> cardiomyopathy`
- PMID **35289694**
- DOI `10.1080/0284186X.2022.2048068`
- Decision: **approve-with-narrowing-and-bibliographic-correction**
- Implementation citation: Søndergaard MMA, Nordsmark M, Møller DS, Nielsen KM, Poulsen SH. Reduction in myocardial function and oxygen consumption after chemoradiotherapy in patients with esophageal cancer. Acta Oncol. 2022;61(5):566-574. PMID 35289694. doi:10.1080/0284186X.2022.2048068.
- Final citation: Astrup Søndergaard MM, Nordsmark M, Sloth Møller D, Melgaard Nielsen K, Poulsen SH. Reduction in myocardial function and oxygen consumption after chemoradiotherapy in patients with esophageal cancer. Acta Oncol. 2022;61(5):566-574. PMID 35289694. doi:10.1080/0284186X.2022.2048068.
- Implementation proposition: Treatment-mediated myocardial dysfunction/cardiomyopathy following actual thoracic chemoradiotherapy for esophageal cancer.
- Final approved proposition: Thoracic chemoradiotherapy for esophageal cancer is associated with early left-ventricular functional decline; this source supports a treatment-mediated cardiotoxicity pathway but does not by itself establish cardiomyopathy.
- Implementation phenotype boundary: treatment-related myocardial dysfunction/cardiomyopathy after esophageal-cancer chemoradiotherapy
- Final phenotype boundary: separately established cardiomyopathy after thoracic chemoradiotherapy for esophageal cancer
- Implementation guard: Require documented esophageal cancer, actual exposure to thoracic chemoradiotherapy, and a separately established myocardial-dysfunction or cardiomyopathy phenotype with compatible post-treatment chronology. Do not infer cardiomyopathy from the cancer diagnosis, radiation exposure, a small isolated strain change, fatigue, or dyspnea alone. Preserve pre-existing cardiomyopathy or heart failure, ischemic disease, hypertension, valvular disease, arrhythmia, other cardiotoxic therapies, alcohol or toxin exposure, genetic cardiomyopathy, and other recognized myocardial causes.
- Final approved guard: Require documented esophageal cancer, actual exposure to thoracic chemoradiotherapy, and a separately established cardiomyopathy diagnosis with compatible post-treatment chronology. Use this source only as evidence that chemoradiotherapy can produce early left-ventricular dysfunction/cardiotoxicity; it does not itself establish cardiomyopathy or individual causation. Do not infer cardiomyopathy from the cancer diagnosis, radiation exposure, a small isolated strain or ejection-fraction change, fatigue, or dyspnea alone. Preserve pre-existing cardiomyopathy or heart failure, ischemic disease, hypertension, valvular disease, arrhythmia, other cardiotoxic therapies, alcohol or toxin exposure, genetic cardiomyopathy, and other recognized myocardial causes.

## Verification boundary

This approval authorizes exactly five citation promotions, the three approved proposition/guard narrowings, and the one same-source bibliographic correction above.
It does not authorize source replacement, a new relationship, a new identity, publication-state change, rank-1 change, pathwayIntelligence change, semantic broadening, git push, GitHub write, or Vercel action.

## Local citation-verification result

- 5/5 ME-7 clinical references promoted to `verified:true`.
- 5/5 normalized ME-7 master sources promoted to `active`.
- 3/5 relationship proposition/publication boundaries narrowed exactly as approved.
- PMID 35289694 citation corrected within the same source identity; PMID and DOI unchanged.
- Final citation state: 216/216 live verified / 0 unverified / 0 review / 0 hard.
- No source replacement, semantic broadening, taxonomy change, publication-state change, rank-1 change, pathwayIntelligence change, or remote write.
