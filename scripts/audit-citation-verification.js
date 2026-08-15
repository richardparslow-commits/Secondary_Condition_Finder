/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const retirementPath = path.join(process.cwd(), "data/citation-retirements.json");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();
const retirementLedger = fs.existsSync(retirementPath)
  ? JSON.parse(fs.readFileSync(retirementPath, "utf8"))
  : { version: 1, retirements: [] };
const retirements = Array.isArray(retirementLedger.retirements) ? retirementLedger.retirements : [];

const CITATION_DEBT_BASELINE = Object.freeze({
  references: 70,
  liveVerified: 8,
  retiredVerified: 6,
  verifiedProvenance: 14,
  unverified: 62,
  reviewFindings: 60,
  liveClinicalEvidenceWithUrls: 63,
  retiredClinicalEvidenceWithUrls: 4,
  clinicalEvidenceProvenanceWithUrls: 67,
});

const hardFindings = [];
const reviewFindings = [];
const unverifiedByCitation = new Map();
const liveReferenceKeys = new Set();
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;

function addHard(message) { hardFindings.push(message); }
function addReview(message) { reviewFindings.push(message); }
function liveKey(mappingId, conditionId, citation, sourceUrl) {
  return [mappingId || "", conditionId || "", citation || "", sourceUrl || ""].join("|");
}

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
      liveReferenceKeys.add(liveKey(mapping.id, suggestion.conditionId, reference.citation, reference.sourceUrl));
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

const retirementIds = new Set();
let retiredVerified = 0;
let retiredClinicalWithUrls = 0;
for (const [index, retirement] of retirements.entries()) {
  const prefix = `citation-retirements.json: retirements[${index}]`;
  if (!retirement.id) addHard(`${prefix}: missing id`);
  else if (retirementIds.has(retirement.id)) addHard(`${prefix}: duplicate id ${retirement.id}`);
  else retirementIds.add(retirement.id);

  for (const field of ["citation", "sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope", "retiredOn", "retirementReason"]) {
    if (!retirement[field]) addHard(`${prefix}: missing ${field}`);
  }
  if (!retirement.retiredFrom?.mappingId) addHard(`${prefix}: missing retiredFrom.mappingId`);
  if (!retirement.retiredFrom?.conditionId) addHard(`${prefix}: missing retiredFrom.conditionId`);
  if (retirement.previouslyVerified !== true) addHard(`${prefix}: retirement ledger is reserved for previously verified references`);
  if (!Array.isArray(retirement.withdrawalEvidence) || retirement.withdrawalEvidence.length === 0) addHard(`${prefix}: missing withdrawalEvidence`);

  const key = liveKey(retirement.retiredFrom?.mappingId, retirement.retiredFrom?.conditionId, retirement.citation, retirement.sourceUrl);
  if (liveReferenceKeys.has(key)) addHard(`${prefix}: retired reference is still live on the same relationship`);

  if (retirement.previouslyVerified === true) retiredVerified += 1;
  if (retirement.verificationScope === "clinical-evidence" && retirement.sourceUrl) retiredClinicalWithUrls += 1;
}

const unverified = references - verified;
const verifiedProvenance = verified + retiredVerified;
const clinicalEvidenceProvenanceWithUrls = clinicalWithUrls + retiredClinicalWithUrls;

if (verified < CITATION_DEBT_BASELINE.liveVerified) addHard(`citation debt ratchet: live verified reference count regressed (${verified} < ${CITATION_DEBT_BASELINE.liveVerified})`);
if (retiredVerified < CITATION_DEBT_BASELINE.retiredVerified) addHard(`citation debt ratchet: retired verified provenance regressed (${retiredVerified} < ${CITATION_DEBT_BASELINE.retiredVerified})`);
if (verifiedProvenance < CITATION_DEBT_BASELINE.verifiedProvenance) addHard(`citation debt ratchet: verified provenance regressed (${verifiedProvenance} < ${CITATION_DEBT_BASELINE.verifiedProvenance})`);
if (unverified > CITATION_DEBT_BASELINE.unverified) addHard(`citation debt ratchet: unverified reference count increased (${unverified} > ${CITATION_DEBT_BASELINE.unverified})`);
if (reviewFindings.length > CITATION_DEBT_BASELINE.reviewFindings) addHard(`citation debt ratchet: published unverified review findings increased (${reviewFindings.length} > ${CITATION_DEBT_BASELINE.reviewFindings})`);
if (clinicalWithUrls < CITATION_DEBT_BASELINE.liveClinicalEvidenceWithUrls) addHard(`citation debt ratchet: live clinical references with canonical URLs regressed (${clinicalWithUrls} < ${CITATION_DEBT_BASELINE.liveClinicalEvidenceWithUrls})`);
if (retiredClinicalWithUrls < CITATION_DEBT_BASELINE.retiredClinicalEvidenceWithUrls) addHard(`citation debt ratchet: retired clinical URL provenance regressed (${retiredClinicalWithUrls} < ${CITATION_DEBT_BASELINE.retiredClinicalEvidenceWithUrls})`);
if (clinicalEvidenceProvenanceWithUrls < CITATION_DEBT_BASELINE.clinicalEvidenceProvenanceWithUrls) addHard(`citation debt ratchet: clinical URL provenance regressed (${clinicalEvidenceProvenanceWithUrls} < ${CITATION_DEBT_BASELINE.clinicalEvidenceProvenanceWithUrls})`);

const unverifiedCitationCounts = [...unverifiedByCitation.entries()].map(([citation, count]) => ({ citation, count })).sort((a, b) => b.count - a.count || a.citation.localeCompare(b.citation));
const report = { knowledgeBaseFiles: files.length, references, verified, retiredVerified, verifiedProvenance, unverified, citationDebtBaseline: CITATION_DEBT_BASELINE, clinicalEvidenceReferences: clinical, clinicalEvidenceReferencesWithUrls: clinicalWithUrls, retiredClinicalEvidenceReferencesWithUrls: retiredClinicalWithUrls, clinicalEvidenceProvenanceWithUrls, hardFindingCount: hardFindings.length, reviewFindingCount: reviewFindings.length, hardFindings, reviewFindings, unverifiedCitationCounts };
console.log(JSON.stringify(report, null, 2));
process.exitCode = hardFindings.length > 0 ? 1 : 0;
