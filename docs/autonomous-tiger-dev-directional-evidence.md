# Autonomous Tiger Cloud DEV directional-evidence campaign

**Research-only. No clinical approvals, VA nexus decisions, medical content publication, private patient data, or Production migration.**

## Confirmed scope

After merged PR #664, Secondary Condition Finder has 819 authored conditions, 875 directed pathways, and 1,704 reference links. The first unattended research scope contains **48 directional causation/aggravation pathways**, including the **21 published mappings using individualized probability alignment**, and **94 citation links covering 90 unique PubMed IDs**.

A live E-utilities pilot resolved all 90 original PMIDs and found new candidate articles for 21 of the 48 pairwise searches, 100 distinct PMID candidates. Those are only research leads, not source-to-claim or causation verifications. The collector also retrieves bounded bibliographic metadata for newly discovered candidates.

## GitHub Actions scheduling

Workflow: `.github/workflows/tiger-dev-directional-evidence.yml`

- Runs at **02:23, 08:23, 14:23, and 20:23 UTC daily**, and supports `workflow_dispatch`.
- Only `main` can run it: the GitHub `tiger-dev-research` environment has a `main`-only deployment-branch policy.
- `GITHUB_TOKEN` has `contents: read` only. No issue/PR writes, merges, medical approvals or production publication.
- One run at a time; scheduled events cannot cancel an ongoing run.
- Downloads the official pinned **MONDO v2026-10-06** ontology with SHA-256 verification, rebuilds Batch 1's 819/875 review ledger and contradiction signals, runs tests, then checks PubMed.
- Public NCBI E-utilities metadata and fixed Title/Abstract study discovery only. 550 ms minimum request pacing, timeouts, bounded retries, no raw abstract copying and no unrestricted patient queries.
- Inserts a content-addressed research snapshot into the dedicated Tiger Cloud DEV schema and performs independent READ ONLY exact-row verification.
- Saves a GitHub Actions run summary and JSON/CSV/Markdown artifacts (30-day retention).
- Starts running automatically **once the workflow PR has been reviewed and merged to the default branch**. Opening a draft PR is not sufficient.

GitHub can delay or occasionally drop scheduled executions. Inspect Actions history after activation. The workflow does not auto-stop just because source metadata resolves: **clinical review remains outstanding**.

## Security

Existing DEV Tiger service: `secondary-condition-finder-test`, ID `m8vrpmo6ec`, port `30902`, `tsdb` database, verified TLS. Never uses PROD-tagged `db-41579` or Vercel Production.

Dedicated role `scf_evidence_ci_writer` is restricted to schema `scf_autonomous_evidence_dev`. Verified privileges: **SELECT, INSERT allowed; schema CREATE, UPDATE, DELETE denied**. No role/database creation. Credentials are stored in a Mac Keychain item and as encrypted GitHub Actions environment-only secret `TIGER_AUTOMATION_DEV_URL`. The secret is not exposed in source, logs, the PR, or artifacts. A one-time operator script, `scripts/automation/setup-evidence-dev.mjs`, provisions schema/role; GitHub Actions never runs it.

Database tables:

- `runs`: hashed immutable research run identity, source-ledger/git provenance, observation time, and `NOT_GRANTED / RESEARCH_REVIEW_ONLY` status.
- `pubmed_articles`: PMID, metadata title/date/DOI, publication type/status, checksum, compulsory `NOT_ASSESSED` clinical support.
- `pathway_reviews`: source/target, pre-existing nexus label, original and newly discovered PMIDs, contradiction rules, source status, checksum, and compulsory `HUMAN_REVIEW_REQUIRED`.

Import uses parameterized SQL, transactions, advisory locks, idempotent run keys, tight timeouts and exact source-to-database comparison. No uncertain write is blindly replayed. A previous-run comparison detects metadata changes and newly resolved PMIDs.

## Local operator commands

From the reviewed repo branch, with Node 22 and Python 3.12+:

```sh
npm ci
python3 scripts/lib/fetch-mondo-dev.py
python3 scripts/lib/prepare-mondo-dev.py
python3 scripts/lib/build-clinical-review-ledger.py
python3 -m unittest discover -s tests -p 'test_clinical_review_rules.py'
python3 -m unittest discover -s tests -p 'test_directional_evidence_campaign.py'
node --test tests/clinical-review-batch1.test.mjs
node --test tests/tiger-autonomous-evidence.test.mjs
python3 scripts/automation/directional_evidence_campaign.py \
  --out /tmp/scf-autonomous-directional-evidence
# Dedicated DEV connection environment secret required for the next two steps:
node scripts/automation/tiger-evidence-dev.mjs apply --dev-write
node scripts/automation/tiger-evidence-dev.mjs verify
```

The public artifacts contain `evidence-run.json`, `directional-evidence-review.csv`, `summary.json` and `report.md`. Full batch results are available in GitHub Actions and the isolated Tiger DEV schema; failures are reported as unavailable, not source verification.

## Human review / publication gate

Success at resolving 90+ bibliographic records **is not a medically verified nexus**. Qualified reviewers must inspect the original published research, directionality, study design, potential confounding, relevance to the precise medical condition and competing evidence. Existing VA individual-probability language must be reviewed separately from general population studies. New candidates remain unassessed.

No clinical status can be changed by this workflow; any corrections require a separate evidence-backed, reviewed medical-content PR and publication approval. Prioritize the **21 published high-priority pathways**, then the remaining directional pathways and ontology/citation queues.

## Credit utilization

Tiger's existing DEV test service was 2 vCPU / 8 GB RAM; the separate fixture source 0.5 vCPU / 2 GB; the unrelated PROD-tagged service 8 vCPU / 32 GB. Tiger bills running configured compute, including idle hours. Robust benchmarks and extra DEV compute can be valuable, but only after independently confirming the actual credit balance, expiration and overage terms. This setup does not increase PROD capacity or provision idle services just to exhaust expiring credits.

Reference: https://www.tigerdata.com/docs/deploy/tiger-cloud/tiger-cloud-aws/pricing-and-account-management
