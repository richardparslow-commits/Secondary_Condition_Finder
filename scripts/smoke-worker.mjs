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
 * Usage:
 *   npm run smoke:worker                 # full OpenNext build, then probe
 *   npm run smoke:worker -- --skip-build # reuse an existing .open-next build
 *   npm run smoke:worker -- --port 8799  # fixed port (default: a free one)
 *
 * Exit codes: 0 — every check passed; 1 — the build failed, the Worker did not
 * become ready, or an assertion failed. The Wrangler log tail is printed on
 * failure so the reason is visible without re-running by hand.
 */

import { spawn } from "node:child_process";
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
  const options = { skipBuild: false, port: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-build") {
      options.skipBuild = true;
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
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            rawHeaders: res.rawHeaders,
            headers: (name) => headerValues(res.rawHeaders, name),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
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

/** Write the local preview config; the build itself needs no Wrangler config. */
function writeWranglerConfig() {
  const config = {
    $schema: "../node_modules/wrangler/config-schema.json",
    name: "secondary-condition-finder-smoke",
    main: "./worker.js",
    compatibility_date: COMPATIBILITY_DATE,
    compatibility_flags: ["nodejs_compat"],
    assets: {
      directory: "./assets",
      binding: "ASSETS",
    },
  };
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
        "  --port <n>    fixed port (default: a free ephemeral port)\n",
    );
    return 0;
  }

  if (!options.skipBuild) {
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

  for (const required of [WORKER_ENTRY, ASSETS_DIR]) {
    if (!fs.existsSync(required)) {
      throw new Error(
        `${path.relative(ROOT, required)} is missing — run without --skip-build`,
      );
    }
  }

  writeWranglerConfig();
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
    `\n✓ Worker smoke check passed: ${ROUTES.length} routes, one security-header set each.\n`,
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
