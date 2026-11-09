"""Synthetic public-source tests. No clinical records, diagnosis decisions or API keys."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scripts/automation/directional_evidence_campaign.py"
spec = importlib.util.spec_from_file_location("directional_evidence_campaign", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def article(pmid="12345678", status="METADATA_RETRIEVED"):
    raw = {"pmid":pmid, "status":status,"title":"Synthetic study",
           "date":"2026","doi":"","publicationTypes":["Journal Article"]}
    return {**raw,"metadataHash":module.digest(raw)}


def sample():
    edge = {"sourceId":"migraine","targetId":"anxiety","sourceName":"migraine",
            "targetName":"anxiety disorder","publicationState":"PUBLISHED",
            "nexusClassification":"DIRECT_CAUSATION","probabilityAlignment":"NOT_ASSERTED",
            "reviewRules":["DIRECTIONAL_RELATIONSHIP_REVIEW"],"citationPmids":["12345678"],
            "citationCount":1,"clinicalDisposition":"HUMAN_REVIEW_REQUIRED"}
    discovery={"sourceId":"migraine","targetId":"anxiety","candidatePmids":["12345678"],
               "status":"CANDIDATES_FOUND","candidateClinicalSupport":"NOT_ASSESSED"}
    doc={"schemaVersion":1,"observedAt":"2026-11-08T00:00:00+00:00",
         "sourceLedgerId":"a"*64,"sourceCommit":"test","clinicalApproval":"NOT_GRANTED",
         "edges":[edge],"articles":[article()],"discoveries":[discovery]}
    doc["runId"]=module.digest(doc)
    return doc


class DirectionalEvidenceTests(unittest.TestCase):
    def test_existing_directions_and_pubmeds_are_selected(self):
        try:
            _source,edges,ids=module.inputs()
        except FileNotFoundError:
            self.skipTest("Full ontology staging absent in CI")
        self.assertEqual(len(edges),48)
        self.assertEqual(len(ids),90)
        self.assertEqual(sum(e["publicationState"]=="PUBLISHED" for e in edges),21)
        self.assertTrue(all(e["clinicalDisposition"]=="HUMAN_REVIEW_REQUIRED" for e in edges))

    def test_term_validation_uses_only_safe_public_labels(self):
        self.assertEqual(module.query_name("migraine [X] "), "migraine X")
        with self.assertRaises(ValueError):
            module.query_name("x")
        with self.assertRaises(ValueError):
            module.query_name("x"*300)

    def test_article_status_is_metadata_only(self):
        item = module.parse_article("12345678", {
            "uid":"12345678","title":"Synthetic metadata",
            "pubdate":"2026","pubtype":["Retraction of Publication"],
        })
        self.assertEqual(item["status"],"PUBLICATION_STATUS_REVIEW")
        self.assertTrue(item["metadataHash"])
        self.assertEqual(module.parse_article("12345678",{})["status"],"UNRESOLVED")

    def test_bounded_NCBI_response_and_provider_validation(self):
        client = module.NCBI(get=lambda _url,timeout:{"esummary":{}},sleep=lambda _n:None)
        with self.assertRaises(RuntimeError):
            client.request("esummary",{"id":"12345678"})
        with self.assertRaises(ValueError):
            client.request("user-provided-endpoint",{})

    def test_collection_preserves_outage_as_unavailable_not_verified(self):
        class Fake:
            def request(self,kind,_params):
                if kind=="esummary":
                    raise RuntimeError("NCBI_LOOKUP_UNAVAILABLE")
                return {"esearchresult":{"idlist":[]}}
        doc=sample()
        found,discovered=module.research(doc["edges"],["12345678"],Fake())
        self.assertEqual(found[0]["status"],"PROVIDER_UNAVAILABLE")
        self.assertEqual(discovered[0]["status"],"NO_TEXT_MATCH")

    def test_immutable_run_has_reviewer_gate(self):
        doc=sample()
        self.assertIs(module.validate_run(doc),doc)
        altered=json.loads(json.dumps(doc))
        altered["clinicalApproval"]="GRANTED"
        altered["runId"]=module.digest({k:v for k,v in altered.items() if k!="runId"})
        with self.assertRaises(ValueError):
            module.validate_run(altered)

    def test_candidate_studies_do_not_automatically_prove_causation(self):
        doc=sample()
        doc["discoveries"][0]["candidateClinicalSupport"]="PROVEN_CAUSAL"
        doc["runId"]=module.digest({k:v for k,v in doc.items() if k!="runId"})
        with self.assertRaises(ValueError):
            module.validate_run(doc)

    def test_artifacts_are_bounded_public_only(self):
        doc=sample()
        with tempfile.TemporaryDirectory() as root:
            report=module.emit(doc,Path(root))
            self.assertEqual(report["clinicallyApproved"],0)
            self.assertTrue((Path(root)/"evidence-run.json").is_file())
            self.assertEqual((Path(root)/"directional-evidence-review.csv").read_text().count("\n"),2)
            self.assertEqual(report["uniqueCitedPmids"],1)



class AutonomousHealthChecks(unittest.TestCase):
    def test_provider_outage_and_retraction_are_visible_not_approved(self):
        file = Path(__file__).resolve().parents[1] / "scripts/automation/check_evidence_health.py"
        spec = importlib.util.spec_from_file_location("research_health", file)
        health = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(health)
        base = {"clinicallyApproved":0,"productionChanges":0,"requiresQualifiedHumanReview":True,
                "pathways":48,"uniqueCitedPmids":90,"allPubmedMetadataRecords":186,
                "publicationStatuses":{"METADATA_RETRIEVED":186},"candidateSearchesUnavailable":0}
        self.assertEqual(health.assess(base), [])
        missing = {**base, "candidateSearchesUnavailable":2,
            "publicationStatuses":{"METADATA_RETRIEVED":184,
                                   "PROVIDER_UNAVAILABLE":1,
                                   "PUBLICATION_STATUS_REVIEW":1}}
        issues=health.assess(missing)
        self.assertIn("PUBMED_PROVIDER_UNAVAILABLE",issues)
        self.assertIn("PUBLICATION_STATUS_REVIEW_REQUIRED",issues)
        self.assertIn("CANDIDATE_DISCOVERY_API_UNAVAILABLE",issues)
        invalid={**base,"clinicallyApproved":1}
        self.assertEqual(health.assess(invalid),["FORBIDDEN_AUTOMATED_CLINICAL_STATE"])

if __name__ == "__main__":
    unittest.main()
