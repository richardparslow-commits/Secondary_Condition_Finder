# Regulatory Intelligence v4 — Preflight Synchronization

## Purpose

Every substantive VA relationship review must establish a timestamped regulatory snapshot before recommendation output is generated. The snapshot separates current-law authority from pending rulemaking and policy-development signals, and it remains locked for the duration of the review.

## Live sources

The preflight checks these sources before a review begins:

1. **Federal Register API** — VA documents published since the prior successful snapshot (with a bounded overlap window). This is the discovery/structured-metadata source.
2. **OIRA EO 12866 reviews currently under review** — regulatory-development metadata only.
3. **OIRA EO 12866 reviews completed in the previous 30 days** — regulatory-development metadata only.
4. **Unified Agenda XML** — RIN/stage/planned-action metadata only. Planned dates retain their published precision; month-only dates are never converted into invented day values.
5. **OIRA stakeholder meetings** — bounded checks for active VA RINs; policy-development context only.
6. **Regulations.gov** — optional docket enrichment when `REGULATIONS_GOV_API_KEY` is configured. It is not required for legal freshness.

OIRA review records, Unified Agenda stages, and OIRA meetings are never promoted to binding authority. A proposed rule is never treated as current law merely because OIRA labels the action as being in a final-rule stage.

## Federal Register authenticity rule

FederalRegister.gov is used for discovery and normalized metadata. When a newly detected final/interim-final action could already be operative, the preflight attempts to verify the official Federal Register/GovInfo edition before allowing the app to rely on that change for a current-law conclusion.

If a potentially operative change cannot be officially verified, the review enters `medical-only` mode rather than silently treating the change as binding.

## Freshness states

Default maximum verified-cache age: **24 hours**.

- `current` — all required live checks succeeded and no unresolved official-edition verification blocks legal use. Review mode: `full`.
- `degraded` — either a required live source failed but a recent verified snapshot is available, or an authenticity gap was detected. A recent verified fallback permits `full-with-warning`; an unresolved current-law authenticity gap forces `medical-only`.
- `stale` — no sufficiently recent verified legal snapshot is available. Review mode: `medical-only`.

Clinical/medical relationship research may continue in `medical-only` mode, but the UI must not present current-law, effective-date, regulatory-status, or legal-eligibility conclusions as current.

## Snapshot locking

The preflight writes a bounded server-side snapshot cache. Once a review starts, Steps 5 and 6 use the same snapshot identifier. The app must not silently swap a newer legal snapshot into an in-progress review.

Snapshot files are review locks, so they are pruned by age (default **72 hours**), never by a newest-file count. Ordinary page loads by other visitors therefore cannot evict an in-progress review's legal basis.

If the locked snapshot has expired or otherwise disappears, that review is downgraded to `medical-only` with a visible warning. A new review can then establish a new regulatory snapshot.

## Review scope

Where the workflow has selected condition IDs, the snapshot records the subset of detected regulatory changes relevant to those conditions/claim theories/Diagnostic Codes. Unknown or incompletely mapped regulatory impacts remain visible for review rather than being automatically suppressed.

## Runtime configuration

- `REGULATORY_PREFLIGHT_MAX_AGE_HOURS` — cache freshness ceiling; default `24`.
- `REGULATORY_PREFLIGHT_SNAPSHOT_RETENTION_HOURS` — how long locked snapshots survive; default `72`, capped at one year.
- `REGULATORY_PREFLIGHT_SOURCE_TIMEOUT_MS` — per-source HTTP timeout; default `8000`.
- `REGULATORY_PREFLIGHT_CACHE_DIR` — optional server-local cache location; defaults to a bounded OS temporary directory.
- `REGULATIONS_GOV_API_KEY` — optional Regulations.gov docket enrichment.
- `REGULATORY_SYNC_SECRET` — bearer secret for the scheduled refresh endpoint. `CRON_SECRET` is accepted as a fallback.

## Scheduled refresh endpoint

`GET /api/regulatory/preflight` refreshes the generic VA regulatory cache when called with:

`Authorization: Bearer <REGULATORY_SYNC_SECRET>`

The route fails closed with HTTP 401 when the server has no configured secret or the supplied secret is wrong. It returns only regulatory snapshot metadata; it does not accept or log claimant data.

The route is scheduler-agnostic. No Vercel Cron configuration is added while the repository's Vercel deployment freeze is active.

## Security and resilience

- Network calls have explicit timeouts, response-size ceilings, no-store semantics, and bounded pagination.
- Regulations.gov keys are sent in `X-Api-Key`, not placed in query strings or logs.
- Cache writes are atomic and created with restrictive file permissions.
- Snapshot file names are validated before filesystem lookup.
- Source outages do not crash the medical workflow; they fail closed with respect to current-law conclusions.
- The preflight never sends claimant medical data to Federal Register, OIRA, or Regulations.gov. Review scope is used only after public regulatory records are retrieved.

## CI contracts

The regulatory CI workflow runs the Evidence Architecture, Regulatory Intelligence v3, and Regulatory Preflight v4 contract tests together. The v4 contracts specifically cover proposed-vs-binding status, Agenda date precision, OIRA non-authoritativeness, recent-cache degradation, stale-cache medical-only behavior, and official-edition verification fail-safe behavior.
