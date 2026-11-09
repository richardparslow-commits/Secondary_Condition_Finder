"""Synthetic/fixture clinical-accuracy triage tests; not tests of medical validity."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/automation"))
import ontology_identity_triage as identity
import clinical_accuracy_triage as triage


class SyntheticPubMed:
    def __init__(self, fail=False):
        self.fail = fail

    def request(self, kind, params):
        if self.fail:
            raise RuntimeError("provider unavailable")
        assert kind == "esummary"
        ids = params["id"].split(",")
        return {"result": {
            pid: {
                "uid": pid, "title": "Synthetic bibliographic record " + pid,
                "pubdate": "2026", "pubtype": ["Journal Article"],
                "articleids": [],
            } for pid in ids
        }}


class ClinicalAccuracyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads(identity.FIXTURE.read_text())
        cls.priority = triage.load_priority()[0] if triage.PACKETS.exists() else None

    def test_375_exception_invariant_and_no_auto_identity_mapping(self):
        labels = identity.catalog_labels()
        identity.validate_fixture(self.fixture, labels)
        self.assertEqual(len(self.fixture["records"]), 375)
        self.assertEqual(sum(bool(x["reviewCandidates"]) for x in self.fixture["records"]), 195)
        self.assertEqual(sum(
            x["existingOntologyAudit"] == "AMBIGUOUS_LEXICAL_CANDIDATES"
            for x in self.fixture["records"]), 51)
        self.assertTrue(all(not x["catalogChangeAuthorized"]
                            for x in self.fixture["records"]))

    def test_ontology_tamper_and_approval_rejected(self):
        modified = copy.deepcopy(self.fixture)
        modified["records"][0]["humanIdentityReviewState"] = "APPROVED"
        with self.assertRaises(ValueError):
            identity.validate_fixture(modified)
        modified = copy.deepcopy(self.fixture)
        modified["records"][0]["reviewCandidates"].append({
            "mondo": "MONDO:0000001", "medicalEquivalence": "APPROVED"})
        with self.assertRaises(ValueError):
            identity.validate_fixture(modified)

    def test_lexical_scoring_rejects_unrelated_labels(self):
        self.assertEqual(identity.candidate_score(
            "Obstructive Sleep Apnea", "Liver cirrhosis"), 0.0)
        self.assertEqual(identity.candidate_score("cancer", "cancer"), 0.0)
        self.assertGreater(identity.candidate_score(
            "adjustment disorders", "adjustment disorder"), 0.6)

    def test_human_gate_and_complete_21_case_pubmed_summary(self):
        if self.priority is None:
            self.skipTest("Source claim packets not staged")
        ids = triage.load_priority()[1]
        self.assertEqual(len(ids), 20)
        supplements = {p: {
            "abstractPresent": True, "publicationCorrectionTypes": [],
            "retractionOrConcernSignal": False,
        } for p in ids}
        with tempfile.TemporaryDirectory() as t:
            doc = triage.build(client=SyntheticPubMed(), extracted=supplements,
                observed="2026-11-09T12:00:00Z", output=Path(t))
            self.assertEqual(doc["bibliographicMetadataChecked"], 20)
            self.assertEqual(doc["efetchRecordsChecked"], 20)
            self.assertEqual(doc["highPriorityPublishedPathways"], 21)
            self.assertEqual(doc["automaticClinicalApprovals"], 0)
            self.assertEqual(doc["automaticTerminologyApprovals"], 0)
            self.assertTrue(all(x["medicalClaimVerification"] == "NOT_ASSESSED"
                                for x in doc["priorityPathways"]))
            triage.validate(json.loads((Path(t)/"triage-run.json").read_text()),self.fixture)

    def test_unavailable_provider_remains_unresolved_and_unapproved(self):
        if self.priority is None:
            self.skipTest("Source claim packets not staged")
        with tempfile.TemporaryDirectory() as t:
            doc = triage.build(client=SyntheticPubMed(fail=True), extracted={},
                observed="2026-11-09T12:00:00Z", output=Path(t))
            self.assertEqual(doc["bibliographicMetadataChecked"], 0)
            self.assertEqual(doc["efetchRecordsChecked"], 0)
            self.assertTrue(all(m["verificationRecommendation"] ==
                "SOURCE_METADATA_UNRESOLVED" for m in doc["publicationMetadata"]))
            self.assertEqual(doc["automaticClinicalApprovals"], 0)

    def test_retraction_signal_preserved_for_urgent_review_not_auto_rejection(self):
        if self.priority is None:
            self.skipTest("Source claim packets not staged")
        ids = triage.load_priority()[1]
        supplements = {p: {
            "abstractPresent": True, "publicationCorrectionTypes": [],
            "retractionOrConcernSignal": False,
        } for p in ids}
        supplements[ids[0]]["publicationCorrectionTypes"] = ["RetractionIn"]
        supplements[ids[0]]["retractionOrConcernSignal"] = True
        with tempfile.TemporaryDirectory() as t:
            doc = triage.build(client=SyntheticPubMed(), extracted=supplements,
                observed="2026-11-09T12:00:00Z",output=Path(t))
            self.assertEqual(doc["pubmedStatusAlerts"],1)
            self.assertEqual(doc["publicationMetadata"][0]
                             ["verificationRecommendation"],
                             "URGENT_PUBLICATION_STATUS_REVIEW")
            self.assertEqual(doc["automaticClinicalApprovals"],0)

    def test_citation_approval_tamper_fails_closed(self):
        if self.priority is None:
            self.skipTest("Source claim packets not staged")
        ids=triage.load_priority()[1]
        supplements={p:{"abstractPresent":False,"publicationCorrectionTypes":[],
                       "retractionOrConcernSignal":False} for p in ids}
        with tempfile.TemporaryDirectory() as t:
            doc=triage.build(client=SyntheticPubMed(),extracted=supplements,
                observed="2026-11-09T12:00:00Z",output=Path(t))
            altered=copy.deepcopy(doc)
            altered["automaticClinicalApprovals"]=1
            with self.assertRaises(ValueError):
                triage.validate(altered,self.fixture)
            altered=copy.deepcopy(doc)
            altered["priorityPathways"][0]["medicalClaimVerification"]="APPROVED"
            altered["priorityPathways"][0]["rowSha256"]=triage.sha({
                k:v for k,v in altered["priorityPathways"][0].items()
                if k!="rowSha256"})
            altered["runSha256"]=triage.sha({
                k:v for k,v in altered.items() if k!="runSha256"})
            with self.assertRaises(ValueError):
                triage.validate(altered,self.fixture)


if __name__=="__main__":
    unittest.main()
