/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const catalogDir = "data/conditions";
const kbDir = "data/knowledge-base";

const catalogFiles = fs.readdirSync(catalogDir).filter(f => f.endsWith(".json"));
const systemSummary = {};

catalogFiles.forEach(catFile => {
  const catData = JSON.parse(fs.readFileSync(path.join(catalogDir, catFile), "utf8"));
  const systemName = catData.bodySystem || catFile.replace(".json", "");
  const conditionIds = catData.conditions.map(c => c.id);

  let published = 0;
  let drafts = 0;

  conditionIds.forEach(id => {
    const kbPath = path.join(kbDir, `${id}.json`);
    if (fs.existsSync(kbPath)) {
      const kbData = JSON.parse(fs.readFileSync(kbPath, "utf8"));
      if (kbData.draft === false) published++;
      else drafts++;
    } else {
      drafts++;
    }
  });

  systemSummary[systemName] = { total: conditionIds.length, published, drafts };
});

console.log("================ BODY SYSTEM AUTHORING STATUS ================");
Object.entries(systemSummary).forEach(([sys, stats]) => {
  const pct = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
  console.log(`[${sys}] Total: ${stats.total} | Published: ${stats.published} | Drafts: ${stats.drafts} (${pct}% complete)`);
});
console.log("==============================================================\n");
