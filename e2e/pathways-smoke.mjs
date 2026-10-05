import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Production-boot pathway smoke check.
 *
 * Boots the production build with `next start` — like the COI journey, this
 * check asserts production responses, so a fresh `npm run build` must exist
 * (CI runs it immediately after the build step) — and fetches `/pathways`
 * over HTTP. It then asserts, on the raw served body (the server-rendered
 * HTML together with the RSC flight payload Next embeds in it):
 *
 *  1. Chain-break semantics are rendered: the "Association only — chain
 *     broken" composite badge, the "Chain broken — a research lead, not a
 *     nexus." heading, the CHAIN_BREAK_NOTICE disclosure clause, the
 *     population-level guard, and the reviewer-triage anchor guard all
 *     appear in the served response.
 *  2. The RSC flight payload is present (`__next_f`), so the enum scan below
 *     is actually inspecting the serialized tree rather than a payload-less
 *     document. React serializes rendered text, element keys, and
 *     client-component props into this payload — `PathwayExplorer` documents
 *     element keys as the historical leak vector — so an internal enum
 *     interpolated into any of them would appear even though the labelled
 *     badges use human text only.
 *  3. No raw internal nexus enum value (`ASSOCIATION_ONLY_CHAIN_BROKEN`,
 *     `ASSOCIATION_ONLY`, `DIRECT_CAUSATION`, `AGGRAVATION`) appears anywhere
 *     in the served body. `tests/pathway-explorer-surface.test.ts` pins the
 *     same boundary against static markup and component source; this journey
 *     closes the remaining gap by scanning exactly what production serves.
 *
 * Ports: `PATHWAYS_SMOKE_APP_PORT` (default 3301). The journey is fetch-only —
 * no Chrome/ChromeDriver required.
 */

const APP_PORT = Number(process.env.PATHWAYS_SMOKE_APP_PORT ?? 3301);
const APP_BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const ROUTE = "/pathways";
const USE_PROCESS_GROUPS = process.platform !== "win32";
const children = [];

/**
 * Human strings pinned by `tests/pathway-explorer-surface.test.ts`. Duplicated
 * verbatim because this journey inspects served bytes rather than importing
 * module exports; keep the two in sync.
 */
const CHAIN_BREAK_HEADING = "Chain broken — a research lead, not a nexus.";
const CHAIN_BREAK_BADGE = "Association only — chain broken";
const CHAIN_BREAK_NOTICE_CLAUSE = "The legal chain is broken end-to-end";
const POPULATION_GUARD_CLAUSE = "No chain on this page establishes causation";
const CITATION_TRIAGE_CLAUSE = "Citation anchors are listed for reviewer triage.";

/** Marker of the embedded RSC flight payload the leak scan must cover. */
const RSC_PAYLOAD_MARKER = "__next_f";

/** Raw enum values the presentation layer must translate before serialization. */
const FORBIDDEN_NEXUS_ENUMS = [
  "ASSOCIATION_ONLY_CHAIN_BROKEN",
  "ASSOCIATION_ONLY",
  "DIRECT_CAUSATION",
  "AGGRAVATION",
];

function logProcess(label, child) {
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  children.push(child);
  return child;
}

function sendProcessTreeSignal(child, signal) {
  if (!child.pid) return;

  try {
    if (USE_PROCESS_GROUPS) {
      process.kill(-child.pid, signal);
      return;
    }
    if (!child.killed) child.kill(signal);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
}

async function terminateProcessTree(child, signal = "SIGTERM") {
  sendProcessTreeSignal(child, signal);
  await delay(250);
  sendProcessTreeSignal(child, "SIGKILL");
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200 && response.status < 500) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

/** Assert the chain-break semantics and the payload whose bytes are scanned. */
function assertChainBreakSemantics(body) {
  const required = [
    CHAIN_BREAK_HEADING,
    CHAIN_BREAK_BADGE,
    CHAIN_BREAK_NOTICE_CLAUSE,
    POPULATION_GUARD_CLAUSE,
    CITATION_TRIAGE_CLAUSE,
  ];
  const missing = required.filter((text) => !body.includes(text));
  if (missing.length > 0) {
    throw new Error(
      `${ROUTE} did not render the chain-break semantics; missing: ${missing
        .map((text) => JSON.stringify(text))
        .join(", ")}`,
    );
  }

  if (!body.includes(RSC_PAYLOAD_MARKER)) {
    throw new Error(
      `${ROUTE} served no RSC flight payload (marker "${RSC_PAYLOAD_MARKER}" absent), so the enum-leak scan would be vacuous; re-evaluate this check against the current Next.js serialization format.`,
    );
  }
}

/** Assert that no raw internal nexus enum value reached the served bytes. */
function assertNoEnumLeaks(body) {
  const leaked = FORBIDDEN_NEXUS_ENUMS.filter((token) => body.includes(token));
  if (leaked.length === 0) return;

  const details = leaked
    .map((token) => {
      const at = body.indexOf(token);
      const excerpt = body
        .slice(Math.max(0, at - 80), at + token.length + 80)
        .replace(/\s+/g, " ");
      return `${token} (served context: …${excerpt}…)`;
    })
    .join("; ");
  throw new Error(
    `${ROUTE} leaked raw internal nexus enum values into the served body (including the RSC payload): ${details}`,
  );
}

async function runJourney() {
  const response = await fetch(`${APP_BASE_URL}${ROUTE}`, {
    redirect: "follow",
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 200) {
    throw new Error(`${ROUTE} returned HTTP ${response.status} in production mode.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`${ROUTE} did not serve HTML (content-type: ${contentType || "missing"}).`);
  }

  const body = await response.text();
  assertChainBreakSemantics(body);
  assertNoEnumLeaks(body);

  console.log(
    `Pathway smoke passed: production ${ROUTE} rendered the chain-break semantics, embedded the RSC payload, ` +
      `and served no raw nexus enum values (scanned ${body.length} bytes).`,
  );
}

async function cleanup() {
  for (const child of children.reverse()) {
    await terminateProcessTree(child);
  }
  await delay(250);
}

async function main() {
  const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). This smoke check asserts production responses; run `npm run build` first (CI runs it right after the build step).",
    );
  }

  const nextExecutable = path.join(process.cwd(), "node_modules", ".bin", "next");
  const nextServer = logProcess(
    "pathways-next",
    spawn(nextExecutable, ["start", "-H", "127.0.0.1", "-p", String(APP_PORT)], {
      env: {
        ...process.env,
        WORKFLOW_SESSION_SECRET:
          process.env.WORKFLOW_SESSION_SECRET ?? "browser-validation-workflow-secret-only-for-local-ci-2026",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: USE_PROCESS_GROUPS,
    }),
  );
  if (!nextServer.pid) throw new Error("Unable to start the pathway smoke production server.");

  await waitForHttp(APP_BASE_URL, "Pathways smoke Next.js production server");
  await runJourney();
}

try {
  await main();
} finally {
  await cleanup();
}
