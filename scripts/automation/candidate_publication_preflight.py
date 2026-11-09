#!/usr/bin/env python3
"""Bounded, immutable bibliographic screening of independent PubMed candidates.

No clinical support, contradiction, VA nexus, study quality or publication
conclusions are made. Abstract and full-text bodies are never stored.
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

import secondary_evidence_discovery as discovery

SOURCE = discovery.OUT / "secondary-candidates-21.json"
OUT = discovery.OUT / "candidate-metadata-preflight"
OFFICIAL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
SCOPE = "OFFICIAL_PUBMED_CANDIDATE_BIBLIOGRAPHY_NOT_CLINICAL_VERIFICATION"
MAX_CANDIDATES = discovery.REQUIRED * discovery.MAX_MATCHES
BATCH = 20
MAX_XML_BYTES = 1_000_000
WARNING = re.compile(r"errat|retract|concern|withdraw", re.IGNORECASE)


def canonical(value):
    return discovery.canonical(value)


def sha(value):
    return hashlib.sha256(canonical(value).encode("utf8")).hexdigest()


def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inputs(source=SOURCE, original=discovery.SOURCE, queries=discovery.QUERIES):
    candidate = json.loads(source.read_text(encoding="utf8"))
    discovery.validate(candidate, discovery.load_inputs(original, queries))
    ids = sorted({pid for row in candidate["reviewCases"] for pid in row["candidatePmids"]})
    if len(ids) > MAX_CANDIDATES or any(not discovery.PMID.fullmatch(pid) for pid in ids):
        raise ValueError("Unbounded or malformed bibliographic candidate cohort")
    return candidate, ids


def _flatten(element):
    if element is None:
        return ""
    return " ".join("".join(element.itertext()).split())


def parse_pubmed(root, requested):
    if root.tag != "PubmedArticleSet" or len(requested) > BATCH:
        raise ValueError("Unexpected PubMed XML response or batch")
    records = {}
    for entry in root:
        if entry.tag not in {"PubmedArticle", "PubmedBookArticle"}:
            raise ValueError("Unexpected publication entry")
        main = (entry.find("./MedlineCitation") or entry.find("./BookDocument"))
        if main is None:
            raise ValueError("Publication without source metadata")
        pmid = (main.findtext("./PMID") or "").strip()
        if pmid not in requested or pmid in records:
            raise ValueError("Duplicate or unexpected official PubMed PMID")
        article = main.find("./Article")
        title_element = (article.find("./ArticleTitle") if article is not None else
                         main.find("./ArticleTitle"))
        if title_element is None:
            title_element = main.find("./Book/BookTitle")
        title = _flatten(title_element)
        if not 5 <= len(title) <= 1200:
            raise ValueError("Missing or unbounded publication title")
        if article is not None:
            types = sorted({_flatten(t) for t in article.findall(
                "./PublicationTypeList/PublicationType") if _flatten(t)})
            abstract = article.find("./Abstract")
            pubdate = article.find("./Journal/JournalIssue/PubDate")
            year = (pubdate.findtext("./Year") or pubdate.findtext("./MedlineDate") or ""
                    if pubdate is not None else "")
        else:
            types = []
            abstract = main.find("./Abstract")
            year = main.findtext("./PubDate/Year") or ""
        corrections = sorted({c.attrib.get("RefType", "UNSPECIFIED")[:75] for c in
                              main.findall("./CommentsCorrectionsList/CommentsCorrections")})
        if len(types) > 50 or len(corrections) > 50:
            raise ValueError("Unbounded official publication metadata")
        records[pmid] = {
            "pmid": pmid, "title": title,
            "publicationTypes": types, "publicationYearText": " ".join(year.split())[:100],
            "abstractAvailable": bool(_flatten(abstract)),
            "correctionOrRetractionTypes": corrections,
            "publicationStatusReviewRequired": any(WARNING.search(c) for c in corrections),
            "bibliographicStatus": "OFFICIAL_RECORD_FOUND",
            "clinicalSupport": "NOT_ASSESSED",
            "medicalReview": "REQUIRED",
            "fullTextReviewed": False, "abstractTextStored": False,
            "publicationAuthorization": "NOT_GRANTED",
        }
    if set(records) != set(requested):
        raise ValueError("Official PubMed records missing from requested cohort")
    return records


def fetch_batch(ids):
    if not 1 <= len(ids) <= BATCH or len(set(ids)) != len(ids) or any(
        not discovery.PMID.fullmatch(i) for i in ids
    ):
        raise ValueError("Invalid bounded official PubMed batch")
    url = OFFICIAL + "?" + urlencode({
        "db": "pubmed", "id": ",".join(ids), "retmode": "xml",
        "tool": "SCFIndependentCandidateMetadataDEV",
    })
    with urlopen(Request(url, headers={
        "User-Agent": "SCFIndependentCandidateMetadataDEV/1.0"}), timeout=30) as response:
        final = urlsplit(response.url)
        if (final.scheme != "https" or final.hostname != "eutils.ncbi.nlm.nih.gov"
            or final.path != "/entrez/eutils/efetch.fcgi"):
            raise ValueError("Official PubMed URL changed unexpectedly")
        payload = response.read(MAX_XML_BYTES + 1)
    if len(payload) > MAX_XML_BYTES:
        raise ValueError("Official PubMed payload exceeds bound")
    return parse_pubmed(ET.fromstring(payload), set(ids))


def fetch_official(ids, delay=0.5):
    if len(ids) > MAX_CANDIDATES or len(set(ids)) != len(ids) or any(
        not discovery.PMID.fullmatch(i) for i in ids
    ):
        raise ValueError("Unbounded or duplicate candidate requests")
    found = {}
    for offset in range(0, len(ids), BATCH):
        if offset and delay:
            time.sleep(delay)
        batch = ids[offset: offset + BATCH]
        part = fetch_batch(batch)
        if set(part) & set(found):
            raise ValueError("Duplicate PubMed metadata across batches")
        found.update(part)
    if set(found) != set(ids):
        raise ValueError("Incomplete official PubMed candidate verification")
    return found


def _check_pub(pub):
    return (isinstance(pub, dict)
            and isinstance(pub.get("pmid"), str)
            and discovery.PMID.fullmatch(pub["pmid"])
            and isinstance(pub.get("title"), str)
            and 5 <= len(pub["title"]) <= 1200
            and isinstance(pub.get("publicationTypes"), list)
            and len(pub["publicationTypes"]) <= 50
            and all(isinstance(t, str) and 0 < len(t) <= 250
                    for t in pub["publicationTypes"])
            and isinstance(pub.get("publicationYearText"), str)
            and len(pub["publicationYearText"]) <= 100
            and isinstance(pub.get("abstractAvailable"), bool)
            and isinstance(pub.get("correctionOrRetractionTypes"), list)
            and len(pub["correctionOrRetractionTypes"]) <= 50
            and all(isinstance(t, str) and 0 < len(t) <= 75
                    for t in pub["correctionOrRetractionTypes"])
            and pub.get("publicationStatusReviewRequired") is
                any(WARNING.search(t) for t in pub["correctionOrRetractionTypes"])
            and pub.get("bibliographicStatus") == "OFFICIAL_RECORD_FOUND"
            and pub.get("clinicalSupport") == "NOT_ASSESSED"
            and pub.get("medicalReview") == "REQUIRED"
            and pub.get("fullTextReviewed") is False
            and pub.get("abstractTextStored") is False
            and pub.get("publicationAuthorization") == "NOT_GRANTED")


def validate(doc, source=SOURCE, original=discovery.SOURCE, queries=discovery.QUERIES):
    candidate, ids = inputs(source, original, queries)
    if (doc.get("schemaVersion") != 1 or doc.get("scope") != SCOPE
        or doc.get("sourceCandidateRunSha256") != candidate["runSha256"]
        or doc.get("sourceLedgerId") != discovery.LEDGER
        or doc.get("clinicalApprovals") != 0 or doc.get("contradictionFindings") != 0
        or doc.get("individualVaNexusApprovals") != 0
        or doc.get("productionChanges") != 0 or doc.get("abstractTextsStored") != 0
        or doc.get("fullTextsReviewed") != 0
        or doc.get("sourcePublicationCount") != len(ids)
        or doc.get("runSha256") != sha({
            k: v for k, v in doc.items() if k != "runSha256"})):
        raise ValueError("Candidate metadata review provenance or governance changed")
    pubs = doc.get("publications", [])
    links = doc.get("caseCandidateLinks", [])
    if (len(pubs) != len(ids) or {p.get("pmid") for p in pubs} != set(ids)
        or any(not _check_pub(pub) for pub in pubs)):
        raise ValueError("Publication records incomplete, malformed, or approved")
    indexed = {p["pmid"]: p for p in pubs}
    expected = [
        (r["sourceId"], r["targetId"], r["originalPmid"], i + 1, pid)
        for r in candidate["reviewCases"]
        for i, pid in enumerate(r["candidatePmids"])
    ]
    if len(links) != len(expected):
        raise ValueError("Not all candidate links are represented")
    for row, expected_key in zip(links, expected):
        if (tuple(row.get(k) for k in
                ["sourceId", "targetId", "originalPmid", "searchRank", "candidatePmid"])
            != expected_key
            or row.get("candidatePmid") not in indexed
            or row.get("studyScreening") != "REQUIRED"
            or row.get("clinicalFinding") != "NOT_ASSESSED"
            or row.get("individualVaNexus") != "NOT_ASSESSED"
            or row.get("publicationAuthorization") != "NOT_GRANTED"):
            raise ValueError("Candidate-to-claim linkage or clinical gate changed")
    return doc


def build(source=SOURCE, output=OUT, fetcher=fetch_official, observed=None,
          original=discovery.SOURCE, queries=discovery.QUERIES):
    candidate, ids = inputs(source, original, queries)
    found = fetcher(ids) if ids else {}
    if set(found) != set(ids) or any(not _check_pub(p) or p["pmid"] != key
                                     for key, p in found.items()):
        raise ValueError("Missing or unsafe candidate publication metadata")
    publications = [found[pmid] for pmid in ids]
    links = [
        {"sourceId": row["sourceId"], "targetId": row["targetId"],
         "originalPmid": row["originalPmid"], "searchRank": rank,
         "candidatePmid": pmid, "studyScreening": "REQUIRED",
         "clinicalFinding": "NOT_ASSESSED", "individualVaNexus": "NOT_ASSESSED",
         "publicationAuthorization": "NOT_GRANTED"}
        for row in candidate["reviewCases"]
        for rank, pmid in enumerate(row["candidatePmids"], 1)
    ]
    doc = {
        "schemaVersion": 1, "scope": SCOPE, "sourceLedgerId": discovery.LEDGER,
        "sourceCandidateRunSha256": candidate["runSha256"],
        "observedAt": observed or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourcePublicationCount": len(ids), "publications": publications,
        "caseCandidateLinks": links,
        "clinicalApprovals": 0, "contradictionFindings": 0,
        "individualVaNexusApprovals": 0, "productionChanges": 0,
        "abstractTextsStored": 0, "fullTextsReviewed": 0,
    }
    doc["runSha256"] = sha(doc)
    validate(doc, source, original, queries)
    output.mkdir(parents=True, exist_ok=True)
    names = ["candidate-metadata.json", "candidate-metadata-review.csv",
             "candidate-metadata-dossier.md", "qualified-clinical-screening-EMPTY.csv"]
    (output / names[0]).write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
    with (output / names[1]).open("w", newline="", encoding="utf8") as handle:
        w = csv.writer(handle)
        w.writerow(["sourceId", "targetId", "originalPMID", "candidatePMID",
                    "searchRank", "title", "publicationTypes", "publicationYearText",
                    "abstractAvailable", "linkedCorrectionsOrRetractions",
                    "humanStudyScreening", "clinicalFinding", "publicationAuthorization"])
        for link in links:
            pub = found[link["candidatePmid"]]
            w.writerow([link["sourceId"], link["targetId"], link["originalPmid"],
                        pub["pmid"], link["searchRank"], pub["title"],
                        "; ".join(pub["publicationTypes"]), pub["publicationYearText"],
                        pub["abstractAvailable"], pub["publicationStatusReviewRequired"],
                        "REQUIRED", "NOT_ASSESSED", "NOT_GRANTED"])
    with (output / names[3]).open("w", newline="", encoding="utf8") as handle:
        w = csv.writer(handle)
        w.writerow(["sourceId", "targetId", "originalPMID", "candidatePMID",
                    "reviewer", "qualifications", "fullTextReviewedOn",
                    "studyDesignAndPopulation", "phenotypeDirectionalityConfounders",
                    "supportVsContradiction", "clinicalRationale", "disposition"])
        for link in links:
            w.writerow([link["sourceId"], link["targetId"], link["originalPmid"],
                        link["candidatePmid"]] + [""] * 8)
    dossier = ["# Candidate publication metadata: exact original source/claim links", "",
               "**Research-only official PubMed bibliography; no clinical study screening.**",
               "A search hit does not constitute supporting or contradicting medical evidence.",
               "All candidate papers and original sources require qualified full-text review.",
               "An absent abstract is not evidence of absence; linked errata require inspection.",
               "No automatic causal inference, individual VA nexus or Production publication.", ""]
    for link in links:
        pub = found[link["candidatePmid"]]
        dossier += [
            f"## {link['sourceId']} → {link['targetId']} (rank {link['searchRank']})", "",
            f"Original reference: https://pubmed.ncbi.nlm.nih.gov/{link['originalPmid']}/",
            f"Candidate record: https://pubmed.ncbi.nlm.nih.gov/{pub['pmid']}/",
            "Official title: " + pub["title"],
            "Publication types: " + (", ".join(pub["publicationTypes"]) or "Not indexed"),
            "Abstract indexed: " + ("yes" if pub["abstractAvailable"] else "no"),
            "Correction/retraction link(s): " + (", ".join(pub["correctionOrRetractionTypes"]) or "none indexed"),
            "**Human study screening REQUIRED; claim support NOT_ASSESSED.**", ""]
    (output / names[2]).write_text("\n".join(dossier) + "\n", encoding="utf8")
    manifest = {
        "runSha256": doc["runSha256"], "sourceCandidateRunSha256": candidate["runSha256"],
        "bibliographicRecords": len(ids), "caseCandidateLinks": len(links),
        "linkedStatusReviewRecords": sum(
            p["publicationStatusReviewRequired"] for p in publications),
        "missingAbstractRecords": sum(not p["abstractAvailable"] for p in publications),
        "clinicalApprovals": 0, "productionChanges": 0,
        "outputFilesSha256": {name: file_sha(output / name) for name in names},
    }
    (output / "candidate-metadata-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    return manifest


def verify(source=SOURCE, output=OUT, original=discovery.SOURCE,
           queries=discovery.QUERIES):
    doc = validate(json.loads((output / "candidate-metadata.json").read_text()),
                   source, original, queries)
    manifest = json.loads((output / "candidate-metadata-manifest.json").read_text())
    names = {"candidate-metadata.json", "candidate-metadata-review.csv",
             "candidate-metadata-dossier.md", "qualified-clinical-screening-EMPTY.csv"}
    if (manifest.get("runSha256") != doc["runSha256"]
        or manifest.get("sourceCandidateRunSha256") != doc["sourceCandidateRunSha256"]
        or manifest.get("bibliographicRecords") != len(doc["publications"])
        or manifest.get("caseCandidateLinks") != len(doc["caseCandidateLinks"])
        or manifest.get("linkedStatusReviewRecords") != sum(
            x["publicationStatusReviewRequired"] for x in doc["publications"])
        or manifest.get("missingAbstractRecords") != sum(
            not x["abstractAvailable"] for x in doc["publications"])
        or manifest.get("clinicalApprovals") != 0
        or manifest.get("productionChanges") != 0
        or set(manifest.get("outputFilesSha256", {})) != names):
        raise ValueError("Research publication manifest mismatch")
    for name, value in manifest["outputFilesSha256"].items():
        if file_sha(output / name) != value:
            raise ValueError("Research publication artifact changed")
    with (output / "candidate-metadata-review.csv").open(newline="", encoding="utf8") as f:
        rows = list(csv.DictReader(f))
    if (len(rows) != len(doc["caseCandidateLinks"])
        or any((r["humanStudyScreening"], r["clinicalFinding"], r["publicationAuthorization"])
               != ("REQUIRED", "NOT_ASSESSED", "NOT_GRANTED") for r in rows)):
        raise ValueError("Review CSV changed or promoted medical evidence")
    with (output / "qualified-clinical-screening-EMPTY.csv").open(
            newline="", encoding="utf8") as f:
        human = list(csv.DictReader(f))
    if (len(human) != len(rows)
        or any(any(v for k, v in row.items() if k not in (
            "sourceId", "targetId", "originalPMID", "candidatePMID")) for row in human)):
        raise ValueError("Qualified-human template cannot contain automatic decisions")
    return {"result": "EXACT_CANDIDATE_PUBMED_METADATA_PARITY",
            "officialPubMedRecords": len(doc["publications"]),
            "candidateReviewLinks": len(doc["caseCandidateLinks"]),
            "clinicalApprovals": 0, "productionChanges": 0}


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--verify", action="store_true")
    args = cli.parse_args()
    try:
        print(json.dumps(verify() if args.verify else build()))
    except Exception as exc:
        print("Independent candidate PubMed metadata failed closed: " +
              str(exc)[:160], file=sys.stderr)
        sys.exit(1)
