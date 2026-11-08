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
