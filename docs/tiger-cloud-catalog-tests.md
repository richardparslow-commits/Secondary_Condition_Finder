# Secondary Condition Finder Tiger Cloud lab

The app serves versioned catalog and knowledge-base files. The Tiger lab checks that data and the application's exact lookup. The lab uses only condition IDs, names, normalized search terms, publication status and pathway edge identifiers and ranks. Keep veteran records, uploaded documents, credentials and VA API traffic outside this lab.

## Run the catalog checks

Use Node 24, Tiger CLI authenticated to the test project, and PostgreSQL's `psql` on your path. The runner checks the service name and development environment before it connects.

```sh
node scripts/test-tiger-catalog.mjs seed <fixture-source-service-id>
node scripts/test-tiger-catalog.mjs verify <destination-test-service-id>
```

Seed writes an immutable snapshot keyed by its content hash. Running seed again on the same input leaves that snapshot in place. Wait for the managed PostgreSQL source connector to copy the snapshot before running verify against the destination.

The connector maps `scf_tiger_lab.conditions`, `scf_tiger_lab.terms`, and `scf_tiger_lab.edges` from the dedicated fixture database. Use a dedicated replication login scoped to that database. The source tables use primary keys and foreign keys, and the verifier independently checks destination counts, row values, missing endpoints and exact lookup results.

Seed also installs child-side indexes on `edges(snapshot, target_id)` and `terms(snapshot, condition_id)`. The primary keys do not cover these foreign-key lookup prefixes. These indexes prevent full child-table scans when replacing or removing synthetic parent conditions under concurrent load. They stay installed after fixture cleanup; the replicated destination does not need these source-side foreign-key indexes.

The lookup probe set covers identifiers, names, aliases, case and whitespace variants, and deliberate misses. The reported application time measures in-memory lookup in one local Node process. Measure remote PostgreSQL throughput and latency separately through the direct and transaction-pooled connections.

## Management connection reliability

Use the current official Tiger CLI (`brew upgrade --cask tiger-cli` for this installation). Automated runs disable startup update checks. The runner validates the designated service ID, name, DEV tag and readiness, resolves credentials once, then uses direct `psql` for SQL. Passwords stay in process memory and the child environment, not command arguments or reports.

Only temporary management read failures receive at most three attempts, with 45 seconds per attempt (longer than the CLI's documented 30-second HTTP timeout). Authentication failures, malformed responses and unknown errors fail closed. SQL is never automatically retried: a disconnect can leave the commit outcome uncertain. Inspect state before rerunning. Each SQL statement retains a 15-second limit; the local process is bounded at 120 seconds. No production setting is changed.

Historical campaign evidence is immutable. Its 18-second credential-resolution deadline and per-write `tiger db psql` calls are superseded by this runner; use this connection bootstrap for future campaign clients rather than copying those historical helpers. These safeguards address client fragility, not an assurance that Tiger's remote API cannot have an outage.

## Repeatable hypertable recovery drill (SCF-017)

```sh
node scripts/test-tiger-recovery.mjs m8vrpmo6ec /absolute/path/to/new-recovery-run
```

This fixed synthetic drill runs only on the designated DEV Timescale test service. It creates 10,000 synthetic audit rows across multiple daily chunks, saves the table definition, ordered CSV and checksum manifest, and removes only its own generated source schema. It recreates the hypertable in a fresh scratch schema, reloads the saved CSV in a transaction, and verifies the exact count, distinct IDs, content digest, primary key and hypertable status. The run rejects an empty schema-only restore and a truncated backup before it can claim success. Both scratch schemas are removed; local artifacts remain private. A pre-existing output directory is refused.

CSV export explicitly uses `COPY (SELECT ... FROM hypertable)`, which includes chunk data. A schema-only or parent-table-only dump is not a successful data backup. See [Tiger's individual-hypertable backup procedure](https://www.tigerdata.com/docs/deploy/self-hosted/backup-and-restore/logical-backup#back-up-and-restore-individual-hypertables).

This procedure covers this drill's known audit schema and data. It is not a generic backup tool for arbitrary schemas, roles, policies, continuous aggregates, compressed tables or a substitute for service-level backups/PITR. No production data, service settings or replicated catalog tables are changed. SQL is not automatically retried after ambiguous failures.
