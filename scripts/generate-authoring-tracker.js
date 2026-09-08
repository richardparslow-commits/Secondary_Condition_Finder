/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = "data/knowledge-base";
const catalogDir = "data/conditions";

// Load every catalog condition, remembering which body-system file it came from.
const catalogByFile = fs
  .readdirSync(catalogDir)
  .filter((f) => f.endsWith(".json"))
  .map((file) => {
    const slug = file.replace(".json", "");
    const data = JSON.parse(fs.readFileSync(path.join(catalogDir, file), "utf8"));
    return { slug, conditions: data.conditions ?? [] };
  });

// id -> body-system slug for every catalog condition.
const conditionSystem = new Map();
for (const { slug, conditions } of catalogByFile) {
  for (const condition of conditions) {
    conditionSystem.set(condition.id, slug);
  }
}

// id -> true when the mapping file is still draft, false when published.
const mappingStatus = new Map();
for (const file of fs.readdirSync(kbDir).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  mappingStatus.set(data.id, data.draft === true);
}

// Backlog: catalog conditions without a published mapping.
//   - No mapping file at all          -> UNMAPPED
//   - Mapping file still draft: true  -> DRAFT
const backlog = [];
for (const [id, system] of conditionSystem) {
  if (!mappingStatus.has(id)) {
    backlog.push({ id, system, status: "UNMAPPED" });
  } else if (mappingStatus.get(id) === true) {
    backlog.push({ id, system, status: "DRAFT" });
  }
}

backlog.sort((a, b) => a.system.localeCompare(b.system) || a.id.localeCompare(b.id));

let csvContent = "Condition ID,Body System,Status,Assigned To\n";
for (const entry of backlog) {
  csvContent += `${entry.id},${entry.system},${entry.status},\n`;
}

fs.writeFileSync("draft-backlog-tracker.csv", csvContent);

const unmapped = backlog.filter((entry) => entry.status === "UNMAPPED").length;
const drafts = backlog.filter((entry) => entry.status === "DRAFT").length;
console.log(
  `✅ Generated draft-backlog-tracker.csv with ${backlog.length} pending conditions (${unmapped} unmapped, ${drafts} draft)!`,
);