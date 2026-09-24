/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = path.join(process.cwd(), "data", "knowledge-base");
const format = process.argv.includes("--markdown") ? "markdown" : "json";
// --include-drafts extends the queue beyond the published surface so the
// draft-quarantined D1 authoring batches get a generated (never transcribed)
// reviewer row set. The published-only default is unchanged: it is the
// contract exercised by tests/clinical-program-completion-controls.test.ts.
const includeDrafts = process.argv.includes("--include-drafts");
const files = fs.readdirSync(kbDir).filter((file) => file.endsWith(".json")).sort();

const items = [];
for (const file of files) {
  const mapping = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  const isDraft = mapping.draft === true;
  if (isDraft && !includeDrafts) continue;
  for (const suggestion of mapping.suggestions || []) {
    for (const reference of suggestion.sourceReferences || []) {
      if (reference.verified === true) continue;
      items.push({
        mappingId: mapping.id,
        conditionId: suggestion.conditionId,
        publicationState: isDraft ? "draft-quarantined" : "published",
        citation: reference.citation || "",
        verificationScope: reference.verificationScope || "",
        sourceUrl: reference.sourceUrl || "",
        sourceCheckedOn: reference.sourceCheckedOn || "",
        sourceLocator: reference.sourceLocator || "",
        reviewerDecision: "PENDING",
        reviewer: "",
        reviewedOn: "",
        reviewerNotes: "",
      });
    }
  }
}

items.sort((a, b) =>
  a.mappingId.localeCompare(b.mappingId) ||
  a.conditionId.localeCompare(b.conditionId) ||
  a.verificationScope.localeCompare(b.verificationScope) ||
  a.citation.localeCompare(b.citation)
);

const summary = {
  generatedFrom: includeDrafts
    ? "data/knowledge-base published and draft-quarantined mappings"
    : "data/knowledge-base published mappings",
  qualificationRule: "Only a qualified human reviewer may change repository source records to verified:true.",
  pendingCount: items.length,
  clinicalEvidencePending: items.filter((item) => item.verificationScope === "clinical-evidence").length,
  legalFrameworkPending: items.filter((item) => item.verificationScope === "legal-framework").length,
  proceduralGuidancePending: items.filter((item) => item.verificationScope === "procedural-guidance").length,
};
if (includeDrafts) {
  summary.draftQuarantinedPending = items.filter((item) => item.publicationState === "draft-quarantined").length;
  summary.publishedPending = items.filter((item) => item.publicationState === "published").length;
}

if (format === "markdown") {
  console.log("# Qualified-Human Citation Verification Queue\n");
  console.log(`Pending live published references: **${summary.pendingCount}**`);
  console.log(`Clinical evidence: **${summary.clinicalEvidencePending}**; legal framework: **${summary.legalFrameworkPending}**; procedural guidance: **${summary.proceduralGuidancePending}**.\n`);
  if (includeDrafts) {
    console.log(`Included via --include-drafts: draft-quarantined rows **${summary.draftQuarantinedPending}**; published rows **${summary.publishedPending}**.\n`);
  }
  console.log("A source-check record is not a human verification decision. For each row, the reviewer must open the canonical source, confirm citation metadata and proposition scope, record the result under the Citation Verification SOP, and only then change the source record to `verified: true` when warranted.\n");
  console.log("| Primary mapping | Secondary | Role | Citation | URL | Checked | Locator | Decision |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const item of items) {
    const esc = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
    const decision = item.publicationState === "draft-quarantined" ? "PENDING (draft-quarantined)" : "PENDING";
    console.log(`| ${esc(item.mappingId)} | ${esc(item.conditionId)} | ${esc(item.verificationScope)} | ${esc(item.citation)} | ${esc(item.sourceUrl)} | ${esc(item.sourceCheckedOn)} | ${esc(item.sourceLocator)} | ${decision} |`);
  }
} else {
  console.log(JSON.stringify({ summary, items }, null, 2));
}
