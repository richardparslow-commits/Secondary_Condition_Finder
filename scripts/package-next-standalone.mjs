import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const staticSource = path.join(root, ".next", "static");
const staticDestination = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(root, "public");
const publicDestination = path.join(standaloneDir, "public");

async function requireDirectory(directory, label) {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error(`${label} is not a directory`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected ${label} at ${directory}: ${detail}`);
  }
}

await requireDirectory(standaloneDir, "Next.js standalone output");
await requireDirectory(staticSource, "Next.js static assets");
await requireDirectory(publicSource, "public assets");

await mkdir(path.dirname(staticDestination), { recursive: true });
await cp(staticSource, staticDestination, { recursive: true, force: true });
await cp(publicSource, publicDestination, { recursive: true, force: true });

console.log("Prepared .next/standalone with Next.js static and public assets for Azure Static Web Apps.");
