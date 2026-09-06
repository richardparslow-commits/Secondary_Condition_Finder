# Landing Page Legal Content Review Checklist

**Scope:** `src/app/page.tsx` (public landing page), with related routes
`/secondary` (`src/app/secondary/page.tsx`) and `/terms` (`src/app/terms/page.tsx`).

**Status:** Draft for qualified review. This document is not legal advice and
does not verify any citation. Every row below is a claim that a qualified
reviewer (accredited representative, VSO, or attorney) must confirm, correct,
or remove before the page can present it as reliable. The app-wide rule still
applies: until a human checks a row and records it here, the claim remains an
**unverified starting point**.

Quotes below are from `src/app/page.tsx` at the time of the audit
(September 2026) and are anchored by section, not line number, so the checklist
survives small edits. Keep this list current when copy changes.

---

## Why this checklist exists

The app marks knowledge-base citations as `verified: false` and shows
"unverified" chips next to them on the results and evidence pages. The landing
page makes similar-strength assertions (regulatory citations, case holdings,
and cause/effect medical statements) but renders them as plain prose with no
inline unverified marker, so a reader cannot tell the two apart. The existing
copy-contract tests (`tests/legal-copy-contracts.test.ts`,
`tests/copy-contracts.test.ts`) only enforce a small forbidden-phrase list and
the presence of general notices; they cannot detect a wrong case holding or an
overstated legal rule. That gap is what this checklist closes — by hand.

---

## 1. Regulatory citations to verify

| # | Where | Claim | Why it needs review | Action |
|---|---|---|---|---|
| 1.1 | Landing, "Secondary Service Connection" intro | "VA grants Secondary Service Connection … as stated in 38 CFR § 3.310(a)" | Direction is right, but § 3.310(a) also covers aggravation-adjacent rules; confirm the paragraph/subdivision actually supports the sentence as written. | Confirm against current CFR text; record citation + checked date. |
| 1.2 | Landing, same paragraph | A secondary condition "is given its own individual disability rating; this rating is then combined with your other ratings by using whole-person math (38 CFR § 4.25)" | § 4.25 is the *combined ratings* table; "whole-person math" is informal paraphrase. Confirm 4.25 is the correct cite and the paraphrase is acceptable. | Confirm; consider rewording to "combined under the VA rating schedule (38 C.F.R. § 4.25)". |
| 1.3 | Landing, "The 3 Required Elements" | "To win a direct secondary claim, you need to prove three main things: … current diagnosis is official medical evidence … Medical Nexus … 'at least as likely as not' (i.e. a probability of 50% or more)" | "To win", "official medical evidence", and "prove" overstate claim requirements in advice-like terms. The 50% gloss on "at least as likely as not" needs confirmation against the VA benefit-of-the-doubt standard (38 CFR 3.102 / Gilbert v. Derwinski). | SME to rephrase as research-preparation guidance and confirm the equipoise explanation. |
| 1.4 | Landing, "Key Legal Precedents" | Spicer v. McDonough set out the "but-for" test; Roper v. Nicholson — secondaries "rated separately before being combined"; Ellington and Manzanares v. Shulkin — secondary claims "do not automatically have the same original effective date" | Case holdings stated with no pin cite, year, or link; risk of glossing nuance (e.g., Roper concerns 38 U.S.C. § 1153 aggravation). | For each case: confirm holding, add citation + public link, or remove. |

## 2. Substantive medical/regulatory claims to verify

| # | Where | Claim | Why it needs review | Action |
|---|---|---|---|---|
| 2.1 | Landing, "Presumptive Secondary Conditions" | Heart disease "believed to be a result of the service-connected amputations of the lower extremities"; TBI-associated conditions ("Parkinson's disease, seizures, depression, or dementia") | Presented under a "presumptive secondary" heading that blurs the two legally distinct tracks the app otherwise separates. Unsourced "believed to be" claims. | SME to source each against VA regulations (e.g., amputation residuals, TBI/neurological provisions) or cut; if kept, mark unverified and rename the section so it cannot be read as the 38 CFR 3.307/3.309 presumptive track. |
| 2.2 | Landing, aggravation column "Adjudicative Mechanics" | "VA raters subtract the original severity and the normal progression of the disease from the current total severity" | Mechanistic description of rating practice needs confirmation against M21-1; as written it reads like a formula the agency actually applies. | Confirm against M21-1 guidance or soften to "VA considers the additional severity beyond natural progression". |
| 2.3 | Landing, aggravation column "Legal and Regulatory Basis" | Allen v. Brown (1995) "formally incorporated into 38 CFR § 3.310(b)" | Confirm the Allen v. Brown holding, year, and the claimed incorporation into 3.310(b). | Confirm and add citation, or remove. |
| 2.4 | Landing, aggravation column "Equipoise Doctrine" | "A claim will be approved if the evidence indicates that it is 'at least as likely as not' … the service-connected condition caused the deterioration" | Benefit-of-the-doubt/equipoise gloss needs confirmation (see 1.3); "will be approved" is too absolute even with the doctrine. | Confirm standard; reword to remove "will be approved". |
| 2.5 | Landing, "Common Causal Pathways" and aggravation "Primary Clinical Pathways" | Diabetes → small-vessel/nerve damage; PTSD → cortisol → IBS/GERD; NSAIDs → ulcers; psych meds → metabolic syndrome; biomechanical stress → adjacent-joint arthritis; obesity intermediary | Presented as settled causal pathways. Some are widely accepted in claims practice; others are illustrative. None carries a citation. | SME to mark each pathway as sourced or illustrative; ensure none reads as a medical determination for a specific veteran. |

## 3. Meta / consistency issues (no SME needed, but fix with the review)

| # | Issue | Where | Action |
|---|---|---|---|
| 3.1 | No inline unverified marker on body assertions, unlike the results/evidence pages which show "unverified" chips | Landing columns | **Resolved (2026-09):** the app-wide unverified notice now renders above the two-column content on `/`. |
| 3.2 | Citation format inconsistent: "38 C.F.R. § 3.310(a)" (body) vs "38 CFR 3.310" (chooser mechanism lines) | Landing + `/secondary` + `/terms` | **Resolved (2026-09):** landing body copy normalized to "38 CFR § …" (same style as `src/lib/legal/references.ts`). Note the legal-copy contract test's regex still only matches "38 CFR …" without "§", so body text remains outside what tests police. |
| 3.3 | British spelling ("recognised") mixed into otherwise US copy | Landing, "Common Causal Pathways" | **Resolved (2026-09):** normalized to "recognized". |
| 3.4 | Duplicated legal content across `/`, `/secondary`, `/terms` with slightly different wording | Three routes | **Resolved (2026-09):** all reference data consolidated into `src/lib/legal/references.ts` (the duplicate `secondaryReferences.ts` module was deleted); `/terms` and `/secondary` render their reference lists from those arrays. Free-standing prose claims on `/` that cannot be derived from the module remain tracked under rows 1.x–2.x for SME sign-off. |
| 3.5 | `/secondary/legal` was an orphan route (not linked from any page or the README) | ~~`src/app/secondary/legal/page.tsx`~~ | **Resolved (2026-09):** route deleted; its content was duplicated on `/` and `/terms`. |

---

## Sign-off

No row above is approved until a qualified reviewer records it here. Use one
row per item, mirroring the source-audit convention used in the presumptive
data (`sourceCheckedOn`, `auditedBy`).

| Item # | Reviewed by | Date | Decision (confirmed / corrected / removed) | Notes |
|---|---|---|---|---|
| | | | | |
