#!/usr/bin/env python3
"""Research QA queue for existing authored pathway citations; NOT a medical opinion."""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
STAGED = Path("/tmp/scf-mondo-20261006/staged")
PMID = re.compile(r"(?:PMID[:\s]*|pubmed\.ncbi\.nlm\.nih\.gov/)(\d{4,9})", re.I)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
        separators=(",", ":")).encode("utf8")).hexdigest()


def build():
    manifest = json.loads((STAGED / "manifest.json").read_text())
    assert manifest["appPathwayCount"] == 875
    audits = {r["condition_id"]: r for r in csv.DictReader(
        (STAGED / "app_audits.csv").open(encoding="utf8"))}
    registry = json.loads((REPO / "data/evidence/master-sources.json").read_text())["sources"]
    active_pmids = {str(r["pmid"]) for r in registry if r.get("status") == "active"
        and r.get("pmid")}
    rows = []
    for file in sorted((REPO / "data/knowledge-base").glob("*.json")):
        node = json.loads(file.read_text(encoding="utf-8-sig"))
        parent = node["id"]
        for s in node["suggestions"]:
            target = s["conditionId"]
            if parent not in audits or target not in audits:
                raise ValueError("Existing pathway endpoint missing from condition inventory")
            refs = s.get("sourceReferences", [])
            nexus = (s.get("nexusClaim") or {}).get("nexusClassification", "")
            if nexus not in ("ASSOCIATION_ONLY", "DIRECT_CAUSATION", "AGGRAVATION"):
                raise ValueError("Unexpected nexus classification")
            clinical = [r for r in refs if r.get("verificationScope") == "clinical-evidence"]
            pmids = sorted(set(p for r in refs for p in PMID.findall(
                str(r.get("citation", "")) + " " + str(r.get("sourceUrl", "")))))
            verified = sum(r.get("verified") is True for r in refs)
            clinical_verified = sum(r.get("verified") is True for r in clinical)
            flags = []
            if not refs:
                flags.append("NO_REFERENCES_REVIEW")
            if not clinical:
                flags.append("NO_CLINICAL_REFERENCE_REVIEW")
            if clinical_verified < len(clinical):
                flags.append("UNVERIFIED_CLINICAL_REFERENCE_REVIEW")
            if any(x not in active_pmids for x in pmids):
                flags.append("PMID_REGISTRY_STATUS_REVIEW")
            if nexus != "ASSOCIATION_ONLY":
                flags.append("DIRECTIONAL_NEXUS_REVIEW")
            if (audits[parent]["audit_status"] != "UNIQUE_LEXICAL_CANDIDATE_REVIEW"
                or audits[target]["audit_status"] != "UNIQUE_LEXICAL_CANDIDATE_REVIEW"):
                flags.append("ONTOLOGY_IDENTITY_REVIEW")
            # Citation quantity/status cannot evaluate the study's actual
            # proposition, methodology, directionality or individual nexus.
            flags.append("CLINICAL_CLAIM_UNASSESSED")
            row = {
                "source_id": parent, "target_id": target, "rank": int(s["rank"]),
                "nexus_classification": nexus, "references": len(refs),
                "declared_verified": verified, "clinical_refs": len(clinical),
                "clinical_declared_verified": clinical_verified,
                "pmids_count": len(pmids), "flags": sorted(set(flags)),
                "review_state": "HUMAN_REVIEW_REQUIRED",
            }
            row["content_sha256"] = digest(row)
            rows.append(row)
    assert len(rows) == 875
    assert len({(r["source_id"], r["target_id"]) for r in rows}) == 875
    rows.sort(key=lambda x: (x["source_id"], x["target_id"]))
    payload = {
        "schemaVersion": 1, "ontologySnapshot": manifest["snapshot"],
        "clinicalApproval": "NOT_GRANTED", "rows": rows,
    }
    payload["digest"] = digest(payload)
    (STAGED / "pathway-citation-audit.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    flag_counts = Counter(f for r in rows for f in r["flags"])
    return {
        "snapshot": payload["digest"], "pathways": len(rows),
        "totalReferenceLinks": sum(r["references"] for r in rows),
        "declaredVerified": sum(r["declared_verified"] for r in rows),
        "reviewFlags": dict(flag_counts),
    }


if __name__ == "__main__":
    print(json.dumps(build()))
