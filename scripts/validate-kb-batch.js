const fs = require("fs");
const path = require("path");

console.log("🔍 Running Phase 3 Knowledge Base Batch Validation...");

const trackerPath = "draft-backlog-tracker.csv";
if (!fs.existsSync(trackerPath)) {
  console.error("❌ Backlog tracker CSV not found.");
  process.exit(1);
}

const content = fs.readFileSync(trackerPath, "utf8");
const lines = content.split("\n").filter(Boolean);
console.log(`📊 Total conditions tracked in backlog: ${lines.length - 1}`);

// Verify authoring guide exists
const guidePath = "docs/SME-AUTHORING-GUIDE.md";
if (fs.existsSync(guidePath)) {
  console.log("✅ SME Authoring Guide is present.");
} else {
  console.warn("⚠️ SME Authoring Guide missing!");
}

console.log("✨ Phase 3 validation infrastructure ready for batch authoring!");
