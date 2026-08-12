const fs = require("node:fs");
const path = require("node:path");

const source = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destinationDir = path.join(process.cwd(), "public");
const destination = path.join(destinationDir, "pdf.worker.min.mjs");

if (!fs.existsSync(source)) {
  throw new Error(`PDF.js worker not found at ${source}`);
}

fs.mkdirSync(destinationDir, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Copied PDF.js worker to ${destination}`);
