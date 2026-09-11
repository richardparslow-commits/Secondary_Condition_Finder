# Feature Ideas

**Project:** Secondary

_Generated: 9/9/2026, 4:39:26 PM_

_Produced by [Agiloop](https://agiloop.ai)_

---

## Ideas

### 1. Medical Record Checklist Generator

**Category:** PRODUCTIVITY | **Impact:** High Impact

After selecting secondary conditions, generate a specific, actionable checklist of medical records and evidence types needed to support each claim pathway. For example: 'To support PTSD → Sleep Disorder via neurological mechanism, obtain: sleep study results, neurology records, and sleep specialist notes.' Veterans can use this checklist when requesting records from providers or VA.

**Why It Matters**

Veterans get a concrete roadmap of what medical evidence to pursue, reducing guesswork about what documentation actually matters for their specific claim pathways.

**Recommendation: Medical Record Checklist Generator**

Veterans often struggle knowing which medical records to request. A pathway-specific checklist transforms abstract evidence gaps into concrete actionable steps, directly supporting the claim-preparation workflow.

After suggestions are displayed, show a 'Prepare Evidence' section for each recommended condition. For each pathway (DIRECT_CAUSATION, AGGRAVATION, etc.), display a checklist of evidence types (e.g., 'Specialist evaluation', 'Imaging results', 'Treatment records'). Each checklist item includes 1-2 sentences on why it matters (e.g., 'Neurologist's notes establish the causal mechanism between service-connected condition and new diagnosis'). Veterans can check items off as they gather records. Export the checklist with the consultation summary.

### 2. Condition Comparison Tool

**Category:** USER EXPERIENCE | **Impact:** High Impact

Allow veterans to select 2-3 secondary conditions from their suggestions and compare them side-by-side. Display nexus pathway strength, evidence quality ratings, typical rating ranges, number of supporting citations, and required evidence gaps for each. Helps veterans prioritize which conditions to pursue first.

**Why It Matters**

Veterans can make informed decisions about which secondary conditions have the strongest evidence and are most likely to succeed, focusing their claim-preparation effort on the most promising options.

**Recommendation: Condition Comparison Tool**

When veterans receive multiple suggested secondary conditions, they need to triage. A side-by-side comparison of evidence strength, ratings potential, and complexity helps them allocate limited time and resources to the most defensible claims.

Add a 'Compare Conditions' button on the suggestions page. Clicking opens a modal or page where users select 2-3 conditions from their results. Display a table with columns: Condition Name | Nexus Classification (DIRECT_CAUSATION/AGGRAVATION/ASSOCIATION_ONLY) | Etiological Consensus (Well-Established/Probable/Contested) | Typical Rating Range (e.g., 20-50%) | Number of Citations | Evidence Gaps (count). Highlight cells with stronger evidence in green. Include a 'Download Comparison' option to export as PDF.

### 3. Interactive VA Rating Schedule Guide

**Category:** ANALYTICS & INSIGHTS | **Impact:** High Impact

Provide an interactive explorer of VA rating schedules specific to each recommended condition. Veterans can select a condition, enter their symptoms/functional limitations, and the tool shows which VA rating category applies (20%, 30%, 40%, etc.) and the criteria needed for each rating level. Helps veterans understand potential disability compensation amounts.

**Why It Matters**

Veterans gain clarity on disability rating percentages for recommended conditions, helping them understand the financial implications of successful secondary condition claims.

**Recommendation: Interactive VA Rating Schedule Guide**

Understanding potential disability ratings motivates claim filing and helps veterans set realistic expectations. Interactive exploration of rating criteria demystifies VA disability assessment and connects medical findings to compensation levels.

Add a 'Rating Schedule' tab or sidebar section for each condition suggestion. Display the VA rating schedule for that condition extracted from diagnostic code criteria. Include: (1) a visual scale showing 0%, 10%, 20%...100% rating levels, (2) text describing the diagnostic criteria for each level (e.g., '30%: Productive cough with slight dyspnea'), (3) an interactive 'Symptom Matcher' where users check off their symptoms and the tool highlights the likely rating category. Show examples: 'Your reported symptoms typically match criteria for 40% rating.' Include a disclaimer that final rating is determined by VA.

### 4. Evidence Strength Indicator

**Category:** ANALYTICS & INSIGHTS | **Impact:** Medium Impact

Add visual badges or indicators to each suggested secondary condition showing the strength of medical evidence supporting that pathway. Badges display etiological consensus level (Well-Established, Probable, Contested, Not-Established). Color-coded indicators help veterans quickly identify which pathways have the strongest scientific support.

**Why It Matters**

Veterans can immediately see which secondary condition claims have solid medical backing versus those needing stronger evidence, helping them prioritize claim filing and understand risk.

**Recommendation: Evidence Strength Indicator**

Not all secondary condition pathways are equally well-supported by medical literature. Visual strength indicators help veterans judge which claims are most defensible without reading detailed medical descriptions.

For each secondary condition suggestion, display a colored badge next to the nexus classification showing etiological consensus: Green for 'Well-Established', Yellow for 'Probable', Orange for 'Contested', Gray for 'Not-Established'. Include a tooltip: 'Well-Established: Strong medical consensus on this pathway' or 'Contested: Medical experts disagree; strong nexus evidence is essential.' Aggregate the badge into the suggestion card header for quick scanning. On the detailed view, include a one-sentence explanation: 'The medical literature on [condition] causing [secondary] is [level], which means [implication for your claim].'

### 5. Personalized Claim Action Plan

**Category:** PRODUCTIVITY | **Impact:** High Impact

After viewing suggestions, generate a 'Your Next Steps' plan that prioritizes conditions in ranked order, recommends specific VA forms to file, includes timeline expectations, and links to relevant resources. Transforms abstract suggestions into a concrete claim-filing roadmap.

**Why It Matters**

Veterans receive a clear, step-by-step action plan to move from research to actual claim filing, reducing confusion and encouraging follow-through.

**Recommendation: Personalized Claim Action Plan**

Suggestions are research outputs, not filing instructions. A personalized action plan bridges that gap, converting research results into executable steps that reduce barriers to actual claim submission.

After displaying suggestions, show a 'Create Your Action Plan' button. Clicking generates a prioritized list: (1) Rank conditions by evidence strength and effort, (2) For each top-ranked condition, show: 'File using [Form 21-0960 or other] → Gather [evidence checklist] → Schedule VA exam → Submit by [realistic timeline]', (3) Include links to forms, presumptive category pages if applicable, and contact information for local VSO offices, (4) Show realistic timelines ('Initial processing typically takes 3-5 months'), (5) Offer download as PDF or printable action card. Include disclaimer: 'This is a research-generated suggestion, not VA guidance.'

### 6. AI Symptom Reverse Matcher

**Category:** AUTOMATION | **Impact:** High Impact

Allow veterans to enter symptoms or medical complaints in natural language (e.g., 'I have chronic pain and trouble sleeping since my military injury') and the AI matches them to secondary conditions in the knowledge base. Reverses the current flow where veterans start with service-connected conditions; instead, veterans can start from their actual symptoms.

**Why It Matters**

Veterans who aren't sure which conditions to research can describe their symptoms and discover relevant secondary conditions, making the research process more intuitive and discovery-focused.

**Recommendation: AI Symptom Reverse Matcher**

The current workflow assumes veterans know their primary service-connected conditions upfront. Many veterans think in terms of their symptoms and don't immediately connect them to specific diagnoses. An AI-powered symptom matcher removes this barrier to entry.

Add an alternative entry point on the homepage: 'Describe Your Symptoms' card with a text input ('I experience...'). When submitted, send the symptom description to an LLM with this system prompt: 'Given veteran-reported symptoms, identify conditions from this knowledge base that commonly present with these symptoms. Return top 5 conditions with symptom-match confidence scores (0-100%). Always include: (1) confirmed condition name from catalog, (2) why these symptoms suggest this condition, (3) which service-connected conditions commonly cause it, (4) disclaimer: symptoms don't constitute diagnosis.'. Display results with confidence scores and links to the secondary-condition workflow pre-populated with candidate conditions. Include clear disclaimer: 'AI matching helps organize research but is not medical advice; symptoms may indicate other conditions not listed here.'

### 7. Medical Evidence Pathway Analyzer

**Category:** AUTOMATION | **Impact:** High Impact

Allow veterans to upload medical records or paste clinical notes. An AI analyzer reads the documents and explains how specific findings support (or weaken) each recommended secondary condition pathway. For example: 'Your sleep study confirms insomnia, which supports the PTSD → Sleep Disorder pathway by showing objective evidence of the sleep disturbance mechanism.'

**Why It Matters**

Veterans gain confidence that their medical records support their claims by seeing specific evidence-to-pathway connections explained in plain language.

**Recommendation: Medical Evidence Pathway Analyzer**

Veterans often collect medical records but struggle to connect specific findings to their claims. An AI analyzer bridges this gap by mapping medical evidence to supported pathways, reducing uncertainty about whether they have 'enough' evidence.

Add an 'Analyze Your Medical Records' feature in the evidence-upload section. After uploading documents, show an 'AI Analysis' button. When clicked, send extracted text to an LLM with this prompt: 'Analyze these clinical notes against these secondary condition pathways: [list with mechanisms]. For each pathway, identify specific clinical findings that support it (e.g., "Doctor noted poor sleep quality" supports sleep-disorder pathway). Format: Pathway Name → Specific Finding → Why It Matters. Include gaps: "To strengthen [pathway], consider obtaining [type of evaluation].' Always note: findings are research cues, not medical determinations.' Display results in a table format with Pathway | Supporting Evidence | Evidence Gaps columns. Allow side-by-side comparison with baseline suggestions.

### 8. Accredited Representative & VSO Locator

**Category:** INTEGRATIONS | **Impact:** Medium Impact

Integrate a searchable directory of accredited VA representatives, VSO (Veterans Service Organizations) offices, and legal representatives. Veterans can search by zip code or location to find nearby help with filing claims. Includes contact information, specializations (e.g., 'PTSD claims specialist'), and links to their websites.

**Why It Matters**

Veterans can find qualified professional help to support their claim filing without conducting their own internet search, making the research-to-filing transition smoother.

**Recommendation: Accredited Representative & VSO Locator**

The tool emphasizes that suggestions should be reviewed with 'a qualified provider or accredited representative,' but provides no way to find one. A locator removes a key friction point in the claim-preparation process.

Add a 'Find Help' section on the suggestions page or homepage with: (1) A search box: 'Enter your zip code to find accredited representatives near you', (2) Display results as a list with: Representative/Organization Name | Distance from you | Specializations (if available) | Phone | Website link | Accreditation status badge, (3) Filter options: 'VSO', 'Accredited Agent', 'Attorney', (4) Include note: 'Accredited representatives can file claims at no upfront cost (fees may be allowed after claim approval).' Integrate data from VA's OGC Accredited Representatives database (public API) and cross-reference with VSO locator data.

### 9. DD-214 Auto-Parser for Service History

**Category:** USER EXPERIENCE | **Impact:** Medium Impact

Allow veterans to upload their DD-214 (Certificate of Discharge) document. The app auto-extracts service dates, branch, locations, and occupations, then pre-fills the presumptive workflow. Reduces manual data entry and errors in the service-history step.

**Why It Matters**

Veterans can quickly populate their service history without manually typing dates and locations, reducing friction in the presumptive workflow and improving accuracy.

**Recommendation: DD-214 Auto-Parser for Service History**

Service history entry is error-prone manual data entry. A DD-214 parser eliminates this friction point while improving accuracy, especially for veterans with complex service histories or multiple deployments.

In the presumptive workflow service-history entry step, add an 'Upload DD-214' button. Accept PDF or image format. Use OCR and field extraction (or if available, GPT-based form parsing) to extract: (1) Name, SSN (masked) for verification, (2) Service branch, (3) Service dates (enter, active-duty end), (4) Military occupations/specialties, (5) Locations/stations. Display extracted data in a review form: 'Verify your service history' with fields pre-populated and editable. Allow correction before saving to workflow. Handle common variations: different DD-214 versions, handwritten sections, poor-quality scans. Fall back to manual entry if parsing fails. Include: 'DD-214 data is extracted by OCR; verify dates and locations for accuracy before proceeding.'

### 10. Condition Combination Insights

**Category:** ANALYTICS & INSIGHTS | **Impact:** Medium Impact

Analyze how multiple secondary conditions interact when filing together. Some conditions strengthen each other's claims (e.g., PTSD and sleep disorder often co-occur and support each other), while others might complicate ratings (e.g., filing multiple conditions affecting the same body system). Provide strategic insights on claim sequencing.

**Why It Matters**

Veterans understand whether filing multiple secondary conditions together strengthens or weakens their overall claim strategy, enabling smarter prioritization.

**Recommendation: Condition Combination Insights**

Veterans often receive multiple secondary condition suggestions but don't know whether to file all together or prioritize. An analysis of condition combinations helps them choose the strongest filing strategy.

After suggestions are displayed, show a 'Combination Insights' section analyzing the top 3-5 recommended conditions: (1) For each pair of conditions, display: 'Synergistic': Both conditions strengthen evidence for each other (e.g., PTSD + sleep disorder), 'Independent': Each stands alone, 'Conflicting': Filing both might complicate ratings due to diagnostic overlap. (2) Show evidence: 'PTSD and sleep disorder often co-occur; 85% of PTSD cases include sleep disturbance, making both claims mutually supportive.' (3) Strategic recommendation: 'Consider filing [condition A] and [condition B] together; they reinforce each other.' or 'File [condition A] first; [condition B] can follow as secondary to it.' (4) Show risk indicators: 'Multiple musculoskeletal conditions in same body region may trigger more scrutiny; consider filing strongest claim first.' Disclaimer: 'Combination analysis is informational; VA makes final determinations.'

---

_Generated with [Agiloop](https://agiloop.ai) — AI-native software development._