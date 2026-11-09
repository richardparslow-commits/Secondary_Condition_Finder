# Tiger Cloud → Vercel Preview read-only probe

This integration is a **diagnostic only**, not a migration or a new persistence
layer. The application continues to load its checked-in condition catalog.
The Mac's Codex MCP server (`tiger_db41579`) is separate from Vercel serverless
runtime access; the latter uses its own server-only PostgreSQL connection URL.

## Configuration

Configure **Preview only** in the Vercel project
`secondary-condition-finder`:

- `TIGER_DATABASE_URL`: Vercel Secret with the dedicated
  `preview_catalog_reader` login for Tiger service `yc5kzxwazj`
  (`db-41579`), database `tsdb`, port `37615`, `sslmode=require`.
  Never use `tsdbadmin` or place the URL in source, client bundles or logs.
- `TIGER_CATALOG_PROBE_TOKEN`: independent random bearer token, at least
  32 characters, also scoped **Preview only**. Do not reuse a workflow,
  VA API, personal account or administrator secret.

No production environment variables, database roles or records are required.
The route itself checks `VERCEL_ENV=preview` and is inaccessible otherwise.
Restrict Preview deployment access with Vercel Deployment Protection as well.

## Operator invocation

`POST /api/internal/tiger-catalog-compare`

Send `Authorization: Bearer <TIGER_CATALOG_PROBE_TOKEN>` from an authorized
operator session. Use a tool that does not print the header in console or CI
logs. Do not use GET, put tokens in query strings, or check secrets into Git.

Responses:

- HTTP 200, `identities_match`: the connection succeeded and an existing
  `scf_tiger_lab.conditions` snapshot matched **every checked-in ID/name**.
  The term and edge counts are informational, not term/pathway parity proof.
- HTTP 409, `missing_tables`: the connection succeeded but one or more
  of `scf_tiger_lab.conditions`, `terms`, `edges` are absent.
- HTTP 409, `identities_mismatch`: catalog tables exist, but no tested
  snapshot has exactly the same condition IDs and names as the application.
- HTTP 503: missing or invalid settings, database/TLS/auth failure, or query
  failure. Error details and credentials are withheld.
- HTTP 404: non-Preview environment or missing/invalid bearer token.

Requests run within `BEGIN READ ONLY` and roll back without changing data.
Connection and query timeouts are bounded. The URL parser pins the Tiger
service, database, user, port and required TLS; certificates are verified.

## Scope of the result

This probe **does not** seed tables, create the `scf_tiger_lab` schema,
promote a deployment, merge a PR, migrate app data, process records, or send
VA traffic. The dedicated `db-41579` service may be empty. An HTTP 409 for
missing tables is therefore a valid, useful connection result and should not
be mistaken for a failed database login.

Existing separate DEV lab integration and its scripts under
`docs/tiger-cloud-catalog-tests.md` remain unchanged.
