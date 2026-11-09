#!/usr/bin/env python3
"""DEV-only bounded ontology/coding/literature probes; no human data and no auto approvals."""
import csv
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/tmp/scf-mondo-20261006/staged")
REPO = Path(__file__).resolve().parents[2]
HOSTS = {"www.ebi.ac.uk", "clinicaltables.nlm.nih.gov",
         "api.monarchinitiative.org", "www.ncbi.nlm.nih.gov"}
APP_SAMPLE = (
    "ptsd", "hypothyroidism", "asthma", "fibromyalgia",
    "chronic-fatigue-syndrome", "diabetes-mellitus-type-2",
    "sleep-apnea", "migraine-headaches", "hypertension",
    "depressive-disorder", "chronic-sinusitis", "rheumatoid-arthritis",
)
PROVIDERS = ("ols4", "icd10cm", "monarch", "pubtator3")
OBSERVED = datetime.now(timezone.utc).isoformat(timespec="seconds")
WS = re.compile(r"\s+")
def norm(x):
    return WS.sub(" ", x.strip().lower())


def sha(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False,
        separators=(",", ":")).encode("utf8")).hexdigest()


def fetch(base, params, timeout=15):
    url = base + "?" + urllib.parse.urlencode(params)
    u = urllib.parse.urlsplit(url)
    if u.scheme != "https" or u.hostname not in HOSTS:
        raise ValueError("unapproved public research API host")
    req = urllib.request.Request(url, headers={
        "Accept": "application/json", "User-Agent": "SCF-Ontology-DEV-PublicResearch/1.0"})
    response = urllib.request.urlopen(req, timeout=timeout)
    # Never permit a provider redirect to an unapproved authority.
    final = urllib.parse.urlsplit(response.url)
    if final.scheme != "https" or final.hostname not in HOSTS:
        raise ValueError("unsafe research redirect")
    if int(response.headers.get("content-length") or 0) > 1_000_000:
        raise ValueError("oversized provider payload")
    body = response.read(1_000_001)
    if len(body) > 1_000_000:
        raise ValueError("oversized provider payload")
    return json.loads(body), url


def output(provider, cid, rank, candidate_id, label, relation, status, url,
           version="", metadata=None):
    record = {
        "provider": provider,
        "condition_id": cid,
        "rank": rank,
        "candidate_id": str(candidate_id)[:140],
        "label": str(label)[:220],
        "relation": str(relation)[:80],
        "status": status,
        "source_url": url.split("?", 1)[0],
        "source_version": str(version)[:90],
        "observed_at": OBSERVED,
        "metadata": metadata or {},
        "reviewRequired": True,
    }
    record["content_sha256"] = sha(record)
    return record


def read_inputs():
    source = json.loads((ROOT / "manifest.json").read_text())
    assert source["version"] == "v2026-10-06"
    assert source["appConditionCount"] == 819
    catalog = {}
    for f in sorted((REPO / "data/conditions").glob("*.json")):
        for c in json.loads(f.read_text(encoding="utf-8-sig"))["conditions"]:
            catalog[c["id"]] = c
    assert len(catalog) == 819
    audits = {r["condition_id"]: r for r in csv.DictReader((ROOT / "app_audits.csv").open())}
    candidates = {}
    for r in csv.DictReader((ROOT / "app_candidates.csv").open()):
        candidates.setdefault(r["condition_id"], set()).add(r["concept_id"])
    return source, catalog, audits, candidates


def query_ols(cid, name):
    url = "https://www.ebi.ac.uk/ols4/api/search"
    doc, url = fetch(url, {"q": name, "ontology": "mondo",
                           "queryFields": "label,synonym", "rows": 8})
    results = []
    for r in doc.get("response", {}).get("docs", [])[:8]:
        concept = r.get("obo_id", "")
        if not re.fullmatch(r"MONDO:\d{7}", concept):
            continue
        label = r.get("label", "")
        # Require exact name before identifying a lexical candidate.
        status = "EXACT_LABEL_REVIEW" if norm(label) == norm(name) else "SEARCH_CANDIDATE_REVIEW"
        results.append(output("ols4", cid, len(results) + 1, concept,
            label, "ontology_search", status, url, "OLS4",
            {"ontology": "mondo", "is_obsolete": bool(r.get("is_obsolete", False))}))
        if len(results) >= 5:
            break
    return results or [output("ols4", cid, 0, "-", name,
        "ontology_search", "NO_CANDIDATE", url, "OLS4")]


def query_icd(cid, name):
    url = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
    d, url = fetch(url, {"terms": name, "sf": "name",
                         "count": 8, "df": "code,name"})
    if not isinstance(d, list) or len(d) < 4 or not isinstance(d[3], list):
        raise ValueError("unexpected ICD-10-CM API response shape")
    results = []
    for i, item in enumerate(d[3][:5]):
        if not isinstance(item, list) or len(item) < 2:
            continue
        code, label = item[:2]
        if not re.fullmatch(r"[A-Z][0-9A-Z][0-9A-Z](?:\.[A-Z0-9]{1,4})?", code):
            continue
        status = "EXACT_LABEL_REVIEW" if norm(label) == norm(name) else "CODING_CANDIDATE_REVIEW"
        results.append(output("icd10cm", cid, len(results) + 1, "ICD10CM:" + code,
            label, "diagnostic_code", status, url, "NLM ICD-10-CM 2027",
            {"totalMatchesReported": min(int(d[0]), 10000)}))
    return results or [output("icd10cm", cid, 0, "-", name,
        "diagnostic_code", "NO_CANDIDATE", url, "NLM ICD-10-CM 2027")]


def query_monarch(cid, mondo_id):
    url = "https://api.monarchinitiative.org/v3/api/association"
    doc, url = fetch(url, {"subject": mondo_id, "limit": 5})
    rows = []
    for r in doc.get("items", [])[:5]:
        if not isinstance(r, dict):
            continue
        # KG associations may reflect taxonomy, phenotypes, genes or
        # model organisms. None are individual medical-causality proof.
        subject = r.get("subject") or {}
        obj = r.get("object") or {}
        oid = obj.get("id", "") if isinstance(obj, dict) else str(obj)
        label = obj.get("name", "") if isinstance(obj, dict) else ""
        pred = r.get("predicate", "")
        rows.append(output("monarch", cid, len(rows) + 1, oid or "-",
             label or "Monarch association", pred, "KG_ASSOCIATION_REVIEW",
             url, "Monarch v3",
             {"sourceConcept": mondo_id, "knowledgeLevel": str(r.get("knowledge_level", ""))[:50]}))
    return rows or [output("monarch", cid, 0, "-", "",
        "association_query", "NO_ASSOCIATIONS", url, "Monarch v3",
        {"sourceConcept": mondo_id})]


def query_pubtator(cid, name):
    url = "https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/"
    doc, url = fetch(url, {"text": name, "page": 1}, timeout=20)
    rows = []
    for r in doc.get("results", [])[:3]:
        pmid = str(r.get("pmid", ""))
        if not re.fullmatch(r"\d{6,9}", pmid):
            continue
        rows.append(output("pubtator3", cid, len(rows) + 1, "PMID:" + pmid,
            r.get("title", ""), "literature_mention", "TEXT_MINED_REVIEW",
            url, "PubTator3",
            {"doi": str(r.get("doi") or "")[:100], "notNexusProof": True}))
    return rows or [output("pubtator3", cid, 0, "-", name,
        "literature_query", "NO_CANDIDATE", url, "PubTator3")]


def main():
    source, catalog, audits, candidates = read_inputs()
    observations = []
    errors = []
    for n, cid in enumerate(APP_SAMPLE):
        if cid not in catalog or cid not in audits:
            raise ValueError("sample condition absent from approved catalog")
        name = catalog[cid]["name"]
        calls = [("ols4", lambda: query_ols(cid, name)),
                 ("icd10cm", lambda: query_icd(cid, name))]
        if len(candidates.get(cid, [])) == 1:
            mid = next(iter(candidates[cid]))
            calls.append(("monarch", lambda mid=mid: query_monarch(cid, mid)))
        calls.append(("pubtator3", lambda: query_pubtator(cid, name)))
        for provider, func in calls:
            try:
                rows = func()
                observations.extend(rows)
                if any(r["status"].startswith("NO_") for r in rows):
                    errors.append({"condition_id": cid, "provider": provider,
                                   "status": rows[0]["status"]})
            except Exception as error:
                errors.append({"condition_id": cid, "provider": provider,
                               "status": "PROVIDER_UNAVAILABLE"})
                observations.append(output(provider, cid, 0, "-", name, "provider_query",
                    "PROVIDER_UNAVAILABLE", "https://" + {
                        "ols4": "www.ebi.ac.uk/ols4",
                        "icd10cm": "clinicaltables.nlm.nih.gov",
                        "monarch": "api.monarchinitiative.org",
                        "pubtator3": "www.ncbi.nlm.nih.gov/research/pubtator3/"
                    }[provider]))
            time.sleep(0.45)
        print(json.dumps({"condition": cid, "completed": n + 1,
                          "total": len(APP_SAMPLE)}), flush=True)

    if len(observations) > 300:
        raise ValueError("unbounded ontology enrichment response")
    doc = {
        "base_snapshot": source["snapshot"], "seed": list(APP_SAMPLE),
        "observed_at": OBSERVED, "clinicalApproval": "NOT_GRANTED",
        "observations": observations, "gaps": errors,
    }
    doc["digest"] = sha(doc)
    path = ROOT / "enrichment.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"result": "DEV_ENRICHMENT_COLLECTED", "digest": doc["digest"],
        "records": len(observations), "gaps": len(errors),
        "providerCounts": {p: sum(x["provider"] == p for x in observations)
            for p in PROVIDERS}}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Enrichment failed; no patient content stored", file=sys.stderr)
        sys.exit(1)
