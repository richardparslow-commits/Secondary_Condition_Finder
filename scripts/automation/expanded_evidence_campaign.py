#!/usr/bin/env python3
"""Scheduled continuation: all 827 *remaining* authored pathways, public PubMed only.

Batch 0-2 prioritize published pathways. Later batches prioritize draft paths
with citation registry/verification debt. A missed/failed batch is revisited
when its nine-slot rotation repeats; completion is confirmed independently in
Tiger Cloud DEV rather than inferred from a workflow success.
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import directional_evidence_campaign as base

REPO = base.REPO
LEDGER = base.LEDGER
OUT = Path("/tmp/scf-autonomous-expanded-evidence")
BATCH_SIZE = 100
REMAINDER_COUNT = 827
TOTAL_PATHWAYS = 875
INITIAL_DIRECTIONAL = 48
BATCH_COUNT = 9
CITATION_DEBT = {"SOURCE_REGISTRY_REVIEW", "CLINICAL_REFERENCE_STATUS_REVIEW"}
EXCLUDED_NEXUS = {"DIRECT_CAUSATION", "AGGRAVATION"}


def selection(repo=REPO, ledger_file=LEDGER):
    ledger, initial, _ = base.inputs(repo=repo, ledger_file=ledger_file)
    excluded = {(r["sourceId"], r["targetId"]) for r in initial}
    if len(excluded) != INITIAL_DIRECTIONAL:
        raise ValueError("Unexpected initial campaign scope — fail closed")
    authored = ledger["pathways"]
    if len(authored) != TOTAL_PATHWAYS:
        raise ValueError("Unexpected authored catalog — fail closed")
    authored_keys = {(e["sourceId"], e["targetId"]) for e in authored}
    if len(authored_keys) != TOTAL_PATHWAYS or not excluded <= authored_keys:
        raise ValueError("Original path identities missing/duplicated")

    names = {}
    for path in sorted((repo / "data/conditions").glob("*.json")):
        for row in json.loads(path.read_text(encoding="utf-8-sig"))["conditions"]:
            if row["id"] in names:
                raise ValueError("Duplicate condition label")
            names[row["id"]] = base.query_name(row["name"])
    if len(names) != 819:
        raise ValueError("Unreviewed condition catalog change")
    authored_refs = {}
    for path in sorted((repo / "data/knowledge-base").glob("*.json")):
        mapping = json.loads(path.read_text(encoding="utf-8-sig"))
        for r in mapping["suggestions"]:
            key = (mapping["id"], r["conditionId"])
            if key in authored_refs:
                raise ValueError("Duplicate authored pathway")
            authored_refs[key] = r.get("sourceReferences", [])
    if set(authored_refs) != authored_keys:
        raise ValueError("Source-to-claim citation inventory drift")

    remaining = [r for r in authored if (r["sourceId"], r["targetId"]) not in excluded]
    if len(remaining) != REMAINDER_COUNT:
        raise ValueError("Unexpected remainder count")

    def review_priority(row):
        rules = {r["rule"] for r in row["findings"]}
        # Published relationships first. Within a publication tier, favor
        # citation-state flags and ontology-identity debt.
        return (
            0 if row["publicationState"] == "PUBLISHED" else 1,
            0 if rules & CITATION_DEBT else 1,
            0 if "ONTOLOGY_ENDPOINT_IDENTITY_REVIEW" in rules else 1,
            row["sourceId"], row["targetId"],
        )

    ordered = sorted(remaining, key=review_priority)
    if sum(x["publicationState"] == "PUBLISHED" for x in ordered) != 227:
        raise ValueError("Published remainder scope drift")
    if sum(bool({f["rule"] for f in x["findings"]} & CITATION_DEBT)
           for x in ordered) != 480:
        raise ValueError("Citation review inventory drift")
    rows = []
    for r in ordered:
        key = (r["sourceId"], r["targetId"])
        refs = authored_refs[key]
        pmids = sorted({x for ref in refs for x in base.PMID_RE.findall(
            str(ref.get("citation", "")) + " " + str(ref.get("sourceUrl", "")))})
        rows.append({
            "sourceId": key[0], "targetId": key[1],
            "sourceName": names[key[0]], "targetName": names[key[1]],
            "publicationState": r["publicationState"],
            "nexusClassification": r["nexusClassification"],
            "probabilityAlignment": r["vaNexusProbabilityAlignment"],
            "reviewRules": sorted({f["rule"] for f in r["findings"]}),
            "citationPmids": pmids, "citationCount": len(refs),
            "clinicalDisposition": "HUMAN_REVIEW_REQUIRED",
        })
    digest = base.digest([[x["sourceId"], x["targetId"]] for x in rows])
    return ledger, rows, digest


def choose_batch(rows, index):
    if not isinstance(index, int) or not 0 <= index < BATCH_COUNT or len(rows) != REMAINDER_COUNT:
        raise ValueError("Unsafe batch index/count")
    batch = rows[index * BATCH_SIZE:(index + 1) * BATCH_SIZE]
    expected = BATCH_SIZE if index < BATCH_COUNT - 1 else REMAINDER_COUNT - (BATCH_COUNT - 1) * BATCH_SIZE
    if len(batch) != expected or len({(r["sourceId"], r["targetId"]) for r in batch}) != expected:
        raise ValueError("Incomplete or duplicate batch")
    return batch


def selected_index(argument="auto", run_number=None):
    if argument != "auto":
        if not re.fullmatch(r"\d{1,2}", str(argument)):
            raise ValueError("Invalid explicit batch index")
        index = int(argument)
    elif run_number is None:
        index = 0
    else:
        if not re.fullmatch(r"\d{1,12}", str(run_number)) or int(run_number) < 1:
            raise ValueError("Untrusted GitHub run number")
        index = (int(run_number) - 1) % BATCH_COUNT
    if not 0 <= index < BATCH_COUNT:
        raise ValueError("Batch index out of range")
    return index


def run(out=OUT, batch_index=0, client=None, repo=REPO, ledger_file=LEDGER,
        observed_at=None):
    ledger, remainder, selection_digest = selection(repo=repo, ledger_file=ledger_file)
    batch = choose_batch(remainder, batch_index)
    ids = sorted({p for e in batch for p in e["citationPmids"]})
    if len(ids) > base.MAX_PMIDS:
        raise ValueError("Unbounded cited PubMed references")
    articles, discoveries = base.research(
        batch, ids, client or base.NCBI(key=os.environ.get("NCBI_API_KEY")))
    metadata = {
        "campaignScope": "REMAINDER_RESEARCH_ONLY",
        "batchIndex": batch_index,
        "batchCount": BATCH_COUNT,
        "batchSize": BATCH_SIZE,
        "totalRemainder": REMAINDER_COUNT,
        "priorDirectional": INITIAL_DIRECTIONAL,
        "fullInventory": TOTAL_PATHWAYS,
        "selectionDigest": selection_digest,
    }
    doc = {
        "schemaVersion": 1,
        "sourceLedgerId": ledger["runId"],
        "sourceCommit": os.getenv("GITHUB_SHA", ""),
        "observedAt": observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "clinicalApproval": "NOT_GRANTED",
        "edges": batch,
        "articles": articles,
        "discoveries": discoveries,
        **metadata,
    }
    doc["runId"] = base.digest(doc)
    summary = base.emit(doc, out)
    (out / "directional-evidence-review.csv").rename(out / "expanded-evidence-review.csv")
    (out / "batch-selection.json").write_text(json.dumps(
        {**metadata, "sourceLedgerId": ledger["runId"], "runId": doc["runId"],
         "selected": len(batch), "selectedPublished": sum(
             e["publicationState"] == "PUBLISHED" for e in batch),
         "selectedCitationFlagged": sum(bool(set(e["reviewRules"]) & CITATION_DEBT)
                                       for e in batch),
         "clinicalApproval": "NOT_GRANTED"}, indent=2) + "\n")
    with (out / "report.md").open("a", encoding="utf8") as fp:
        fp.write("\n## Remaining-pathway coverage batch\n\n")
        fp.write(f"- Source inventory: {TOTAL_PATHWAYS}; original high-risk campaign: {INITIAL_DIRECTIONAL}\n")
        fp.write(f"- Remaining review scope: {REMAINDER_COUNT}; batch: {batch_index + 1}/{BATCH_COUNT}\n")
        fp.write(f"- Paths in this batch: {len(batch)}; published paths: "
                 f"{sum(e['publicationState'] == 'PUBLISHED' for e in batch)}\n")
        fp.write("- Coverage must be verified against Tiger DEV's distinct stored pathway IDs; "
                 "workflow success does not imply all 827 paths have been processed.\n")
        fp.write("- **No medical causal conclusions or individual VA nexus verification.**\n")
    return {**summary, **metadata, "selected": len(batch),
            "publishedSelected": sum(e["publicationState"] == "PUBLISHED" for e in batch)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(OUT), type=Path)
    parser.add_argument("--batch-index", default="auto")
    arguments = parser.parse_args()
    try:
        idx = selected_index(arguments.batch_index, os.getenv("GITHUB_RUN_NUMBER"))
        print(json.dumps(run(out=arguments.out, batch_index=idx), sort_keys=True))
    except Exception:
        # No URLs/API keys, patient data or connection strings in failures.
        print("Expanded DEV public research failed; inspect safe review artifacts",
              file=sys.stderr)
        sys.exit(1)
