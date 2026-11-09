#!/usr/bin/env python3
"""Review-only reconciliation for the 507 authored pathways with citation debt.

Compares original citations, the repository's previous registry dispositions,
and Tiger DEV PubMed *bibliographic metadata*. Neither presence nor a
previous verified:true tag independently proves support for a medical claim.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEDGER = Path("/tmp/scf-clinical-review-batch1/clinical-review-ledger.json")
PACKETS = Path("/tmp/scf-source-to-claim-review/review-packets.jsonl")
REGISTRY = ROOT / "data/evidence/master-sources.json"
OUT = Path("/tmp/scf-clinical-accuracy-triage/citation-review")
PMID = re.compile(r"(?:PMID[:\s]*|pubmed\.ncbi\.nlm\.nih\.gov/)(\d{4,9})", re.I)
FLAGS = {"SOURCE_REGISTRY_REVIEW", "CLINICAL_REFERENCE_STATUS_REVIEW"}
EXPECTED = 507


def canonical(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha(x):
    return hashlib.sha256(canonical(x).encode("utf8")).hexdigest()


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_inputs():
    ledger = json.loads(LEDGER.read_text(encoding="utf8"))
    if ledger["pathwayCount"] != 875 or ledger["sourceReferenceCount"] != 1704:
        raise ValueError("Wrong source cohort")
    if sha({k: v for k, v in ledger.items() if k != "runId"}) != ledger["runId"]:
        raise ValueError("Ledger SHA256 mismatch")
    packets = {}
    with PACKETS.open(encoding="utf8") as f:
        for line in f:
            item = json.loads(line)
            key = (item["sourceId"], item["targetId"])
            if key in packets or sha({k: v for k, v in item.items()
                                      if k != "contentSha256"}) != item["contentSha256"]:
                raise ValueError("Untrusted or duplicate original source packet")
            packets[key] = item
    if len(packets) != 875:
        raise ValueError("Not all 875 source packets are available")
    reg = json.loads(REGISTRY.read_text(encoding="utf8"))
    index = {}
    for s in reg["sources"]:
        pid = str(s.get("pmid") or "")
        if pid:
            index.setdefault(pid, []).append(s["status"])
    return ledger, packets, index


def metadata_index(path):
    if path is None:
        return {}
    raw = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(raw, dict) or raw.get("sourceLedgerId") != (
        "dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa"):
        raise ValueError("Unknown DEV bibliographic ledger or metadata format")
    rows = raw.get("articles")
    if not isinstance(rows, list) or len(rows) > 12000:
        raise ValueError("Unbounded bibliographic metadata input")
    indexed = {}
    for row in rows:
        pid = str(row["pmid"])
        if not re.fullmatch(r"\d{4,9}", pid) or row["status"] not in (
            "METADATA_RETRIEVED", "PUBLICATION_STATUS_REVIEW",
            "UNRESOLVED", "PROVIDER_UNAVAILABLE"):
            raise ValueError("Invalid PubMed metadata row")
        if row["clinicalSupport"] != "NOT_ASSESSED":
            raise ValueError("External claim approval not permitted")
        indexed.setdefault(pid, set()).add(row["status"])
    return indexed


def review(ledger, packets, registry, metadata):
    flagged = [x for x in ledger["pathways"] if
               {f["rule"] for f in x["findings"]} & FLAGS]
    if len(flagged) != EXPECTED or any(x["publicationState"] != "DRAFT" for x in flagged):
        raise ValueError("Flagged citation cohort changed; fail closed")
    rows = []
    for e in sorted(flagged, key=lambda r: (r["sourceId"], r["targetId"])):
        packet = packets[(e["sourceId"], e["targetId"])]
        citations = []
        for ref in packet["references"]:
            ids = sorted(set(PMID.findall(ref["citation"] + " " + ref["sourceUrl"])))
            state = []
            for pid in ids:
                statuses = registry.get(pid, [])
                state.append({
                    "pmid": pid,
                    "registryStatuses": sorted(set(statuses)),
                    "activeInRegistry": "active" in statuses,
                    "tigerBibliographicStatuses": sorted(metadata.get(pid, [])),
                    "metadataFoundInDev": bool(metadata.get(pid)),
                    "claimSupport": "NOT_ASSESSED",
                })
            citations.append({
                "ordinal": ref["ordinal"],
                "citation": ref["citation"],
                "sourceUrl": ref["sourceUrl"],
                "verificationScope": ref["verificationScope"],
                "previouslyDeclaredVerified": ref["previouslyDeclaredVerified"],
                "pubmed": state,
                "noPmidInCitation": not bool(ids),
                "newSpecificClaimVerification": "NOT_PERFORMED",
            })
        if len(citations) != e["citationCount"]:
            raise ValueError("Citation counts differ from authored KB")
        row = {
            "sourceId": e["sourceId"], "targetId": e["targetId"],
            "publicationState": e["publicationState"],
            "authoredClassification": e["nexusClassification"],
            "citationCount": e["citationCount"],
            "ruleFlags": sorted({f["rule"] for f in e["findings"]}),
            "references": citations,
            "reviewDisposition": "HUMAN_SOURCE_TO_CLAIM_REVIEW_REQUIRED",
            "citationStateReconciled": "METADATA_ONLY",
            "medicalCausationVerified": False,
            "publicationAuthorized": False,
        }
        row["rowSha256"] = sha(row)
        rows.append(row)
    return rows


def produce(output=OUT, metadata_path=None):
    ledger, packets, reg = load_inputs()
    meta = metadata_index(metadata_path)
    rows = review(ledger, packets, reg, meta)
    output.mkdir(parents=True, exist_ok=True)
    src = output / "citation-review-507.jsonl"
    src.write_text("".join(canonical(row) + "\n" for row in rows), encoding="utf8")
    queue = output / "citation-review-507.csv"
    with queue.open("w", newline="", encoding="utf8") as f:
        w = csv.writer(f)
        w.writerow(["sourceId", "targetId", "references", "pmids",
                    "previouslyVerifiedRefCount", "activeRegistryPmids",
                    "pendingOrMissingRegistryPmids", "pmidsWithDevMetadata",
                    "humanReviewRequired", "rowSha256"])
        for row in rows:
            pmids = {p["pmid"]: p for ref in row["references"] for p in ref["pubmed"]}
            w.writerow([row["sourceId"], row["targetId"],
                        row["citationCount"], len(pmids),
                        sum(r["previouslyDeclaredVerified"] for r in row["references"]),
                        sum(p["activeInRegistry"] for p in pmids.values()),
                        sum(not p["activeInRegistry"] for p in pmids.values()),
                        sum(p["metadataFoundInDev"] for p in pmids.values()),
                        "YES", row["rowSha256"]])
    status_counts = Counter(p["pmid"] + ":" + status
                            for row in rows for ref in row["references"]
                            for p in ref["pubmed"]
                            for status in p["tigerBibliographicStatuses"])
    summary = {
        "schemaVersion": 1,
        "sourceLedgerRunId": ledger["runId"],
        "flaggedDraftPathways": len(rows),
        "flaggedReferenceLinks": sum(x["citationCount"] for x in rows),
        "uniqueReferencedPubMedIds": len({
            p["pmid"] for row in rows for ref in row["references"] for p in ref["pubmed"]}),
        "uniquePubMedIdsWithDevMetadata": len({
            p["pmid"] for row in rows for ref in row["references"]
            for p in ref["pubmed"] if p["metadataFoundInDev"]}),
        "metadataSource": "Tiger DEV research" if metadata_path else "NOT_QUERIED",
        "observationsWithResearchMetadata": len(status_counts),
        "clinicalApprovals": 0, "terminologyApprovals": 0,
        "publicationChanges": 0, "sourceClaimVerified": False,
        "files": {name: hash_file(output / name) for name in (
            "citation-review-507.jsonl", "citation-review-507.csv")},
    }
    (output / "manifest.json").write_text(
        json.dumps(summary, sort_keys=True, indent=2) + "\n", encoding="utf8")
    return summary


def verify(output=OUT):
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf8"))
    if manifest["flaggedDraftPathways"] != EXPECTED or (
        manifest["clinicalApprovals"] != 0 or
        manifest["publicationChanges"] != 0 or manifest["sourceClaimVerified"] is not False):
        raise ValueError("Invalid review manifest")
    for name, digest in manifest["files"].items():
        if hash_file(output / name) != digest:
            raise ValueError("Review artifact tampered")
    count = 0
    with (output / "citation-review-507.jsonl").open(encoding="utf8") as fp:
        for line in fp:
            row = json.loads(line)
            expected = row.pop("rowSha256")
            if sha(row) != expected or row["publicationAuthorized"] or row["medicalCausationVerified"]:
                raise ValueError("Unauthorized citation status alteration")
            count += 1
    if count != EXPECTED:
        raise ValueError("Missing review rows")
    return {"result": "EXACT_CITATION_REVIEW_PARITY", "flaggedPathways": count,
            "medicalApprovals": 0}


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--out", type=Path, default=OUT)
    cli.add_argument("--metadata-json", type=Path)
    cli.add_argument("--verify", action="store_true")
    options = cli.parse_args()
    try:
        print(json.dumps(verify(options.out) if options.verify else
                         produce(options.out, options.metadata_json)))
    except Exception as e:
        print("DEV citation provenance review failed: " + str(e)[:150], file=sys.stderr)
        sys.exit(1)
