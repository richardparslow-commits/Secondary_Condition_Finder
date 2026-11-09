# Tiger Cloud DEV — autonomous PubMed expansion to the remaining 827 pathways

**Scope:** Research-only engineering continuation of the merged directional-causation audit. No clinical approval, personal nexus ruling, change to authored medical relationships or Production modification.

## Cohort and priorities

Secondary Condition Finder has **819 authored condition IDs** and **875 ranked secondary-condition pathways** in the currently pinned review ledger. The existing first campaign covers 48 causation/aggravation or published individualized-probability mappings.

This continuation covers the **827 other pathways** in nonoverlapping, deterministic order: first **227 published pathways**, next **480 draft pathways with clinical-reference or source-registry verification flags**, and then **120 other draft pathways**.

A pinned source-ledger SHA256 and ordered-selection SHA256 guard the cohort. There are eight batches of 100 pathways and a final batch of 27. The first two batches are entirely published; batch 2 contains the remaining 27 published pathways plus 73 citation-flagged drafts. No batch includes any of the initial 48.

All path selections are for bibliographic research. Publication-type status, a PubMed search hit, shared symptoms, a molecular pathway or source verified metadata **cannot independently verify a causal nexus**.

## Unattended runs

GitHub Actions workflow: `.github/workflows/tiger-dev-expanded-evidence.yml`.

- Four runs daily at **03:11, 09:11, 15:11, and 21:11 UTC**, staggered from the original 48-pathway workflow.
- A deterministic nine-slot rotation uses `(GITHUB_RUN_NUMBER - 1) % 9`. Failed/missed batches recur in subsequent rotations; user may also manually dispatch batch 0–8. **One successful run does not imply completion of all 827**.
- Each cycle checksum-verifies the pinned MONDO audit, rebuilds the original full 875-pathway contradiction ledger, executes regression tests, and performs bounded public PubMed research on exactly one expanded batch. Searches use 550 ms minimum spacing and bounded retries. No private medical information is submitted to external sources.
- Source metadata and all selected paths are stored as an immutable research run in the existing `scf_autonomous_evidence_dev` Tiger Cloud DEV schema via the existing least-privilege `scf_evidence_ci_writer` login. This login cannot CREATE, UPDATE, DELETE, change clinical verification states or access Production.
- The separate verification step runs `BEGIN READ ONLY` and compares every stored row with its source. The cumulative coverage report checks unique stored author IDs from the **same versioned ledger edition** against the original 875, and separates original 48 coverage from the remaining 827. Repeated batches do not increase distinct-coverage counts.
- A short read-only benchmark reports network-inclusive query latency. Reports and public-only files are retained as GitHub Actions artifacts for 30 days. A separate `issues: write` job tracks failed runs and clears the issue after subsequent green runs. Research code has `contents: read` only and cannot create PRs or merge.
- Publication-status concerns, API outages, missing PMID metadata and unsuccessful candidate searches are flagged for review rather than treated as confirmed medical findings. All outputs remain `NOT_ASSESSED` / `HUMAN_REVIEW_REQUIRED`.

## Operator commands

From a reviewed repository checkout on the authorized workstation:

```sh
npm ci
python3 scripts/automation/stage_pinned_ontology.py
python3 scripts/lib/build-clinical-review-ledger.py
python3 -m unittest discover -s tests -p 'test_expanded_evidence_campaign.py'
node --test tests/expanded-evidence-campaign.test.mjs

python3 scripts/automation/expanded_evidence_campaign.py \
  --batch-index 0 --out /tmp/scf-autonomous-expanded-evidence

# The following commands require the existing encrypted DEV-only database
# secret supplied by GitHub Actions. Never print, paste or commit credentials.
SCF_EVIDENCE_FILE=/tmp/scf-autonomous-expanded-evidence/evidence-run.json \
  node scripts/automation/tiger-evidence-dev.mjs apply --dev-write
SCF_EVIDENCE_FILE=/tmp/scf-autonomous-expanded-evidence/evidence-run.json \
  node scripts/automation/tiger-evidence-dev.mjs verify
node scripts/automation/expanded-evidence-coverage.mjs
python3 scripts/automation/check_evidence_health.py \
  --summary /tmp/scf-autonomous-expanded-evidence/summary.json
```

Completion of a nine-batch sweep depends on nine **successful** batch runs. GitHub scheduling can delay or miss executions; only an independent database coverage query proves 827/827 *research collection*. Full research metadata coverage is **not** medical validity. Clinical verification remains a separate qualified-human source-to-specific-claim assessment for all 875 pathways.

## Tiger Cloud credit use

This work gives the existing Tiger Cloud DEV service purposeful larger research ingestion, immutable provenance comparisons, historical PubMed metadata analysis and repeatable read-only query timing. Monitor storage, compute and budget. Increasing idle service size to exhaust trial credits does not make the medical evidence stronger.

No new Tiger Cloud service is provisioned, no clinical approval is issued, no private claimant information is transmitted, and Production remains unchanged. Post-credit artifacts should be archived outside 30-day Actions retention.
