# Tiger Cloud Preview-only catalog probe

This route is deliberately disabled in Production and local development.

- Vercel Preview sensitive variables: `TIGER_DATABASE_URL` (non-admin PostgreSQL URI), and `TIGER_PROBE_TOKEN` (32+ random characters).
- Request: `GET /api/internal/tiger-preview` with `Authorization: Bearer <TIGER_PROBE_TOKEN>` on an authenticated Preview deployment.
- Never send credentials to chat, logs, GitHub, or public issue/PR comments. Run requests from an authorized secret-capable environment.
- The route uses TLS certificate validation, short connection/query timeouts, a read-only transaction, and a fixed read-only catalog query.
- It verifies connection and role then reads the optional `scf_tiger_lab.conditions` fixture relation. If absent, it returns `connected_catalog_absent` (503), not a fabricated parity pass.
- A present relation is compared with checked-in condition IDs and names; the response contains only counts. It never seeds fixtures, migrates, writes data, or modifies Production.
- Note: Tiger CLI's separate experimental catalog test scripts can seed synthetic data into their designated lab service; this Preview endpoint **does not** invoke them.
- Any change to the database schema or catalog source must be reviewed before extending comparison.
