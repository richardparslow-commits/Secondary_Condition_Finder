"""Offline verification of official candidate bibliography and clinical review gates."""
import csv
import importlib.util
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/automation"))
import secondary_evidence_discovery as discovery
import candidate_publication_preflight as mod
from test_secondary_evidence_discovery import synthetic_source


def official_fixture(ids):
    root = ET.Element("PubmedArticleSet")
    for idx, pmid in enumerate(ids):
        entry = ET.SubElement(root, "PubmedArticle")
        main = ET.SubElement(entry, "MedlineCitation")
        ET.SubElement(main, "PMID").text = pmid
        article = ET.SubElement(main, "Article")
        ET.SubElement(article, "ArticleTitle").text = f"Synthetic study {idx + 1} on medical research questions"
        journal = ET.SubElement(article, "Journal")
        issue = ET.SubElement(journal, "JournalIssue")
        ET.SubElement(ET.SubElement(issue, "PubDate"), "Year").text = "2024"
        ET.SubElement(ET.SubElement(article, "PublicationTypeList"), "PublicationType").text = "Journal Article"
        if idx != 0:
            ET.SubElement(ET.SubElement(article, "Abstract"), "AbstractText").text = (
                "Synthetic abstract marker NEVER_PERSIST_123")
        if idx == 0:
            ET.SubElement(ET.SubElement(main, "CommentsCorrectionsList"),
                          "CommentsCorrections", {"RefType": "ErratumIn"})
    return root


def prepare(folder, search=None):
    original = synthetic_source(folder)
    candidate_out = folder / "candidate-discovery"
    if search is None:
        search = lambda query, original_pmid: (2, ["99880001", "99880002"])
    discovery.build(search, source=original, output=candidate_out, rate_delay=0)
    return original, candidate_out / "secondary-candidates-21.json"


def fetch_fixture(ids):
    return mod.parse_pubmed(official_fixture(ids), set(ids))


class CandidateBibliographyTests(unittest.TestCase):
    def test_official_pubmed_parser_uses_no_abstract_bodies(self):
        docs = fetch_fixture(["99880001", "99880002"])
        self.assertEqual(len(docs), 2)
        self.assertTrue(docs["99880001"]["publicationStatusReviewRequired"])
        self.assertFalse(docs["99880001"]["abstractAvailable"])
        self.assertFalse(docs["99880002"]["publicationStatusReviewRequired"])
        self.assertTrue(docs["99880002"]["abstractAvailable"])
        self.assertNotIn("NEVER_PERSIST_123", json.dumps(docs))
        self.assertTrue(all(p["clinicalSupport"] == "NOT_ASSESSED" for p in docs.values()))

    def test_official_pubmed_response_rejects_missing_and_duplicate_pmids(self):
        root = official_fixture(["99880001"])
        with self.assertRaises(ValueError):
            mod.parse_pubmed(root, {"99880001", "99880002"})
        root.append(root[0])
        with self.assertRaises(ValueError):
            mod.parse_pubmed(root, {"99880001"})
        with self.assertRaises(ValueError):
            mod.parse_pubmed(ET.Element("ErrorResponse"), {"99880001"})

    def test_exact_publication_to_pathway_provenance_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            original, candidate = prepare(folder)
            out = folder / "metadata"
            result = mod.build(source=candidate, original=original, output=out,
                               fetcher=fetch_fixture, observed="2026-11-09T23:00:00+00:00")
            self.assertEqual(result["bibliographicRecords"], 2)
            self.assertEqual(result["caseCandidateLinks"], 42)
            self.assertEqual(result["linkedStatusReviewRecords"], 1)
            self.assertEqual(result["missingAbstractRecords"], 1)
            self.assertEqual(mod.verify(source=candidate, original=original,
                                        output=out)["candidateReviewLinks"], 42)
            self.assertNotIn("NEVER_PERSIST_123", (
                out / "candidate-metadata.json").read_text())
            with (out / "qualified-clinical-screening-EMPTY.csv").open() as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 42)
            self.assertTrue(all(r["disposition"] == "" for r in rows))

    def test_rehashed_clinical_promotion_still_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            original, candidate = prepare(folder)
            out = folder / "metadata"
            mod.build(source=candidate, original=original,
                      output=out, fetcher=fetch_fixture)
            doc = json.loads((out / "candidate-metadata.json").read_text())
            doc["publications"][0]["clinicalSupport"] = "VERIFIED"
            doc["runSha256"] = mod.sha({k: v for k, v in doc.items() if k != "runSha256"})
            with self.assertRaises(ValueError):
                mod.validate(doc, source=candidate, original=original)

    def test_modified_reviewer_csv_or_manifest_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            original, candidate = prepare(folder)
            out = folder / "metadata"
            mod.build(source=candidate, original=original,
                      output=out, fetcher=fetch_fixture)
            with (out / "qualified-clinical-screening-EMPTY.csv").open("a") as handle:
                handle.write("claim,false,VERIFIED\n")
            with self.assertRaises(ValueError):
                mod.verify(source=candidate, original=original, output=out)

    def test_candidate_source_mutation_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            original, candidate = prepare(folder)
            doc = json.loads(candidate.read_text())
            doc["reviewCases"][0]["medicalVerification"] = "VERIFIED"
            doc["runSha256"] = discovery.sha({
                k: v for k, v in doc.items() if k != "runSha256"})
            candidate.write_text(json.dumps(doc))
            with self.assertRaises(ValueError):
                mod.inputs(source=candidate, original=original)

    def test_zero_candidate_results_remain_unverified_not_negative_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            original, candidate = prepare(folder, lambda q, p: (0, []))
            out = folder / "metadata"
            result = mod.build(source=candidate, original=original,
                               output=out, fetcher=lambda ids: {})
            self.assertEqual(result["caseCandidateLinks"], 0)
            self.assertEqual(result["bibliographicRecords"], 0)
            self.assertEqual(mod.verify(source=candidate, original=original,
                                        output=out)["clinicalApprovals"], 0)

    def test_weekly_and_pr_ci_verify_research_only_metadata(self):
        workflow = (ROOT / ".github/workflows/tiger-dev-clinical-accuracy-triage.yml").read_text()
        ci = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("candidate_publication_preflight.py", workflow)
        self.assertIn("candidate_publication_preflight.py --verify", workflow)
        self.assertIn("test_candidate_publication_preflight.py", ci)
        self.assertNotIn("PRODUCTION_DATABASE_URL", workflow)


if __name__ == "__main__":
    unittest.main()
