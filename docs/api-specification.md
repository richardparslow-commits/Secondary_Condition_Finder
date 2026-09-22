# API Specification

This document describes the request/response contracts for all API endpoints and Server Actions in the application.

---

## API Endpoints

### `GET /api/health`

Health check endpoint used by Vercel's monitoring and the production readiness workflow. Returns component-level status for catalog, session crypto, VA API config, and circuit breaker state.

**Response** (`200 OK` when healthy, `503 Service Unavailable` when degraded):

```json
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
      "hits": 42,
      "misses": 8,
      "hitRate": 84
    }
  },
  "latencyMs": 18,
  "timestamp": "2026-09-13T22:00:00.000Z"
}
```

**Healthy** (`200`): `catalog.status === "ok"` AND `sessionCrypto.status === "ok"`.
**Degraded** (`503`): Either `catalog` or `sessionCrypto` is `"error"`.

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

All Server Actions are defined in `src/lib/actions/` and invoked via Next.js form submissions (`<form action={...}>`). They all:

1. Accept a `FormData` parameter
2. Validate input
3. Write to the encrypted workflow session cookie (or redirect with an error)
4. Redirect to the next workflow step on success
5. Emit an audit log entry on success or failure

**Error handling pattern**: On validation failure or session write failure, the action redirects to the originating step with a `?error=<code>` query parameter. The page reads the error code and displays a user-facing message.

### Validation Error Codes

All secondary workflow actions share these validation codes (defined in `src/lib/secondary-workflow/validation.ts`):

| Code | Message | Triggered by |
|---|---|---|
| `select-diagnosed` | Select at least one diagnosed condition to continue. | `saveDiagnosedSelection`, `saveServiceConnectedSelection` |
| `answer-service-connected` | Choose Yes or No for every diagnosed condition before continuing. | `saveServiceConnectedSelection` |
| `no-service-connected` | This secondary workflow needs at least one condition already recognized as service connected. | `saveServiceConnectedSelection`, `saveRatingsSelection` |
| `select-rating` | Choose a current rating or I prefer not to answer for every service-connected condition. | `saveRatingsSelection` |
| `invalid-rating` | Use a whole-number rating from 0 through 100, or choose I prefer not to answer. | `saveRatingsSelection` |
| `select-documents` | Choose whether document availability should be reflected in the checklist. | `saveDocumentsSelection` |
| `invalid-context` | Optional medication and treatment context is limited to 20 entries per field and 160 characters per entry. | `saveDocumentsSelection` |

---

### Secondary Workflow Actions (`src/lib/actions/secondary.ts`)

#### `saveDiagnosedSelection(formData)`

Saves the user's diagnosed condition selections.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `diagnosed` | `string \| string[]` | Yes | One or more condition IDs from the catalog. |

**Success**: Redirects to `/secondary/service-connected`.
**Validation errors**: `select-diagnosed` → `/secondary/diagnosed?error=select-diagnosed`.
**Session write failure**: Same as validation error (does not advance).

---

#### `saveServiceConnectedSelection(formData)`

Saves which diagnosed conditions are service-connected.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `serviceConnected-{id}` | `"yes" \| "no"` | Yes (per diagnosed condition) | Whether each diagnosed condition is service-connected. |

**Success**: Redirects to `/secondary/ratings`.
**Validation errors**:
- Missing diagnoses → `select-diagnosed` → `/secondary/diagnosed`
- Incomplete answers → `answer-service-connected` → `/secondary/service-connected`
- All "no" → `no-service-connected` → `/secondary/service-connected`

---

#### `saveRatingsSelection(formData)`

Saves disability ratings for service-connected conditions.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `rating-{id}` | `string` | Yes (per service-connected condition) | Rating as integer 0-100, or `"decline"` to skip. |

**Success**: Redirects to `/secondary/upload`.
**Validation errors**:
- No service-connected conditions → `no-service-connected`
- Missing rating → `select-rating`
- Invalid rating (not 0-100 integer, not "decline") → `invalid-rating`

---

#### `saveDocumentsSelection(formData)`

Saves document availability and optional context (medications, treatments, history).

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `documentsShared` | `"yes" \| "no"` | Yes | Whether the user has documents to share. |
| `medications` | `string` | No | Newline-separated list of medications (max 20 entries, 160 chars each). |
| `treatments` | `string` | No | Newline-separated list of treatments (max 20 entries, 160 chars each). |
| `history` | `string` | No | Newline-separated list of history items (max 20 entries, 160 chars each). |

**Success**: Redirects to `/secondary/suggestions`.
**Validation errors**: `select-documents`, `invalid-context`.

---

#### `finishSecondaryWorkflow()`

Clears the secondary workflow session and redirects to the landing page.

**Form fields**: None.
**Success**: Redirects to `/secondary`.

---

#### `restartSecondaryWorkflow()`

Clears the secondary workflow session and restarts from the diagnosed step.

**Form fields**: None.
**Success**: Redirects to `/secondary/diagnosed`.

---

### Presumptive Workflow Actions (`src/lib/actions/presumptive.ts`)

#### `saveServiceHistory(formData)`

Saves service branch, location, and date information for presumptive eligibility matching.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `serviceBranchCode` | `string \| string[]` | Yes | One or more two-letter military branch codes. |
| `location` | `string \| string[]` | Yes | At least one location code (e.g., country or theater code). |
| `serviceStart` | `string` | No | Service start date (ISO 8601 date string). |
| `serviceEnd` | `string` | No | Service end date (must be after `serviceStart`). |

**Success**: Redirects to `/presumptive/results`.
**Validation errors** (via `?error=` query param on `/presumptive`):
- `select-location`: No locations selected.
- `date-order`: End date before start date.
- `invalid-date`: Invalid date format.

---

### Scenario Actions (`src/lib/actions/scenarios.ts`)

#### `launchDemoScenario(formData)`

Loads a pre-built demo scenario and populates the secondary workflow session.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `scenarioId` | `string` | Yes | Scenario ID (1-80 chars, lowercase alphanumeric + hyphens). |

**Success**: Redirects to `/secondary/suggestions`.
**Validation errors**: Invalid or unknown scenario ID → redirect to `/scenarios`. Scenario state that fails parsing or session-write validation → redirect to `/scenarios?error=invalid_state` (never an unhandled server error).

---

### Accredited Representative Actions (`src/lib/actions/accredited-representatives.ts`)

#### `searchAccreditedRepresentatives(formData)`

Redirects to the suggestions page with query parameters for the accredited representative locator.

**Form fields**:
| Field | Type | Required | Description |
|---|---|---|---|
| `zip` | `string` | Yes | 5-digit US ZIP code. |
| `radiusMiles` | `string` | No | Search radius: `"25"`, `"50"`, or `"100"`. |
| `type` | `string` | No | Representative type: `"VSO"`, `"agent"`, or `"attorney"`. |
| `returnTo` | `string` | No | Return URL (default: `/secondary/suggestions`). |

**Success**: Redirects to `{returnTo}?zip={zip}&radiusMiles={radius}&type={type}`.
**Validation errors**:
- Invalid ZIP → `{returnTo}?error=invalid-zip`
- Invalid radius → `/secondary/suggestions?error=invalid-radius`
- Invalid type → `/secondary/suggestions?error=invalid-type`

---

### `POST /api/admin/cache-clear`

Clears the process-local VA reference cache. Requires Bearer token authentication (`REGULATORY_SYNC_SECRET` or `CRON_SECRET`). Rate-limited to 5 requests/minute per IP.

**Headers**:
- `Authorization: Bearer <CRON_SECRET>`

**Query parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `prefix` | `string` | No | Only clear entries whose key starts with this prefix (e.g., `va-forms:`). If omitted, clears all entries. |

**Response** (`200 OK`):
```json
{
  "ok": true,
  "cleared": 5,
  "prefix": null,
  "message": "Cleared all 5 cache entries."
}
```

**Response** (`200 OK` with prefix):
```json
{
  "ok": true,
  "cleared": 2,
  "prefix": "va-forms:",
  "message": "Cleared 2 cache entries with prefix \"va-forms:\"."
}
```

**Response** (`401 Unauthorized`):
```json
{ "ok": false, "error": "Unauthorized cache-clear request." }
```

**Response** (`429 Too Many Requests`): Rate-limited by application-level limiter.
```json
{ "ok": false, "error": "Rate limit exceeded. Please try again later." }
```

**Note**: This only clears the process-local cache on the specific instance that handles the request. In a serverless environment, other instances retain their cache until TTL expiry.

**Runtime**: `force-dynamic`, `nodejs`.

---

## Rate Limiting

Application-level rate limiting is enforced in `src/proxy.ts` (defense-in-depth behind Vercel's edge WAF):

| Route | Window | Max | Key |
|---|---|---|---|
| Server Action POSTs | 60s | 30 | IP (`X-Forwarded-For`) |
| `/api/regulatory/preflight` | 60s | 5 | IP |
| `/api/admin/cache-clear` | 60s | 5 | IP |
| `/api/health` | 60s | 30 | IP |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

---

## Security Notes

- All Server Actions write to an **encrypted, authenticated session cookie** (not localStorage). See `src/lib/workflow-session-crypto.ts`.
- The health endpoint uses an **ephemeral secret** for crypto probing — it never depends on production env config.
- The regulatory preflight endpoint requires **Bearer token authentication**.
- No API endpoint transmits Veteran PII to external services. All workflow state is browser-local or cookie-encrypted.
