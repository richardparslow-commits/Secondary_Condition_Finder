#!/usr/bin/env python3
"""Generate conservative, unapproved terminology review suggestions for 375 exceptions.

Derived solely from the pinned official MONDO 2026-10-06 DEV import and the
public 819-condition application catalog. No clinical concepts are approved,
merged, rewritten, or promoted; fuzzy matches are *review hints* only.
"""
import argparse
import csv
import difflib
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGED = Path("/tmp/scf-mondo-20261006/staged")
FIXTURE = ROOT / "scripts/automation/fixtures/mondo-v2026-10-06/identity-review-candidates.json"
EXPECTED_ONTOLOGY = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7"
STATES = {"AMBIGUOUS_LEXICAL_CANDIDATES": 51, "NO_EXACT_ONTOLOGY_MATCH": 324}
SKIP = {"disease", "disorder", "syndrome", "and", "or", "of", "the", "with", "without",
        "other", "unspecified", "condition", "type", "injury", "chronic", "acute"}


def canonical(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(x):
    return hashlib.sha256(canonical(x).encode("utf8")).hexdigest()


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize(s):
    s = unicodedata.normalize("NFKD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def label_index():
    manifest = json.loads((STAGED / "manifest.json").read_text(encoding="utf8"))
    if manifest["snapshot"] != EXPECTED_ONTOLOGY or manifest["appConditionCount"] != 819:
        raise ValueError("Unapproved ontology release")
    counts = {"concepts": 36055, "synonyms": 94313, "app_audits": 819,
              "app_candidates": 565}
    rows = {}
    for name, count in counts.items():
        path = STAGED / (name + ".csv")
        if file_hash(path) != manifest["tables"][name]["sha256"]:
            raise ValueError("Pinned MONDO table digest mismatch: " + name)
        with path.open(newline="", encoding="utf8") as fh:
            rows[name] = list(csv.DictReader(fh))
        if len(rows[name]) != count:
            raise ValueError("Incorrect official ontology subset size: " + name)
    return manifest, rows


def catalog_labels():
    labels = {}
    for path in sorted((ROOT / "data/conditions").glob("*.json")):
        obj = json.loads(path.read_text(encoding="utf-8-sig"))
        for row in obj["conditions"]:
            if row["id"] in labels:
                raise ValueError("Duplicate authored catalog identity")
            labels[row["id"]] = row["name"]
    if len(labels) != 819:
        raise ValueError("Authored catalog size changed")
    return labels


def candidate_score(query, text):
    q = normalize(query)
    t = normalize(text)
    qs, ts = set(q.split()), set(t.split())
    if not qs or not ts or q == t:
        return 0.0
    common = qs & ts
    meaningful = {x for x in common if x not in SKIP and len(x) > 2}
    if not meaningful:
        return 0.0
    overlap = len(meaningful) / max(1, len({x for x in qs if x not in SKIP and len(x) > 2}))
    jaccard = len(common) / len(qs | ts)
    seq = difflib.SequenceMatcher(None, q, t, autojunk=False).ratio()
    return round(0.45 * overlap + 0.25 * jaccard + 0.30 * seq, 4)


def propose(manifest, tables, labels):
    concepts = {r["concept_id"]: r for r in tables["concepts"]}
    if len(concepts) != 36055:
        raise ValueError("Duplicate MONDO concept")
    audits = {r["condition_id"]: r for r in tables["app_audits"]}
    if set(audits) != set(labels):
        raise ValueError("Ontology audit does not match authored IDs")
    existing = defaultdict(list)
    for r in tables["app_candidates"]:
        if r["condition_id"] not in labels or r["concept_id"] not in concepts:
            raise ValueError("Invalid pre-existing lexical candidate")
        existing[r["condition_id"]].append(r)
    term_index = defaultdict(list)
    inverted = defaultdict(set)

    def add_term(mondo, value, scope):
        if mondo not in concepts or concepts[mondo]["obsolete"] == "true":
            return
        norm = normalize(value)
        if len(norm) < 4 or len(norm) > 140:
            return
        key = (mondo, norm)
        # Skip redundant variants and avoid repeated large inverted posting lists.
        if key in term_seen:
            return
        term_seen.add(key)
        if scope != "LABEL" and scope != "EXACT":
            return
        term_index[norm].append((mondo, value, scope))
        for token in set(norm.split()):
            if len(token) > 2 and token not in SKIP:
                inverted[token].add(norm)

    term_seen = set()
    for r in tables["concepts"]:
        add_term(r["concept_id"], r["label"], "LABEL")
    for r in tables["synonyms"]:
        if r["scope"] == "EXACT":
            add_term(r["concept_id"], r["term"], "EXACT")
    records = []
    for cid in sorted(labels):
        audit = audits[cid]
        if audit["audit_status"] not in STATES:
            continue
        authored_name = labels[cid]
        suggested = []
        if audit["audit_status"] == "AMBIGUOUS_LEXICAL_CANDIDATES":
            for raw in sorted(existing[cid], key=lambda r: r["concept_id"]):
                c = concepts[raw["concept_id"]]
                suggested.append({
                    "mondo": raw["concept_id"], "ontologyLabel": c["label"],
                    "sourceTerm": raw["matched_term"], "method": raw["rule"],
                    "obsolete": c["obsolete"] == "true",
                    "replacedBy": c["replaced_by"] or None,
                    "lexicalScore": None,
                    "medicalEquivalence": "NOT_ASSESSED",
                })
        else:
            norm = normalize(authored_name)
            tokens = [t for t in set(norm.split()) if len(t) > 2 and t not in SKIP]
            # Prefer rare significant tokens, then deterministic alphabetical order.
            tokens.sort(key=lambda t: (len(inverted.get(t, ())), t))
            candidates = set()
            for token in tokens[:3]:
                candidates.update(inverted.get(token, ()))
            # Guard broad generic names; no assumption that a weak fuzzy
            # name matches a medical disease concept.
            scores = []
            for term in sorted(candidates):
                score = candidate_score(authored_name, term)
                if score < 0.57:
                    continue
                for mondo, original, method in term_index[term]:
                    scores.append((score, mondo, original, method))
            scores.sort(key=lambda r: (-r[0], r[1], r[2]))
            seen = set()
            for score, mondo, original, method in scores:
                if mondo in seen:
                    continue
                seen.add(mondo)
                suggested.append({
                    "mondo": mondo, "ontologyLabel": concepts[mondo]["label"],
                    "sourceTerm": original, "method": "FUZZY_" + method,
                    "obsolete": False, "replacedBy": None,
                    "lexicalScore": score, "medicalEquivalence": "NOT_ASSESSED",
                })
                if len(suggested) == 3:
                    break
        record = {
            "conditionId": cid,
            "authoredLabel": authored_name,
            "existingOntologyAudit": audit["audit_status"],
            "existingExactCandidateCount": int(audit["candidate_count"]),
            "reviewCandidates": suggested,
            "suggestedMatchesAreMedicalEquivalence": False,
            "humanIdentityReviewState": "NOT_ASSESSED",
            "catalogChangeAuthorized": False,
        }
        record["rowSha256"] = digest(record)
        records.append(record)
    if len(records) != 375:
        raise ValueError("Expected 375 identity exceptions")
    found = Counter(r["existingOntologyAudit"] for r in records)
    if found != STATES:
        raise ValueError("Wrong ontology exception distribution")
    doc = {
        "schemaVersion": 1,
        "ontologySnapshot": manifest["snapshot"],
        "ontologyVersion": manifest["version"],
        "sourceMONDOSHA256": manifest["source_sha256"],
        "inputHashes": {k: manifest["tables"][k]["sha256"] for k in (
            "concepts", "synonyms", "app_audits", "app_candidates")},
        "conditionsNeedingIdentityReview": 375,
        "ambiguousExistingExact": 51, "noExactLexical": 324,
        "clinicalApproval": "NOT_GRANTED", "automaticOntologyDecisions": 0,
        "records": records,
    }
    doc["snapshotSha256"] = digest(doc)
    return doc


def validate_fixture(doc, labels=None):
    if (doc.get("schemaVersion") != 1 or doc.get("ontologySnapshot") != EXPECTED_ONTOLOGY
        or doc.get("conditionsNeedingIdentityReview") != 375
        or doc.get("ambiguousExistingExact") != 51
        or doc.get("noExactLexical") != 324
        or doc.get("automaticOntologyDecisions") != 0
        or doc.get("clinicalApproval") != "NOT_GRANTED"):
        raise ValueError("Unexpected ontology reconciliation configuration")
    if digest({k:v for k,v in doc.items() if k != "snapshotSha256"}) != doc["snapshotSha256"]:
        raise ValueError("Ontology review snapshot tampered")
    seen = set()
    counts = Counter()
    for r in doc["records"]:
        if (r["conditionId"] in seen
            or r["humanIdentityReviewState"] != "NOT_ASSESSED"
            or r["catalogChangeAuthorized"] is not False
            or r["suggestedMatchesAreMedicalEquivalence"] is not False):
            raise ValueError("Invalid/approved identity review row")
        seen.add(r["conditionId"])
        counts[r["existingOntologyAudit"]] += 1
        check = {k:v for k,v in r.items() if k != "rowSha256"}
        if digest(check) != r["rowSha256"]:
            raise ValueError("Ontology identity row altered")
        if labels is not None and labels.get(r["conditionId"]) != r["authoredLabel"]:
            raise ValueError("Authored condition label changed")
        if len(r["reviewCandidates"]) > 30:
            raise ValueError("Unbounded terminology suggestions")
        for c in r["reviewCandidates"]:
            if (c["medicalEquivalence"] != "NOT_ASSESSED"
                or not re.fullmatch(r"MONDO:\d{7}", c["mondo"])):
                raise ValueError("Improperly approved terminology suggestion")
    if len(seen) != 375 or counts != STATES:
        raise ValueError("Ontology exception count/IDs changed")
    return doc


def export_csv(doc, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf8") as fp:
        writer = csv.writer(fp)
        writer.writerow(["conditionId", "authoredLabel", "auditState", "existingExact",
                         "candidateCount", "candidateIds", "candidateLabels",
                         "reviewState", "clinicalEquivalenceVerified"])
        for r in doc["records"]:
            writer.writerow([
                r["conditionId"], r["authoredLabel"], r["existingOntologyAudit"],
                r["existingExactCandidateCount"], len(r["reviewCandidates"]),
                ";".join(c["mondo"] for c in r["reviewCandidates"]),
                ";".join(c["ontologyLabel"] for c in r["reviewCandidates"]),
                r["humanIdentityReviewState"], "NO",
            ])


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--refresh-from-pinned-mondo", action="store_true")
    cli.add_argument("--export", type=Path)
    args = cli.parse_args()
    try:
        labels = catalog_labels()
        if args.refresh_from_pinned_mondo:
            manifest, tables = label_index()
            doc = propose(manifest, tables, labels)
            validate_fixture(doc, labels)
            FIXTURE.parent.mkdir(parents=True, exist_ok=True)
            FIXTURE.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                               encoding="utf8")
        else:
            doc = validate_fixture(json.loads(FIXTURE.read_text(encoding="utf8")), labels)
        if args.export:
            export_csv(doc, args.export)
        print(json.dumps({
            "status": "HUMAN_ONTOLOGY_REVIEW_REQUIRED",
            "snapshotSha256": doc["snapshotSha256"],
            "conditions": 375, "ambiguous": 51, "noExact": 324,
            "withLexicalReviewSuggestions": sum(bool(r["reviewCandidates"])
                                                for r in doc["records"]),
            "automaticallyApproved": 0,
        }))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print("Ontology identity triage failed: " + str(exc)[:160], file=sys.stderr)
        sys.exit(1)
