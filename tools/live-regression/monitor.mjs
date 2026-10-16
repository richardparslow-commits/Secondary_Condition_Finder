/**
 * Scheduled regression monitor for the practice application.
 *
 * It does not re-implement any testing. It runs the already-verified harness twice —
 *   live-suite.mjs            a short randomized journey set
 *   hydration-race-gate.mjs   the React #418 streaming-hydration race canary (payment: it reproduces the defect on demand)
 * — then compares the result with state/baseline.json and answers exactly one question:
 * "is any check failing now that was passing when the baseline was last accepted?"
 *
 * Exit codes (the workflow and any cron wrapper gate on these):
 *   0  no newly failing check (known failures are reported, not re-raised)
 *   1  at least one newly failing check, or the race canary regressed
 *   2  the monitor itself could not run (harness error, unreadable output) — not an application verdict
 *
 * Usage:
 *   node monitor.mjs [--runs=8] [--seed=auto] [--race=20] [--kbps=400] [--latency=150] [--url=<target>]
 *                    [--baseline=state/baseline.json] [--results=results] [--update-baseline]
 *                    [--webhook=URL] [--webhook-always] [--suite-extra=--flag=value] [--quiet]
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split("=").slice(1).join("=");
const has = (n) => argv.includes(`--${n}`);

const RUNS = Number(arg("runs", "8"));
const SEED = arg("seed", "auto");
const RACE = Number(arg("race", "20"));
const KBPS = Number(arg("kbps", "400"));
const LATENCY = Number(arg("latency", "150"));
const TARGET = arg("url", ""); // passed to the race canary only (the journey suite is pinned to the production URL)
const BASELINE = resolve(HERE, arg("baseline", "state/baseline.json"));
const RESULTS = resolve(HERE, arg("results", "results"));
const UPDATE = has("update-baseline");
const QUIET = has("quiet");
const WEBHOOK = arg("webhook", process.env.MONITOR_WEBHOOK_URL || "");
const WEBHOOK_ALWAYS = has("webhook-always") || !!process.env.MONITOR_WEBHOOK_ALWAYS;
const SUITE_EXTRA = argv.filter((a) => a.startsWith("--suite-extra=")).map((a) => a.slice(14));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const seed = SEED === "auto" ? (Date.now() % 900000) + 1000 : Number(SEED);
mkdirSync(RESULTS, { recursive: true });

function run(cmd, args, logName) {
  return new Promise((res) => {
    const logPath = join(RESULTS, logName);
    const out = [];
    const child = spawn(cmd, args, { cwd: HERE });
    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => out.push(d));
    child.on("close", (code) => {
      writeFileSync(logPath, Buffer.concat(out).toString("utf8"));
      res({ code, logPath, tail: Buffer.concat(out).toString("utf8").split("\n").slice(-8).join("\n") });
    });
    child.on("error", (e) => res({ code: 127, logPath, tail: String(e) }));
  });
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const baseline = existsSync(BASELINE) ? readJson(BASELINE) : { checks: {} };

// ---------------------------------------------------------------- journey suite
const suiteOut = join(RESULTS, `monitor-suite-${stamp}.json`);
const suiteArgs = [
  join(HERE, "live-suite.mjs"),
  `--runs=${RUNS}`,
  `--seed=${seed}`,
  "--viewport=desktop",
  `--out=${suiteOut}`,
  ...SUITE_EXTRA,
];
const suite = await run(process.execPath, suiteArgs, `monitor-${stamp}-suite.log`);
let campaign = null;
if (existsSync(suiteOut)) {
  try {
    campaign = readJson(suiteOut);
  } catch {}
}
if (!campaign) {
  console.error(`monitor cannot run: live-suite.mjs produced no readable result (exit ${suite.code})\n${suite.tail}`);
  process.exit(2);
}
const S = campaign.summary;

// Per-check tallies are recomputed from the run records rather than taken from S.perCheck, because the harness
// deliberately forgives a failure its same-seed replay could not reproduce: that run is marked \`flaky: true\`,
// counted as passed in the summary, and its first-attempt failures still appear in perCheck. Reading perCheck at
// face value made this monitor raise the known React #418 race every time it wobbled. A check fails here only when
// a run STAYED failed (\`passed: false\` and not flaky); a wobble in a recovered run is recorded as a flake and
// reported without being raised, since a rising flake count is the early warning that precedes a real regression.
const now = {};
const flaked = {};
for (const r of campaign.results) {
  const firstAttemptFailures = r.failedChecks || [];
  const recoveredOnReplay = r.passed === false && (r.flaky === true || r.replay?.passed === true);
  const names = new Set([...Object.keys(r.checks || {}), ...firstAttemptFailures]);
  for (const name of names) {
    now[name] = now[name] || { pass: 0, fail: 0 };
    if (recoveredOnReplay) {
      now[name].pass++;
      if (firstAttemptFailures.includes(name)) flaked[name] = (flaked[name] || 0) + 1;
    } else if (r.passed === false && firstAttemptFailures.includes(name)) {
      now[name].fail++;
    } else {
      now[name].pass++;
    }
  }
}

// ---------------------------------------------------------------- race canary
let race = null;
if (RACE > 0) {
  const raceArgs = [join(HERE, "hydration-race-gate.mjs"), `--runs=${RACE}`, `--kbps=${KBPS}`, `--latency=${LATENCY}`];
  if (TARGET) raceArgs.push(`--url=${TARGET}`);
  const r = await run(process.execPath, raceArgs, `monitor-${stamp}-race.log`);
  if (![0, 1].includes(r.code)) {
    console.error(`monitor cannot run: hydration-race-gate.mjs exited ${r.code} (neither clean nor reproducing)\n${r.tail}`);
    process.exit(2);
  }
  // The canary writes its full summary to results/hydration-race-gate.json; the log tail is truncated for
  // large runs, so read the artifact and fall back to the exit code only if it is missing.
  const raceFile = join(HERE, "results", "hydration-race-gate.json");
  let raceSummary = null;
  if (existsSync(raceFile)) { try { raceSummary = readJson(raceFile); } catch {} }
  race = {
    runs: RACE,
    kbps: KBPS,
    latency: LATENCY,
    mismatches: raceSummary ? raceSummary.hydrationMismatches : r.code === 1 ? RACE : 0,
    exitCode: r.code,
    logPath: r.logPath,
  };
}

// ---------------------------------------------------------------- comparison
const baseChecks = baseline.checks || {};
const newlyFailing = [];
const stillFailing = [];
const recovered = [];
for (const [name, v] of Object.entries(now)) {
  const before = baseChecks[name];
  if (v.fail > 0 && (!before || before.fail === 0)) newlyFailing.push({ name, fail: v.fail, pass: v.pass, was: before ? "0 failures" : "not in baseline" });
  else if (v.fail > 0) stillFailing.push({ name, fail: v.fail, pass: v.pass, known: before.fail });
  else if (before && before.fail > 0) recovered.push({ name, was: before.fail });
}
const missingChecks = Object.keys(baseChecks).filter((k) => !(k in now));
const unknownChecks = Object.keys(now).filter((k) => !(k in baseChecks));
const raceKnown = (baseline.raceGate?.mismatches ?? 0) > 0;
const raceRegressed = race ? (race.mismatches > 0 && !raceKnown) : false;
const raceRecovered = race ? race.mismatches === 0 && raceKnown : false;
const harnessBroken = (S.harnessFailures ?? 0) > 0;
const verdict = harnessBroken ? 2 : newlyFailing.length || raceRegressed ? 1 : 0;

const builds = S.builds || [];
const md = [
  `## Live regression monitor — ${verdict === 0 ? "no newly failing check" : verdict === 1 ? "NEWLY FAILING CHECK" : "MONITOR ERROR"}`,
  ``,
  `| | |`,
  `|---|---|`,
  `| Target | ${S.target} |`,
  `| Journeys | ${S.runs} (seed ${seed}) → **${S.passedRuns} passed**, ${S.appFailures} app failure(s), ${S.harnessFailures} harness failure(s), ${S.flakyRuns} flake(s) |`,
  `| Build(s) | ${builds.join(", ") || "unknown"}${S.singleBuild ? "" : " — **more than one build during the run**"} |`,
  race ? `| Race canary | ${race.runs} loads @ ${race.kbps} kbps / ${race.latency} ms → **${race.mismatches} mismatch(es)** |` : `| Race canary | disabled |`,
  `| Baseline | ${baseline.source || "none"} (updated ${baseline.updatedAt || "never"}) |`,
  ``,
];
if (newlyFailing.length) {
  md.push(`### Newly failing (was passing in the baseline)`, ``, `| Check | Failures | Passes | Baseline |`, `|---|---|---|---|`);
  for (const c of newlyFailing) md.push(`| \`${c.name}\` | ${c.fail} | ${c.pass} | ${c.was} |`);
  md.push(``);
}
if (raceRegressed) md.push(`### Race canary regressed`, ``, `The streaming-hydration race reproduced ${race.mismatches}/${race.runs} at ${race.kbps} kbps / ${race.latency} ms, and the baseline recorded it as clean. See \`notes/HYDRATION-ROOT-CAUSE.md\` (facebook/react#37321).`, ``);
if (Object.keys(flaked).length) {
  md.push(`### Flakes (failed once, recovered on same-seed replay — reported, not raised)`, ``);
  for (const [name, n] of Object.entries(flaked)) md.push(`- \`${name}\`: ${n} recovered wobble(s). A rising count here is the early warning that precedes a reproducible regression.`);
  md.push(``);
}
if (unknownChecks.length) md.push(`### Checks new since the baseline`, ``, `${unknownChecks.map((c) => `\`${c}\``).join(", ")} — appear only if the suite gained a check; accept with \`--update-baseline\` once intended.`, ``);
if (stillFailing.length || (race && race.mismatches > 0 && raceKnown)) {
  md.push(`### Known failures (tracked in the baseline — not re-raised)`, ``);
  for (const c of stillFailing) md.push(`- \`${c.name}\`: ${c.fail} failure(s) now, ${c.known} when the baseline was accepted`);
  if (race && race.mismatches > 0 && raceKnown) md.push(`- race canary: ${race.mismatches}/${race.runs} mismatches, ${baseline.raceGate.mismatches} when the baseline was accepted — ${baseline.raceGate.note || "known"}`);
  md.push(``);
}
if (recovered.length || raceRecovered) {
  md.push(`### Recovered (failing in the baseline, passing now)`, ``);
  for (const c of recovered) md.push(`- \`${c.name}\`: ${c.was} failure(s) before, 0 now`);
  if (raceRecovered) md.push(`- race canary: clean now, ${baseline.raceGate.mismatches} before — accept it with \`--update-baseline\``);
  md.push(``);
}
if (missingChecks.length) md.push(`### Checks that disappeared`, ``, `${missingChecks.map((c) => `\`${c}\``).join(", ")} — the suite or the application changed shape; confirm this is intended.`, ``);
md.push(
  `### Artifacts`,
  ``,
  `- \`${suiteOut.replace(HERE + "/", "")}\` (per-journey detail), \`results/evidence/\` (screenshots/HTML on failures)`,
  race ? `- \`${race.logPath.replace(HERE + "/", "")}\`` : ``,
  `- Logs: \`results/monitor-${stamp}-*.log\``,
  ``,
  `Reproduce: \`node monitor.mjs --runs=${S.runs} --seed=${seed}${race ? ` --race=${race.runs} --kbps=${race.kbps} --latency=${race.latency}` : ""}\``
);

const report = md.filter((l) => l !== null).join("\n");
mkdirSync(RESULTS, { recursive: true });
writeFileSync(join(RESULTS, `monitor-${stamp}.md`), report + "\n");
writeFileSync(join(RESULTS, `monitor-${stamp}.json`), JSON.stringify({ verdict, seed, generatedAt: stamp, summary: S, now, race, newlyFailing, stillFailing, recovered, flaked, unknownChecks, missingChecks, baselineSource: baseline.source }, null, 2));
writeFileSync(join(HERE, "state", "latest.json"), JSON.stringify({ at: stamp, verdict, newlyFailing: newlyFailing.map((c) => c.name), stillFailing: stillFailing.map((c) => c.name), race }, null, 2));

if (UPDATE) {
  const updated = {
    updatedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    source: `accepted after a monitor run (${S.passedRuns}/${S.runs} journeys, seed ${seed})`,
    checks: now,
    ...(race ? { raceGate: { kbps: race.kbps, latency: race.latency, runs: race.runs, mismatches: race.mismatches, note: race.mismatches === 0 ? "clean" : "known failure — tracked, not newly failing" } } : {}),
  };
  writeFileSync(BASELINE, JSON.stringify(updated, null, 2) + "\n");
  console.log(`baseline updated (${Object.keys(now).length} checks${race ? `, race ${race.mismatches}/${race.runs}` : ""})`);
  process.exit(0);
}

if (!QUIET) console.log(report);
console.log(
  `\nmonitor: ${verdict === 0 ? "green" : verdict === 1 ? "NEW FAILURE" : "MONITOR ERROR"} — ${newlyFailing.length} newly failing, ${stillFailing.length} known-failing${race ? `, race ${race.mismatches}/${race.runs}${raceKnown ? " (known)" : ""}` : ""}`
);

if (WEBHOOK && (verdict === 1 || WEBHOOK_ALWAYS)) {
  try {
    await fetch(WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: report }) });
    console.log("webhook notified");
  } catch (e) {
    console.error("webhook failed: " + String(e).slice(0, 120));
  }
}

if (UPDATE && verdict === 0) {
  // nothing to accept, still exit 0
}
process.exit(verdict);
