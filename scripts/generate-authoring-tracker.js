/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const kbDir = "data/knowledge-base";
const catalogDir = "data/conditions";
const files = fs.readdirSync(kbDir).filter(f => f.endsWith(".json"));

let csvContent = "Condition ID,Body System,Status,Assigned To\n";
let draftCount = 0;

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(kbDir, file), "utf8"));
  if (data.draft === true) {
    draftCount++;
    // Look up body system
    let system = "Unknown";
    const catFiles = fs.readdirSync(catalogDir).filter(f => f.endsWith(".json"));
    for (const catFile of catFiles) {
      const catData = JSON.parse(fs.readFileSync(path.join(catalogDir, catFile), "utf8"));
      if (catData.conditions && catData.conditions.some(c => c.id === data.id)) {
        system = catData.systemName || catFile.replace(".json", "");
        break;
      }
    }
    csvContent += `${data.id},${system},DRAFT,\n`;
  }
});

fs.writeFileSync("draft-backlog-tracker.csv", csvContent);
console.log(`✅ Generated draft-backlog-tracker.csv with ${draftCount} pending conditions!`);
