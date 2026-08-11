const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data/knowledge-base");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();

const hardFindings = [];
const reviewFindings = [];
let references = 0;
let verified = 0;
let clinical = 0;
let clinicalWithUrls = 0;

function addHard(message) {
  hardFindings.push(message);
}

function addReview(message) {
  reviewFindings.push(message);
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

    // A medical causation/aggravation proposition must have a clinical source;
    // a VA regulation can establish the legal pathway but cannot establish the
    // underlying medical relationship.
    if (causalLanguage.test(rationale) && !hasClinicalEvidence) {
      addHard(`${file}: suggestions[${suggestionIndex}]: causal/aggravation language has no clinical-evidence reference`);
    }

    // Medication causation claims require clinical/pharmacologic evidence rather
    // than a legal secondary-service-connection citation alone.
    if (medicationLanguage.test(rationale) && !hasClinicalEvidence) {
      addHard(`${file}: suggestions[${suggestionIndex}]: medication/treatment claim has no clinical-evidence reference`);
    }

    if (hasOnlyLegalReferences && (causalLanguage.test(rationale) || medicationLanguage.test(rationale))) {
      addHard(`${file}: suggestions[${suggestionIndex}]: medical proposition is supported only by legal/administrative authority`);
    }

    for (const [referenceIndex, reference] of refs.entries()) {
      references += 1;
      if (reference.verified === true) verified += 1;
      if (reference.verificationScope === "clinical-evidence") {
        clinical += 1;
        if (reference.sourceUrl) clinicalWithUrls += 1;
        if (!reference.sourceUrl) {
          addHard(`${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]: clinical-evidence reference is missing sourceUrl`);
        }
      }

      const prefix = `${file}: suggestions[${suggestionIndex}].sourceReferences[${referenceIndex}]`;
      if (reference.verified === true) {
        for (const field of ["sourceUrl", "sourceCheckedOn", "sourceLocator", "verificationScope"]) {
          if (!reference[field]) addHard(`${prefix}: verified reference is missing ${field}`);
        }
      }

      if (reference.citation === "38 CFR 3.310" && /cause|caused|aggravat|medication/i.test(reference.note || "")) {
        addHard(`${prefix}: 38 CFR 3.310 is legal authority and must not be used as clinical evidence for the medical proposition in its note`);
      }

      if (mapping.draft === false && reference.verified !== true) {
        addReview(`${prefix}: published mapping still contains an unverified source`);
      }
    }
  }
}

const report = {
  knowledgeBaseFiles: files.length,
  references,
  verified,
  unverified: references - verified,
  clinicalEvidenceReferences: clinical,
  clinicalEvidenceReferencesWithUrls: clinicalWithUrls,
  hardFindingCount: hardFindings.length,
  reviewFindingCount: reviewFindings.length,
  hardFindings,
  reviewFindings,
};

console.log(JSON.stringify(report, null, 2));

// P3-C policy: incomplete verification remains a review item until the claim
// is actually checked. Unsafe provenance, legal/clinical category errors, and
// unsupported medical causation/aggravation or medication propositions are hard
// CI failures; they must be corrected before the P3-C branch can merge.
process.exitCode = hardFindings.length > 0 ? 1 : 0;
