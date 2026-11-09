#!/usr/bin/env python3
"""Bounded PubMed candidate discovery for the 21 published claim-review cases.

Search hits are NOT counterevidence, confirmation, causal support, or a
systematic evidence review. Only their PubMed IDs are retained; all medical
and publication decisions remain with qualified human reviewers.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
QUERIES = ROOT / "scripts/automation/fixtures/clinical-21-secondary-searches.json"
SOURCE = Path("/tmp/scf-source-specific-review/source-claim-21-run.json")
OUT = Path("/tmp/scf-source-specific-review/secondary-evidence-discovery")
LEDGER = "dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa"
SCOPE = "INDEPENDENT_PUBMED_RETRIEVAL_CANDIDATES_NOT_CLINICAL_VERIFICATION"
PURPOSE = "RETRIEVAL_CANDIDATES_ONLY_NOT_A_CLINICAL_CONTRADICTION_FINDING"
OFFICIAL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PMID = re.compile(r"[1-9][0-9]{3,8}\Z")
MAX_MATCHES = 12
MAX_BYTES = 200_000
REQUIRED = 21


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def sha(value):
    return hashlib.sha256(canonical(value).encode("utf8")).hexdigest()


def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_inputs(source=SOURCE, queries=QUERIES):
    doc = json.loads(source.read_text(encoding="utf8"))
    fixture = json.loads(queries.read_text(encoding="utf8"))
    if (doc.get("schemaVersion") != 1 or doc.get("sourceLedgerId") != LEDGER
        or doc.get("scope") != "PRELIMINARY_ABSTRACT_SCOPE_REVIEW_NOT_MEDICAL_VERIFICATION"
        or doc.get("clinicalApprovals") != 0 or doc.get("publicationChanges") != 0
        or doc.get("individualVaNexusApprovals") != 0
        or len(doc.get("humanReviewCases", [])) != REQUIRED
        or doc.get("runSha256") != sha({k: v for k, v in doc.items() if k != "runSha256"})):
        raise ValueError("Pinned clinical research input is incomplete or modified")
    originals = {}
    for row in doc["humanReviewCases"]:
        key = (row["sourceId"], row["targetId"])
        pub = row["source"]
        if (key in originals or row.get("contentSha256") != sha({
                    k: v for k, v in row.items() if k != "contentSha256"})
            or row.get("medicalClaimVerification") != "NOT_ASSESSED"
            or row.get("individualVaNexusAssessment") != "NOT_ASSESSED"
            or row.get("publicationAuthorization") != "NOT_GRANTED"
            or row.get("humanReviewerDecision") != "PENDING"
            or pub.get("fullTextReviewed") is not False
            or pub.get("studyToClaimVerified") != "NOT_ASSESSED"
            or pub.get("abstractRetainedInArtifact") is not False
            or not isinstance(pub.get("pmid"), str)
            or not PMID.fullmatch(pub["pmid"])):
            raise ValueError("Published case changed or has an unauthorized decision")
        originals[key] = row
    if (fixture.get("schemaVersion") != 1 or fixture.get("sourceLedgerId") != LEDGER
        or fixture.get("reviewPurpose") != PURPOSE
        or len(fixture.get("cases", [])) != REQUIRED):
        raise ValueError("Secondary search cohort is not pinned to the original ledger")
    searches = {}
    for row in fixture["cases"]:
        key = (row["sourceId"], row["targetId"])
        query = row["query"]
        focus = row["reviewFocus"]
        if (key in searches or not isinstance(query, str) or not 12 <= len(query) <= 450
            or not isinstance(focus, str) or not 30 <= len(focus) <= 300
            or "[Title/Abstract]" not in query or "\n" in query or "\r" in query):
            raise ValueError("Duplicate, missing, or unrestricted PubMed search")
        searches[key] = row
    if set(searches) != set(originals):
        raise ValueError("Search queries do not match the exact original 21 claims")
    return doc, fixture, originals, searches


def parse_search(root, original):
    if root.tag != "eSearchResult" or not PMID.fullmatch(original):
        raise ValueError("Unexpected official PubMed search response")
    count = root.findtext("Count")
    ids = [e.text or "" for e in root.findall("./IdList/Id")]
    if (count is None or not count.isdecimal() or len(ids) > MAX_MATCHES
        or any(not PMID.fullmatch(x) for x in ids) or len(ids) != len(set(ids))):
        raise ValueError("Invalid or unbounded official PubMed IDs")
    total = int(count)
    if total < len(ids):
        raise ValueError("PubMed search count smaller than returned IDs")
    return total, [x for x in ids if x != original]


def fetch_official(query, original):
    if not isinstance(query, str) or not 12 <= len(query) <= 450:
        raise ValueError("Unbounded official PubMed query")
    url = OFFICIAL + "?" + urlencode({
        "db": "pubmed", "term": query, "sort": "relevance", "retmax": MAX_MATCHES,
        "retmode": "xml", "tool": "SCFSecondaryEvidenceDev",
    })
    req = Request(url, headers={"User-Agent": "SCFSecondaryEvidenceDev/1.0"})
    with urlopen(req, timeout=30) as response:
        location = urlsplit(response.url)
        if (location.scheme != "https" or location.hostname != "eutils.ncbi.nlm.nih.gov"
            or location.path != "/entrez/eutils/esearch.fcgi"):
            raise ValueError("Unofficial PubMed redirect")
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Oversized official PubMed search")
    return parse_search(ET.fromstring(raw), original)


def validate(doc, inputs=None):
    origin, fixture, originals, searches = inputs or load_inputs()
    if (doc.get("schemaVersion") != 1 or doc.get("scope") != SCOPE
        or doc.get("sourceLedgerId") != LEDGER
        or doc.get("sourceClaimRunSha256") != origin["runSha256"]
        or doc.get("searchFixtureSha256") != sha(fixture)
        or doc.get("clinicalApprovals") != 0 or doc.get("publicationChanges") != 0
        or doc.get("contradictionFindings") != 0 or doc.get("abstractBodiesStored") != 0
        or len(doc.get("reviewCases", [])) != REQUIRED
        or doc.get("runSha256") != sha({k: v for k, v in doc.items() if k != "runSha256"})):
        raise ValueError("Secondary-source artifact modified or grants clinical judgment")
    found = set()
    for row in doc["reviewCases"]:
        key = (row["sourceId"], row["targetId"])
        if key not in originals or key in found:
            raise ValueError("Missing or repeated original published relationship")
        found.add(key)
        ids = row["candidatePmids"]
        if (row["originalPmid"] != originals[key]["source"]["pmid"]
            or row["query"] != searches[key]["query"]
            or row["reviewFocus"] != searches[key]["reviewFocus"]
            or row["sourceCaseSha256"] != originals[key]["contentSha256"]
            or not isinstance(row["totalPubMedMatches"], int)
            or row["totalPubMedMatches"] < len(ids)
            or not isinstance(ids, list) or len(ids) > MAX_MATCHES
            or len(ids) != len(set(ids)) or row["originalPmid"] in ids
            or any(not isinstance(x, str) or not PMID.fullmatch(x) for x in ids)
            or row["retrievalDisposition"] != "UNSCREENED_CANDIDATES"
            or row["medicalVerification"] != "NOT_ASSESSED"
            or row["individualVaNexus"] != "NOT_ASSESSED"
            or row["publicationAuthorization"] != "NOT_GRANTED"):
            raise ValueError("Unverified search candidate details changed")
    if found != set(originals):
        raise ValueError("Secondary-source coverage incomplete")
    return doc


def build(search=fetch_official, source=SOURCE, queries=QUERIES, output=OUT,
          observed_at=None, rate_delay=0.5):
    inputs = load_inputs(source, queries)
    origin, fixture, originals, searches = inputs
    rows = []
    for index, key in enumerate(sorted(searches)):
        if index and rate_delay:
            time.sleep(rate_delay)
        row = searches[key]
        original = originals[key]
        count, ids = search(row["query"], original["source"]["pmid"])
        if (not isinstance(count, int) or count < 0 or not isinstance(ids, list)
            or len(ids) > MAX_MATCHES or any(not isinstance(i, str) for i in ids)):
            raise ValueError("Official search returned an unexpected result")
        rows.append({
            "sourceId": key[0], "targetId": key[1],
            "originalPmid": original["source"]["pmid"],
            "sourceCaseSha256": original["contentSha256"],
            "query": row["query"], "reviewFocus": row["reviewFocus"],
            "totalPubMedMatches": count, "candidatePmids": ids,
            "retrievalDisposition": "UNSCREENED_CANDIDATES",
            "medicalVerification": "NOT_ASSESSED",
            "individualVaNexus": "NOT_ASSESSED", "publicationAuthorization": "NOT_GRANTED",
        })
    doc = {
        "schemaVersion": 1, "scope": SCOPE, "sourceLedgerId": LEDGER,
        "sourceClaimRunSha256": origin["runSha256"],
        "searchFixtureSha256": sha(fixture),
        "observedAt": observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "clinicalApprovals": 0, "publicationChanges": 0,
        "contradictionFindings": 0, "abstractBodiesStored": 0,
        "reviewCases": rows,
    }
    doc["runSha256"] = sha(doc)
    validate(doc, inputs)
    output.mkdir(parents=True, exist_ok=True)
    names = ["secondary-candidates-21.json", "secondary-candidates-21-review.csv",
             "secondary-candidates-21-dossier.md"]
    (output / names[0]).write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
    with (output / names[1]).open("w", newline="", encoding="utf8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["sourceId", "targetId", "originalPMID", "totalMatches",
                         "candidatePMIDs", "query", "reviewFocus", "humanStudyScreening",
                         "medicalVerification", "publicationAuthorization"])
        for row in rows:
            writer.writerow([row["sourceId"], row["targetId"], row["originalPmid"],
                             row["totalPubMedMatches"], ";".join(row["candidatePmids"]),
                             row["query"], row["reviewFocus"], "REQUIRED",
                             "NOT_ASSESSED", "NOT_GRANTED"])
    dossier = ["# Independent PubMed candidate discovery: 21 published review cases", "",
        "**Retrieval only. Search matches are neither counterevidence nor clinical support.**",
        "Searches are non-exhaustive, relevance-ranked, and limited to the first 12 records.",
        "A zero-result query is not evidence of absence. No abstracts or full text are saved.",
        "Qualified reviewers must independently examine methods, corrections, populations,",
        "phenotypes, confounders, competing evidence and the exact authored assertion.",
        "All clinical/VA nexus verification and publication authorization remain withheld.", ""]
    for idx, row in enumerate(rows, 1):
        url = "https://pubmed.ncbi.nlm.nih.gov/"
        dossier.extend([f"## {idx}. {row['sourceId']} → {row['targetId']}", "",
                        f"Original cited paper: [PMID {row['originalPmid']}]({url}{row['originalPmid']}/)",
                        "Search: " + row["query"],
                        "Reviewer focus: " + row["reviewFocus"],
                        f"Search reported {row['totalPubMedMatches']} matches; first-page alternatives: {len(row['candidatePmids'])}.",
                        "Unscreened candidates: " + (", ".join(
                            f"[PMID {pmid}]({url}{pmid}/)" for pmid in row["candidatePmids"])
                            or "none returned"),
                        "**Human study-level screening required; NOT_ASSESSED.**", ""])
    (output / names[2]).write_text("\n".join(dossier) + "\n", encoding="utf8")
    manifest = {"runSha256": doc["runSha256"], "reviewCaseCount": REQUIRED,
                "unexaminedCandidateRecords": sum(len(r["candidatePmids"]) for r in rows),
                "clinicalApprovals": 0, "publicationChanges": 0,
                "outputFilesSha256": {n: file_sha(output / n) for n in names}}
    (output / "secondary-candidates-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    return manifest


def verify(source=SOURCE, queries=QUERIES, output=OUT):
    inputs = load_inputs(source, queries)
    doc = validate(json.loads((output / "secondary-candidates-21.json").read_text()), inputs)
    manifest = json.loads((output / "secondary-candidates-manifest.json").read_text())
    expected = {"secondary-candidates-21.json", "secondary-candidates-21-review.csv",
                "secondary-candidates-21-dossier.md"}
    if (manifest.get("runSha256") != doc["runSha256"]
        or manifest.get("reviewCaseCount") != REQUIRED
        or manifest.get("clinicalApprovals") != 0
        or manifest.get("publicationChanges") != 0
        or manifest.get("unexaminedCandidateRecords") != sum(
            len(r["candidatePmids"]) for r in doc["reviewCases"])
        or set(manifest.get("outputFilesSha256", {})) != expected):
        raise ValueError("Independent-source manifest mismatch")
    for name, digest in manifest["outputFilesSha256"].items():
        if file_sha(output / name) != digest:
            raise ValueError("Published research reviewer artifact was changed")
    with (output / "secondary-candidates-21-review.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    if (len(rows) != REQUIRED or [(r["sourceId"], r["targetId"]) for r in rows] != [
            (r["sourceId"], r["targetId"]) for r in doc["reviewCases"]]
        or any(r["humanStudyScreening"] != "REQUIRED" or
               r["medicalVerification"] != "NOT_ASSESSED" or
               r["publicationAuthorization"] != "NOT_GRANTED" for r in rows)):
        raise ValueError("Clinical reviewer queue changed")
    return {"result": "EXACT_SECONDARY_RESEARCH_CANDIDATE_PARITY",
            "cases": REQUIRED, "clinicalApprovals": 0, "publicationChanges": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(output=args.out) if args.verify else build(output=args.out)))
    except Exception as exc:
        print("PubMed candidate research failed closed: " + str(exc)[:120], file=sys.stderr)
        sys.exit(1)
