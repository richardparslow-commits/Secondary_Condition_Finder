#!/usr/bin/env python3
"""Supplementary public terminology searches: HPO and Open Targets (DEV only)."""
import json
import hashlib
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path("/tmp/scf-mondo-20261006/staged")
HOSTS = {"www.ebi.ac.uk", "api.platform.opentargets.org"}
def sha(v):
    return hashlib.sha256(json.dumps(v, sort_keys=True, ensure_ascii=False,
        separators=(",", ":")).encode("utf8")).hexdigest()
def get(url, params=None, body=None):
    u = url + ("?" + urllib.parse.urlencode(params) if params else "")
    assert urllib.parse.urlsplit(u).hostname in HOSTS
    req = urllib.request.Request(u,
        headers={"Accept":"application/json", "Content-Type":"application/json",
                 "User-Agent":"SCF-Ontology-DEV-Vocab/1.0"},
        data=json.dumps(body).encode() if body else None,
        method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=16) as r:
        assert urllib.parse.urlsplit(r.url).hostname in HOSTS
        if int(r.headers.get("content-length") or 0) > 200000:
            raise ValueError("oversized public metadata response")
        b = r.read(200001)
        if len(b) > 200000:
            raise ValueError("oversized public metadata response")
        return json.loads(b)

def record(provider, cid, index, id, label, relation, status, source, observed, details={}):
    row = {
        "provider": provider, "condition_id": cid, "rank": index,
        "candidate_id": id[:140], "label": label[:220], "relation": relation,
        "status": status, "source_url": source, "source_version":
            "HPO via OLS4" if provider == "hpo_ols4" else "Open Targets Platform",
        "observed_at": observed, "metadata": details,
        "reviewRequired": True,
    }
    row["content_sha256"] = sha(row)
    return row

def main():
    base = json.loads((ROOT / "enrichment.json").read_text())
    assert len(base["seed"]) == 12
    import csv
    app = {}
    repo = Path(__file__).resolve().parents[2]
    for fp in (repo / "data/conditions").glob("*.json"):
        for c in json.loads(fp.read_text(encoding="utf-8-sig"))["conditions"]:
            app[c["id"]] = c
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = list(base["observations"])
    gaps = list(base["gaps"])
    for cid in base["seed"]:
        name = app[cid]["name"]
        try:
            url = "https://www.ebi.ac.uk/ols4/api/search"
            d = get(url, {"q": name, "ontology": "hp",
                          "queryFields": "label,synonym", "rows": 6})
            candidates = [v for v in d.get("response", {}).get("docs", [])
                if str(v.get("obo_id","")).startswith("HP:") and
                v.get("ontology_name") == "hp"][:3]
            if not candidates:
                rows.append(record("hpo_ols4",cid,0,"-",name,"phenotype_vocab_search",
                    "NO_CANDIDATE",url,now, {"noDiseasePhenotypeInference":True}))
            else:
                for i, v in enumerate(candidates, 1):
                    rows.append(record("hpo_ols4",cid,i,v["obo_id"],
                        str(v.get("label","")),"phenotype_vocab_search",
                        "PHENOTYPE_TERM_REVIEW",url,now,
                        {"noDiseasePhenotypeInference":True}))
        except Exception:
            gaps.append({"condition_id":cid, "provider":"hpo_ols4", "status":"PROVIDER_UNAVAILABLE"})
            rows.append(record("hpo_ols4",cid,0,"-",name,"phenotype_vocab_search",
                "PROVIDER_UNAVAILABLE","https://www.ebi.ac.uk/ols4",now))
        time.sleep(0.45)
        try:
            url = "https://api.platform.opentargets.org/api/v4/graphql"
            body = {"query": "query SearchDisease($term: String!) { search(queryString:$term,entityNames:[\"disease\"],page:{index:0,size:3}) { hits { id name entity } } }",
                    "variables":{"term":name}}
            d = get(url, body=body)
            hits = d.get("data", {}).get("search", {}).get("hits", [])
            if d.get("errors") or not isinstance(hits, list):
                raise ValueError("Unexpected Open Targets response")
            hits = [x for x in hits[:3] if x.get("entity")=="disease"]
            if not hits:
                rows.append(record("opentargets",cid,0,"-",name,"disease_lookup",
                    "NO_CANDIDATE",url,now,{"noNexusInference":True}))
            else:
                for i,x in enumerate(hits,1):
                    rows.append(record("opentargets",cid,i,str(x.get("id","")),
                        str(x.get("name","")),"disease_lookup",
                        "DISEASE_IDENTITY_CANDIDATE_REVIEW",url,now,
                        {"noNexusInference":True}))
        except Exception:
            gaps.append({"condition_id":cid,"provider":"opentargets","status":"PROVIDER_UNAVAILABLE"})
            rows.append(record("opentargets",cid,0,"-",name,"disease_lookup",
                "PROVIDER_UNAVAILABLE","https://api.platform.opentargets.org",now))
        time.sleep(0.45)
        print(json.dumps({"supplementary_completed":cid}),flush=True)
    assert len(rows)<=300
    doc={**base,"observations":rows,"gaps":gaps}
    doc.pop("digest",None)
    doc["digest"]=sha(doc)
    (ROOT/"enrichment-supplemental.json").write_text(
        json.dumps(doc,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print(json.dumps({"result":"SUPPLEMENTAL_TERMINOLOGY_COLLECTED",
        "records":len(rows),"newRecords":len(rows)-len(base["observations"]),
        "digest":doc["digest"],"newGaps":len(gaps)-len(base["gaps"])}))
if __name__ == "__main__":
    try:main()
    except Exception:print("Supplementary public terminology fetch failed",file=sys.stderr);sys.exit(1)
