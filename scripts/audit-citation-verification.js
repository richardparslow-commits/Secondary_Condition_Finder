/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();

// Medium-audit verification-debt ratchet. Existing review debt is not falsely
// promoted to verified, but it may never grow silently. Lower these ceilings as
// source-by-source verification work is completed or unsafe legacy references
// are retired, and raise the clinical-evidence floor as legal-only support is
// replaced with condition-specific clinical sources.
const CITATION_DEBT_BASELINE = Object.freeze({
  references: 140,
  verified: 14,
  unverified: 126,
  reviewFindings: 124,
  clinicalEvidenceWithUrls: 35,
});

const hardFindings = [];
const reviewFindings = [];
const unverifiedByCitation = new Map();
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;

function addHard(message) { hardFindings.push(message); }
function addReview(message) { reviewFindings.push(message); }

const causalLanguage = /\b(caus(?:e|es|ed|ing)|causal|cause-and-effect|aggravat(?:e|es|ed|ing)|worsen(?:s|ed|ing)?|leads? to|result(?:s|ed|ing) in|due to|secondary (?:to|from)|proximately due)\b/i;
const medicationLanguage = /\b(medication|medications|drug|drugs|NSAID|SSRI|antidepressant|treatment side effect|side effect|pharmacologic)\b/i;
const legalCitation = /^(38 CFR|38 C\.F\.R\.|M21-1|VAOPGCPREC|Allen v\.|Walsh v\.)/i;

for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  for (const [suggestionIndex, suggestion] of (mapping.suggestions || []).entries()) {
    const refs = suggestion.sourceReferences || [];
    const hasClinicalEvidence = refs.some((reference) => reference.verificationScope === "clinical-evidence");
    const hasOnlyLegalReferences = refs.length > 0 && refs.every((reference) => legalCitation.test(reference.citation || ""));
    const rationale = suggestion.rationale || "";

    if (causalLanguage.test(rationale) && !hasClinicalEvidence) addHard(`${file}: suggestions[${suggestionIndex}]: causal/aggravation language has no clinical-evidence reference`);
    if (medicationLanguage.test(rationale) && !hasClinicalEvidence) addHard(`${file}: suggestions[${suggestionIndex}]: medication/treatment claim has no clinical-evidence reference`);
    if (hasOnlyLegalReferences && (causalLanguage.test(rationale) || medicationLanguage.test(rationale))) addHard(`${file}: suggestions[${suggestionIndex}]: medical proposition is supported only by legal/administrative authority`);

    for (const [referenceIndex, reference] of refs.entries()) {
      references += 1;
      if (reference.verified === true) verified += 1;
      else {
        const citation = String(reference.citation || "(missing citation)");
        unverifiedByCitation.set(citation, (unverifiedByCitation.get(citation) || 0) + 1);
      }
      if (reference.verificationScope === "clinical-evidence") {
        clinical += 1;
        if (reference.sourceUrl) clinicalWithUrls += 1;
        if (!reference.sourceUrl) addHard(`${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]: clinical-evidence reference is missing sourceUrl`);
      }
      const prefix = `${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]`;
      if (reference.verified === true) {
        for (const field of ["sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope"]) if (!reference[field]) addHard(`${prefix}: verified reference is missing ${field}`);
      }
      if (reference.citation === "38 CFR 3.310" && /cause|caused|aggravat|medication/i.test(reference.note || "")) addHard(`${prefix}: 38 CFR 3.310 is legal authority and must not be used as clinical evidence for the medical proposition in its note`);
      if (mapping.draft === false && reference.verified !== true) addReview(`${prefix}: published mapping still contains an unverified source`);
    }
  }
}

const unverified = references - verified;
if (references < CITATION_DEBT_BASELINE.references && verified < CITATION_DEBT_BASELINE.verified) addHard(`citation debt ratchet: verified references fell below baseline (${verified} < ${CITATION_DEBT_BASELINE.verified}) while references were removed`);
if (verified < CITATION_DEBT_BASELINE.verified) addHard(`citation debt ratchet: verified reference count regressed (${verified} < ${CITATION_DEBT_BASELINE.verified})`);
if (unverified > CITATION_DEBT_BASELINE.unverified) addHard(`citation debt ratchet: unverified reference count increased (${unverified} > ${CITATION_DEBT_BASELINE.unverified})`);
if (reviewFindings.length > CITATION_DEBT_BASELINE.reviewFindings) addHard(`citation debt ratchet: published unverified review findings increased (${reviewFindings.length} > ${CITATION_DEBT_BASELINE.reviewFindings})`);
if (clinicalWithUrls < CITATION_DEBT_BASELINE.clinicalEvidenceWithUrls) addHard(`citation debt ratchet: clinical references with canonical URLs regressed (${clinicalWithUrls} < ${CITATION_DEBT_BASELINE.clinicalEvidenceWithUrls})`);

const unverifiedCitationCounts = [...unverifiedByCitation.entries()].map(([citation, count]) => ({ citation, count })).sort((a, b) => b.count - a.count || a.citation.localeCompare(b.citation));
const report = { knowledgeBaseFiles: files.length, references, verified, unverified, citationDebtBaseline: CITATION_DEBT_BASELINE, clinicalEvidenceReferences: clinical, clinicalEvidenceReferencesWithUrls: clinicalWithUrls, hardFindingCount: hardFindings.length, reviewFindingCount: reviewFindings.length, hardFindings, reviewFindings, unverifiedCitationCounts };
console.log(JSON.stringify(report, null, 2));
process.exitCode = hardFindings.length > 0 ? 1 : 0;
