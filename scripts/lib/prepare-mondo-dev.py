#!/usr/bin/env python3
"""Pinned MONDO OBO -> versioned public ontology and review queues. No PHI or diagnosis inference."""
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

RELEASE = "v2026-10-06"
SHA256 = "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b"
SOURCE_URL = "https://github.com/monarch-initiative/mondo/releases/download/v2026-10-06/mondo.obo"
SOURCE_FILE = Path("/tmp/scf-mondo-20261006/mondo.obo")
OUT = Path("/tmp/scf-mondo-20261006/staged")
REPO = Path(__file__).resolve().parents[2]
SYNS = re.compile(r'^synonym: "((?:\\\"|[^"])*)" (EXACT|BROAD|NARROW|RELATED)\b')
ID = re.compile(r"^MONDO:\d{7}$")
PARENTS = re.compile(r"^is_a: (MONDO:\d{7})\b")
REF = re.compile(r"^xref: ([^ ]+)")
WS = re.compile(r"\s+")


def norm(s):
    return WS.sub(" ", s.strip().lower())


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as fd:
        for b in iter(lambda: fd.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def csvwrite(name, rows, cols):
    path = OUT / (name + ".csv")
    with path.open("w", newline="", encoding="utf8") as fp:
        writer = csv.writer(fp, lineterminator="\n")
        writer.writerow(cols)
        for row in rows:
            writer.writerow(row)
    ndjson = OUT / (name + ".jsonl")
    with ndjson.open("w", encoding="utf8") as fp:
        for row in rows:
            fp.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"rows": len(rows), "sha256": sha(path), "file": str(path),
            "jsonl": str(ndjson), "jsonl_sha256": sha(ndjson)}


def parse():
    if not SOURCE_FILE.is_file() or sha(SOURCE_FILE) != SHA256:
        raise ValueError("MONDO file digest mismatch: only official pinned 2026-10-06 release accepted")
    concepts = {}
    synonyms = set()
    parents = set()
    refs = set()
    term = {}
    def finish():
        if not term or not ID.fullmatch(term.get("id", "")):
            return
        mid = term["id"]
        if mid in concepts:
            raise ValueError("Duplicate MONDO concept ID")
        concepts[mid] = (mid, term.get("name", ""), term.get("is_obsolete") == "true",
                         term.get("replaced_by", ""), term.get("subset", [])[:8])
        for synonym, scope in term.get("synonym", []):
            if synonym and len(synonym) <= 300:
                synonyms.add((mid, norm(synonym), scope))
        for parent in term.get("parent", []):
            parents.add((mid, parent))
        for ref in term.get("xref", []):
            if len(ref) <= 140:
                refs.add((mid, ref))
    in_term = False
    with SOURCE_FILE.open(encoding="utf8") as fp:
        for raw in fp:
            line = raw.rstrip("\n")
            if line == "[Term]":
                if in_term:
                    finish()
                term = {"synonym": [], "parent": [], "xref": [], "subset": []}
                in_term = True
                continue
            if line.startswith("[") and line.endswith("]"):
                if in_term:
                    finish()
                in_term = False
                continue
            if not in_term:
                continue
            if line.startswith(("id: ", "name: ", "replaced_by: ", "is_obsolete: ")):
                key, value = line.split(": ", 1)
                term[key] = value.strip()
            elif line.startswith("synonym: "):
                m = SYNS.match(line)
                if m:
                    term["synonym"].append((m.group(1).replace(r'\\"', '"'), m.group(2)))
            elif line.startswith("is_a: "):
                m = PARENTS.match(line)
                if m:
                    term["parent"].append(m.group(1))
            elif line.startswith("xref: "):
                m = REF.match(line)
                if m:
                    term["xref"].append(m.group(1))
            elif line.startswith("subset: "):
                term["subset"].append(line[8:].split(" ", 1)[0])
        if in_term:
            finish()
    valid = set(concepts)
    parents = sorted((x, y) for x, y in parents if x in valid and y in valid)
    synonyms = sorted(synonyms)
    refs = sorted(refs)
    rows = sorted(concepts.values())
    return rows, synonyms, parents, refs


def local_catalog():
    conditions = []
    for path in sorted((REPO / "data/conditions").glob("*.json")):
        conditions.extend(json.loads(path.read_text(encoding="utf-8-sig"))["conditions"])
    mappings = {}
    for path in sorted((REPO / "data/knowledge-base").glob("*.json")):
        r = json.loads(path.read_text(encoding="utf-8-sig"))
        mappings[r["id"]] = r
    assert len(conditions) == len(mappings) == 819
    assert len({c["id"] for c in conditions}) == len(conditions)
    return conditions, mappings


def match_local(concepts, synonyms, local, kb):
    labels = defaultdict(set)
    exact = defaultdict(set)
    valid = {row[0] for row in concepts if not row[2]}
    for mid, label, obsolete, _, _ in concepts:
        if not obsolete and label:
            labels[norm(label)].add(mid)
    for mid, synonym, scope in synonyms:
        if mid in valid and scope == "EXACT":
            exact[synonym].add(mid)
    candidates = []
    audits = []
    outcome = {}
    for c in local:
        checks = [("LABEL", norm(c["name"])), ("EXACT_SYNONYM", norm(c["name"]))]
        for alias in c.get("aliases", []):
            checks.extend([("ALIAS_LABEL", norm(alias)), ("ALIAS_EXACT_SYNONYM", norm(alias))])
        ranked = {}
        for rule, word in checks:
            source = labels if rule in ("LABEL", "ALIAS_LABEL") else exact
            for mid in source.get(word, ()):
                previous = ranked.get(mid)
                order = ("LABEL", "EXACT_SYNONYM", "ALIAS_LABEL", "ALIAS_EXACT_SYNONYM")
                if previous is None or order.index(rule) < order.index(previous[0]):
                    ranked[mid] = (rule, word)
        # All candidates are evidence for a possible identity, not approvals.
        for mid, (rule, word) in sorted(ranked.items()):
            candidates.append((c["id"], mid, rule, word))
        if not ranked:
            status = "NO_EXACT_ONTOLOGY_MATCH"
        elif len(ranked) == 1:
            status = "UNIQUE_LEXICAL_CANDIDATE_REVIEW"
        else:
            status = "AMBIGUOUS_LEXICAL_CANDIDATES"
        audits.append((c["id"], status, len(ranked)))
        outcome[c["id"]] = status

    pathways = []
    for primary, mapping in sorted(kb.items()):
        for suggestion in mapping["suggestions"]:
            target = suggestion["conditionId"]
            if primary not in outcome or target not in outcome:
                raise ValueError("Unmapped local pathway endpoint")
            status = "ONTOLOGY_ENDPOINT_REVIEW" if "NO_EXACT" in outcome[primary] or "NO_EXACT" in outcome[target] else "CAUSALITY_UNVERIFIED"
            pathways.append((primary, target, suggestion["rank"], status))
    if len(pathways) != 875:
        raise ValueError("Existing pathway count unexpectedly changed")
    return sorted(candidates), sorted(audits), sorted(pathways)


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    concepts, synonyms, parents, refs = parse()
    local, kb = local_catalog()
    candidates, audits, pathways = match_local(concepts, synonyms, local, kb)
    tables = {
        "concepts": csvwrite("concepts", [(id, name, "true" if obsolete else "false", replacement)
            for id, name, obsolete, replacement, _ in concepts],
            ["concept_id", "label", "obsolete", "replaced_by"]),
        "synonyms": csvwrite("synonyms", synonyms, ["concept_id", "term", "scope"]),
        "parents": csvwrite("parents", parents, ["child_id", "parent_id"]),
        "xrefs": csvwrite("xrefs", refs, ["concept_id", "xref"]),
        "app_candidates": csvwrite("app_candidates", candidates, ["condition_id", "concept_id", "rule", "matched_term"]),
        "app_audits": csvwrite("app_audits", audits, ["condition_id", "audit_status", "candidate_count"]),
        "app_pathways": csvwrite("app_pathways", pathways, ["source_id", "target_id", "rank", "audit_status"]),
    }
    counts = {s: sum(a[1] == s for a in audits) for s in sorted({a[1] for a in audits})}
    info = {
        "source": SOURCE_URL, "source_sha256": SHA256, "version": RELEASE,
        "snapshot": hashlib.sha256((SHA256 + json.dumps(
            {name: table["sha256"] for name, table in tables.items()}, sort_keys=True)).encode()).hexdigest(),
        "tables": tables, "conditionCoverage": counts, "appConditionCount": len(local),
        "appPathwayCount": len(pathways), "clinicalApproval": "NOT_GRANTED",
        "attribution": "MONDO Disease Ontology, CC BY 4.0, Monarch Initiative.",
    }
    (OUT / "manifest.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf8")
    print(json.dumps({k: info[k] for k in ("version", "snapshot", "conditionCoverage", "appConditionCount", "appPathwayCount") } |
        {"rows": {k: v["rows"] for k, v in tables.items()}}))
    return info


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("MONDO parsing / snapshot verification failed: " + str(error)[:200], file=sys.stderr)
        sys.exit(1)
