/**
 * Progress heartbeats for the long PRIV-01 acceptance walk.
 *
 * Why this exists: the walk spends most of its wall-clock time inside bounded
 * waits (page conditions, `/api/health`, a captured request, CDP round trips),
 * and the one failure that actually happens on a loaded host is a **wedge** —
 * the browser stops answering `Runtime.evaluate` while the condition it was
 * asked for simply never becomes true. Before this module the only output was
 * `waiting: <label> (120s)`, which reports elapsed time and nothing else: a
 * wedged run and a slow one produced the same log, and the diagnosis existed
 * only inside the JSON report written after the run had already been killed.
 *
 * The signal that distinguishes them is not the clock, it is **whether anything
 * is still changing**:
 *
 *   - a probe that answers — even with `false` — proves the thing being polled is
 *     reachable, so the run is slow, not wedged;
 *   - consecutive probe *errors* mean it stopped answering, which is the wedged
 *     case;
 *   - no event of any kind for far longer than the walk's own polling interval
 *     means something is stuck outside the polling loop entirely (a CDP send
 *     that never resolves, a synchronous step).
 *
 * Each of those produces a different heartbeat line, so the failure mode is
 * readable from the log alone.
 *
 * Probes cover every bounded wait the walk performs, not only the browser: page
 * conditions, `/api/health`, the Chrome DevTools endpoint and a captured
 * request. So the verdict names the wait label it is talking about ("app health
 * stopped answering") instead of assuming a browser: when a run wedges because
 * the app under test never came up, blaming the browser would send the reader
 * after the wrong process.
 *
 * The reporter is deliberately passive: it never throws, never mutates the
 * walk's state, and every dependency (clock, timer, writer) is injectable so
 * the classification is testable without a browser or real time.
 */

/** Compact duration, e.g. `9s`, `1m05s`, `1h02m`. */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m${String(totalSeconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

/** Longest probe description kept in a heartbeat line, so one line stays one line. */
const MAX_PROBE_SUMMARY = 120;

/**
 * Renders whatever a probe produced as one short, log-safe phrase.
 *
 * `true`/`false` are spelled out because they are the whole difference between
 * "the condition is satisfied" and "still waiting"; anything else is collapsed
 * to a single line and truncated so a multi-line CDP error cannot wreck the log.
 */
export function summarizeProbe(last) {
  if (last === undefined) return "no result yet";
  if (last === null) return "null";
  if (last === true) return "returned true";
  if (last === false) return "returned false";
  if (typeof last === "number") return `returned ${last}`;
  if (typeof last === "string") {
    const oneLine = last.replace(/\s+/g, " ").trim();
    if (oneLine === "") return "(empty)";
    return oneLine.length > MAX_PROBE_SUMMARY ? `${oneLine.slice(0, MAX_PROBE_SUMMARY)}…` : oneLine;
  }
  try {
    const json = JSON.stringify(last);
    if (typeof json !== "string") return String(last);
    return json.length > MAX_PROBE_SUMMARY ? `${json.slice(0, MAX_PROBE_SUMMARY)}…` : json;
  } catch {
    return "(unserializable)";
  }
}

/**
 * @typedef {object} ProgressSnapshot
 * @property {string} phase Current phase label.
 * @property {number} elapsedMs Since the reporter started.
 * @property {number} phaseElapsedMs Since the current phase began.
 * @property {string | null} waitLabel Wait currently being polled, if any.
 * @property {number | null} waitElapsedMs Time spent in that wait.
 * @property {number} probes Probes recorded against the current wait.
 * @property {number} consecutiveProbeErrors
 * @property {string} lastProbeSummary
 * @property {string} lastEventName
 * @property {number} sinceLastEventMs
 * @property {number} heartbeats
 * @property {"responding" | "unresponsive" | "no-progress"} state
 * @property {string} detail
 */

/**
 * Creates the reporter. Nothing is bound to a timer until `start()` is called,
 * so importing this module (including from a test) has no side effects.
 *
 * @param {{ write?: (message: string) => void, now?: () => number, heartbeatMs?: number, stallMs?: number, setIntervalFn?: typeof setInterval, clearIntervalFn?: typeof clearInterval }} [options]
 */
export function createProgressReporter({
  write = (message) => console.log(message),
  now = Date.now,
  heartbeatMs = 15_000,
  // Three poll intervals with nothing answering is a wedge, not a slow page: the
  // walk's waits poll every 400ms, so a working page always produces an answer
  // inside a second. `stallMs` only governs the "nothing is changing at all"
  // case, which includes waits that are not polling.
  stallMs = 30_000,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const startedAt = now();
  let currentPhase = "startup";
  let phaseStartedAt = startedAt;
  let lastEventAt = startedAt;
  let lastEventName = "run started";
  /** @type {null | { label: string, startedAt: number, probes: number, consecutiveProbeErrors: number, lastProbeSummary: string, lastProbeStatus: string | null, changedAt: number }} */
  let wait = null;
  let timer = null;
  let heartbeats = 0;
  let lastReportedAt = startedAt;

  function phase(name) {
    const at = now();
    currentPhase = name;
    phaseStartedAt = at;
    lastEventAt = at;
    lastEventName = `phase "${name}"`;
    wait = null;
    write(`phase ${formatDuration(at - startedAt)}: ${name}`);
  }

  /**
   * A progress event that is not a probe: an assertion result, a completed UI
   * step. Recorded silently — the walk already logs its own `ok`/`FAIL` lines —
   * and used as the "something is still moving" signal for the heartbeat.
   */
  function event(name) {
    const at = now();
    lastEventAt = at;
    lastEventName = name;
  }

  function note(text) {
    write(`note ${formatDuration(now() - startedAt)}: ${text}`);
  }

  /**
   * Records one probe result. A probe that answers (even `false`) counts as an
   * event: the target responded, so the walk is slow rather than wedged. A probe
   * that threw does not, and consecutive throws are the wedge signature.
   *
   * @param {{ label: string, elapsedMs?: number, last?: unknown, status?: "value" | "error" }} result
   */
  function probe({ label, elapsedMs = 0, last, status = "value" }) {
    const at = now();
    if (!wait || wait.label !== label) {
      wait = {
        label,
        startedAt: at - (Number.isFinite(elapsedMs) ? elapsedMs : 0),
        probes: 0,
        consecutiveProbeErrors: 0,
        lastProbeSummary: "no result yet",
        lastProbeStatus: null,
        changedAt: at,
      };
    }
    wait.probes += 1;
    if (status === "error") wait.consecutiveProbeErrors += 1;
    else wait.consecutiveProbeErrors = 0;

    const summary = summarizeProbe(last);
    if (summary !== wait.lastProbeSummary || status !== wait.lastProbeStatus) {
      wait.lastProbeSummary = summary;
      wait.lastProbeStatus = status;
      wait.changedAt = at;
    }
    if (status !== "error") {
      lastEventAt = at;
      lastEventName = `probe for "${label}" answered`;
    }
  }

  /** Classify the current state. This is the whole point of the module. */
  function classify() {
    const at = now();
    if (wait && wait.consecutiveProbeErrors >= 3) {
      return {
        state: /** @type {const} */ ("unresponsive"),
        // Named, not assumed: the stalled wait may be the dev server rather than
        // the browser, and the label is what tells the two apart.
        detail: `"${wait.label}" stopped answering: ${wait.consecutiveProbeErrors} consecutive probe errors (last: ${wait.lastProbeSummary})`,
      };
    }
    const sinceEvent = at - lastEventAt;
    const sinceChange = wait ? at - wait.changedAt : sinceEvent;
    if (sinceEvent >= stallMs && sinceChange >= stallMs) {
      return {
        state: /** @type {const} */ ("no-progress"),
        detail: `no observable progress for ${formatDuration(sinceEvent)} (last event: ${lastEventName})`,
      };
    }
    return {
      state: /** @type {const} */ ("responding"),
      detail: wait
        ? `still answering (last probe ${wait.lastProbeSummary})`
        : `last event ${formatDuration(sinceEvent)} ago`,
    };
  }

  /** One greppable line: `progress <elapsed> | phase ... | ... | OK|STALLED: ...` */
  function describe() {
    const at = now();
    const { state, detail } = classify();
    const parts = [`progress ${formatDuration(at - startedAt)}`, `phase "${currentPhase}" for ${formatDuration(at - phaseStartedAt)}`];
    if (wait) {
      parts.push(`waiting ${formatDuration(at - wait.startedAt)} on "${wait.label}" (${wait.probes} probes)`);
    }
    parts.push(`last event ${formatDuration(at - lastEventAt)} ago (${lastEventName})`);
    const verdict = state === "responding" ? "OK" : `STALLED:${state}`;
    parts.push(`${verdict}: ${detail}`);
    return parts.join(" | ");
  }

  /** Structured state for the evidence report, so the same diagnosis survives the run. */
  function snapshot() {
    const at = now();
    const { state, detail } = classify();
    return {
      phase: currentPhase,
      elapsedMs: at - startedAt,
      phaseElapsedMs: at - phaseStartedAt,
      waitLabel: wait?.label ?? null,
      waitElapsedMs: wait ? at - wait.startedAt : null,
      probes: wait?.probes ?? 0,
      consecutiveProbeErrors: wait?.consecutiveProbeErrors ?? 0,
      lastProbeSummary: wait?.lastProbeSummary ?? "no result yet",
      lastEventName,
      sinceLastEventMs: at - lastEventAt,
      heartbeats,
      state,
      detail,
    };
  }

  /**
   * A sentence for a *timed-out* wait, which must say whether the thing being
   * polled was answering. "It kept answering but the condition never became
   * true" and "it stopped answering" demand different responses, and only the
   * probe history can tell them apart.
   */
  function describeWait(label) {
    const at = now();
    const { state, detail } = classify();
    const waited = wait && wait.label === label ? formatDuration(at - wait.startedAt) : "an unknown time";
    if (state === "unresponsive") {
      return `stalled on "${label}" after ${waited} — ${detail}; this is a wedge, not a slow run`;
    }
    if (state === "no-progress") {
      return `stalled on "${label}" after ${waited} — ${detail}; nothing in the run changed, so it is stuck rather than slow`;
    }
    return `timed out on "${label}" after ${waited} — it kept answering (last probe ${wait?.lastProbeSummary ?? "unknown"}), so the condition never became true rather than the target wedging`;
  }

  function shouldReport() {
    const at = now();
    if (at - lastReportedAt < heartbeatMs) return false;
    // An active wait always merits a heartbeat; otherwise only an unusually long
    // stretch with no phase change does (the stuck-outside-the-poll-loop case).
    if (wait) return true;
    return at - phaseStartedAt >= heartbeatMs;
  }

  function heartbeat() {
    if (!shouldReport()) return;
    lastReportedAt = now();
    heartbeats += 1;
    write(describe());
  }

  function start() {
    if (timer) return;
    timer = setIntervalFn(heartbeat, heartbeatMs);
    // A heartbeat must never be the reason the process stays alive.
    timer?.unref?.();
  }

  function stop() {
    if (!timer) return;
    clearIntervalFn(timer);
    timer = null;
  }

  return { phase, event, note, probe, describe, describeWait, snapshot, start, stop };
}
