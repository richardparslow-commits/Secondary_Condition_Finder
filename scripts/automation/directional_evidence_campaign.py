#!/usr/bin/env python3
"""Scheduled, public-only PubMed evidence research: never clinical approval."""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LEDGER = Path("/tmp/scf-clinical-review-batch1/clinical-review-ledger.json")
OUTPUT = Path("/tmp/scf-autonomous-directional-evidence")
URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
PMID_RE = re.compile(r"(?:PMID[:\s]*|pubmed\.ncbi\.nlm\.nih\.gov/)(\d{4,9})", re.I)
ID_RE = re.compile(r"^\d{4,9}$")
MAX_EDGES, MAX_PMIDS = 350, 1000


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf8")).hexdigest()


def query_name(value):
    text = re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 -]", " ", str(value))).strip()
    if len(text) < 3 or len(text) > 145:
        raise ValueError("Invalid generic public condition term")
    return text


def inputs(repo=REPO, ledger_file=LEDGER):
    doc = json.loads(ledger_file.read_text())
    if doc.get("clinicalApproval") != "NOT_GRANTED" or \
       doc.get("conditionCount") != 819 or doc.get("pathwayCount") != 875:
        raise ValueError("Expected Batch 1 review-only ledger not staged")
    if doc.get("runId") != digest({k:v for k,v in doc.items() if k!="runId"}):
        raise ValueError("Signed-off clinical-review ledger digest mismatch")
    names = {}
    for file in sorted((repo / "data/conditions").glob("*.json")):
        for c in json.loads(file.read_text(encoding="utf-8-sig"))["conditions"]:
            if c["id"] in names:
                raise ValueError("Duplicate authored condition")
            names[c["id"]] = query_name(c["name"])
    if len(names) != 819:
        raise ValueError("Unreviewed condition-catalog change")
    kb = {}
    for file in sorted((repo / "data/knowledge-base").glob("*.json")):
        node = json.loads(file.read_text(encoding="utf-8-sig"))
        kb[node["id"]] = {x["conditionId"]: x for x in node.get("suggestions", [])}
    edges = []
    cited = set()
    for row in doc["pathways"]:
        directional = row["nexusClassification"] in ("DIRECT_CAUSATION","AGGRAVATION")
        individual = row["publicationState"] == "PUBLISHED" and \
            row["vaNexusProbabilityAlignment"] == "AT_LEAST_AS_LIKELY_AS_NOT"
        if not (directional or individual):
            continue
        source, target = row["sourceId"], row["targetId"]
        refs = kb[source][target]["sourceReferences"]
        ids = sorted({
            pmid for ref in refs for pmid in PMID_RE.findall(
                str(ref.get("citation", "")) + " " + str(ref.get("sourceUrl", "")))
        })
        cited.update(ids)
        edges.append({
            "sourceId":source, "targetId":target,
            "sourceName":names[source], "targetName":names[target],
            "publicationState":row["publicationState"],
            "nexusClassification":row["nexusClassification"],
            "probabilityAlignment":row["vaNexusProbabilityAlignment"],
            "reviewRules":sorted({r["rule"] for r in row["findings"]}),
            "citationPmids":ids,
            "citationCount":len(refs),
            "clinicalDisposition":"HUMAN_REVIEW_REQUIRED",
        })
    edges.sort(key=lambda r:(r["sourceId"],r["targetId"]))
    if not 1 <= len(edges) <= MAX_EDGES or len(cited)>MAX_PMIDS:
        raise ValueError("Unbounded source-research campaign")
    return doc,edges,sorted(cited)


class NCBI:
    def __init__(self, get=None, sleep=time.sleep, key=None):
        self.get = get or self.network_json
        self.sleep = sleep
        self.key = key
        self.last = 0

    @staticmethod
    def network_json(url, timeout=18):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname != "eutils.ncbi.nlm.nih.gov" or \
            parsed.path not in ("/entrez/eutils/esummary.fcgi", "/entrez/eutils/esearch.fcgi"):
            raise ValueError("Unapproved source request")
        req = urllib.request.Request(url, method="GET", headers={
            "User-Agent":"SCF-AutonomousPublicEvidenceDEV/1.0",
            "Accept":"application/json",
        })
        with urllib.request.urlopen(req,timeout=timeout) as response:
            end = urllib.parse.urlsplit(response.url)
            if end.hostname!="eutils.ncbi.nlm.nih.gov" or end.scheme!="https":
                raise ValueError("Unapproved provider redirect")
            if int(response.headers.get("content-length") or 0)>2000000:
                raise ValueError("Oversized provider response")
            raw=response.read(2000001)
            if len(raw)>2000000:
                raise ValueError("Oversized provider response")
            return json.loads(raw)

    def request(self, kind, params):
        if kind not in ("esearch","esummary"):
            raise ValueError("Invalid public research endpoint")
        args={"db":"pubmed","retmode":"json","tool":"SCFPublicEvidenceDEV",**params}
        if self.key:
            args["api_key"]=self.key
        url=URL+kind+".fcgi?"+urllib.parse.urlencode(args)
        for attempt in range(3):
            elapsed=time.monotonic()-self.last
            if self.last and elapsed<0.55:
                self.sleep(0.55-elapsed)
            self.last=time.monotonic()
            try:
                doc=self.get(url,timeout=18)
                root="result" if kind=="esummary" else "esearchresult"
                if not isinstance(doc,dict) or not isinstance(doc.get(root),dict) or "error" in doc:
                    raise ValueError("Invalid medical reference response")
                return doc
            except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,
                    OSError,ValueError,json.JSONDecodeError):
                if attempt<2:
                    self.sleep(2*(attempt+1))
        # Fail safe: URLs may contain keys, so never print exception text.
        raise RuntimeError("NCBI_LOOKUP_UNAVAILABLE") from None


def parse_article(pmid,record):
    if not isinstance(record,dict) or str(record.get("uid"))!=pmid:
        return {"pmid":pmid,"status":"UNRESOLVED","title":"","date":"",
                "doi":"","publicationTypes":[],"metadataHash":""}
    pubtype=[str(t)[:100] for t in record.get("pubtype",[]) if isinstance(t,str)][:20]
    flagged=any(re.search(r"retract|expression of concern|withdraw",t,re.I) for t in pubtype)
    doi=""
    for item in record.get("articleids",[]):
        if isinstance(item,dict) and item.get("idtype")=="doi":
            doi=str(item.get("value",""))[:140]
            break
    data={"pmid":pmid,"status":"PUBLICATION_STATUS_REVIEW" if flagged else "METADATA_RETRIEVED",
          "title":str(record.get("title",""))[:400],
          "date":str(record.get("pubdate",""))[:45],"doi":doi,"publicationTypes":pubtype}
    return {**data,"metadataHash":digest(data)}


def research(edges,ids,client):
    found={}
    for start in range(0,len(ids),45):
        chunk=ids[start:start+45]
        try:
            payload=client.request("esummary",{"id":",".join(chunk)})["result"]
            for pmid in chunk:
                found[pmid]=parse_article(pmid,payload.get(pmid))
        except RuntimeError:
            for pmid in chunk:
                found[pmid]={"pmid":pmid,"status":"PROVIDER_UNAVAILABLE","title":"",
                             "date":"","doi":"","publicationTypes":[],"metadataHash":""}
    discovered=[]
    for index,edge in enumerate(edges):
        q='"'+edge["sourceName"]+'"[Title/Abstract] AND "'+edge["targetName"]+'"[Title/Abstract]'
        try:
            raw=client.request("esearch",{"term":q,"retmax":"5","sort":"relevance"})
            candidates=raw["esearchresult"].get("idlist",[])
            if not isinstance(candidates,list):
                raise ValueError("Malformed article candidate list")
            candidates=list(dict.fromkeys(
                str(x) for x in candidates[:5] if ID_RE.fullmatch(str(x))))
            status="CANDIDATES_FOUND" if candidates else "NO_TEXT_MATCH"
        except (RuntimeError,ValueError):
            candidates=[]
            status="SEARCH_UNAVAILABLE"
        discovered.append({"sourceId":edge["sourceId"],"targetId":edge["targetId"],
                           "candidatePmids":candidates,"status":status,
                           "candidateClinicalSupport":"NOT_ASSESSED"})
        if (index+1)%12==0:
            print(json.dumps({"progress":index+1,"total":len(edges)}),flush=True)
    # Resolve newly discovered *candidate* PMIDs to bibliographic metadata.
    # Candidate search matches never upgrade an authored clinical relationship.
    additional = sorted({pmid for d in discovered for pmid in d["candidatePmids"]} - set(found))
    if len(additional) > MAX_EDGES * 5:
        raise ValueError("Excessive candidate evidence expansion")
    for start in range(0,len(additional),45):
        chunk = additional[start:start+45]
        try:
            payload = client.request("esummary",{"id":",".join(chunk)})["result"]
            for pmid in chunk:
                found[pmid] = parse_article(pmid,payload.get(pmid))
        except RuntimeError:
            for pmid in chunk:
                found[pmid] = {"pmid":pmid,"status":"PROVIDER_UNAVAILABLE","title":"",
                               "date":"","doi":"","publicationTypes":[],"metadataHash":""}
    return [found[x] for x in sorted(found)],discovered


def validate_run(doc):
    if doc["clinicalApproval"]!="NOT_GRANTED" or doc["schemaVersion"]!=1:
        raise ValueError("Unauthorized clinical-use designation")
    if doc.get("runId")!=digest({k:v for k,v in doc.items() if k!="runId"}):
        raise ValueError("Source research digest mismatch")
    edges=doc["edges"]
    discovered=doc["discoveries"]
    articles=doc["articles"]
    if not 1<=len(edges)<=MAX_EDGES or len(discovered)!=len(edges) or \
       len(articles)>MAX_PMIDS:
        raise ValueError("Research coverage mismatch")
    names=set()
    for edge in edges:
        key=(edge["sourceId"],edge["targetId"])
        if key in names or edge["clinicalDisposition"]!="HUMAN_REVIEW_REQUIRED":
            raise ValueError("Invalid clinical-review status")
        names.add(key)
    all_pmids={a["pmid"] for a in articles}
    if len(all_pmids)!=len(articles) or any(not ID_RE.fullmatch(p) for p in all_pmids):
        raise ValueError("Invalid PubMed identifier")
    for a in articles:
        if a["status"] not in ("UNRESOLVED","PROVIDER_UNAVAILABLE",
                              "PUBLICATION_STATUS_REVIEW","METADATA_RETRIEVED"):
            raise ValueError("Unauthorized publication status")
        if a["status"] in ("METADATA_RETRIEVED","PUBLICATION_STATUS_REVIEW") and \
                not a["metadataHash"]:
            raise ValueError("Resolved publication must have immutable metadata digest")
        if a["metadataHash"] and a["metadataHash"]!=digest(
            {k:v for k,v in a.items() if k!="metadataHash"}):
            raise ValueError("Article metadata integrity error")
    if any(not set(x["citationPmids"]).issubset(all_pmids) for x in edges):
        raise ValueError("Missing original citation status")
    for r in discovered:
        if (r["sourceId"],r["targetId"]) not in names or \
           r["candidateClinicalSupport"]!="NOT_ASSESSED" or \
           len(r["candidatePmids"])>5 or \
           r["status"] not in ("CANDIDATES_FOUND","NO_TEXT_MATCH","SEARCH_UNAVAILABLE"):
            raise ValueError("Invalid unapproved evidence candidate")
    return doc


def emit(doc,out):
    validate_run(doc)
    out.mkdir(exist_ok=True,parents=True)
    (out/"evidence-run.json").write_text(json.dumps(doc,indent=2,ensure_ascii=False)+"\n")
    linked={a["pmid"]:a for a in doc["articles"]}
    discovered={(d["sourceId"],d["targetId"]):d for d in doc["discoveries"]}
    keys=["sourceId","targetId","publicationState","nexusClassification",
          "citationPmids","resolvedPmids","statusReviewPmids","unresolvedPmids",
          "discoveryStatus","candidatePmids","reviewRules","clinicalDisposition"]
    with (out/"directional-evidence-review.csv").open("w",newline="",encoding="utf8") as fp:
        writer=csv.DictWriter(fp,fieldnames=keys)
        writer.writeheader()
        for e in doc["edges"]:
            statuses=[linked[p]["status"] for p in e["citationPmids"]]
            d=discovered[(e["sourceId"],e["targetId"])]
            writer.writerow({
                "sourceId":e["sourceId"],"targetId":e["targetId"],
                "publicationState":e["publicationState"],
                "nexusClassification":e["nexusClassification"],
                "citationPmids":";".join(e["citationPmids"]),
                "resolvedPmids":sum(x in ("PUBLICATION_STATUS_REVIEW","METADATA_RETRIEVED")
                                    for x in statuses),
                "statusReviewPmids":sum(x=="PUBLICATION_STATUS_REVIEW" for x in statuses),
                "unresolvedPmids":sum(x in ("UNRESOLVED","PROVIDER_UNAVAILABLE") for x in statuses),
                "discoveryStatus":d["status"],
                "candidatePmids":";".join(d["candidatePmids"]),
                "reviewRules":";".join(e["reviewRules"]),
                "clinicalDisposition":e["clinicalDisposition"],
            })
    states={s:sum(a["status"]==s for a in doc["articles"]) for s in sorted(
        {a["status"] for a in doc["articles"]})}
    summary={
        "runId":doc["runId"],"observedAt":doc["observedAt"],
        "pathways":len(doc["edges"]),
        "publishedPathways":sum(e["publicationState"]=="PUBLISHED" for e in doc["edges"]),
        "uniqueCitedPmids":len(set(p for e in doc["edges"] for p in e["citationPmids"])),
        "allPubmedMetadataRecords":len(doc["articles"]),
        "publicationStatuses":states,
        "candidateSearchesWithHits":sum(x["status"]=="CANDIDATES_FOUND" for x in doc["discoveries"]),
        "candidateSearchesUnavailable":sum(x["status"]=="SEARCH_UNAVAILABLE" for x in doc["discoveries"]),
        "uniqueDiscoveredPmids":len(set(p for d in doc["discoveries"] for p in d["candidatePmids"])),
        "clinicallyApproved":0,"productionChanges":0,"requiresQualifiedHumanReview":True,
    }
    (out/"summary.json").write_text(json.dumps(summary,indent=2,sort_keys=True)+"\n")
    (out/"report.md").write_text(
        "# Autonomous Directional Evidence Review (Tiger Cloud DEV)\n\n"+
        "\n".join("- **"+k+"**: "+str(v) for k,v in summary.items())+
        "\n\n**All PubMed records are metadata/research leads only.** "+
        "No independent clinical verification or VA nexus decisions were made.\n")
    return summary


def run(out=OUTPUT,client=None,repo=REPO,ledger_file=LEDGER,observed_at=None):
    ledger,edges,ids=inputs(repo,ledger_file)
    articles,discovery=research(edges,ids,client or NCBI(key=os.environ.get("NCBI_API_KEY")))
    document={
        "schemaVersion":1,"sourceLedgerId":ledger["runId"],"sourceCommit":os.getenv("GITHUB_SHA",""),
        "observedAt":observed_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "clinicalApproval":"NOT_GRANTED",
        "edges":edges,"articles":articles,"discoveries":discovery,
    }
    document["runId"]=digest(document)
    return emit(document,out)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",default=str(OUTPUT),type=Path)
    args=parser.parse_args()
    try:print(json.dumps(run(out=args.out),sort_keys=True))
    except Exception:
        print("Public evidence collection failed; credential and URL details withheld",file=sys.stderr)
        sys.exit(1)
