# Source-to-Claim Clinical Review Packets (DEV research only)

This stage follows the autonomous PubMed research-collection campaigns. It prepares a reviewer-facing packet for **every one of the 875 authored secondary-condition pathways**, preserving all **1,704 original reference links**, original classification, rationale, contradictions, clinical source notes, and previously declared citation verification.

**This generator DOES NOT read full clinical studies, reassess evidence support, determine individual VA nexus probability, or grant any medical approval.** A citation previously marked `verified:true` remains a previously documented repository declaration, not a new clinical source-to-specific-claim review. No case-specific VA decision can be derived from these generic public mapping records.

## Human review workflow

A qualified reviewer should separately inspect each underlying original source and evaluate:

1. Exact cited source identity, PMID, article type, publication status and possible retraction
2. Full relevant methodology, population, diagnostic phenotype, outcomes, and limitations
3. Exact applicability of the source to the proposed condition-to-condition relationship, versus mere co-occurrence
4. Whether claimed directionality, aggravation, treatment mediation or causation has clinical support
5. Confounding and alternative causes, inconsistent studies, age/severity/timeline and plausible counterevidence
6. Legal authority as a distinct evidence category, not proof of clinical causation
7. Need for individual diagnostic/medical-record evidence and expert judgment before any VA nexus determination

The reviewer spreadsheet is intentionally **blank** for all 875 items. A user or AI filling checkboxes is not by itself qualified evidence. This pipeline does not ingest filled reviewer decisions, elevate verification flags, or alter published recommendations. Future implementation changes require separate, evidence-backed reviews and PRs.

## Exact immutable outputs

The command `python3 scripts/automation/build_claim_review_packets.py` produces:

- `review-packets.jsonl` — all 875 source-to-claim packets with per-row SHA256, full authored rationale and 1,704 original references
- `priority-queue.csv` — prioritized published potential contradictions first, published mappings second, flagged draft mappings next
- `published-high-priority.md` — the **21 published paths** with high-priority consistency flags, with their exact citations, locators, and evidence limitations
- `reviewer-decisions-EMPTY.csv` — blank qualified-review form for all 875 edges, with no prefilled approval
- `manifest.json` — frozen source catalog, KB and clinical-review ledger digests and exact output checksums

Validation: `python3 scripts/automation/build_claim_review_packets.py --verify` independently checks all file hashes, every packet content digest, 875/1704 counts, mandatory review state, zero newly verified sources and zero publication changes. A changed authored ledger or source registry fails closed.

## Automatic operation in GitHub Actions

The workflow `tiger-dev-expanded-evidence.yml` regenerates this complete review package and runs its integrity tests during every bounded evidence-research batch; it attaches the packet directory to GitHub Actions artifacts with a 30-day retention period. Existing 48-directional and 827-remaining pathway research ingest and source-health checks remain unchanged. The report generation itself is local and read-only: **it does not use the Tiger writer credential or modify any medical map**.

After each new research run, source statuses in Tiger Cloud DEV are available to reviewers separately. The packets intentionally do not auto-interpret article metadata or PubMed Title/Abstract hits as evidence-specific clinical support.

## Reproduction and retention

```sh
python3 scripts/automation/stage_pinned_ontology.py
python3 scripts/lib/build-clinical-review-ledger.py
python3 scripts/automation/build_claim_review_packets.py
python3 scripts/automation/build_claim_review_packets.py --verify
python3 -m unittest discover -s tests -p 'test_claim_review_packets.py'
```

The user’s Mac Desktop copy is a convenience archive; GitHub artifacts expire after 30 days. Keep checksum-protected public research exports before Tiger Cloud credit expiration. Clinical approvals remain **0** by design until a distinct authorized qualified-human verification process.
