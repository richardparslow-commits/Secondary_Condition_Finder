#!/usr/bin/env python3
"""Auditable public PMID metadata screen. Never clinical approval or Production."""
import argparse,collections,csv,hashlib,io,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"scripts/fixtures/research-dev/directional-public-pubmed-20261109.json"
DEST=ROOT/"docs/research-dev"
FIELDS=["priority","source_id","source_name","target_id","target_name","authored_pathway_type",
 "publication_state","source_pmids","registry_pmids","status_review_pmids","unresolved_pmids",
 "discovery_status","discovered_pmids","flags","clinical_review","snapshot","reviewer",
 "review_date","review_decision"]
def digest(x):
 return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
def prepare():
 doc=json.loads(SOURCE.read_text())
 if doc.get("schemaVersion")!=1 or doc.get("clinicalApproval")!="NOT_GRANTED":raise ValueError("Unsafe source")
 if digest({k:v for k,v in doc.items() if k!="runId"})!=doc.get("runId"):raise ValueError("Source digest mismatch")
 edges=doc.get("edges",[]);articles=doc.get("articles",[]);discovery=doc.get("discoveries",[])
 if len(edges)!=48 or len(discovery)!=48 or len(articles)<1:raise ValueError("Not 48 source edges")
 if len({(x["sourceId"],x["targetId"]) for x in edges})!=48:raise ValueError("Duplicate pathway")
 entries={str(x["pmid"]):x for x in articles}
 if len(entries)!=len(articles):raise ValueError("Duplicate PMID")
 found={(x["sourceId"],x["targetId"]):x for x in discovery}
 if len(found)!=48:raise ValueError("Incomplete discovery")
 rows=[];flag_counts=collections.Counter()
 for edge in sorted(edges,key=lambda x:(x["sourceId"],x["targetId"])):
  pair=(edge["sourceId"],edge["targetId"]);d=found[pair]
  ids=sorted(set(str(x) for x in edge["citationPmids"]))
  if not all(p.isdigit() and 4<=len(p)<=9 for p in ids):raise ValueError("Invalid PMID")
  resolved=[p for p in ids if entries.get(p,{}).get("status")=="METADATA_RETRIEVED"]
  review=[p for p in ids if entries.get(p,{}).get("status")=="PUBLICATION_STATUS_REVIEW"]
  missing=[p for p in ids if p not in resolved+review]
  flags=["DIRECTIONAL_CLAIM_HUMAN_REVIEW","NO_CLINICAL_PROOF_FROM_METADATA"]
  if not ids:flags.append("NO_PMID")
  if missing:flags.append("UNRESOLVED_PMID")
  if review:flags.append("PUBLICATION_STATUS_REVIEW")
  if d["status"]!="CANDIDATES_FOUND":flags.append("NO_KEYWORD_CANDIDATE_MATCH")
  if edge["publicationState"]=="PUBLISHED":flags.append("ALREADY_PUBLISHED_APP_DATA")
  if edge["probabilityAlignment"]=="AT_LEAST_AS_LIKELY_AS_NOT":
   flags.append("INDIVIDUAL_NEXUS_PROBABILITY_LANGUAGE")
  priority="P0" if edge["publicationState"]=="PUBLISHED" or missing or review else "P1"
  flag_counts.update(flags)
  rows.append(dict(priority=priority,source_id=edge["sourceId"],source_name=edge["sourceName"],
    target_id=edge["targetId"],target_name=edge["targetName"],
    authored_pathway_type=edge["nexusClassification"],publication_state=edge["publicationState"],
    source_pmids=";".join(ids),registry_pmids=";".join(resolved),
    status_review_pmids=";".join(review),unresolved_pmids=";".join(missing),
    discovery_status=d["status"],discovered_pmids=";".join(d.get("candidatePmids",[])),
    flags=";".join(flags),clinical_review="NOT_REVIEWED",snapshot=doc["runId"],
    reviewer="",review_date="",review_decision=""))
 cited={p for r in rows for p in r["source_pmids"].split(";") if p}
 metrics={"workstream":"directional-review-48","environment":"DEV_ONLY",
  "source_snapshot":doc["runId"],"source_observed_at":doc["observedAt"],
  "edges":len(rows),"authored_types":dict(collections.Counter(e["nexusClassification"] for e in edges)),
  "already_published_in_app_data":sum(r["publication_state"]=="PUBLISHED" for r in rows),
  "unique_cited_pmids":len(cited),"pubmed_metadata_rows":len(entries),
  "cited_pmids_metadata_present":sum(entries.get(p,{}).get("status")=="METADATA_RETRIEVED" for p in cited),
  "cited_pmids_status_review":sum(entries.get(p,{}).get("status")=="PUBLICATION_STATUS_REVIEW" for p in cited),
  "cited_pmids_unresolved":sum(p not in entries for p in cited),
  "candidate_text_search_hit_edges":sum(r["discovery_status"]=="CANDIDATES_FOUND" for r in rows),
  "priority":dict(collections.Counter(r["priority"] for r in rows)),
  "flag_counts":dict(sorted(flag_counts.items())),
  "independent_clinical_approvals":0,"production_changes":0,
  "next_gate":"Qualified human review of the exact direction, mechanism, article relevance, conflicting evidence and individualized nexus language."}
 if len(rows)!=48 or any(r["clinical_review"]!="NOT_REVIEWED" for r in rows):
  raise AssertionError("Review gate violation")
 return rows,metrics
def rendered(rows,m):
 f=io.StringIO(newline="");w=csv.DictWriter(f,fieldnames=FIELDS,lineterminator="\n")
 w.writeheader();w.writerows(rows)
 report=("# Directional review: 48 unverified public research pathways\n\n"
  "DEV-only PubMed identifier and title/abstract search audit. **This does NOT establish any clinical "
  "causal or aggravation relationship**. Bibliographic registry status and keyword search hits "
  "are not article-level relevance, evidence strength, or an individual nexus determination.\n\n"
  "- Source evidence digest: "+m["source_snapshot"]+"\n"
  "- Previously authored pathways: "+str(m["edges"])+
  " (already published in existing application data: "+str(m["already_published_in_app_data"])+").\n"
  "- Unique cited PMIDs: "+str(m["unique_cited_pmids"])+
  "; registry metadata present: "+str(m["cited_pmids_metadata_present"])+
  "; unresolved: "+str(m["cited_pmids_unresolved"])+".\n"
  "- Candidate text searches with hits: "+str(m["candidate_text_search_hit_edges"])+"/48; a hit is not proof.\n"
  "- Medical approvals: **ZERO**. Production writes: **ZERO**.\n\n"
  "Human reviewer must verify study population, primary claims, A-to-B direction, "
  "alternative explanations, counter-evidence and individual-probability language. "
  "All reviewer fields intentionally blank. Source is public-only and immutable.\n")
 return {"directional-review-48.csv":f.getvalue(),
  "directional-review-48.json":json.dumps({"snapshot":m["source_snapshot"],"rows":rows,"clinicalApproval":"NOT_GRANTED"},indent=2,sort_keys=True)+"\n",
  "directional-coverage.json":json.dumps(m,indent=2,sort_keys=True)+"\n",
  "directional-report.md":report}
def main():
 a=argparse.ArgumentParser();a.add_argument("--check",action="store_true");args=a.parse_args()
 rows,metrics=prepare();output=rendered(rows,metrics)
 for name,content in output.items():
  path=DEST/name
  if args.check:
   if not path.exists() or path.read_text()!=content:raise ValueError("Outdated research report: "+name)
  else:
   DEST.mkdir(parents=True,exist_ok=True);path.write_text(content)
 print(json.dumps({"result":"VERIFIED" if args.check else "GENERATED",
  "edges":48,"snapshot":metrics["source_snapshot"],"cited_pmids":metrics["unique_cited_pmids"],
  "candidate_search_hit_edges":metrics["candidate_text_search_hit_edges"],"clinical_approvals":0}))
if __name__=="__main__":main()
