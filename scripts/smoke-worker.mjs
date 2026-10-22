/**
 * Worker smoke check: build with OpenNext, serve the built Worker with
 * `wrangler dev`, and assert the shipped routes and security headers.
 *
 * Why this exists separately from the unit suite: the duplicate-header bug
 * documented in `docs/deployment-readiness.md` ("one owner per response") is
 * invisible to unit tests. `next.config.ts` and `src/proxy.ts` each look
 * correct in isolation; on OpenNext, two sources of the same header are
 * *concatenated*, so a real response carried
 * `Strict-Transport-Security: max-age=…, max-age=…` and
 * `X-Frame-Options: DENY, DENY`. Node's fetch helper merges those into one
 * string, which is exactly how the defect survived the route tests. This
 * script reads `res.rawHeaders`, so a header sent twice is counted twice, and
 * it checks the *built Worker* — the artifact that deploys — rather than the
 * source modules.
 *
 * What it asserts:
 *   - the OpenNext build produces `.open-next/worker.js` and its assets;
 *   - every document/API route answers with the expected status and content
 *     type under workerd;
 *   - each baseline security header appears exactly once on those responses,
 *     and each fixed value is byte-identical to `next.config.ts`'s rule (a
 *     merged duplicate fails the exact-value check as well as the count);
 *   - the CSP is a single policy: one `default-src`, one `script-src`, one
 *     `style-src`, a per-request nonce, no `'unsafe-inline'`, no comma (a comma
 *     is what a concatenated second policy leaves behind);
 *   - `/api/health` still loads the catalog and knowledge-base graph from the
 *     Worker bundle (that is what proves the filesystem-backed data made it
 *     into the deployment artifact);
 *   - a static asset served by the assets binding gets the policy
 *     `public/_headers` declares for it — one COEP, one CORP, one cache rule —
 *     and never two copies of a baseline header.
 *
 * `--sites` builds the same Worker with the Sites OpenNext config
 * (`freebuff.open-next.config.ts`, including its R2 incremental cache and
 * Durable Object queue/tag cache bindings) instead of the minimal smoke config,
 * then additionally proves the OCR model path end to end: the
 * `/tesseract/eng.traineddata.gz` rewrite answers 200 with the model's gzip
 * content type, immutable cache policy and single CORP/nosniff headers; its
 * bytes hash to `OCR_MODEL_SHA256` and match both the direct `/api/ocr-model`
 * response and the postinstall package copy; and no static copy exists in
 * `public/` that could mask the rewrite. That mode requires a checkout prepared
 * for Sites (the generated config is present); it refuses `--skip-build`,
 * because a reused `.open-next` tree was not necessarily built with those
 * bindings.
 *
 * Usage:
 *   npm run smoke:worker                 # full OpenNext build, then probe
 *   npm run smoke:worker -- --skip-build # reuse an existing .open-next build
 *   npm run smoke:worker -- --sites      # Sites OpenNext config + OCR checks
 *   npm run smoke:worker -- --port 8799  # fixed port (default: a free one)
 *
 * Exit codes: 0 — every check passed; 1 — the build failed, the Worker did not
 * become ready, or an assertion failed. The Wrangler log tail is printed on
 * failure so the reason is visible without re-running by hand.
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { once } from "node:events";

const ROOT = process.cwd();
const OPEN_NEXT_DIR = path.join(ROOT, ".open-next");
const WORKER_ENTRY = path.join(OPEN_NEXT_DIR, "worker.js");
const ASSETS_DIR = path.join(OPEN_NEXT_DIR, "assets");
const WRANGLER_CONFIG = path.join(OPEN_NEXT_DIR, "smoke.wrangler.jsonc");
/**
 * A smoke-only OpenNext config. The repository ships no `open-next.config.ts`
 * because the Sites publication supplies its own generated config; the smoke
 * run must not depend on that gitignored file, so it writes a minimal default
 * config (no R2 or Durable Object bindings) into the ignored `tmp/` directory.
 */
const OPEN_NEXT_CONFIG = path.join(ROOT, "tmp", "smoke.open-next.config.ts");
/** The Sites-generated config; present only in a checkout prepared for publishing. */
const SITES_OPEN_NEXT_CONFIG = path.join(ROOT, "freebuff.open-next.config.ts");

/** Browser-local OCR model served through the Sites rewrite. */
const OCR_MODEL_PATH = "/tesseract/eng.traineddata.gz";
const OCR_MODEL_ROUTE = "/api/ocr-model";
const OCR_MODEL_BUNDLE = path.join(ROOT, ".data-bundle", "ocr", "eng.traineddata.gz");
const OCR_MODEL_PUBLIC_COPY = path.join(ROOT, "public", "tesseract", "eng.traineddata.gz");
const OCR_MODEL_HEADERS = {
  "content-type": "application/gzip",
  "cache-control": "public, max-age=31536000, immutable",
  "x-content-type-options": "nosniff",
  "cross-origin-resource-policy": "same-origin",
};

/**
 * The same date the deployment build uses. A compatibility date newer than the
 * pinned Wrangler's bundled workerd is rejected, so this is deliberately a
 * fixed date rather than "today".
 */
const COMPATIBILITY_DATE = "2026-10-01";

const READY_TIMEOUT_MS = 180_000;
const REQUEST_TIMEOUT_MS = 90_000;
const LOG_TAIL_CHARS = 12_000;

/** Baseline headers from `next.config.ts` `securityHeaders`. */
const BASELINE_HEADERS = [
  ["strict-transport-security", "max-age=31536000; includeSubDomains"],
  ["x-frame-options", "DENY"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "no-referrer"],
  [
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  ],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-embedder-policy", "require-corp"],
];

/** Routes every deployment must answer. `kind` selects the header contract. */
const ROUTES = [
  { path: "/", status: 200, kind: "document" },
  { path: "/secondary", status: 200, kind: "document" },
  { path: "/privacy", status: 200, kind: "document" },
  { path: "/terms", status: 200, kind: "document" },
  { path: "/runtime-readiness", status: 200, kind: "document" },
  // Health returns 503 when a production-only secret is absent; the smoke run
  // does not configure secrets, so both statuses are valid. What matters is
  // that the route ran and every component it reads from the bundle resolved.
  { path: "/api/health", status: [200, 503], kind: "api" },
  { path: "/pdf.worker.min.mjs", status: 200, kind: "asset" },
];

function parseArguments(argv) {
  const options = { skipBuild: false, sites: false, port: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-build") {
      options.skipBuild = true;
    } else if (argument === "--sites") {
      options.sites = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--port") {
      const value = argv[index + 1];
      index += 1;
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error(`--port expects 1-65535, received ${JSON.stringify(value)}`);
      }
      options.port = port;
    } else {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}`);
    }
  }
  return options;
}

function binary(name) {
  return path.join(
    ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCommand(command, args, label) {
  process.stdout.write(`\n▶ ${label}\n`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        WRANGLER_SEND_METRICS: "false",
      },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Values for one header name, preserving duplicates in `rawHeaders`. */
function headerValues(rawHeaders, name) {
  const wanted = name.toLowerCase();
  const values = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === wanted) values.push(rawHeaders[index + 1]);
  }
  return values;
}

/**
 * One request over `node:http` rather than `fetch`.
 *
 * `fetch` folds repeated headers into one comma-joined value, which is how a
 * duplicated `X-Frame-Options: DENY, DENY` can look like a single header to a
 * test. `rawHeaders` keeps every instance exactly as the Worker sent it.
 */
function request(pathname, port) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
        headers: { accept: "*/*" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            rawHeaders: res.rawHeaders,
            headers: (name) => headerValues(res.rawHeaders, name),
            body: body.toString("utf8"),
            bodyBuffer: body,
          });
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(
        new Error(`GET ${pathname} timed out after ${REQUEST_TIMEOUT_MS} ms`),
      );
    });
    req.once("error", reject);
    req.end();
  });
}

function oneOfEachFailures(response, pathname) {
  const failures = [];
  for (const [name, expected] of BASELINE_HEADERS) {
    const values = response.headers(name);
    if (values.length !== 1) {
      failures.push(
        `${pathname}: expected exactly one ${name}, found ${values.length}` +
          (values.length > 1 ? ` (${JSON.stringify(values)})` : ""),
      );
      continue;
    }
    if (values[0] !== expected) {
      failures.push(
        `${pathname}: ${name} is ${JSON.stringify(values[0])}, expected ${JSON.stringify(expected)}`,
      );
    }
  }
  return failures;
}

function cspFailures(response, pathname) {
  const failures = [];
  const policies = response.headers("content-security-policy");
  if (policies.length !== 1) {
    failures.push(
      `${pathname}: expected exactly one content-security-policy, found ${policies.length}`,
    );
    return failures;
  }

  const policy = policies[0];
  // A concatenated policy is comma-joined by the runtime; one policy never
  // contains a comma.
  if (policy.includes(",")) {
    failures.push(`${pathname}: CSP contains a comma, so two policies were concatenated`);
  }

  const directives = policy.split(";").map((directive) => directive.trim());
  for (const name of ["default-src", "script-src", "style-src"]) {
    const count = directives.filter(
      (directive) => directive === name || directive.startsWith(`${name} `),
    ).length;
    if (count !== 1) {
      failures.push(`${pathname}: CSP has ${count} ${name} directives, expected 1`);
    }
  }

  if (!/script-src 'self' 'nonce-[A-Za-z0-9+/=_-]+' 'strict-dynamic'/.test(policy)) {
    failures.push(`${pathname}: CSP script-src is not the nonce + strict-dynamic contract`);
  }
  if (!/style-src 'self' 'nonce-[A-Za-z0-9+/=_-]+'/.test(policy)) {
    failures.push(`${pathname}: CSP style-src is not the nonce contract`);
  }
  if (policy.includes("'unsafe-inline'")) {
    failures.push(`${pathname}: CSP carries 'unsafe-inline'`);
  }
  if (!policy.includes("frame-ancestors 'none'")) {
    failures.push(`${pathname}: CSP is missing frame-ancestors 'none'`);
  }
  return failures;
}

function documentFailures(response, pathname) {
  return [...oneOfEachFailures(response, pathname), ...cspFailures(response, pathname)];
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Read the pin from source rather than restating it, so it cannot drift. */
function readPinnedOcrDigest() {
  const source = fs.readFileSync(
    path.join(ROOT, "src", "lib", "evidence", "ocr-model.ts"),
    "utf8",
  );
  const match = source.match(/OCR_MODEL_SHA256\s*=\s*"([0-9a-f]{64})"/);
  if (!match) {
    throw new Error("could not read OCR_MODEL_SHA256 from src/lib/evidence/ocr-model.ts");
  }
  return match[1];
}

function ocrHeaderFailures(response, label) {
  const failures = [];
  for (const [name, expected] of Object.entries(OCR_MODEL_HEADERS)) {
    const values = response.headers(name);
    if (values.length !== 1) {
      failures.push(
        `${label}: expected exactly one ${name}, found ${values.length}` +
          (values.length > 0 ? ` (${JSON.stringify(values)})` : ""),
      );
    } else if (values[0].toLowerCase() !== expected) {
      failures.push(
        `${label}: ${name} is ${JSON.stringify(values[0])}, expected ${JSON.stringify(expected)}`,
      );
    }
  }
  if (response.headers("content-encoding").length > 0) {
    failures.push(
      `${label}: response is content-encoded; tesseract.js expects the gzip file bytes`,
    );
  }
  return failures;
}

/**
 * Prove the Sites OCR path: the rewrite, the response contract, and the digest
 * of the bytes actually served. A 200 alone would not distinguish the route
 * from a static file, so the direct route and the pinned package copy are
 * compared as well.
 */
async function checkOcrModel(port) {
  const failures = [];
  const rewritten = await request(OCR_MODEL_PATH, port);
  const direct = await request(OCR_MODEL_ROUTE, port);

  for (const [label, response] of [
    [OCR_MODEL_PATH, rewritten],
    [OCR_MODEL_ROUTE, direct],
  ]) {
    if (response.status !== 200) {
      failures.push(`${label}: status ${response.status}, expected 200`);
      continue;
    }
    failures.push(...ocrHeaderFailures(response, label));
  }

  if (rewritten.status === 200 && direct.status === 200) {
    const expected = readPinnedOcrDigest();
    const servedDigest = sha256Hex(rewritten.bodyBuffer);
    if (rewritten.bodyBuffer.length !== direct.bodyBuffer.length) {
      failures.push(
        `${OCR_MODEL_PATH} and ${OCR_MODEL_ROUTE} serve different byte counts ` +
          `(${rewritten.bodyBuffer.length} vs ${direct.bodyBuffer.length})`,
      );
    }
    if (sha256Hex(direct.bodyBuffer) !== servedDigest) {
      failures.push(`${OCR_MODEL_ROUTE} serves different bytes than the rewrite destination`);
    }
    if (servedDigest !== expected) {
      failures.push(
        `${OCR_MODEL_PATH}: served SHA-256 ${servedDigest}, expected ${expected}`,
      );
    }
  }

  if (!fs.existsSync(OCR_MODEL_BUNDLE)) {
    failures.push(
      `${path.relative(ROOT, OCR_MODEL_BUNDLE)} is missing; postinstall did not copy the pinned model`,
    );
  } else {
    const expected = readPinnedOcrDigest();
    const bundledDigest = sha256Hex(fs.readFileSync(OCR_MODEL_BUNDLE));
    if (bundledDigest !== expected) {
      failures.push(
        `${path.relative(ROOT, OCR_MODEL_BUNDLE)}: SHA-256 ${bundledDigest}, expected ${expected}`,
      );
    }
  }

  if (fs.existsSync(OCR_MODEL_PUBLIC_COPY)) {
    failures.push(
      `${path.relative(ROOT, OCR_MODEL_PUBLIC_COPY)} exists, so a static copy could answer ` +
        "the OCR path instead of the rewrite",
    );
  }

  const nextConfig = fs.readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
  const declaresRewrite =
    /source:\s*"\/tesseract\/eng\.traineddata\.gz"[\s\S]{0,120}?destination:\s*"\/api\/ocr-model"/.test(
      nextConfig,
    );
  if (!declaresRewrite) {
    failures.push(
      "next.config.ts no longer declares /tesseract/eng.traineddata.gz -> /api/ocr-model",
    );
  }

  return failures;
}

async function checkRoute(route, port) {
  const response = await request(route.path, port);
  const failures = [];
  const expectedStatuses = Array.isArray(route.status) ? route.status : [route.status];
  if (!expectedStatuses.includes(response.status)) {
    failures.push(
      `${route.path}: status ${response.status}, expected ${expectedStatuses.join(" or ")}`,
    );
  }

  if (route.kind === "asset") {
    const contentType = response.headers("content-type")[0] ?? "";
    if (!contentType.includes("javascript")) {
      failures.push(`${route.path}: content-type ${JSON.stringify(contentType)} is not JavaScript`);
    }
    const cache = response.headers("cache-control");
    if (cache.length !== 1 || cache[0] !== "public,max-age=3600,must-revalidate") {
      failures.push(
        `${route.path}: expected one cache-control "public,max-age=3600,must-revalidate", found ${JSON.stringify(cache)}`,
      );
    }
    for (const [name] of [
      ["cross-origin-embedder-policy", "require-corp"],
      ["cross-origin-resource-policy", "same-origin"],
    ]) {
      const values = response.headers(name);
      if (values.length !== 1) {
        failures.push(
          `${route.path}: expected exactly one ${name}, found ${values.length} (${JSON.stringify(values)})`,
        );
      }
    }
    // The assets binding answers before Next.js, so `next.config.ts`'s rule
    // never runs. A baseline header may be absent here, but it must never be
    // duplicated.
    for (const [name] of BASELINE_HEADERS) {
      if (response.headers(name).length > 1) {
        failures.push(`${route.path}: ${name} is duplicated on an asset response`);
      }
    }
    return { failures, status: response.status, label: "asset" };
  }

  const contentType = response.headers("content-type")[0] ?? "";
  if (route.kind === "document" && !contentType.includes("text/html")) {
    failures.push(`${route.path}: content-type ${JSON.stringify(contentType)} is not text/html`);
  }
  if (route.kind === "api" && !contentType.includes("application/json")) {
    failures.push(
      `${route.path}: content-type ${JSON.stringify(contentType)} is not application/json`,
    );
  }

  failures.push(...documentFailures(response, route.path));

  if (route.path === "/") {
    if (!response.body.includes("<!DOCTYPE html")) {
      failures.push("/: response body is not an HTML document");
    }
  }

  if (route.path === "/api/health") {
    let health;
    try {
      health = JSON.parse(response.body);
    } catch {
      failures.push("/api/health: body is not JSON");
    }
    if (health) {
      const catalog = health?.components?.catalog;
      const kbGraph = health?.components?.kbGraph;
      if (catalog?.status !== "ok") {
        failures.push(
          `/api/health: catalog did not load from the Worker bundle (${JSON.stringify(catalog)})`,
        );
      }
      if (kbGraph?.status !== "ok") {
        failures.push(
          `/api/health: knowledge-base graph did not load from the Worker bundle (${JSON.stringify(kbGraph)})`,
        );
      }
    }
  }

  return { failures, status: response.status, label: contentType.split(";")[0] };
}

/** Write the minimal OpenNext config used only by this check. */
function writeOpenNextConfig() {
  fs.mkdirSync(path.dirname(OPEN_NEXT_CONFIG), { recursive: true });
  fs.writeFileSync(
    OPEN_NEXT_CONFIG,
    [
      'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
      "",
      "// Defaults only: the smoke run has no R2 bucket or queue bindings.",
      "export default defineCloudflareConfig({});",
      "",
    ].join("\n"),
  );
}

/**
 * Write the local preview config; the build itself needs no Wrangler config.
 *
 * The Sites build binds an R2 incremental cache, an R2 bucket for files and two
 * Durable Object classes, so `wrangler dev` needs those bindings declared or
 * the Worker fails on the first request that touches one. They are local
 * placeholders: no remote resource or account is involved.
 */
function writeWranglerConfig({ sites = false } = {}) {
  const config = {
    $schema: "../node_modules/wrangler/config-schema.json",
    name: "secondary-condition-finder-smoke",
    main: "./worker.js",
    compatibility_date: COMPATIBILITY_DATE,
    compatibility_flags: sites
      ? ["nodejs_compat", "global_fetch_strictly_public", "enable_ctx_exports"]
      : ["nodejs_compat"],
    // No `run_worker_first`: the local check lets the assets binding answer
    // static paths directly and sends misses to the Worker. The Sites entry
    // shim does the same `ASSETS` lookup itself before calling Next, so the
    // split is equivalent here without reproducing that generated wrapper.
    assets: {
      directory: "./assets",
      binding: "ASSETS",
    },
  };
  if (sites) {
    Object.assign(config, {
      d1_databases: [
        {
          binding: "DB",
          database_name: "sites-smoke-db",
          database_id: "00000000-0000-0000-0000-000000000001",
        },
      ],
      r2_buckets: [
        { binding: "NEXT_INC_CACHE_R2_BUCKET", bucket_name: "sites-smoke-cache" },
        { binding: "FILES", bucket_name: "sites-smoke-files" },
      ],
      durable_objects: {
        bindings: [
          { name: "NEXT_CACHE_DO_QUEUE", class_name: "DOQueueHandler" },
          { name: "NEXT_TAG_CACHE_DO_SHARDED", class_name: "DOShardedTagCache" },
        ],
      },
      migrations: [
        {
          tag: "freebuff-next-v1",
          new_sqlite_classes: ["DOQueueHandler", "DOShardedTagCache"],
        },
      ],
    });
  }
  fs.writeFileSync(WRANGLER_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
}

function startWrangler(port) {
  const log = { text: "" };
  const child = spawn(
    binary("wrangler"),
    ["dev", "--config", WRANGLER_CONFIG, "--ip", "127.0.0.1", "--port", String(port), "--local"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        BROWSER: "none",
      },
      // A process group lets the cleanup below stop workerd too, not just the
      // Wrangler supervisor that spawned it.
      detached: process.platform !== "win32",
    },
  );

  const record = (chunk) => {
    log.text = `${log.text}${chunk.toString()}`.slice(-LOG_TAIL_CHARS);
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  child.once("error", record);

  return { child, log };
}

async function waitUntilReady(child, port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited early with code ${child.exitCode}`);
    }
    try {
      const response = await request("/", port);
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(1_000);
  }
  throw new Error(
    `wrangler dev did not answer on 127.0.0.1:${port} within ${READY_TIMEOUT_MS} ms` +
      (lastError ? ` (last error: ${lastError.message})` : ""),
  );
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const signalTree = (signal) => {
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch {
      // The process may already be gone; nothing to clean up.
    }
  };
  const exited = once(child, "exit").then(() => true);
  signalTree("SIGTERM");
  const clean = await Promise.race([exited, sleep(5_000).then(() => false)]);
  if (!clean) {
    signalTree("SIGKILL");
    await Promise.race([once(child, "exit"), sleep(2_000)]);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Build the OpenNext Worker and smoke-check it under wrangler dev.\n\n" +
        "  --skip-build  reuse an existing .open-next build\n" +
        "  --sites       build with freebuff.open-next.config.ts and verify the\n" +
        "                OCR model rewrite and digest (cannot be combined with\n" +
        "                --skip-build)\n" +
        "  --port <n>    fixed port (default: a free ephemeral port)\n",
    );
    return 0;
  }

  if (options.sites && options.skipBuild) {
    throw new Error(
      "--sites cannot be combined with --skip-build: a reused .open-next tree was not " +
        "necessarily built with the Sites OpenNext config or its bindings",
    );
  }

  if (!options.skipBuild) {
    if (options.sites) {
      if (!fs.existsSync(SITES_OPEN_NEXT_CONFIG)) {
        throw new Error(
          `${path.relative(ROOT, SITES_OPEN_NEXT_CONFIG)} is missing; prepare the checkout for ` +
            "Sites before running --sites",
        );
      }
      await runCommand(
        binary("opennextjs-cloudflare"),
        [
          "build",
          "--skipWranglerConfigCheck",
          "--openNextConfigPath",
          path.relative(ROOT, SITES_OPEN_NEXT_CONFIG),
        ],
        "opennextjs-cloudflare build (Sites config, runs next build)",
      );
    } else {
      writeOpenNextConfig();
      try {
        await runCommand(
          binary("opennextjs-cloudflare"),
          [
            "build",
            "--skipWranglerConfigCheck",
            "--openNextConfigPath",
            path.relative(ROOT, OPEN_NEXT_CONFIG),
          ],
          "opennextjs-cloudflare build (runs next build)",
        );
      } finally {
        fs.rmSync(OPEN_NEXT_CONFIG, { force: true });
      }
    }
  }

  for (const required of [WORKER_ENTRY, ASSETS_DIR]) {
    if (!fs.existsSync(required)) {
      throw new Error(
        `${path.relative(ROOT, required)} is missing — run without --skip-build`,
      );
    }
  }

  writeWranglerConfig({ sites: options.sites });
  const port = options.port ?? (await freePort());
  const { child, log } = startWrangler(port);

  let smokeFailure = null;
  try {
    await waitUntilReady(child, port);
    process.stdout.write(`\n▶ wrangler dev ready on http://127.0.0.1:${port}\n\n`);

    const failures = [];
    for (const route of ROUTES) {
      const result = await checkRoute(route, port);
      failures.push(...result.failures);
      if (result.failures.length === 0) {
        process.stdout.write(
          `  ✓ GET ${route.path} — ${result.status} ${result.label}\n`,
        );
      } else {
        process.stdout.write(`  ✗ GET ${route.path}\n`);
      }
    }

    if (options.sites) {
      const ocrFailures = await checkOcrModel(port);
      failures.push(...ocrFailures);
      if (ocrFailures.length === 0) {
        process.stdout.write(
          `  ✓ GET ${OCR_MODEL_PATH} — 200 application/gzip, SHA-256 verified\n`,
        );
      } else {
        process.stdout.write(`  ✗ GET ${OCR_MODEL_PATH} (rewrite + digest)\n`);
      }
    }

    if (failures.length > 0) {
      smokeFailure = new Error(
        `${failures.length} smoke assertion${failures.length === 1 ? "" : "s"} failed`,
      );
      for (const failure of failures) process.stderr.write(`    - ${failure}\n`);
    }
  } catch (error) {
    smokeFailure = error;
  } finally {
    await stop(child);
    fs.rmSync(WRANGLER_CONFIG, { force: true });
  }

  if (smokeFailure) {
    process.stderr.write(`\n✗ Worker smoke check failed: ${smokeFailure.message}\n`);
    if (log.text.trim()) {
      process.stderr.write(`\n--- wrangler dev log (tail) ---\n${log.text.trim()}\n`);
    }
    return 1;
  }

  process.stdout.write(
    `\n✓ ${options.sites ? "Sites " : ""}Worker smoke check passed: ${ROUTES.length} routes, ` +
      `one security-header set each${options.sites ? ", OCR rewrite and digest verified" : ""}.\n`,
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`\n✗ Worker smoke check failed: ${error.message}\n`);
    process.exitCode = 1;
  });
