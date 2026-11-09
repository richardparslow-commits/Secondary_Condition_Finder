#!/usr/bin/env python3
"""Stage signed-off MONDO audit subset for the recurring DEV evidence campaign.

The full official release was already hashed/imported in Tiger DEV. This
workflow uses only the frozen 819-condition audit and 565 lexical candidates,
both independently digest-validated against the original official manifest.
No HTTP, patient data, medical adjudication or database write takes place.
"""
import csv
import hashlib
import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "scripts/automation/fixtures/mondo-v2026-10-06"
DEST = Path("/tmp/scf-mondo-20261006/staged")
PINNED_ONTOLOGY = "a165dc2fc61761f5e5413b6395dd4afb14c89d78783af213a9b8f1d0a3f2a8c7"
PINNED_RELEASE = "v2026-10-06"
PINNED_SOURCE_SHA = "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b"
FILES = {
    "app_audits": (819, ["condition_id", "audit_status", "candidate_count"]),
    "app_candidates": (565, ["condition_id", "concept_id", "rule", "matched_term"]),
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf8"))
    if (manifest.get("version") != PINNED_RELEASE
            or manifest.get("source_sha256") != PINNED_SOURCE_SHA
            or manifest.get("snapshot") != PINNED_ONTOLOGY
            or manifest.get("appConditionCount") != 819
            or manifest.get("appPathwayCount") != 875
            or manifest.get("clinicalApproval") != "NOT_GRANTED"):
        raise ValueError("Unapproved MONDO provenance/coverage")
    for name, (count, fields) in FILES.items():
        source = SOURCE / (name + ".csv")
        if sha256(source) != manifest["tables"][name]["sha256"]:
            raise ValueError("Pinned ontology CSV hash mismatch: " + name)
        with source.open(newline="", encoding="utf8") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames != fields or sum(1 for _ in reader) != count:
                raise ValueError("Pinned ontology CSV schema/count mismatch: " + name)

    DEST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        out = DEST / (name + ".csv")
        if out.is_file() and sha256(out) != manifest["tables"][name]["sha256"]:
            raise ValueError("Existing staged audit has changed: refusing overwrite")
    target_manifest = DEST / "manifest.json"
    if target_manifest.is_file():
        if json.loads(target_manifest.read_text(encoding="utf8")) != manifest:
            raise ValueError("Unexpected ontology manifest in staged directory")
    for name in FILES:
        shutil.copyfile(SOURCE / (name + ".csv"), DEST / (name + ".csv"))
    shutil.copyfile(SOURCE / "manifest.json", target_manifest)
    print(json.dumps({
        "status": "PINNED_ONTOLOGY_AUDIT_STAGED",
        "release": PINNED_RELEASE,
        "sourceSHA256": PINNED_SOURCE_SHA,
        "ontologySnapshot": PINNED_ONTOLOGY,
        "appConditions": 819,
        "lexicalCandidates": 565,
        "clinicalApproval": "NOT_GRANTED",
    }))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("Pinned ontology audit stage failed: " + str(exc)[:160], file=sys.stderr)
        sys.exit(1)
