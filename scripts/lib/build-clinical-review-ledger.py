#!/usr/bin/env python3
"""Batch 1: deterministic, review-only clinical-mapping contradiction ledger.

All inputs are committed public KB/condition data plus the authenticated
MONDO DEV source manifest/staging. This never makes clinical judgments,
changes authored rankings or marks citations verified.
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
STAGING = Path("/tmp/scf-mondo-20261006/staged")
OUT = Path("/tmp/scf-clinical-review-batch1")
ONTOLOGY_SHA = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7"
VERSION = 1
VALID_NEXUS = {"ASSOCIATION_ONLY", "DIRECT_CAUSATION", "AGGRAVATION"}
VALID_ONTOLOGY = {
    "UNIQUE_LEXICAL_CANDIDATE_REVIEW",
    "AMBIGUOUS_LEXICAL_CANDIDATES",
    "NO_EXACT_ONTOLOGY_MATCH",
}
HIGH = "HIGH"
REVIEW = "REVIEW"
# These patterns are *signals of potential contradiction*, not clinical
# judgments. Each high-severity finding requires qualified-human disposition.
ASSOCIATION_LIMITS = [
    ("BIDIRECTIONAL_ONLY_SIGNAL", re.compile(
        r"\b(?:probably|likely|potentially) bidirectional\b", re.I)),
    ("ASSOCIATION_NOT_CAUSATION_SIGNAL", re.compile(
        r"\b(?:association(?:[- ]only|[- ]focused)|association,\s*not\s*(?:automatic\s+)?(?:individual\s+)?causation)\b",
        re.I)),
    ("NO_CAUSATION_PROOF_SIGNAL", re.compile(
        r"\b(?:rather than proving|does not (?:establish|prove|demonstrate)|"
        r"(?:insufficient|not sufficient) to establish|"
        r"cannot (?:establish|demonstrate|prove))\b.{0,75}\bcaus(?:ation|al|e)\b", re.I)),
]
INDIVIDUAL_ASSERTION = re.compile(
    r"(?:(?:for|in) (?:this|the) individual's presentation|"
    r"(?:supports|establishes) (?:the )?nexus at the at-least-as-likely-as-not level|"
    r"at[- ]least[- ]as[- ]likely[- ]as[- ]not (?:for|in) (?:this|the) individual)",
    re.I,
)
WS = re.compile(r"\s+")


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf8")).hexdigest()


def digest_paths(paths):
    return digest([(str(path.relative_to(REPO)), hashlib.sha256(path.read_bytes()).hexdigest())
                   for path in sorted(paths)])


def normalize(s):
    return WS.sub(" ", str(s).strip().lower())


def require_reference_ontology():
    manifest = json.loads((STAGING / "manifest.json").read_text(encoding="utf8"))
    if manifest["snapshot"] != ONTOLOGY_SHA or manifest["appConditionCount"] != 819:
        raise RuntimeError("Pinned MONDO review snapshot missing or unexpected")
    expected = {
        "app_audits": (819, ["condition_id", "audit_status", "candidate_count"]),
        "app_candidates": (565, ["condition_id", "concept_id", "rule", "matched_term"]),
    }
    rows = {}
    for name, (count, header) in expected.items():
        path = STAGING / f"{name}.csv"
        if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["tables"][name]["sha256"]:
            raise RuntimeError(f"Untrusted ontology staging file: {name}")
        with path.open(encoding="utf8", newline="") as fp:
            rdr = csv.DictReader(fp)
            if rdr.fieldnames != header:
                raise RuntimeError(f"Incorrect ontology header: {name}")
            items = list(rdr)
        if len(items) != count:
            raise RuntimeError(f"Unexpected ontology rows: {name}")
        rows[name] = items
    audits = {}
    for r in rows["app_audits"]:
        if r["condition_id"] in audits or r["audit_status"] not in VALID_ONTOLOGY:
            raise RuntimeError("Duplicate or invalid ontology audit")
        audits[r["condition_id"]] = r
    candidates = defaultdict(list)
    for r in rows["app_candidates"]:
        if r["condition_id"] not in audits or not re.fullmatch(r"MONDO:\d{7}", r["concept_id"]):
            raise RuntimeError("Ontology candidate unknown or invalid")
        candidates[r["condition_id"]].append(r["concept_id"])
    for cid, row in audits.items():
        if int(row["candidate_count"]) != len(candidates[cid]):
            raise RuntimeError(f"Ontology candidate count mismatch: {cid}")
    return audits, candidates


def public_content():
    conditions = {}
    mappings = {}
    condition_files = sorted((REPO / "data/conditions").glob("*.json"))
    mapping_files = sorted((REPO / "data/knowledge-base").glob("*.json"))
    for path in condition_files:
        for cond in json.loads(path.read_text(encoding="utf-8-sig"))["conditions"]:
            cid = cond["id"]
            if cid in conditions:
                raise RuntimeError(f"Duplicate condition identity: {cid}")
            conditions[cid] = cond
    for path in mapping_files:
        row = json.loads(path.read_text(encoding="utf-8-sig"))
        if row["id"] in mappings:
            raise RuntimeError("Duplicate KB identity")
        mappings[row["id"]] = row
    if len(conditions) != 819 or len(mappings) != 819 or set(conditions) != set(mappings):
        raise RuntimeError("Condition/KB identity drift: fail closed")
    return conditions, mappings, digest_paths(condition_files), digest_paths(mapping_files)


def patterns(text):
    signals = set()
    for name, pattern in ASSOCIATION_LIMITS:
        if pattern.search(text):
            signals.add(name)
    return sorted(signals)


def scan_relationship(mapping, item, active_pmids):
    """Conservative rule-based *review* findings. Never make medical findings."""
    from_suggestion = {
        "rationale": str(item.get("rationale", "")),
        "etiologicalTrigger": str((item.get("nexusClaim") or {}).get("etiologicalTrigger", "")),
        "sourceNote": " ".join(str(r.get("note", "")) for r in item.get("sourceReferences", [])),
    }
    classification = (item.get("nexusClaim") or {}).get("nexusClassification", "")
    if classification not in VALID_NEXUS:
        raise RuntimeError("Unexpected nexus classification")

    profile = item.get("evidentiaryProfile") or {}
    mechanism = item.get("causalMechanism") or {}
    source_refs = item.get("sourceReferences") or []
    clinical = [r for r in source_refs if r.get("verificationScope") == "clinical-evidence"]
    findings = []

    def flag(rule, severity, field, evidence):
        findings.append({"rule": rule, "severity": severity,
                         "field": field, "signal": evidence[:90]})

    if classification != "ASSOCIATION_ONLY":
        for field, text in from_suggestion.items():
            for signal in patterns(text):
                flag("CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE",
                     HIGH, field, signal)
        if mechanism.get("hypothesizedOnly") is True:
            flag("CAUSAL_CLASSIFICATION_WITH_HYPOTHESIZED_MECHANISM",
                 HIGH, "causalMechanism.hypothesizedOnly", "hypothesizedOnly=true")
    if INDIVIDUAL_ASSERTION.search(str(profile.get("conservativeRationale", ""))):
        flag("INDIVIDUAL_NEXUS_ASSERTION_IN_GENERIC_KNOWLEDGE_BASE",
             HIGH, "evidentiaryProfile.conservativeRationale",
             "individual-case language in generic mapping")
    if profile.get("vaNexusProbabilityAlignment") == "AT_LEAST_AS_LIKELY_AS_NOT":
        flag("INDIVIDUAL_PROBABILITY_ALIGNMENT_REVIEW",
             HIGH, "evidentiaryProfile.vaNexusProbabilityAlignment",
             "at-least-as-likely-as-not assigned without case facts")
    if classification != "ASSOCIATION_ONLY":
        flag("DIRECTIONAL_RELATIONSHIP_REVIEW",
             REVIEW, "nexusClaim.nexusClassification", classification)
    if not clinical:
        flag("NO_CLINICAL_EVIDENCE_REFERENCE", REVIEW,
             "sourceReferences.verificationScope", "no clinical-evidence source")
    elif any(r.get("verified") is not True for r in clinical):
        flag("CLINICAL_REFERENCE_STATUS_REVIEW", REVIEW,
             "sourceReferences.verified", "at least one clinical reference not verified")
    if any(r.get("authorityCategory") in
           ("statutory-authority", "current-regulatory-authority",
            "federal-register-final-rule", "va-adjudication-guidance")
           and r.get("verificationScope") == "clinical-evidence" for r in source_refs):
        flag("LEGAL_AUTHORITY_MISUSED_AS_CLINICAL_EVIDENCE", HIGH,
             "sourceReferences.authorityCategory", "legal document as clinical evidence")

    pmid_regex = re.compile(r"(?:PMID[:\s]*|pubmed\.ncbi\.nlm\.nih\.gov/)(\d{4,9})", re.I)
    citation_pmids = sorted({p for r in source_refs for p in pmid_regex.findall(
        str(r.get("citation", "")) + " " + str(r.get("sourceUrl", "")))})
    if any(p not in active_pmids for p in citation_pmids):
        flag("SOURCE_REGISTRY_REVIEW", REVIEW,
             "sourceReferences", "at least one PMID absent from active registry")

    # Reference verified=true is *previously declared*, not reassessed here.
    return sorted(findings, key=lambda x:
                  (0 if x["severity"] == HIGH else 1, x["rule"], x["field"], x["signal"])), {
        "clinicalRefCount": len(clinical),
        "citationCount": len(source_refs),
        "declaredVerified": sum(r.get("verified") is True for r in source_refs),
        "clinicalDeclaredVerified": sum(r.get("verified") is True for r in clinical),
        "pmidCount": len(citation_pmids),
        "nexusClassification": classification,
        "vaNexusProbabilityAlignment": str(profile.get("vaNexusProbabilityAlignment", "NOT_ASSERTED")),
    }


def build():
    audits, candidates = require_reference_ontology()
    conditions, mappings, catalog_digest, kb_digest = public_content()
    registry = json.loads((REPO / "data/evidence/master-sources.json").read_text(encoding="utf8"))
    active_pmids = {str(x["pmid"]) for x in registry["sources"]
                    if x.get("status") == "active" and x.get("pmid")}
    sources_digest = hashlib.sha256((REPO / "data/evidence/master-sources.json").read_bytes()).hexdigest()
    rows_conditions, rows_edges = [], []
    for cid in sorted(conditions):
        m = mappings[cid]
        ontology = audits.get(cid)
        if ontology is None:
            raise RuntimeError("Condition missing ontology coverage")
        outgoing = m.get("suggestions", [])
        condition = {
            "id": cid, "name": conditions[cid]["name"],
            "publicationState": "DRAFT" if m.get("draft") is True else "PUBLISHED",
            "outgoingCount": len(outgoing),
            "ontologyStatus": ontology["audit_status"],
            "ontologyCandidateCount": int(ontology["candidate_count"]),
            "ontologyCandidateIds": sorted(candidates[cid]),
            "reviewState": "HUMAN_IDENTITY_REVIEW_REQUIRED",
            "clinicalApproval": "NOT_GRANTED",
        }
        condition["contentSha256"] = digest(condition)
        rows_conditions.append(condition)
        seen_rank = set()
        for item in outgoing:
            target = item.get("conditionId")
            if target not in conditions:
                raise RuntimeError("Unknown authored target " + str(target))
            rank = item.get("rank")
            if not isinstance(rank, int) or rank < 1 or rank in seen_rank:
                raise RuntimeError("Invalid/duplicate authored rank for " + cid)
            seen_rank.add(rank)
            findings, refs = scan_relationship(m, item, active_pmids)
            if audits[cid]["audit_status"] != "UNIQUE_LEXICAL_CANDIDATE_REVIEW" or \
               audits[target]["audit_status"] != "UNIQUE_LEXICAL_CANDIDATE_REVIEW":
                findings.append({"rule": "ONTOLOGY_ENDPOINT_IDENTITY_REVIEW",
                                 "severity": REVIEW, "field": "ontologyStatus",
                                 "signal": "one or both endpoint identities need review"})
            findings.sort(key=lambda x: (0 if x["severity"] == HIGH else 1,
                                         x["rule"], x["field"], x["signal"]))
            edge = {
                "sourceId": cid, "targetId": target, "rank": rank,
                "publicationState": condition["publicationState"],
                "nexusClassification": refs["nexusClassification"],
                "vaNexusProbabilityAlignment": refs["vaNexusProbabilityAlignment"],
                "citationCount": refs["citationCount"],
                "declaredVerified": refs["declaredVerified"],
                "clinicalRefCount": refs["clinicalRefCount"],
                "clinicalDeclaredVerified": refs["clinicalDeclaredVerified"],
                "pmidCount": refs["pmidCount"],
                "findings": findings,
                "reviewState": "HUMAN_CLINICAL_REVIEW_REQUIRED",
                "clinicalApproval": "NOT_GRANTED",
            }
            edge["contentSha256"] = digest(edge)
            rows_edges.append(edge)
    rows_edges.sort(key=lambda x: (x["sourceId"], x["rank"], x["targetId"]))
    if len(rows_conditions) != 819 or len(rows_edges) != 875 or len({
        (x["sourceId"], x["targetId"]) for x in rows_edges}) != 875:
        raise RuntimeError("Dataset coverage mismatch")
    total_citations = sum(x["citationCount"] for x in rows_edges)
    if total_citations != 1704:
        raise RuntimeError("Reference count changed: requires new review baseline")
    manifest = {
        "schemaVersion": VERSION,
        "clinicalApproval": "NOT_GRANTED",
        "ontologySnapshot": ONTOLOGY_SHA,
        "catalogDigest": catalog_digest,
        "knowledgeBaseDigest": kb_digest,
        "sourceRegistryDigest": sources_digest,
        "conditionCount": len(rows_conditions),
        "pathwayCount": len(rows_edges),
        "sourceReferenceCount": total_citations,
        "conditions": rows_conditions,
        "pathways": rows_edges,
    }
    manifest["runId"] = digest(manifest)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "clinical-review-ledger.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf8")

    summary_rules = Counter(f["rule"] for e in rows_edges for f in e["findings"])
    flagged_edges = sum(any(f["severity"] == HIGH for f in e["findings"]) for e in rows_edges)
    published_flagged = sum(
        e["publicationState"] == "PUBLISHED" and
        any(f["severity"] == HIGH for f in e["findings"]) for e in rows_edges)
    summary = {
        "runId": manifest["runId"],
        "conditions": 819,
        "pathways": 875,
        "referenceLinks": total_citations,
        "publishedConditions": sum(c["publicationState"] == "PUBLISHED" for c in rows_conditions),
        "publishedPathways": sum(e["publicationState"] == "PUBLISHED" for e in rows_edges),
        "uniqueOntologyCandidates": sum(c["ontologyStatus"] == "UNIQUE_LEXICAL_CANDIDATE_REVIEW"
                                          for c in rows_conditions),
        "ambiguousOntologyIdentities": sum(c["ontologyStatus"] == "AMBIGUOUS_LEXICAL_CANDIDATES"
                                           for c in rows_conditions),
        "noExactOntologyMatches": sum(c["ontologyStatus"] == "NO_EXACT_ONTOLOGY_MATCH"
                                      for c in rows_conditions),
        "highSeverityReviewPathways": flagged_edges,
        "publishedHighSeverityReviewPathways": published_flagged,
        "ruleCounts": dict(sorted(summary_rules.items())),
        "automatedMedicalApprovals": 0,
    }
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf8")
    for name, rows, cols in (
        ("condition-review-queue.csv", rows_conditions,
         ["id", "name", "publicationState", "outgoingCount", "ontologyStatus",
          "ontologyCandidateCount", "ontologyCandidateIds", "reviewState", "contentSha256"]),
        ("pathway-contradiction-queue.csv", rows_edges,
         ["sourceId", "targetId", "rank", "publicationState", "nexusClassification",
          "vaNexusProbabilityAlignment", "citationCount", "declaredVerified",
          "clinicalRefCount", "clinicalDeclaredVerified", "findings",
          "reviewState", "contentSha256"]),
    ):
        with (OUT / name).open("w", encoding="utf8", newline="") as fp:
            writer = csv.writer(fp)
            writer.writerow(cols)
            for row in rows:
                writer.writerow([json.dumps(row[col], ensure_ascii=False)
                                 if isinstance(row[col], (list, dict)) else row[col] for col in cols])
    return summary


if __name__ == "__main__":
    try:
        print(json.dumps(build()))
    except Exception as exc:
        print("Clinical-review ledger generation failed: " + str(exc)[:220], file=sys.stderr)
        sys.exit(1)
