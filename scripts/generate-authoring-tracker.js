/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = "data/knowledge-base";
const catalogDir = "data/conditions";
const files = fs.readdirSync(kbDir).filter(f => f.endsWith(".json")).sort();
const catalogFiles = fs.readdirSync(catalogDir).filter(f => f.endsWith(".json"));
const catalogSystems = new Map();

for (const catFile of catalogFiles) {
  const catData = JSON.parse(fs.readFileSync(path.join(catalogDir, catFile), "utf8"));
  for (const condition of catData.conditions ?? []) {
    catalogSystems.set(condition.id, catData.systemName || catFile.replace(".json", ""));
  }
}

const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
const header = [
  "Condition ID",
  "Body System",
  "Status",
  "Assigned To",
  "Due Date",
  "Publish Gate",
  "Verification Status",
  "Last Verified",
  "Notes",
];
const rows = [header.map(escapeCsv).join(",")];
let draftCount = 0;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  const status = data.draft === true ? "DRAFT" : "PUBLISHED";
  if (data.draft === true) draftCount++;

  const verificationStatuses = [];
  for (const suggestion of data.suggestions ?? []) {
    for (const source of suggestion.sources ?? []) {
      verificationStatuses.push(source.verified === true ? "verified" : "unverified");
    }
  }
  const verificationStatus = verificationStatuses.length === 0
    ? "not-applicable"
    : verificationStatuses.every(value => value === "verified")
      ? "verified"
      : "unverified";

  rows.push([
    data.id,
    catalogSystems.get(data.id) || "Unknown",
    status,
    "unassigned",
    "TBD",
    "SME review + citation verification + phase gate",
    verificationStatus,
    "",
    data.draft === true ? (data.todo ?? []).join("; ") : "",
  ].map(escapeCsv).join(","));
}

fs.writeFileSync("draft-backlog-tracker.csv", `${rows.join("\n")}\n`);
console.log(`Generated draft-backlog-tracker.csv for ${files.length} mappings (${draftCount} drafts).`);
