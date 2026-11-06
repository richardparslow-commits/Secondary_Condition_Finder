# API Specification

This document describes the request/response contracts for all API endpoints and Server Actions in the application.

---

## API Endpoints

### `GET /api/health`

Health check endpoint used by Vercel's monitoring and the production readiness workflow. Returns component-level status for the catalog, crypto primitives, the legacy configured-secret readiness marker, CRG adjacency graph, VA API config, circuit-breaker state, the shared consumer budget's admit/refuse pressure, and the Content-Security-Policy violations browsers have reported recently. These crypto fields support runtime readiness; the current research workflows use browser-local state, and the optional VA-account store has independent configuration and its own `VA_ACCOUNT_SESSION_SECRET`.

`sessionCrypto` proves the seal/open primitives work using an ephemeral probe secret. `workflowSession` reports whether the primary `WORKFLOW_SESSION_SECRET` passes the production crypto-readiness probe; it does not establish research-workflow persistence or VA-account store readiness. Production health treats an absent/short primary key as degraded because the runtime-readiness contract still requires it.

The `kbGraph` component reports validated adjacency-graph migration state: `nodes`/`edges` count the migrated graph, and an empty graph is the valid pre-migration state. Invalid graph data never loads — the loader fails loud, so the component reports `error` and health degrades.

**Response** (`200 OK` when healthy, `503 Service Unavailable` when degraded):

<!-- jsonc: the example is executable JSON once the trailing comments are
     stripped. Those comments record the TypeScript union each field may take
     (see src/lib/runtime-capabilities.ts), so the block stays copy-pasteable
     while still documenting every legal value. -->

```jsonc
{
  "status": "healthy",
  "components": {
    "catalog": {
      "status": "ok",
      "latencyMs": 12,
      "count": 302,
      "detail": "optional error message"
    },
    "sessionCrypto": {
      "status": "ok",
      "latencyMs": 5,
      "detail": "optional error message"
    },
    "workflowSession": {
      "status": "ok",
      "latencyMs": 1,
      "detail": "Workflow session crypto readiness probe passed"
    },
    "kbGraph": {
      "status": "ok",
      "latencyMs": 1,
      "nodes": 4,
      "edges": 3,
      "detail": "optional error message"
    },
    "vaConfig": {
      "status": "ok",
      "latencyMs": 1,
      "enabled": false,
      "environment": "sandbox",
      "detail": "disabled (sandbox) — local fallback active"
    },
    "circuitBreaker": {
      "status": "ok",
      "latencyMs": 0,
      "detail": "va-forms:closed benefits-reference-data:closed accredited-representatives:closed",
      "snapshot": {
        "va-forms": { "state": "closed", "failures": 0, "lastFailureAt": null },
        "benefits-reference-data": { "state": "closed", "failures": 0, "lastFailureAt": null },
        "accredited-representatives": { "state": "closed", "failures": 0, "lastFailureAt": null }
      }
    },
    "vaReferenceCache": {
      "scope": "process-local", // "process-local" | "disabled"
      "detail": "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
      "hits": 42,
      "misses": 8,
      "hitRate": 84
    },
    "rateLimit": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "per-instance", // "per-instance" | "single-process"
      "detail": "per-client (key only as trustworthy as the forwarding header) limits apply per instance, so the aggregate is roughly the configured limit x instance count; the edge WAF remains the capacity layer",
      "identity": {
        "trustedIngress": false, // true only when an ingress model is declared
        "identity": "self-declared", // "asserted" | "self-declared"
        "model": "unasserted", // "unasserted" | "set" | "append"
        "header": "x-forwarded-for", // "x-forwarded-for" | "x-real-ip" | null
        "hop": "leftmost", // "leftmost" | "nth-from-right" | "none"
        "hopsFromRight": null, // set for the append model, otherwise null
        "fallback": "x-real-ip", // null when the model reads no fallback header
        "unidentified": {
          "policy": "ceiling", // "ceiling" | "shared-per-client-bucket"
          "keyTemplate": null, // "unidentified:<limiter>" under the class-bucket policy, else null
          "detail": "no ingress model is declared, so a request with no usable identity cannot be told apart from an honest client of a deployment whose forwarding headers never arrive; it is bounded by the shared admission ceiling, and charging that whole population to one bucket at a client's own limit would cap it at one client's allowance"
        },
        "variable": "RATE_LIMIT_TRUSTED_INGRESS",
        "detail": "no ingress is asserted, so a per-client key is only as trustworthy as the header that carried it; the shared admission ceiling caps abuse that rotates keys either way"
      },
      "ceiling": {
        "max": 6000, // read off the limiter that enforces it
        "windowMs": 60000,
        "variable": "RATE_LIMIT_UNATTRIBUTED_MAX",
        "key": "unattributed:shared",
        "detail": "unattributed requests (no valid IP literal) and any request's share of aggregate traffic are bounded by this shared budget, which is deliberately separate from the per-client limit"
      },
      "store": {
        "mode": "process-local", // "process-local" is the only implemented mode
        "distributed": false,
        "blockedBy": "no-store-provisioned",
        "detail": "counters live in this process only, so the enforced limit is per instance; a deployment-wide quota needs a shared counter store the operator must provision (and prove atomic in the hosting environment), and no shared store is wired for inbound admission, so none is claimed (SEC-02 remains open on that half)"
      },
      "refusals": {
        "scope": "process-local", // refusals are counted where they happen, never a fleet total
        "windowMs": 900000,
        "maxEvents": 256, // hard cap on retained events; a storm drops its own oldest rows
        "received": 0, // retained in-window refusals
        "unknownBudget": 0, // retained refusals whose reason was none of the budgets below
        "byBudget": { "ceiling": 0, "perClient": 0, "unidentified": 0 }, // the reading: which budget refused
        "ceilingShare": null, // 0-100, share charged to the shared ceiling; null when nothing retained
        "evicted": 0, // dropped at the retention bound since this process started
        "since": null, // oldest retained refusal, ISO 8601, or null
        "lastRefusedAt": null,
        "surfaces": [], // busiest first: { surface, budget, count, lastRefusedAt }
        "surfacesOmitted": 0, // surface rows left out by the reporting cap of 12
        "detail": "no inbound admission refusal in the last 15m; this window is per instance, forgets rows on cold start, and never sees a refusal the edge WAF answered itself"
      }
    },
    "vaConsumerBudget": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "not-required", // "fleet-shared" | "unenforced" | "not-required"
      "detail": "one process is the whole fleet in this runtime, so the shared reservation is not consulted and the per-instance outbound budget (VA_API_OUTBOUND_WINDOW_MS / VA_API_OUTBOUND_MAX_REQUESTS_PER_SERVICE) is the whole budget; the shared pressure counters stay structurally zero",
      "budget": {
        "maxRequests": 60, // read off the budget that enforces it, never re-declared here
        "windowMs": 60000,
        "optIn": false, // VA_SHARED_CONSUMER_BUDGET=true is required in a distributed runtime
        "variable": "VA_SHARED_CONSUMER_BUDGET"
      },
      "store": {
        "mode": "no-coordinator", // "shared-coordinator" | "no-coordinator"
        "distributed": false,
        "blockedBy": null // "no-shared-budget-opt-in" | "no-shared-coordinator-configured" | null
      },
      "pressure": {
        "scope": "per-instance", // this instance's decisions since it started, never a fleet total
        "since": null,
        "admitted": 0,
        "refused": 0,
        "refusals": {
          "exhausted": 0, // the budget working: this window's budget is spent
          "superseded-window": 0, // the store has already opened a later window
          "predecessor-invalid": 0,
          "counter-lifetime-refused": 0,
          "unreadable-decision": 0,
          "store-unconfigured": 0,
          "store-unreachable": 0,
          "clock-unusable": 0
        },
        "refusedInLastWindow": 0,
        "lastRefusalAt": null,
        "lastRefusalReason": null,
        "pacing": {
          "charges": 0,
          "chargedReservations": 0,
          "refusedCharges": 0,
          "lastChargedAt": null
        },
        "detail": "no reservation has been decided on this instance since it started"
      }
    },
    "cspReports": {
      "status": "ok",
      "latencyMs": 0,
      "scope": "process-local", // reports are accepted by whichever instance served the POST
      "windowMs": 900000,
      "maxEvents": 128,
      "received": 0, // non-zero is the signal: some deploy is blocking something the policy did not intend
      "oversized": 0, // rejected before they could be attributed; counted, never parsed
      "evicted": 0, // dropped at the retention bound since this process started
      "since": null,
      "lastReceivedAt": null,
      "directives": [], // { directive, count, dispositions, lastReceivedAt }, most-reported first, capped at 12
      "directivesOmitted": 0,
      "detail": "no CSP violation report in the last 15m; this window is per instance and forgets rows on cold start"
    },
    "runtime": {
      "status": "ok",
      "latencyMs": 0,
      "distributed": false,
      "reduced": [],
      "capabilities": {
        "vaLiveIntegration": "enabled", // "enabled" | "disabled"
        "vaReferenceCache": "process-local", // "process-local" | "disabled"
        "rateLimit": "single-process", // "single-process" | "per-instance"
        "vaConsumerBudget": "not-required", // "fleet-shared" | "unenforced" | "not-required"
        "circuitBreaker": "single-process" // "single-process" | "per-instance"
      },
      "detail": "all process-local capabilities run at full strength in this runtime"
    }
  },
  "latencyMs": 18,
  "timestamp": "2026-09-13T22:00:00.000Z"
}
```

**Healthy** (`200`): `catalog.status === "ok"` AND `sessionCrypto.status === "ok"` AND `workflowSession.status === "ok"` AND `kbGraph.status === "ok"`.
**Degraded** (`503`): Any of `catalog`, `sessionCrypto`, `workflowSession`, or `kbGraph` is `"error"`. Invalid adjacency-graph data deliberately degrades health as a deployed-integrity failure. The workflow-session component specifically checks the legacy configured primary crypto-readiness marker, not the browser-local research workflows or the independent VA-account session store.

`components.runtime` aggregates every control that depends on process-local state, so
"what does this deployment give up?" has one answer: `reduced` lists capability ids below
full strength, `capabilities` maps every id to its regime (including live VA access, the circuit
breaker, and the shared consumer budget), and `detail` states it in one
sentence. A distributed runtime without the consumer-budget opt-in reports all five as reduced;
that is expected, not degraded. The `scope`/`detail` shown inside `components.vaReferenceCache`,
`components.vaConsumerBudget` and
`components.rateLimit` are generated from the same report, so they cannot disagree with it, and
`components.rateLimit.ceiling.max` and `components.vaConsumerBudget.budget.maxRequests` are read
off the controls that actually enforce them, so the reported budget and the applied budget cannot
drift apart.

`components.cspReports` is how a deployed Content-Security-Policy regression becomes an operator-
readable fact instead of only a browser-console line. `/api/csp-report` redacts every violation
report to a bounded, content-free event and now keeps the last few minutes of them, per directive,
so `received > 0` names what is being blocked, how often, and when. It carries fact names and
counts only: the window is handed the directive/disposition pair, so no document URL, blocked URL,
source file, or report sample can reach this (public) payload. `scope` is always `process-local` — a
report is accepted by whichever instance served the POST, so another instance legitimately reports
its own window and a cold start forgets one — and `maxEvents`/`evicted` bound retention so a report
flood cannot grow the process. It is a **report, never a health failure**: a violation usually means
one page rendered under an unintended policy, not that the deployment cannot serve, so
`cspReports.status` is always `ok` and it is not part of the verdict below.

`components.vaConsumerBudget` reports the fleet's shared consumer budget (A03) in the three parts
an operator needs to tell "the budget is holding" from "there is no budget here". `scope` is
`fleet-shared` when every upstream attempt on this instance, including retries, reserves a slot in
the fleet's one rolling window before it reaches VA; `unenforced` when the runtime is distributed
and the `VA_SHARED_CONSUMER_BUDGET` opt-in or the coordinator is missing, in which case every
upstream attempt is refused outright and live VA access falls back to local reference data;
and `not-required` in a single-process runtime, where the per-instance outbound budget is the
whole budget. `budget` carries the bounds read off the module that enforces them,
`budget.optIn` and `store.blockedBy` name the missing prerequisite when it is unenforced, and
`store.distributed` records the runtime classification the verdict came from.

`pressure` is the reading that makes throttling visible before VA answers `429`. `refused` counts
the upstream attempts this instance refused, `refusals` breaks them down by reason — `exhausted`
is the budget working, while `superseded-window`, `predecessor-invalid`, `unreadable-decision`,
`counter-lifetime-refused`, `store-unconfigured`, `store-unreachable` and `clock-unusable` are the
budget failing closed, which is a different operator problem — and `refusedInLastWindow` with
`lastRefusalAt`/`lastRefusalReason` says whether that is happening now or happened earlier.
`pacing.chargedReservations` is the earliest warning of all: it counts reservations charged
because the upstream's own `ratelimit-remaining` said less quota remains than the fleet's window
believes, so a non-zero value means VA has already told the fleet it is short. When the fleet is
being throttled, `refused` rises while `admitted` flattens and `refusedInLastWindow` is non-zero;
`docs/operations.md` carries the worked example under "Monitoring Consumer-Budget Pressure".

The counters are **per instance** (`pressure.scope` says so) and reset on cold start, so two
instances do not add up to a fleet total without the operator adding them; a refusal is an event
rather than a rate, so any non-zero `refused` is true of the fleet as a whole. `admitted + refused`
is exactly the number of decisions this instance made, because the same statement that decides
also records it. The component is always `status: "ok"`: an exhausted or unenforced budget is the
documented degradation path, not a reason to take the deployment out of service.

`components.rateLimit.identity` and `components.rateLimit.store` record the two limits of this
control in one place: which hop of the forwarding header a per-client key comes from — the declared
ingress model (`RATE_LIMIT_TRUSTED_INGRESS`: `set` for an ingress that overwrites the header,
`append`/`append:N` for one that appends the observed peer at a known position from the right,
`unasserted` when nothing is declared) reported as `model`, `header`, `hop` and `hopsFromRight` —
and whether the counters are deployment-wide or process-local. The model is enforcement, not a
label: it selects the hop, so an operator can audit the claim by comparing the reported hop with
what the ingress writes, and an unreadable value falls back to `unasserted` and is reported as
such. `identity.unidentified` records what a request with **no** usable identity gets: under a
declared model it shares one class bucket per surface at that surface's own per-client limit
(`policy: "shared-per-client-bucket"`, key template `unidentified:<limiter>`), because declining
to present an identity must not be cheaper than presenting one; with no model declared it stays
`policy: "ceiling"`, since an identity-less request cannot then be told apart from an honest
client of a deployment whose headers never arrive. Neither is inferred from comments — see SEC-02 in
`docs/security-architecture-audit-2026-10-07.md` for the hosted evidence still owed.

`components.rateLimit.refusals` is why a refusal happened, counted because the `429` body
deliberately never says: one probe must not be able to tell the shared ceiling from a per-client
bucket. `byBudget.ceiling` rising with `ceilingShare` is aggregate pressure — many *different*
clients refused in one window, which is the shared ceiling being spent — while
`byBudget.perClient` is individual clients at their own limit, and `byBudget.unidentified` is the
class bucket bounding requests that presented no identity — a non-zero count there means the
declared ingress model and the edge it actually runs disagree, not that traffic is merely heavy.
It carries the surface label
(`method-post`, `reference-read`, or the matched route path) and the budget only: never the
client key, which is an address, because this payload is public. Read it as this instance's
decisions, not the fleet's — the window is process-local, resets on cold start, and never sees
a refusal the edge WAF answered itself, so a zero means "nothing was refused here in this
window", never "nothing was refused anywhere".

**Runtime**: `force-dynamic`, `nodejs`.

---

### `GET /api/regulatory/preflight`

Triggers a regulatory preflight cache refresh. Requires Bearer token authentication (`REGULATORY_SYNC_SECRET` or `CRON_SECRET`). Rate-limited to 5 requests/minute per IP.

**Headers**:
- `Authorization: Bearer <REGULATORY_SYNC_SECRET>`

**Response** (`200 OK`):
```json
{
  "ok": true,
  "snapshotId": "abc123",
  "finishedAt": "2026-09-13T22:00:00.000Z",
  "freshness": "current",
  "reviewMode": true,
  "legalRegulatoryConclusionsAllowed": false,
  "changeCount": 3,
  "relevantChangeCount": 1
}
```

**Response** (`401 Unauthorized`):
```json
{ "ok": false, "error": "Unauthorized regulatory sync request." }
```

**Response** (`429 Too Many Requests`): Rate-limited by application-level limiter.
```json
{ "ok": false, "error": "Rate limit exceeded. Please try again later." }
```

**Runtime**: `force-dynamic`, `nodejs`.

---

## Server Actions

Two Server Actions remain, both bounded public-reference operations that persist no Veteran workflow state: the accredited-representative directory lookup (redirects with its lookup result or a fixed validation code) and the Forms Finder search (`searchVaFormsFinder`, which returns its result as action state so the visitor's search text is never placed in a URL — audit A01). The separate VA-account sandbox uses same-origin Route Handlers, not these Server Actions.

> **PRIV-01 (2026-10-07 and 2026-10-08):** both secondary and presumptive research workflows now validate and persist state in versioned, browser-local records. Private context does not reach the server, and the retired secondary, scenario, and presumptive Server Actions are gone. The browser-local contracts follow.

### Validation Error Codes

Client-side validation for the secondary workflow uses these codes (defined in `src/lib/secondary-workflow/validation.ts`):

| Code | Message | Triggered by |
|---|---|---|
| `select-diagnosed` | Select at least one diagnosed condition to continue. | `applyDiagnosedStep`, `applyServiceConnectedStep`, `applyDocumentsStep` |
| `answer-service-connected` | Choose Yes or No for every diagnosed condition before continuing. | `applyServiceConnectedStep` |
| `no-service-connected` | This secondary workflow needs at least one condition already recognized as service connected. | `applyServiceConnectedStep`, `applyRatingsStep` |
| `select-rating` | Choose a current rating or I prefer not to answer for every service-connected condition. | `applyRatingsStep` |
| `invalid-rating` | Use a whole-number rating from 0 through 100, or choose I prefer not to answer. | `applyRatingsStep` |
| `select-documents` | Choose whether document availability should be reflected in the checklist. | `applyDocumentsStep` |
| `invalid-context` | Optional medication and treatment context is limited to 20 entries per field and 160 characters per entry. | `applyDocumentsStep` |
| `context-too-large` | There is not enough room to save this many selections and context entries. | Schema-bound overflow (`persistStepResult`) |
| `storage-unavailable` | This browser could not save your progress locally. Check that storage is enabled for this site and that the browser is not out of space, then try again. | Blocked or refused browser storage (`persistStepResult`) |

Codes render inline on the current step (`role="alert"`). Only cross-step guidance (`no-service-connected`, `select-diagnosed`) still travels as a `?error=<code>` URL parameter, with no context in the URL.

---

### Secondary workflow (browser-local — no Server Actions)

**PRIV-01 stage 2**: the six step forms validate and persist entirely in the browser. There is no request carrying any field below; the server only serves uniform public data (the client corpus and public regulatory/VA references).

**Client step logic** — `src/lib/secondary-workflow/client-steps.ts`:

| Function | Fields it reads | Success | Validation errors |
|---|---|---|---|
| `applyDiagnosedStep` | `diagnosed` (`string \| string[]`, ≥1 catalog ID) | Replaces the record with the diagnosed list; next `/secondary/service-connected` | `select-diagnosed` |
| `applyServiceConnectedStep` | `serviceConnected-{id}` (`"yes"`/`"no"` per diagnosed condition) | Writes diagnosed + service-connected + empty ratings; next `/secondary/ratings` | `select-diagnosed`, `answer-service-connected` (partial answers persist as `serviceConnectedAnswerDraft`), `no-service-connected` (persists an empty service-connected list plus the draft) |
| `applyRatingsStep` | `rating-{id}` (`0`–`100` integer or `"decline"`) | Writes diagnosed + service-connected + ratings; next `/secondary/upload` | `no-service-connected`, `select-rating`, `invalid-rating` |
| `applyDocumentsStep` | `documentsShared` (`"yes"`/`"no"`), `medications`, `treatments`, `history` (newline-separated, max 20 entries × 160 chars), `symptomIds`, `onsetYear-{id}`, `diagnosisYear-{id}` | Writes the full bounded context; next `/secondary/suggestions` | `select-documents`, `invalid-context`, `select-diagnosed` |

**Persistence** — `src/lib/secondary-workflow/browser-context.ts` (Zod-bounded, versioned record) in `sessionStorage` under `secondary-condition-finder:secondary-workflow:v1`. A failed write never navigates: `persistStepResult` maps a schema-bound overflow to `context-too-large` and a blocked or refused storage write to `storage-unavailable`; the step holds the user in place.

**Completion** — the Finish Review / Start a new review controls in `src/components/secondary/SecondaryWorkflowCompletionActions.tsx` clear every registered browser-local key (`clearSecondaryWorkflowLocalState`) and only then navigate to `/secondary` or `/secondary/diagnosed`. A failed cleanup surfaces an error instead of navigating. The controls also carry the shared privacy-request pointer (`src/components/privacy/PrivacyDeletionCue.tsx`, destination `PRIVACY_INTAKE_PATH`), because the data a deletion request reaches is not the browser-local state these controls clear; the presumptive track's saved-service-history control renders the same pointer, so the destination and the distinction are stated once.

**Recommendation engine** — Steps 5 and 6 run `recommend()` in the browser over the public corpus at `/kb/client-corpus.json` (`src/lib/client-corpus/`, generated by `npm run build:client-corpus`). Regulatory relevance filtering also runs locally (`relevantChangesForConditionIds`), so the scope-free server snapshot never sees the selections.

---

### Presumptive workflow (browser-local — no Server Action, since 2026-10-08)

The `saveServiceHistory` Server Action and its sealed-cookie session module are
deleted. Confirmed service branch, location and date fields are validated and
stored by `persistServiceHistory(storage, draft, knownLocations)` in
`src/lib/presumptive/browser-history.ts`, which writes
`presumptive-condition-finder:service-history:v1` in tab-scoped `sessionStorage`
and performs no request.

**Input fields** (rendered by `src/components/ServiceHistoryForm.tsx` and the
DD-214 verification step; they are read from component state, never posted):
| Field | Type | Required | Description |
|---|---|---|---|
| `serviceBranchCode` | `string \| string[]` | No | One or more two-letter military branch codes (administrative reference only). |
| `location` | `string \| string[]` | Yes | At least one location, from the authored exposure catalog. |
| `serviceStart` | `string` | No | Service start date (ISO 8601 date string). |
| `serviceEnd` | `string` | No | Service end date (must not precede `serviceStart`). |

**Success**: the caller navigates to `/presumptive/results`, which reads the
record in the browser.
**Failure codes** (`ServiceHistoryFailureCode`, surfaced as an inline `role="alert"`
on `/presumptive` — there is no `?error=` transport any more):
- `select-location`: No locations selected, or a location outside the authored catalog.
- `date-order`: End date before start date.
- `invalid-date`: Invalid date format.
- `storage-unavailable`: the browser refused the write; the caller must not continue.

**Clearing**: `/presumptive/results` renders a “Clear saved service history” control
(`src/components/presumptive/PresumptiveResults.tsx`) that calls
`clearPresumptiveLocalState(storage)` for every registered key and then navigates
to `/presumptive`. Beside it, the same shared privacy pointer the secondary
completion controls render (`src/components/privacy/PrivacyDeletionCue.tsx`)
states what that control did and what it cannot do: clearing removes this
browser's copy, and the data the application itself keeps is deleted through the
published intake (`PRIVACY_INTAKE_PATH`). Guarded by
`tests/privacy-deletion-pointer.test.tsx`.

**The flow's one server call**: the accredited-representative finder on
`/presumptive/results` posts `zip` / `radiusMiles` / `type` **in the request body** to
the public VA directory (see
[Accredited representatives](#accredited-representative-finder)). It carries no
service history, and it is not a navigation — the ZIP never becomes a query value.

---

### Scenario launcher (browser-local — no Server Action)

**PRIV-01 stage 2**: `src/components/ScenarioLaunchForm.tsx` loads a pre-built synthetic scenario from `data/demo-scenarios.json` entirely in the browser.

1. Look the scenario up by its bundled `scenarioId`; validate the workflow through `parseWorkflowState(workflowSessionToQueryParams(workflow), catalog)` against the public client corpus.
2. Clear every prior browser-local key, then write the validated state into the browser-local context record.
3. Navigate to `/secondary/suggestions`.

An unknown id or invalid state surfaces an inline error; nothing is sent to the server and no workflow data is placed in a URL.

---

### Forms Finder Action (`src/lib/actions/va-forms-finder.ts`)

#### `searchVaFormsFinder(previousState, formData)`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `q` | `string` | Yes | Public form number, keyword, or title. Trimmed and bounded to `FORMS_FINDER_QUERY_MAX_LENGTH` (120); a whole-input identifier is refused by the loader. |

**Success**: returns `{ view, refusal: null }` — the same `VaFormsFinderView` the loader produces, rendered by the client component. It returns state instead of redirecting precisely so the URL never carries the search text (audit A01).

**Refusal**: returns `{ view: <default view>, refusal }` with `refusal` one of `oversized-value` or `phi-shaped-field`; the submitted text is never echoed in the response body, and no field name or value from the request is reflected. Input is validated through the PHI-free Server Action contract (`src/lib/security/phi-free-action-input.ts`).

**Rate limiting**: a POST to `/va-forms/finder` consumes both the method-scoped POST bucket and the shared reference-read bucket (`src/proxy.ts`), because the request still reaches the VA reference loader.

### Accredited Representative Action (`src/lib/actions/accredited-representatives.ts`)

#### `searchAccreditedRepresentatives(previousState, formData)`

Validates public-directory lookup fields and returns the directory view as **action state**. It
does not redirect, so a searched ZIP never enters the page URL, browser history, a copied link, or
the hosting request line (audit A01).

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `zip` | `string` | Yes | 5-digit US ZIP code. |
| `radiusMiles` | `string` | No | Search radius: `"25"`, `"50"`, or `"100"`. |
| `type` | `string` | No | Representative type: `"VSO"`, `"agent"`, or `"attorney"`. |
| `returnTo` | `string` | No | Page that renders the finder. Used **only** to attribute the audit event — it is never concatenated into a URL. Allowlisted; anything else falls back to `/secondary/suggestions`. |

**Success**: returns `{ view, error: null }` — the same `AccreditedRepresentativeView` the loader
produces, rendered by the client component. The surface renders the returned view in place, with no
navigation and no history rewrite.

**Refusals**: return `{ view: null, error }` with a fixed code — `invalid-zip`, `invalid-radius`,
`invalid-type`, or `refused` (the PHI-free Server Action contract). No submitted value or key is
ever echoed, and a refusal clears any previously rendered result rather than leaving it on screen.

**Rate limiting**: a POST to `/secondary/suggestions`, `/secondary/evidence`, or
`/presumptive/results` consumes both the method-scoped POST bucket and the shared reference-read
bucket (`src/proxy.ts`), because the request still reaches the directory loader.

**Upstream (unclosed half of A01)**: while live VA access is enabled, the ZIP is still sent to the
configured VA accredited-representative directory as a query parameter. That request is the
upstream contract; host/CDN retention for whichever requests the operator runs remains an operator
review.

---

### `POST /api/admin/cache-clear`

Clears the process-local VA reference cache and, when a shared KV is configured, advances the store-wide shared-cache invalidation epoch so every instance discards previously cached shared entries immediately. Requires Bearer token authentication (`REGULATORY_SYNC_SECRET` or `CRON_SECRET`). Rate-limited to 5 requests/minute per IP.

**Headers**:
- `Authorization: Bearer <CRON_SECRET>`

**Query parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `prefix` | `string` | No | Only clear process-local entries whose key starts with this prefix (e.g., `forms-finder:`). If omitted, clears all entries. The shared-tier epoch bump is always store-wide. |

**Response** (`200 OK`):
```json
{
  "ok": true,
  "cleared": 5,
  "prefix": null,
  "scope": "process-local",
  "detail": "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
  "sharedInvalidation": "applied",
  "sharedEpoch": "1",
  "message": "Cleared all 5 cache entries. Advanced shared-cache invalidation epoch to 1."
}
```

`sharedInvalidation` is `applied`, `not-configured` (no shared KV), or `failed` (coordinator unreachable; stale shared entries then persist until their 5-minute TTL). `sharedEpoch` is the new epoch string or `null`.

**Response** (`200 OK` with prefix):
```json
{
  "ok": true,
  "cleared": 2,
  "prefix": "forms-finder:",
  "scope": "process-local",
  "detail": "process-local LRU on this instance only; entries reset on cold start and are not shared with other instances",
  "sharedInvalidation": "not-configured",
  "sharedEpoch": null,
  "message": "Cleared 2 cache entries with prefix \"forms-finder:\"."
}
```

**Response** (`200 OK`, cache disabled in this runtime):
```json
{
  "ok": true,
  "cleared": 0,
  "prefix": null,
  "scope": "disabled",
  "detail": "process-local cache is disabled in production and distributed runtimes until a shared cache coordinator is configured; reads always miss, writes are discarded, so the hit/miss counters cannot move and cache-clear operations clear nothing",
  "message": "VA reference cache is disabled in this runtime, so nothing was cleared. ..."
}
```

`scope: "disabled"` means the process-local cache is structurally unable to hold
anything here, so the call cleared nothing by design rather than because the cache
happened to be empty. Callers that expect a real flush should key off `scope`, since
`{ "ok": true, "cleared": 0 }` is also exactly what a working but cold cache returns.
The status stays `200` because the request itself was authorized and handled; the
disclosure is in the body rather than in the status code.

**Response** (`401 Unauthorized`):
```json
{ "ok": false, "error": "Unauthorized cache-clear request." }
```

**Response** (`429 Too Many Requests`): Rate-limited by application-level limiter.
```json
{ "ok": false, "error": "Rate limit exceeded. Please try again later." }
```

**Note**: The prefix-scoped clear only applies to the process-local cache on the instance that handles the request; other instances retain their in-memory entries until TTL expiry. Shared-tier entries written before the request are invalidated fleet-wide by the epoch bump, or — when `sharedInvalidation` is `failed` — remain readable until their TTL expires.

**Runtime**: `force-dynamic`, `nodejs`.

---

## Rate Limiting

Application-level rate limiting is enforced in `src/proxy.ts` (defense-in-depth behind Vercel's edge WAF):

| Route | Window | Max | Key |
|---|---|---|---|
| Server Action POSTs (and every other POST) | 60s | 30 | IP (`X-Forwarded-For`, then `X-Real-IP`) |
| `/api/regulatory/preflight` | 60s | 5 | IP |
| `/api/admin/cache-clear` | 60s | 5 | IP |
| `/api/health` | 60s | 30 | IP |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.
The `429` body is route-specific: `{ "ok": false, "error": "Rate limit exceeded. Please try again later." }`
for `/api/regulatory/preflight` and `/api/admin/cache-clear`, `{ "status": "rate_limited" }`
for `/api/health`, and `{ "error": "Too many requests. Please try again later." }` for the
method-scoped `POST` rule.

A request without a usable IP identity is still charged to the named shared admission
ceiling, so missing or invalid identity does not bypass all limits. Attributed requests
also charge that ceiling in addition to their per-client bucket. All buckets remain
process-local and reset on cold start; `/api/health` reports the declared ingress model
(which hop is the key), the aggregate ceiling, and the store regime in
`components.rateLimit.identity|ceiling|store`. A refusal's reason — the shared ceiling or the
client's own bucket — is counted per instance and reported as `components.rateLimit.refusals`
(15-minute window, at most 256 retained events and 12 reported surface rows, no client address
in the payload), which is what makes ceiling saturation alertable instead of inferred from a
`429` count. Forwarding headers are trustworthy only
when the deployment ingress strips client-supplied values, and the deployment declares
which model it runs — `set` (the ingress overwrites the header) or `append`/`append:N`
(the ingress appends the observed peer, which is then read from the right, and
`X-Real-IP` is not an identity); with no declaration the leftmost hop is read, which is
correct only for an ingress that overwrites. The application cannot verify the edge from
inside: declaring a model moves *which* end is trusted and makes the claim auditable, it
does not prove the edge behaves that way. Hosted, multi-instance and direct-origin
behavior remain deployment checks.

---

## Security Notes

- The secondary and presumptive workflows keep private context in versioned, schema-bounded, tab-scoped browser records; no workflow cookie is set and private fields are refused if submitted to a server route/action.
- `GET /api/health` checks configured primary-secret crypto readiness and reports component/rate-limit status. Its `sessionCrypto` subcheck is an ephemeral primitive test; neither field checks research-workflow persistence or the optional VA-account session store.
- The regulatory preflight endpoint requires **Bearer token authentication**.
- No API endpoint transmits Veteran workflow context to external services. The optional VA sandbox account flow is a separate, disabled-by-default server-side token/session experiment.
