#!/usr/bin/env python3
"""Fail visibly on incomplete API/source status; never equate metadata with clinical proof."""
import argparse
import json
import sys
from pathlib import Path

SUMMARY = Path("/tmp/scf-autonomous-directional-evidence/summary.json")


def assess(data):
    if data.get("clinicallyApproved") != 0 or data.get("productionChanges") != 0 or \
            data.get("requiresQualifiedHumanReview") is not True:
        return ["FORBIDDEN_AUTOMATED_CLINICAL_STATE"]
    issues = []
    if data.get("pathways", 0) < 1 or data.get("uniqueCitedPmids", 0) < 1:
        issues.append("INCOMPLETE_AUTHORED_SCOPE")
    if data.get("allPubmedMetadataRecords", 0) < data.get("uniqueCitedPmids", 0):
        issues.append("INCOMPLETE_PUBLICATION_METADATA")
    statuses = data.get("publicationStatuses") or {}
    if statuses.get("PROVIDER_UNAVAILABLE",0) > 0:
        issues.append("PUBMED_PROVIDER_UNAVAILABLE")
    if statuses.get("UNRESOLVED",0) > 0:
        issues.append("PMID_METADATA_UNRESOLVED")
    if statuses.get("PUBLICATION_STATUS_REVIEW",0) > 0:
        issues.append("PUBLICATION_STATUS_REVIEW_REQUIRED")
    if data.get("candidateSearchesUnavailable", 0) > 0:
        issues.append("CANDIDATE_DISCOVERY_API_UNAVAILABLE")
    return issues


if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary", type=Path, default=SUMMARY)
    args = parser.parse_args()
    try:
        report=json.loads(args.summary.read_text())
        concerns=assess(report)
        print(json.dumps({"engineeringQuality":"ATTENTION" if concerns else "PASSED",
                          "issues":concerns,
                          "clinicalProof":"NOT_ASSESSED",
                          "publishedMedicalChanges":0}))
        if concerns:
            sys.exit(2)
    except Exception:
        print("Autonomous evidence health check failed; confidential diagnostics withheld",
              file=sys.stderr)
        sys.exit(1)
