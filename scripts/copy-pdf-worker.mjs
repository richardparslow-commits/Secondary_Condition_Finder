import fs from "node:fs";
import path from "node:path";

function copyIfExists(source, destination, label) {
  if (!fs.existsSync(source)) {
    throw new Error(`${label} not found at ${source}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`Copied ${label} to ${destination}`);
}

// PDF.js text-layer worker (existing behavior).
copyIfExists(
  path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  path.join(process.cwd(), "public", "pdf.worker.min.mjs"),
  "PDF.js worker",
);

// Browser-local OCR assets, self-hosted so OCR never makes an external network
// request (production CSP keeps connect-src to 'self').
const ocrDir = path.join(process.cwd(), "public", "tesseract");
copyIfExists(
  path.join(process.cwd(), "node_modules", "tesseract.js", "dist", "worker.min.js"),
  path.join(ocrDir, "worker.min.js"),
  "tesseract.js worker",
);
copyIfExists(
  path.join(process.cwd(), "node_modules", "tesseract.js-core", "tesseract-core-simd.wasm.js"),
  path.join(ocrDir, "tesseract-core-simd.wasm.js"),
  "tesseract wasm loader",
);
copyIfExists(
  path.join(process.cwd(), "node_modules", "tesseract.js-core", "tesseract-core-simd.wasm"),
  path.join(ocrDir, "tesseract-core-simd.wasm"),
  "tesseract wasm core",
);
copyIfExists(
  path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz"),
  path.join(ocrDir, "eng.traineddata.gz"),
  "tesseract English traineddata",
);
