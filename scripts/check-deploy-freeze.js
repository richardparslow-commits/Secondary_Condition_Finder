/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const providerArg = process.argv.slice(2).find(arg => arg.startsWith("--provider="));
const provider = providerArg ? providerArg.split("=")[1].trim().toLowerCase() : "";
if (!provider) {
  console.error("Usage: node scripts/check-deploy-freeze.js --provider=<provider>");
  process.exit(64);
}

const configPath = path.join(process.cwd(), ".deploy-freeze.json");
if (!fs.existsSync(configPath)) process.exit(0);

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (String(config.provider || "").toLowerCase() !== provider || config.mode !== "block") process.exit(0);

const deadline = new Date(config.freezeUntil);
if (Number.isNaN(deadline.getTime())) {
  console.error(`Invalid deployment-freeze deadline in ${configPath}: ${config.freezeUntil}`);
  process.exit(65);
}

const now = new Date();
if (now < deadline) {
  console.error(`BLOCKED: ${provider} is frozen until ${config.freezeUntil}. ${config.reason || ""}`.trim());
  process.exit(2);
}

console.log(`${provider} deployment freeze expired at ${config.freezeUntil}.`);
