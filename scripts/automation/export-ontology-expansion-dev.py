#!/usr/bin/env python3
"""Prepare unapproved MONDO disease-concept candidates for DEV-only review.
Pinned official MONDO snapshot must already have exact Tiger DEV row parity.
No app catalog edits, no automatic medical identity matches or diagnoses.
"""
import argparse,collections,csv,hashlib,io,json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
STAGED=Path("/tmp/scf-mondo-20261006/staged")
OUT=ROOT/"docs/research-dev"
PIN="a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7"
SOURCE_SHA256="2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b"
EXPECTED_TABLES=("app_audits","app_candidates","app_pathways","concepts","parents","synonyms","xrefs")
BUCKETS={
 "mental-health":r"depress|anxiet|bipolar|schizo|psychos|post.traumatic|attention.deficit|autis|substance use",
 "tbi-neurology":r"brain injur|encephal|epilep|neuropath|seizur|migraine|parkinson|multiple sclerosis|neurodegener",
 "oncology-tumors":r"cancer|carcinoma|sarcoma|leukemia|lymphoma|neoplas|tumor|glioma",
 "rare-hematology":r"anemia|thrombocyt|hemophil|coagulat|hemoglob|lymphoprolif|myelofibro|neutropenia",
 "skeletal-musculoskeletal":r"arthriti|arthropath|fracture|osteoporos|osteochond|scoliosis|spondyl|tendon",
 "cardiopulmonary":r"cardiomyopath|pulmonary|heart disease|hypox|asthma|sleep apnea|bronchiect",
 "immune-endocrine":r"lupus|diabet|autoimmune|thyroid|adrenal|hypopituit|vasculit|immune deficien",
 "renal-gastrointestinal":r"renal|nephro|hepatitis|cirrho|colitis|pancreatit|kidney|enteritis",
 "rare-genetic":r"congenital|inherited|hereditar|mitochondri|chromosom|gene-related|gene mutation",
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def snapshot_digest(source_sha256,tables):
 return hashlib.sha256((source_sha256+json.dumps(
  {name: table["sha256"] for name,table in tables.items()},sort_keys=True)).encode()).hexdigest()
def validate_manifest(m):
 if m.get("source_sha256")!=SOURCE_SHA256:
  raise ValueError("Unexpected MONDO source digest")
 tables=m.get("tables")
 if not isinstance(tables,dict) or set(tables)!=set(EXPECTED_TABLES):
  raise ValueError("Unexpected ontology table set")
 for name,table in tables.items():
  digest=table.get("sha256") if isinstance(table,dict) else None
  if not isinstance(digest,str) or not re.fullmatch(r"[a-f0-9]{64}",digest):
   raise ValueError("Bad ontology source hash: "+name)
 computed=snapshot_digest(SOURCE_SHA256,tables)
 if m.get("snapshot")!=computed or computed!=PIN:
  raise ValueError("MONDO snapshot digest mismatch")
 return computed
def normalized(v):
 s=unicodedata.normalize("NFKD",str(v).lower())
 s="".join(ch for ch in s if not unicodedata.combining(ch))
 return " ".join(re.findall(r"[a-z0-9]+",s))
def load():
 m=json.loads((STAGED/"manifest.json").read_text())
 if (m.get("version")!="v2026-10-06"
   or m.get("clinicalApproval")!="NOT_GRANTED" or m.get("appConditionCount")!=819):
  raise ValueError("Unexpected MONDO snapshot")
 validate_manifest(m)
 counts={"concepts":36055,"app_candidates":565,"app_audits":819}
 for table in EXPECTED_TABLES:
  f=STAGED/(table+".csv")
  if not f.is_file() or sha(f)!=m["tables"][table]["sha256"]:
   raise ValueError("Bad ontology source hash: "+table)
 tables={}
 for table,n in counts.items():
  f=STAGED/(table+".csv")
  with f.open(newline="",encoding="utf8") as handle:rows=list(csv.DictReader(handle))
  if len(rows)!=n:raise ValueError("Unexpected source count: "+table)
  tables[table]=rows
 app={}
 for file in sorted((ROOT/"data/conditions").glob("*.json")):
  for row in json.loads(file.read_text(encoding="utf-8-sig"))["conditions"]:
   if row["id"] in app:raise ValueError("Duplicate authored disease ID")
   app[row["id"]]=row["name"]
 if len(app)!=819:raise ValueError("Authored condition count changed")
 return m,tables,app
def build(m,tables,app):
 catalog_names={normalized(name) for name in app.values()}
 linked={r["concept_id"] for r in tables["app_candidates"]}
 candidate=[]
 considered=collections.Counter()
 for r in tables["concepts"]:
  if r["obsolete"]!="false":considered["obsolete"]+=1;continue
  label=r["label"].strip(); norm=normalized(label)
  if r["concept_id"] in linked or norm in catalog_names:
   considered["already_lexically_linked"]+=1;continue
  if (not label or len(label)>180 or len(label)<6 or norm in
      {"disease","disorder","syndrome","medical condition","disease of anatomical entity"} or
      label.lower().startswith(("obsolete ","unspecified ","other "))):
   considered["generic_or_ambiguous"]+=1;continue
  # This bucket is merely a text-search triage hint, not a medical classification.
  bucket=next((name for name,rx in BUCKETS.items() if re.search(rx,label,re.I)),"other")
  candidate.append({"mondo_id":r["concept_id"],"label":label,
   "triage_bucket":bucket,"medical_identity":"NOT_REVIEWED",
   "publication_status":"DEV_RESEARCH_ONLY","source_release":m["version"],
   "source_snapshot":m["snapshot"],"reviewer":"","review_date":"","decision":""})
  considered["possible_unlinked"]+=1
 buckets=collections.defaultdict(list)
 for c in candidate:buckets[c["triage_bucket"]].append(c)
 for items in buckets.values():items.sort(key=lambda x:(len(x["label"]),x["mondo_id"]))
 selected=[]
 # Bound reviewer workload; preserve diverse areas rather than selecting only cancers.
 for name in [*BUCKETS,"other"]:
  selected.extend(buckets[name][:100])
 selected.sort(key=lambda x:(x["triage_bucket"],x["mondo_id"]))
 if len(selected)<=819 or len({x["mondo_id"] for x in selected})!=len(selected):
  raise ValueError("Selection must meaningfully expand DEV review candidates")
 metrics={"workstream":"ontology-review-candidates","environment":"DEV_ONLY",
  "release":m["version"],"pinned_snapshot":m["snapshot"],
  "ontology_concepts_total":len(tables["concepts"]),
  "ontology_active":sum(r["obsolete"]=="false" for r in tables["concepts"]),
  "app_catalog_unchanged":len(app),"existing_ontology_crosswalk_rows":len(tables["app_candidates"]),
  "potential_unlinked_concepts":len(candidate),
  "review_queue_rows":len(selected),
  "review_buckets":dict(sorted(collections.Counter(x["triage_bucket"] for x in selected).items())),
  "excluded_counts":dict(considered),"medically_verified_new_conditions":0,
  "automatically_published_to_app":0,
  "source_file_sha256":m["tables"]["concepts"]["sha256"],
  "review_required":"Human medical-terminology reviewer must verify meaning, duplications, obsolescence, ICD/Xref alignment, clinical granularity before catalog promotion."}
 return selected,metrics
def render(rows,m):
 f=io.StringIO(newline=""); w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n")
 w.writeheader();w.writerows(rows)
 md=("# Pinned MONDO ontology expansion — DEV reviewer intake\n\n"
  "Current browser application has 819 authored condition IDs. Existing Tiger Cloud DEV "
  "has independently verified exact-row parity for the pinned MONDO v2026-10-06 snapshot "
  "with 36,055 ontology concepts and 94,313 synonyms. Ontology concepts are not "
  "the same as reviewed clinically diagnosed conditions or A-to-B causal edges.\n\n"
  "- Source digest: "+m["pinned_snapshot"]+"\n"
  "- Active ontology concepts: "+str(m["ontology_active"])+
  "; potential unlinked terms after conservative exclusion: "+str(m["potential_unlinked_concepts"])+".\n"
  "- This first reviewer queue contains "+str(m["review_queue_rows"])+
  " potential additional source identifiers across labeled keyword buckets.\n"
  "- Clinician-verified additions to the shipped app catalog: **ZERO**. "
  "DEV-only review queue, not a Production or diagnosis expansion.\n\n"
  "Every row has a MONDO source identifier and release provenance; heuristic "
  "buckets are NOT clinical taxonomy. Check for duplicate concepts, coding ambiguity, "
  "obsolete terms, false synonyms and phenotype-versus-disease distinctions "
  "before independent approval and any proposed app catalog change.\n")
 return {"ontology-candidate-review.csv":f.getvalue(),
  "ontology-candidate-review.json":json.dumps({"snapshot":m["pinned_snapshot"],"rows":rows,"clinicalApproval":"NOT_GRANTED"},indent=2,sort_keys=True)+"\n",
  "ontology-coverage.json":json.dumps(m,indent=2,sort_keys=True)+"\n",
  "ontology-expansion-report.md":md}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--check",action="store_true");a=ap.parse_args()
 rows,m=build(*load());files=render(rows,m)
 for name,body in files.items():
  p=OUT/name
  if a.check:
   if not p.exists() or p.read_text()!=body:raise ValueError("Report no longer matches pinned source: "+name)
  else:OUT.mkdir(parents=True,exist_ok=True);p.write_text(body)
 print(json.dumps({"result":"VERIFIED" if a.check else "GENERATED",
  "app_catalog":819,"tiger_mondo_concepts":m["ontology_concepts_total"],
  "review_candidates":len(rows),"clinical_approvals":0,"source":m["pinned_snapshot"]}))
if __name__=="__main__":main()
