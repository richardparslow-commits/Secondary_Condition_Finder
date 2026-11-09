#!/usr/bin/env python3
"""Research-only claim-specific PubMed abstract preflight for 21 published edges.

Curated notes are preliminary readings of the cited PUBMED ABSTRACT and only
identify scope/limitations requiring qualified-human review. Full source text
is not downloaded, stored, or implied to have been evaluated. This script
never approves medical causation, VA nexus, diagnosis or publication changes.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "scripts/automation/fixtures/clinical-source-21-preflight-notes.json"
PACKETS = Path("/tmp/scf-source-to-claim-review/review-packets.jsonl")
OUT = Path("/tmp/scf-source-specific-review")
SOURCE_LEDGER = "dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa"
OFFICIAL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
RESEARCH_STATUS = "PRELIMINARY_ABSTRACT_SCOPE_REVIEW_NOT_MEDICAL_VERIFICATION"
PMID_RE = re.compile(r"\bPMID[\s:]*(\d{4,9})\b", re.I)
MAX_XML_BYTES = 2_000_000
EXPECTED_RECORDS = 20
EXPECTED_CASES = 21


def canonical(v):
    return json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha(v):
    return hashlib.sha256(canonical(v).encode("utf8")).hexdigest()


def sha_file(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def require_curated():
    src = json.loads(NOTES.read_text(encoding="utf8"))
    if (src["schemaVersion"] != 1 or src["sourceLedgerId"] != SOURCE_LEDGER
        or src["reviewBasis"] != "PUBLIC_PUBMED_ABSTRACT_RESEARCH_TRIAGE_ONLY"
        or len(src["cases"]) != EXPECTED_CASES):
        raise ValueError("Curated evidence preflight cohort mismatch")
    keyed = {}
    for note in src["cases"]:
        key = (note["sourceId"], note["targetId"])
        if key in keyed or not re.fullmatch(r"\d{4,9}", note["pmid"]):
            raise ValueError("Duplicate case or invalid official PMID")
        for field in ("scope", "preliminaryAbstractFinding", "importantLimit", "reviewerQuestion"):
            if not isinstance(note[field], str) or not 15 <= len(note[field]) <= 1000:
                raise ValueError("Curated statement missing/unbounded")
        if (note["assessmentBasis"] != "PUBMED_ABSTRACT_ONLY"
            or note["clinicalApproval"] != "NOT_GRANTED"
            or note["exactClaimVerified"] is not False
            or note["individualVaNexus"] != "NOT_ASSESSED"
            or note["fullTextHumanReview"] != "REQUIRED"):
            raise ValueError("Unapproved clinical evidence status")
        keyed[key] = note
    return src, keyed


def require_authored(curated):
    original = {}
    with PACKETS.open(encoding="utf8") as f:
        for line in f:
            row = json.loads(line)
            if row["priority"] != 0:
                continue
            if (row["clinicalReview"] != "HUMAN_SOURCE_TO_CLAIM_REVIEW_REQUIRED"
                or row["publicationState"] != "PUBLISHED"
                or row["publicationAuthorization"] != "NOT_GRANTED"
                or row["claimSpecificEvidenceAssessment"] != "NOT_ASSESSED"
                or sha({k: v for k, v in row.items()
                        if k != "contentSha256"}) != row["contentSha256"]):
                raise ValueError("Authored high-priority review packet changed")
            key = (row["sourceId"], row["targetId"])
            if key in original or len(row["references"]) != 1:
                raise ValueError("Unapproved multi-reference/duplicate priority pathway")
            original[key] = row
    if set(original) != set(curated) or len(original) != EXPECTED_CASES:
        raise ValueError("Curated source/case identities disagree with reviewed 21")
    for key, note in curated.items():
        ref = original[key]["references"][0]
        ids = set(PMID_RE.findall(ref["citation"] + " " + ref["sourceUrl"]))
        if ids != {note["pmid"]} or not ref["sourceUrl"].startswith(
                "https://pubmed.ncbi.nlm.nih.gov/" + note["pmid"] + "/"):
            raise ValueError("Curated source does not match original PubMed citation")
    if len({x["pmid"] for x in curated.values()}) != EXPECTED_RECORDS:
        raise ValueError("Incorrect number of distinct authored PubMed sources")
    return original


def fetch_official(ids):
    """Returns parsed ephemeral XML root; only safe fields are emitted later."""
    if (len(ids) != EXPECTED_RECORDS or len(set(ids)) != len(ids)
        or any(not re.fullmatch(r"\d{4,9}", x) for x in ids)):
        raise ValueError("Untrusted/unbounded official research request")
    url = OFFICIAL + "?" + urlencode({
        "db": "pubmed", "id": ",".join(sorted(ids)), "retmode": "xml",
        "tool": "SCFSourceSpecificResearchDev",
    })
    req = Request(url, headers={"User-Agent": "SCFSourceSpecificResearchDev/1.0"})
    with urlopen(req, timeout=30) as res:
        url_parsed = urlsplit(res.url)
        if (url_parsed.scheme != "https"
            or url_parsed.hostname != "eutils.ncbi.nlm.nih.gov"
            or url_parsed.path != "/entrez/eutils/efetch.fcgi"):
            raise ValueError("Unapproved official PubMed redirect")
        xml = res.read(MAX_XML_BYTES + 1)
        if len(xml) > MAX_XML_BYTES:
            raise ValueError("Oversized official PubMed response")
    root = ET.fromstring(xml)
    if root.tag != "PubmedArticleSet":
        raise ValueError("Unexpected official PubMed XML")
    return root


def parse_publications(root, ids):
    found = {}
    for entry in root.findall("./PubmedArticle"):
        pmid = (entry.findtext("./MedlineCitation/PMID") or "").strip()
        if pmid not in ids or pmid in found:
            raise ValueError("Unrecognized/duplicate PubMed source")
        title_el = entry.find("./MedlineCitation/Article/ArticleTitle")
        title = " ".join("".join(title_el.itertext()).split()) if title_el is not None else ""
        if not 10 <= len(title) <= 750:
            raise ValueError("Missing/malformed official PubMed title")
        abstract_el = entry.find("./MedlineCitation/Article/Abstract")
        abstract = " ".join("".join(abstract_el.itertext()).split()) if abstract_el is not None else ""
        types = sorted({x.text.strip() for x in entry.findall(
            "./MedlineCitation/Article/PublicationTypeList/PublicationType")
            if x.text})
        corrections = sorted({x.attrib.get("RefType", "OTHER") for x in
            entry.findall("./MedlineCitation/CommentsCorrectionsList/CommentsCorrections")})
        if not types:
            raise ValueError("Missing publication type metadata")
        warning = [kind for kind in corrections if
                   re.search(r"retract|errat|concern|withdraw", kind, re.I)]
        found[pmid] = {
            "pmid": pmid,
            "title": title,
            "publicationTypes": types,
            "commentOrCorrectionTypes": corrections,
            "correctionOrRetractionReviewRequired": bool(warning),
            "abstractAvailable": bool(abstract),
            "ephemeralAbstractSha256": hashlib.sha256(abstract.encode("utf8")).hexdigest()
                if abstract else None,
            "abstractRetainedInArtifact": False,
            "fullTextReviewed": False,
            "studyToClaimVerified": "NOT_ASSESSED",
        }
    if set(found) != set(ids):
        raise ValueError("Incomplete official PubMed source cohort")
    return found


def build(official_root=None, output=OUT, observed_at=None):
    fixture, notes = require_curated()
    authored = require_authored(notes)
    ids = sorted({r["pmid"] for r in notes.values()})
    root = official_root if official_root is not None else fetch_official(ids)
    refs = parse_publications(root, ids)
    items = []
    for key in sorted(authored):
        packet = authored[key]
        note = notes[key]
        study = refs[note["pmid"]]
        detail = {
            "sourceId": key[0], "targetId": key[1],
            "sourceName": packet["sourceName"], "targetName": packet["targetName"],
            "originalAuthoredClassification": packet["authoredNexusClassification"],
            "originalAuthoredProbabilityLanguage": packet["authoredVaProbabilityAlignment"],
            "originalCitation": packet["references"][0]["citation"],
            "originalSourceURL": packet["references"][0]["sourceUrl"],
            "previouslyDeclaredCitationVerified":
                packet["references"][0]["previouslyDeclaredVerified"],
            "source": study,
            "abstractContext": {
                "scope": note["scope"],
                "preliminaryReading": note["preliminaryAbstractFinding"],
                "importantLimit": note["importantLimit"],
                "questionForQualifiedReviewer": note["reviewerQuestion"],
                "basis": "CURATED_PUBMED_ABSTRACT_ONLY",
                "automatedClinicalVerification": "NOT_PERFORMED",
                "humanFullTextReview": "REQUIRED",
            },
            "sourceReviewWarning": ("OFFICIAL_ABSTRACT_UNAVAILABLE"
                if not study["abstractAvailable"] else
                "CORRECTION_OR_RETRACTION_LINKED"
                if study["correctionOrRetractionReviewRequired"] else
                "ABSTRACT_REVIEW_ONLY"),
            "medicalClaimVerification": "NOT_ASSESSED",
            "individualVaNexusAssessment": "NOT_ASSESSED",
            "publicationAuthorization": "NOT_GRANTED",
            "humanReviewerDecision": "PENDING",
        }
        detail["contentSha256"] = sha(detail)
        items.append(detail)
    doc = {
        "schemaVersion": 1,
        "scope": RESEARCH_STATUS,
        "sourceLedgerId": SOURCE_LEDGER,
        "curatedNotesSha256": sha_file(NOTES),
        "authoredReviewPacketCount": 21,
        "officialPubMedSourceCount": 20,
        "observedAt": observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "clinicalApprovals": 0,
        "humanReviewCases": items,
        "originalAbstractsStored": 0,
        "individualVaNexusApprovals": 0,
        "publicationChanges": 0,
    }
    doc["runSha256"] = sha(doc)
    validate(doc)
    output.mkdir(parents=True, exist_ok=True)
    (output / "source-claim-21-run.json").write_text(
        json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    with (output / "source-claim-21-review.csv").open("w", newline="", encoding="utf8") as out:
        writer = csv.writer(out)
        writer.writerow(["sourceId", "targetId", "PMID", "reviewScope",
            "abstractAvailable", "correctionReviewRequired", "sourceWarning",
            "preliminaryReading", "importantLimit", "qualifiedReviewerQuestion",
            "clinicalVerification", "humanDecision", "contentSha256"])
        for row in items:
            s, v = row["source"], row["abstractContext"]
            writer.writerow([row["sourceId"], row["targetId"], s["pmid"], v["scope"],
                s["abstractAvailable"], s["correctionOrRetractionReviewRequired"],
                row["sourceReviewWarning"], v["preliminaryReading"],
                v["importantLimit"], v["questionForQualifiedReviewer"],
                row["medicalClaimVerification"], row["humanReviewerDecision"],
                row["contentSha256"]])
    with (output / "qualified-human-decision-EMPTY.csv").open(
            "w", newline="", encoding="utf8") as out:
        writer = csv.writer(out)
        writer.writerow(["sourceId", "targetId", "PMID", "clinicalReviewer",
            "reviewerQualifications", "reviewedOn", "fullTextSectionsChecked",
            "studyDesignAndPopulation", "exactClaimSupport", "directionality",
            "competingExplanations", "clinicalDisposition", "reasonedEvidenceAssessment"])
        for row in items:
            writer.writerow([row["sourceId"], row["targetId"],
                row["source"]["pmid"]] + [""] * 10)
    dossier = [
        "# 21 published medical relationship — preliminary cited-source review", "",
        "**Research-only abstract preflight. Not a qualified clinical review, medical",
        "causation finding, individual VA nexus decision, or permission to modify the app.**", "",
        "The original 21 citations were compared to 20 live PubMed source records.",
        "No full-text clinical papers were reviewed or reproduced in this report.",
        "Every proposed relationship still requires qualified source-to-claim review.", "",
    ]
    for i, row in enumerate(items, 1):
        pub = row["source"]
        scope = row["abstractContext"]
        dossier.extend([
            f"## {i}. {row['sourceName']} → {row['targetName']}", "",
            f"- Original authored classification: `{row['originalAuthoredClassification']}`",
            f"- Source: [PMID {pub['pmid']}](https://pubmed.ncbi.nlm.nih.gov/{pub['pmid']}/) — {pub['title']}",
            "- Source study metadata: " + ", ".join(pub["publicationTypes"]),
            "- Bibliographic warning: " + row["sourceReviewWarning"],
            "- Preliminary scope: " + scope["scope"],
            "- Abstract-derived research reading (not clinically approved): " + scope["preliminaryReading"],
            "- Important scope limitation: " + scope["importantLimit"],
            "- Qualified reviewer question: " + scope["questionForQualifiedReviewer"],
            "- **Medical claim verification: NOT ASSESSED; no individual nexus or publication authorization.**", "",
        ])
    (output / "source-claim-21-dossier.md").write_text(
        "\n".join(dossier) + "\n", encoding="utf8")
    summary = {
        "result": "PUBMED_ABSTRACT_SCOPE_RESEARCH_ONLY",
        "runSha256": doc["runSha256"],
        "caseCount": 21, "uniqueCitedPmids": 20,
        "absentAbstractSources": sorted({row["source"]["pmid"] for row in items
                if not row["source"]["abstractAvailable"]}),
        "correctionReviewPmids": sorted({row["source"]["pmid"] for row in items
                if row["source"]["correctionOrRetractionReviewRequired"]}),
        "scopeTypes": dict(sorted(Counter(
            row["abstractContext"]["scope"] for row in items).items())),
        "fullTextsReviewedByWorkflow": 0,
        "clinicalApprovals": 0,
        "individualVaNexusApprovals": 0, "productionChanges": 0,
    }
    summary["outputFilesSha256"] = {
        name: sha_file(output / name) for name in (
            "source-claim-21-run.json", "source-claim-21-review.csv",
            "qualified-human-decision-EMPTY.csv", "source-claim-21-dossier.md")
    }
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n",
                                           encoding="utf8")
    return summary


def validate(doc):
    if (doc["schemaVersion"] != 1 or doc["scope"] != RESEARCH_STATUS
        or doc["sourceLedgerId"] != SOURCE_LEDGER or doc["curatedNotesSha256"] != sha_file(NOTES)
        or doc["authoredReviewPacketCount"] != EXPECTED_CASES
        or doc["officialPubMedSourceCount"] != EXPECTED_RECORDS
        or doc["clinicalApprovals"] != 0 or doc["publicationChanges"] != 0
        or doc["originalAbstractsStored"] != 0
        or doc["individualVaNexusApprovals"] != 0
        or len(doc["humanReviewCases"]) != EXPECTED_CASES
        or sha({k:v for k,v in doc.items() if k!="runSha256"}) != doc["runSha256"]):
        raise ValueError("Source-specific report tampered or unauthorized")
    keys, pmids = set(), set()
    for row in doc["humanReviewCases"]:
        key = (row["sourceId"], row["targetId"])
        if key in keys or row["source"]["pmid"] not in (
                {r["pmid"] for r in require_curated()[1].values()}):
            raise ValueError("Duplicate/unrecognized source-specific case")
        keys.add(key)
        pmids.add(row["source"]["pmid"])
        if (row["medicalClaimVerification"] != "NOT_ASSESSED"
            or row["publicationAuthorization"] != "NOT_GRANTED"
            or row["humanReviewerDecision"] != "PENDING"
            or row["individualVaNexusAssessment"] != "NOT_ASSESSED"
            or row["source"]["fullTextReviewed"] is not False
            or row["source"]["abstractRetainedInArtifact"] is not False
            or row["source"]["studyToClaimVerified"] != "NOT_ASSESSED"
            or row["abstractContext"]["automatedClinicalVerification"] != "NOT_PERFORMED"
            or sha({k:v for k,v in row.items() if k!="contentSha256"}) != row["contentSha256"]):
            raise ValueError("Source-specific case not in mandatory review state")
    if keys != set(require_curated()[1]) or len(pmids) != 20:
        raise ValueError("Source-specific inventory incomplete")
    return doc


def verify(output=OUT):
    doc = validate(json.loads((output / "source-claim-21-run.json").read_text(encoding="utf8")))
    summary = json.loads((output / "summary.json").read_text(encoding="utf8"))
    if (summary["runSha256"] != doc["runSha256"] or summary["caseCount"] != 21
        or summary["clinicalApprovals"] != 0 or summary["productionChanges"] != 0
        or set(summary.get("outputFilesSha256", {})) != {
            "source-claim-21-run.json", "source-claim-21-review.csv",
            "qualified-human-decision-EMPTY.csv", "source-claim-21-dossier.md"}):
        raise ValueError("Preflight manifest mismatch")
    for name, claimed_hash in summary["outputFilesSha256"].items():
        if sha_file(output / name) != claimed_hash:
            raise ValueError("Preflight review artifact changed: " + name)
    with (output / "source-claim-21-review.csv").open(newline="", encoding="utf8") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 21 or { (x["sourceId"],x["targetId"]) for x in rows} != {
        (x["sourceId"],x["targetId"]) for x in doc["humanReviewCases"]}:
        raise ValueError("Source-specific CSV inconsistent")
    with (output / "qualified-human-decision-EMPTY.csv").open(
            newline="", encoding="utf8") as f:
        decisions = list(csv.DictReader(f))
    if len(decisions)!=21 or any(row["clinicalDisposition"] for row in decisions):
        raise ValueError("Premature qualified-human medical disposition")
    return {"result":"EXACT_SOURCE_SPECIFIC_REVIEW_PARITY",
            "cases":21,"uniquePubMed":20,"clinicalApprovals":0}


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--out", type=Path, default=OUT)
    cli.add_argument("--verify", action="store_true")
    args = cli.parse_args()
    try:
        print(json.dumps(verify(args.out) if args.verify else build(output=args.out)))
    except Exception as e:
        print("Source-specific research preflight failed: " + str(e)[:180], file=sys.stderr)
        sys.exit(1)
