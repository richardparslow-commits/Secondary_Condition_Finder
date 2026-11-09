"""Synthetic, offline regression tests for research-only candidate discovery."""
import csv
import importlib.util
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "scf_secondary_discovery", ROOT / "scripts/automation/secondary_evidence_discovery.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def synthetic_source(folder):
    queries = json.loads(mod.QUERIES.read_text())
    cases = []
    for i, candidate in enumerate(queries["cases"]):
        pmid = str(10010000 + i)
        source = {"pmid": pmid, "fullTextReviewed": False,
                  "studyToClaimVerified": "NOT_ASSESSED", "abstractRetainedInArtifact": False}
        row = {"sourceId": candidate["sourceId"], "targetId": candidate["targetId"],
               "source": source, "medicalClaimVerification": "NOT_ASSESSED",
               "individualVaNexusAssessment": "NOT_ASSESSED",
               "publicationAuthorization": "NOT_GRANTED", "humanReviewerDecision": "PENDING"}
        row["contentSha256"] = mod.sha(row)
        cases.append(row)
    doc = {"schemaVersion": 1,
           "sourceLedgerId": mod.LEDGER,
           "scope": "PRELIMINARY_ABSTRACT_SCOPE_REVIEW_NOT_MEDICAL_VERIFICATION",
           "clinicalApprovals": 0, "publicationChanges": 0, "individualVaNexusApprovals": 0,
           "humanReviewCases": cases}
    doc["runSha256"] = mod.sha(doc)
    path = folder / "source-claim-21-run.json"
    path.write_text(json.dumps(doc))
    return path


def fake_search(query, original):
    assert "[Title/Abstract]" in query
    return (3, ["99880001", "99880002"])


class SecondaryEvidenceDiscoveryTests(unittest.TestCase):
    def test_official_xml_is_bounded_and_excludes_original(self):
        root = ET.fromstring("""<eSearchResult><Count>4</Count><IdList>
          <Id>10010000</Id><Id>99880001</Id><Id>99880002</Id></IdList></eSearchResult>""")
        self.assertEqual(mod.parse_search(root, "10010000"), (4, ["99880001", "99880002"]))
        root.find("Count").text = "1"
        with self.assertRaises(ValueError):
            mod.parse_search(root, "10010000")

    def test_unofficial_or_duplicate_pubmed_ids_rejected(self):
        for xml in [
            "<error><Count>2</Count></error>",
            "<eSearchResult><Count>2</Count><IdList><Id>12345678</Id><Id>12345678</Id></IdList></eSearchResult>",
            "<eSearchResult><Count>2</Count><IdList><Id>../../secret</Id></IdList></eSearchResult>",
            "<eSearchResult><Count>x</Count><IdList /></eSearchResult>",
        ]:
            with self.subTest(xml=xml), self.assertRaises(ValueError):
                mod.parse_search(ET.fromstring(xml), "10010000")

    def test_full_21_case_artifact_has_no_clinical_claims_and_checksums_match(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = synthetic_source(folder)
            output = folder / "secondary"
            manifest = mod.build(fake_search, source=source, output=output,
                                 observed_at="2026-11-09T18:00:00+00:00", rate_delay=0)
            self.assertEqual(manifest["reviewCaseCount"], 21)
            self.assertEqual(manifest["unexaminedCandidateRecords"], 42)
            self.assertEqual(mod.verify(source=source, output=output)["clinicalApprovals"], 0)
            doc = json.loads((output / "secondary-candidates-21.json").read_text())
            self.assertEqual(len(doc["reviewCases"]), 21)
            self.assertEqual(doc["contradictionFindings"], 0)
            self.assertTrue(all(r["publicationAuthorization"] == "NOT_GRANTED" for r in doc["reviewCases"]))
            with (output / "secondary-candidates-21-review.csv").open() as f:
                self.assertEqual(len(list(csv.DictReader(f))), 21)

    def test_tampering_with_csv_or_manifest_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = synthetic_source(folder)
            output = folder / "secondary"
            mod.build(fake_search, source=source, output=output, rate_delay=0)
            with (output / "secondary-candidates-21-review.csv").open("a") as f:
                f.write("claim,unsupported,VERIFIED\n")
            with self.assertRaises(ValueError):
                mod.verify(source=source, output=output)

    def test_approvals_fail_even_if_all_content_hashes_are_recomputed(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = synthetic_source(folder)
            output = folder / "secondary"
            mod.build(fake_search, source=source, output=output, rate_delay=0)
            doc = json.loads((output / "secondary-candidates-21.json").read_text())
            doc["reviewCases"][0]["medicalVerification"] = "VERIFIED"
            doc["clinicalApprovals"] = 1
            doc["runSha256"] = mod.sha({k: v for k, v in doc.items() if k != "runSha256"})
            with self.assertRaises(ValueError):
                mod.validate(doc, mod.load_inputs(source))

    def test_source_claim_or_curated_query_change_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = synthetic_source(folder)
            doc = json.loads(source.read_text())
            doc["humanReviewCases"][0]["medicalClaimVerification"] = "VERIFIED"
            doc["humanReviewCases"][0]["contentSha256"] = mod.sha({
                k: v for k, v in doc["humanReviewCases"][0].items() if k != "contentSha256"})
            doc["runSha256"] = mod.sha({k: v for k, v in doc.items() if k != "runSha256"})
            source.write_text(json.dumps(doc))
            with self.assertRaises(ValueError):
                mod.load_inputs(source)
            source = synthetic_source(folder)
            fixture = json.loads(mod.QUERIES.read_text())
            fixture["cases"][0]["targetId"] = "not-original-target"
            fixture_path = folder / "modified.json"
            fixture_path.write_text(json.dumps(fixture))
            with self.assertRaises(ValueError):
                mod.load_inputs(source, fixture_path)

    def test_zero_candidate_search_is_not_marked_as_no_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            source = synthetic_source(folder)
            output = folder / "secondary"
            mod.build(lambda q, original: (0, []), source=source, output=output, rate_delay=0)
            doc = json.loads((output / "secondary-candidates-21.json").read_text())
            self.assertTrue(all(r["retrievalDisposition"] == "UNSCREENED_CANDIDATES"
                                for r in doc["reviewCases"]))
            self.assertEqual(mod.verify(source=source, output=output)["result"],
                             "EXACT_SECONDARY_RESEARCH_CANDIDATE_PARITY")

    def test_curated_queries_match_original_preflight_notes(self):
        original = json.loads(
            (ROOT / "scripts/automation/fixtures/clinical-source-21-preflight-notes.json").read_text())
        secondary = json.loads(mod.QUERIES.read_text())
        pairs = lambda d: {(c["sourceId"], c["targetId"]) for c in d["cases"]}
        self.assertEqual(pairs(original), pairs(secondary))


if __name__ == "__main__":
    unittest.main()
