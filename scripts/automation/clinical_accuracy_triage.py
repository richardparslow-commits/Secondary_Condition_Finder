#!/usr/bin/env python3
"""Qualified-review preflight for 21 published mapping conflicts and 375 ontology exceptions.

Uses current official PubMed bibliographic metadata, pre-approved MONDO
snapshot and authored citations; clinical evidence support, drug effects,
causation, VA legal probability, and ontology equivalence remain NOT_ASSESSED.
"""
import argparse
import csv
import hashlib
import os
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

import directional_evidence_campaign as pubmed
import ontology_identity_triage as ontology

ROOT = Path(__file__).resolve().parents[2]
PACKETS = Path("/tmp/scf-source-to-claim-review/review-packets.jsonl")
OUT = Path("/tmp/scf-clinical-accuracy-triage")
PMID = re.compile(r"(?:PMID[:\s]*|pubmed\.ncbi\.nlm\.nih\.gov/)(\d{4,9})", re.I)
EXPECTED = 21
UNIQUE_PMIDS = 20
ETERM = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


def sha(data):
    return pubmed.digest(data)


def load_priority(packets=PACKETS):
    results = []
    with packets.open(encoding="utf8") as fp:
        for line in fp:
            r = json.loads(line)
            if r["priority"] != 0:
                continue
            if (r["clinicalReview"] != "HUMAN_SOURCE_TO_CLAIM_REVIEW_REQUIRED"
                or r["claimSpecificEvidenceAssessment"] != "NOT_ASSESSED"
                or r["publicationAuthorization"] != "NOT_GRANTED"
                or r["publicationState"] != "PUBLISHED"
                or sha({k:v for k,v in r.items() if k != "contentSha256"}) != r["contentSha256"]):
                raise ValueError("Priority review packet altered/approved")
            results.append(r)
    if len(results) != EXPECTED or len({
        (r["sourceId"], r["targetId"]) for r in results}) != EXPECTED:
        raise ValueError("Expected exactly 21 unique published review cases")
    ids = sorted({p for r in results for s in r["references"] for p in PMID.findall(
        s["citation"] + " " + s["sourceUrl"])})
    if len(ids) != UNIQUE_PMIDS or any(not pubmed.ID_RE.fullmatch(x) for x in ids):
        raise ValueError("Unapproved official citation cohort")
    return results, ids


def record_from_summary(pmid, data):
    parsed = pubmed.parse_article(pmid, data)
    if parsed["status"] not in ("METADATA_RETRIEVED", "PUBLICATION_STATUS_REVIEW"):
        return {"pmid": pmid, "metadataStatus": "UNRESOLVED", "title": "",
                "publicationDate": "", "doi": "", "publicationTypes": [],
                "metadataSha256": "", "sourceClaimVerification": "NOT_ASSESSED",
                "originalAbstractStored": False}
    return {
        "pmid": pmid, "metadataStatus": parsed["status"], "title": parsed["title"],
        "publicationDate": parsed["date"], "doi": parsed["doi"],
        "publicationTypes": parsed["publicationTypes"],
        "metadataSha256": parsed["metadataHash"],
        "sourceClaimVerification": "NOT_ASSESSED",
        "originalAbstractStored": False,
    }


def source_fetch_records(ids):
    """Check PubMed retraction and abstract metadata; never save abstract text."""
    if len(ids) > UNIQUE_PMIDS or not ids or any(not pubmed.ID_RE.fullmatch(p) for p in ids):
        raise ValueError("Unbounded/unapproved EFetch IDs")
    url = ETERM + "?" + urlencode({
        "db": "pubmed", "id": ",".join(ids), "retmode": "xml",
        "tool": "SCFPublicClinicalTriageDEV",
    })
    if not url.startswith(ETERM + "?"):
        raise ValueError("Unapproved official clinical research provider")
    req = Request(url, headers={"User-Agent": "SCF-PublicClinicalTriageDEV/1.0"})
    with urlopen(req, timeout=24) as res:
        if res.url.split("?")[0] != ETERM or res.headers.get("content-length", "0").isdigit() and (
                int(res.headers.get("content-length", "0")) > 1800000):
            raise ValueError("Unexpected source response or redirect")
        raw = res.read(1800001)
        if len(raw) > 1800000:
            raise ValueError("Oversized PubMed response")
    root = ET.fromstring(raw)
    if root.tag != "PubmedArticleSet":
        raise ValueError("Unexpected clinical reference XML")
    found = {}
    for article in root.findall(".//PubmedArticle"):
        p = article.findtext(".//MedlineCitation/PMID", default="").strip()
        if p not in ids or p in found:
            continue
        abstract = article.find(".//Article/Abstract")
        abstract_present = abstract is not None and bool(
            "".join(abstract.itertext()).strip())
        correction_types = sorted({
            node.attrib.get("RefType", "UNKNOWN")[:65]
            for node in article.findall(".//CommentsCorrectionsList/CommentsCorrections")
        })
        found[p] = {
            "pmid": p, "abstractPresent": abstract_present,
            "publicationCorrectionTypes": correction_types,
            "retractionOrConcernSignal": any(re.search(
                r"retract|concern|withdraw", x, re.I) for x in correction_types),
            "originalAbstractStored": False,
            "sourceClaimVerification": "NOT_ASSESSED",
        }
    return found


def build(client=None, extracted=None, observed=None, packets_file=PACKETS,
          ontology_file=ontology.FIXTURE, output=OUT):
    priority, ids = load_priority(packets_file)
    identities = ontology.validate_fixture(
        json.loads(ontology_file.read_text(encoding="utf8")),
        ontology.catalog_labels())
    if len(ids) != 20 or len(identities["records"]) != 375:
        raise ValueError("Incomplete medical research scope")
    n = client or pubmed.NCBI(key=os.environ.get("NCBI_API_KEY"))
    try:
        response = n.request("esummary", {"id": ",".join(ids)})["result"]
    except RuntimeError:
        response = {}
    if not isinstance(response, dict):
        raise ValueError("Untrusted NCBI source metadata")
    checks = extracted if extracted is not None else (
        source_fetch_records(ids) if response else {})
    metadata = []
    for p in ids:
        doc = record_from_summary(p, response.get(p))
        supplement = checks.get(p)
        doc["abstractPresent"] = (
            supplement.get("abstractPresent") if supplement else None)
        doc["publicationCorrectionTypes"] = (
            supplement.get("publicationCorrectionTypes") if supplement else [])
        doc["retractionOrConcernSignal"] = (
            supplement.get("retractionOrConcernSignal") if supplement else False)
        doc["efetchStatus"] = "CHECKED" if supplement else "UNAVAILABLE"
        doc["verificationRecommendation"] = (
            "URGENT_PUBLICATION_STATUS_REVIEW"
            if doc["retractionOrConcernSignal"]
            or doc["metadataStatus"] == "PUBLICATION_STATUS_REVIEW"
            else "SOURCE_METADATA_UNRESOLVED"
            if doc["metadataStatus"] != "METADATA_RETRIEVED"
            or doc["efetchStatus"] != "CHECKED"
            else "FULL_SOURCE_AND_EXACT_CLAIM_REVIEW_REQUIRED")
        metadata.append(doc)
    meta = {m["pmid"]: m for m in metadata}
    cases = []
    for row in priority:
        source_pmids = sorted({p for ref in row["references"]
                              for p in PMID.findall(ref["citation"] + " " + ref["sourceUrl"])})
        flags = sorted({f["rule"] for f in row["flags"] if f["severity"] == "HIGH"})
        records = [meta[p] for p in source_pmids]
        case = {
            "sourceId": row["sourceId"], "targetId": row["targetId"],
            "sourceName": row["sourceName"], "targetName": row["targetName"],
            "publicationState": "PUBLISHED",
            "authoredNexusClassification": row["authoredNexusClassification"],
            "authoredVaProbabilityAlignment": row["authoredVaProbabilityAlignment"],
            "highPriorityConsistencySignals": flags,
            "originalReferencePmids": source_pmids,
            "pubmedBibliographicReview": [r["verificationRecommendation"] for r in records],
            "researcherProposedChange": "NONE_AUTOMATICALLY",
            "reasonedClinicalDisposition": "QUALIFIED_HUMAN_REVIEW_REQUIRED",
            "medicalClaimVerification": "NOT_ASSESSED",
            "individualVaNexusDetermination": "NOT_ASSESSED",
            "productionPublishAuthorization": "NOT_GRANTED",
        }
        case["rowSha256"] = sha(case)
        cases.append(case)
    summary = {
        "schemaVersion": 1,
        "campaign": "CLINICAL_ACCURACY_TRIAGE_NOT_APPROVAL",
        "observedAt": observed or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceLedgerRunId": "dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa",
        "ontologySnapshot": identities["ontologySnapshot"],
        "ontologyReviewFixtureSha256": identities["snapshotSha256"],
        "highPriorityPublishedPathways": 21, "distinctCitedPubMedRecords": 20,
        "bibliographicMetadataChecked": sum(m["metadataStatus"] == "METADATA_RETRIEVED"
                                            for m in metadata),
        "efetchRecordsChecked": sum(m["efetchStatus"] == "CHECKED" for m in metadata),
        "pubmedStatusAlerts": sum(m["retractionOrConcernSignal"]
                                  or m["metadataStatus"] == "PUBLICATION_STATUS_REVIEW"
                                  for m in metadata),
        "identityExceptions": 375, "existingAmbiguous": 51,
        "previouslyUnmatched": 324,
        "lexicalSuggestionsNotEquivalence": sum(bool(r["reviewCandidates"])
                                                for r in identities["records"]),
        "automaticClinicalApprovals": 0, "automaticTerminologyApprovals": 0,
        "productionChanges": 0,
        "publicationMetadata": metadata, "priorityPathways": cases,
    }
    summary["runSha256"] = sha(summary)
    validate(summary, identities)
    output.mkdir(parents=True, exist_ok=True)
    (output / "triage-run.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    ontology.export_csv(identities, output / "ontology-review.csv")
    with (output / "bibliographic-review.csv").open(
            "w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["pmid", "metadataStatus", "efetchStatus", "abstractPresent",
                         "publicationTypes", "retractionOrConcernSignal",
                         "sourceClaimVerification"])
        for m in metadata:
            writer.writerow([m["pmid"], m["metadataStatus"],m["efetchStatus"],
                             m["abstractPresent"], "|".join(m["publicationTypes"]),
                             m["retractionOrConcernSignal"],
                             m["sourceClaimVerification"]])
    with (output / "clinical-case-decisions-EMPTY.csv").open(
            "w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["sourceId", "targetId", "qualifiedReviewer", "reviewDate",
                         "originalSourcesRead", "exactClaimSupport", "studyLimitations",
                         "associationOrCausation", "directionality", "clinicalDisposition",
                         "rationale"])
        for c in cases:
            writer.writerow([c["sourceId"], c["targetId"]] + [""] * 9)
    with (output / "ontology-human-decisions-EMPTY.csv").open(
            "w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["conditionId", "qualifiedReviewer", "reviewDate", "confirmedMONDO",
                         "termMeaningReviewed", "identityDisposition", "sourceAndRationale"])
        for item in identities["records"]:
            writer.writerow([item["conditionId"]] + [""] * 6)
    lines = ["# Clinical accuracy review — DEV source triage", "",
             "All 21 published pathways and 375 terminology exceptions remain unapproved.",
             "This preflight checks PubMed bibliographic and correction metadata, not",
             "clinical source-to-specific-claim validity or individual VA nexus.", "",
             "## Published high-priority pathway review list", "",
             "| Primary condition | Secondary condition | Existing nexus label | PubMed records | Priority review signals |",
             "| --- | --- | --- | --- | --- |"]
    for c in cases:
        urls = ", ".join("[" + p + "](https://pubmed.ncbi.nlm.nih.gov/" + p + "/)"
                         for p in c["originalReferencePmids"])
        signal = ", ".join(c["highPriorityConsistencySignals"])
        lines.append("| " + c["sourceName"].replace("|", "-") + " | " +
                     c["targetName"].replace("|", "-") + " | " +
                     c["authoredNexusClassification"] + " | " + urls + " | " +
                     signal.replace("|", "-") + " |")
    lines += ["", "## Terminology identity review", "",
              "- Existing ambiguous exact lexical identities: 51.",
              "- No original exact MONDO label/synonym match: 324.",
              "- Lexical review suggestions are **not** medical equivalence decisions.",
              "- Candidates below the conservative lexical threshold are omitted,",
              "  not automatically declared absent from medical ontologies.", "",
              "## Human approval required", "",
              "A qualified reviewer must examine original sources in full when possible,",
              "applicability to the exact clinical assertion, conflicting evidence,",
              "disease phenotype, chronology, alternative causes and legal criteria.",
              "No proposed medical changes have been authorized by this artifact.", ""]
    (output / "clinical-accuracy-review.md").write_text(
        "\n".join(lines) + "\n", encoding="utf8")
    return summary


def validate(run, identities=None):
    if (run.get("schemaVersion") != 1
        or run.get("campaign") != "CLINICAL_ACCURACY_TRIAGE_NOT_APPROVAL"
        or run.get("highPriorityPublishedPathways") != 21
        or run.get("distinctCitedPubMedRecords") != 20
        or run.get("identityExceptions") != 375
        or run.get("existingAmbiguous") != 51
        or run.get("previouslyUnmatched") != 324
        or run.get("automaticClinicalApprovals") != 0
        or run.get("automaticTerminologyApprovals") != 0
        or run.get("productionChanges") != 0
        or len(run["publicationMetadata"]) != 20
        or len(run["priorityPathways"]) != 21):
        raise ValueError("Unauthorized or incomplete clinical-accuracy triage")
    if run["runSha256"] != sha({k:v for k,v in run.items() if k != "runSha256"}):
        raise ValueError("Clinical accuracy triage digest mismatch")
    if len({m["pmid"] for m in run["publicationMetadata"]}) != 20:
        raise ValueError("Duplicate cited PMID")
    for r in run["priorityPathways"]:
        if (r["reasonedClinicalDisposition"] != "QUALIFIED_HUMAN_REVIEW_REQUIRED"
            or r["medicalClaimVerification"] != "NOT_ASSESSED"
            or r["individualVaNexusDetermination"] != "NOT_ASSESSED"
            or r["productionPublishAuthorization"] != "NOT_GRANTED"
            or r["researcherProposedChange"] != "NONE_AUTOMATICALLY"
            or r["rowSha256"] != sha({k:v for k,v in r.items() if k != "rowSha256"})):
            raise ValueError("Clinical decision or packet integrity changed")
    for m in run["publicationMetadata"]:
        if m["sourceClaimVerification"] != "NOT_ASSESSED":
            raise ValueError("Unapproved bibliographic-to-clinical promotion")
    if identities is not None and (
        identities["snapshotSha256"] != run["ontologyReviewFixtureSha256"]):
        raise ValueError("Untrusted identity review snapshot")
    return run


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--out", type=Path, default=OUT)
    cli.add_argument("--verify", action="store_true")
    args = cli.parse_args()
    try:
        if args.verify:
            summary = validate(json.loads((args.out / "triage-run.json").read_text()),
                               ontology.validate_fixture(json.loads(
                                   ontology.FIXTURE.read_text()), ontology.catalog_labels()))
        else:
            summary = build(output=args.out)
        print(json.dumps({k:v for k,v in summary.items()
                          if k not in ("publicationMetadata", "priorityPathways")}))
    except Exception as exc:
        print("Clinical accuracy preflight failed: " + str(exc)[:160], file=sys.stderr)
        sys.exit(1)
