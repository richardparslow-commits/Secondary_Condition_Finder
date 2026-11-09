#!/usr/bin/env python3
"""Review-only evidence-to-claim packets, never automated medical verification."""
import argparse
import csv
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BASE = Path("/tmp/scf-clinical-review-batch1/clinical-review-ledger.json")
OUT = Path("/tmp/scf-source-to-claim-review")
RULES = [
    "Confirm title, PMID, dates, retractions, and citation accuracy",
    "Read relevant full source, including methods, results, population and limits",
    "Identify whether it supports this *exact* named condition-to-condition assertion",
    "Evaluate association separately from causation, aggravation and directionality",
    "Check phenotype, temporal sequence, treatment-mediated mechanisms and confounders",
    "Check competing diagnoses, alternative causes and contradictory literature",
    "Separate medical evidence from legal framework and individual VA nexus judgment",
    "Document reviewer expertise, source pages, clinical disposition and rationale",
]
STATUS = "HUMAN_SOURCE_TO_CLAIM_REVIEW_REQUIRED"


def compact(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha(obj):
    return hashlib.sha256(compact(obj).encode("utf8")).hexdigest()


def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source():
    spec = importlib.util.spec_from_file_location(
        "scf_original_clinical_ledger",
        REPO / "scripts/lib/build-clinical-review-ledger.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.public_content()


def tier(edge):
    high = any(f["severity"] == "HIGH" for f in edge["findings"])
    published = edge["publicationState"] == "PUBLISHED"
    clinical = edge["nexusClassification"] != "ASSOCIATION_ONLY"
    flags = {f["rule"] for f in edge["findings"]}
    if published and high:
        return 0
    if published and clinical:
        return 1
    if published:
        return 2
    if high:
        return 3
    if flags & {"SOURCE_REGISTRY_REVIEW", "CLINICAL_REFERENCE_STATUS_REVIEW"}:
        return 4
    return 5


def prepare(ledger, conditions, mappings, catalog_digest, kb_digest):
    if (ledger["schemaVersion"] != 1 or ledger["clinicalApproval"] != "NOT_GRANTED"
        or ledger["conditionCount"] != 819 or ledger["pathwayCount"] != 875
        or ledger["sourceReferenceCount"] != 1704
        or ledger["catalogDigest"] != catalog_digest
        or ledger["knowledgeBaseDigest"] != kb_digest
        or ledger["sourceRegistryDigest"] != file_sha(
            REPO / "data/evidence/master-sources.json")
        or ledger["runId"] != sha({k: v for k, v in ledger.items() if k != "runId"})):
        raise ValueError("Signed-off source ledger is inconsistent with current repository")
    ledger_conditions = {r["id"]: r for r in ledger["conditions"]}
    if len(ledger_conditions) != 819 or set(ledger_conditions) != set(conditions) \
            or set(ledger_conditions) != set(mappings):
        raise ValueError("Missing or changed condition identities")
    authored = {(sid, r["conditionId"]): r
                for sid, node in mappings.items() for r in node["suggestions"]}
    if len(authored) != 875 or len(ledger["pathways"]) != 875:
        raise ValueError("Incorrect authored pathway count")
    packets = []
    seen = set()
    for edge in ledger["pathways"]:
        sid, tid = edge["sourceId"], edge["targetId"]
        key = (sid, tid)
        if key in seen or key not in authored:
            raise ValueError("Duplicate or missing reviewed pathway")
        seen.add(key)
        item = authored[key]
        if item["rank"] != edge["rank"] or (
            item["nexusClaim"]["nexusClassification"] != edge["nexusClassification"]):
            raise ValueError("Authored rank/classification changed")
        refs = []
        for i, r in enumerate(item["sourceReferences"], 1):
            refs.append({
                "ordinal": i,
                "citation": r["citation"],
                "sourceUrl": r["sourceUrl"],
                "sourceLocator": r["sourceLocator"],
                "sourceCheckedOnPreviously": r["sourceCheckedOn"],
                "authoredNote": r["note"],
                "verificationScope": r["verificationScope"],
                "authorityCategory": r["authorityCategory"],
                "previouslyDeclaredVerified": r["verified"] is True,
                "independentlyReverifiedHere": False,
                "specificClaimSupport": "NOT_ASSESSED",
            })
        if len(refs) != edge["citationCount"]:
            raise ValueError("Source references changed")
        packet = {
            "sourceId": sid, "targetId": tid,
            "sourceName": conditions[sid]["name"],
            "targetName": conditions[tid]["name"],
            "rank": edge["rank"],
            "publicationState": edge["publicationState"],
            "authoredNexusClassification": edge["nexusClassification"],
            "authoredVaProbabilityAlignment": edge["vaNexusProbabilityAlignment"],
            "authoredRationale": item["rationale"],
            "authoredNexusClaim": item["nexusClaim"],
            "authoredMechanism": item["causalMechanism"],
            "authoredEvidenceProfile": item["evidentiaryProfile"],
            "authoredEvidenceGaps": item["evidenceGaps"],
            "sourceIdentityStatus": ledger_conditions[sid]["ontologyStatus"],
            "targetIdentityStatus": ledger_conditions[tid]["ontologyStatus"],
            "flags": edge["findings"],
            "priority": tier(edge),
            "references": refs,
            "reviewChecklist": RULES,
            "clinicalReview": STATUS,
            "claimSpecificEvidenceAssessment": "NOT_ASSESSED",
            "individualVaNexusAssessment": "NOT_ASSESSED",
            "publicationAuthorization": "NOT_GRANTED",
        }
        packet["contentSha256"] = sha(packet)
        packets.append(packet)
    packets.sort(key=lambda x: (x["priority"], x["sourceId"], x["targetId"]))
    if len(seen) != 875 or sum(len(x["references"]) for x in packets) != 1704:
        raise ValueError("Full evidence-review inventory differs")
    if sum(x["priority"] == 0 for x in packets) != 21:
        raise ValueError("Published high-severity review baseline differs")
    return packets


def render_high_priority(rows, ledger_id):
    lines = [
        "# 21 published high-priority source-to-claim review packets", "",
        "Automated flags are research-review signals, not medical findings.",
        "Previously declared source verification is not independent verification",
        "of the specific causal proposition or an individual VA nexus.", "",
        "Source ledger ID: " + ledger_id, "",
    ]
    for n, r in enumerate((r for r in rows if r["priority"] == 0), 1):
        lines.extend([
            "## " + str(n) + ". " + r["sourceName"] + " → " + r["targetName"], "",
            "- Source/target IDs: " + r["sourceId"] + " → " + r["targetId"],
            "- Authored classification: " + r["authoredNexusClassification"],
            "- VA-style probability wording: " + r["authoredVaProbabilityAlignment"],
            "- High-priority rule flags: " + "; ".join(
                sorted({f["rule"] for f in r["flags"] if f["severity"] == "HIGH"})),
            "- Authored rationale (not independently adjudicated): " +
            str(r["authoredRationale"]).replace("\n", " "),
            "- Reviewer disposition: PENDING; no medical nexus determination", "",
            "### Original cited sources", "",
        ])
        for ref in r["references"]:
            lines.extend([
                "- " + ref["citation"] + " [" + ref["verificationScope"] + "]",
                "  - URL: " + ref["sourceUrl"],
                "  - Source locator: " + ref["sourceLocator"],
                "  - Prior declared verified: " + str(ref["previouslyDeclaredVerified"]),
                "  - Authored claim-support note: " + ref["authoredNote"].replace("\n", " "),
                "  - New independent source-to-claim check: NOT PERFORMED",
            ])
        lines.extend([
            "", "Reviewer questions: Does the cited paper support *this exact*",
            "directed relationship or only population-level association? Does",
            "it establish directionality, treatment mediation, or aggravation?",
            "Are the target phenotype, alternative etiologies and study limits",
            "properly represented?", "",
        ])
    return "\n".join(lines) + "\n"


def build(out=OUT, ledger_path=BASE):
    conditions, mappings, catalog_hash, kb_hash = source()
    ledger = json.loads(ledger_path.read_text(encoding="utf8"))
    rows = prepare(ledger, conditions, mappings, catalog_hash, kb_hash)
    out.mkdir(parents=True, exist_ok=True)
    full = out / "review-packets.jsonl"
    full.write_text("".join(compact(x) + "\n" for x in rows), encoding="utf8")
    with (out / "priority-queue.csv").open("w", newline="", encoding="utf8") as fp:
        w = csv.writer(fp)
        w.writerow(["priority", "sourceId", "targetId", "sourceName", "targetName",
                    "publicationState", "authoredClassification",
                    "referenceCount", "previouslyDeclaredVerifiedCount",
                    "flags", "reviewStatus", "packetSHA256"])
        for r in rows:
            w.writerow([r["priority"], r["sourceId"], r["targetId"], r["sourceName"],
                        r["targetName"], r["publicationState"],
                        r["authoredNexusClassification"], len(r["references"]),
                        sum(x["previouslyDeclaredVerified"] for x in r["references"]),
                        ";".join(sorted({f["rule"] for f in r["flags"]})),
                        r["clinicalReview"], r["contentSha256"]])
    with (out / "reviewer-decisions-EMPTY.csv").open(
            "w", newline="", encoding="utf8") as fp:
        w = csv.writer(fp)
        w.writerow(["sourceId", "targetId", "reviewer", "credentials", "reviewDate",
                    "exactClaimSupport", "populationAndStudyDesign",
                    "causationVersusAssociation", "directionality", "confounders",
                    "reviewDisposition", "detailedRationale"])
        for r in rows:
            w.writerow([r["sourceId"], r["targetId"]] + [""] * 10)
    (out / "published-high-priority.md").write_text(
        render_high_priority(rows, ledger["runId"]), encoding="utf8")
    files = ["review-packets.jsonl", "priority-queue.csv",
             "reviewer-decisions-EMPTY.csv", "published-high-priority.md"]
    manifest = {
        "schemaVersion": 1, "sourceLedgerId": ledger["runId"],
        "catalogDigest": catalog_hash, "knowledgeBaseDigest": kb_hash,
        "packets": 875, "sourceReferences": 1704,
        "published": sum(x["publicationState"] == "PUBLISHED" for x in rows),
        "publishedHighPriority": 21, "qualifiedReviewCompleted": 0,
        "medicalNexusDecisions": 0, "productionChanges": 0,
        "files": {name: file_sha(out / name) for name in files},
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf8")
    return manifest


def verify(out=OUT):
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf8"))
    if (manifest["packets"] != 875 or manifest["sourceReferences"] != 1704
        or manifest["publishedHighPriority"] != 21
        or manifest["qualifiedReviewCompleted"] != 0
        or manifest["medicalNexusDecisions"] != 0
        or manifest["productionChanges"] != 0):
        raise ValueError("Packet manifest count/status mismatch")
    for name, expected in manifest["files"].items():
        file = out / name
        if not file.is_file() or file_sha(file) != expected:
            raise ValueError("Review packet file digest mismatch")
    count = 0
    with (out / "review-packets.jsonl").open(encoding="utf8") as fp:
        for line in fp:
            row = json.loads(line)
            claimed = row.pop("contentSha256")
            if (sha(row) != claimed or row["clinicalReview"] != STATUS
                or row["publicationAuthorization"] != "NOT_GRANTED"
                or any(r["independentlyReverifiedHere"] for r in row["references"])):
                raise ValueError("Review packet altered or unauthorized")
            count += 1
    if count != 875:
        raise ValueError("Packet row count mismatch")
    return {"result": "REVIEW_PACKETS_EXACT_HASH_PARITY",
            "pathways": count, "clinicalApprovals": 0}


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--out", type=Path, default=OUT)
    cli.add_argument("--verify", action="store_true")
    args = cli.parse_args()
    try:
        print(json.dumps(verify(args.out) if args.verify else build(args.out)))
    except Exception as exc:
        print("Source-to-claim packet processing failed: " +
              str(exc)[:170], file=sys.stderr)
        sys.exit(1)
