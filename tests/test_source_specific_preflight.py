"""Pure source-specific review tests with synthetic official PubMed XML.

These tests do NOT assert a clinical causal relationship or any VA nexus.
"""
import importlib.util
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"scripts/automation/source_specific_preflight.py"
spec=importlib.util.spec_from_file_location("source_preflight",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fake_pubmed():
    ids=sorted({n["pmid"] for n in mod.require_curated()[1].values()})
    root=ET.Element("PubmedArticleSet")
    for i,pmid in enumerate(ids):
        entry=ET.SubElement(root,"PubmedArticle")
        med=ET.SubElement(entry,"MedlineCitation")
        ET.SubElement(med,"PMID").text=pmid
        article=ET.SubElement(med,"Article")
        ET.SubElement(article,"ArticleTitle").text="Synthetic test publication for "+pmid
        if i!=0:
            ET.SubElement(ET.SubElement(article,"Abstract"),"AbstractText").text=(
                "Synthetic design and abstract text; not a real clinical source.")
        ET.SubElement(ET.SubElement(article,"PublicationTypeList"),"PublicationType").text="Journal Article"
        if i==1:
            ET.SubElement(ET.SubElement(med,"CommentsCorrectionsList"),
                          "CommentsCorrections",{"RefType":"ErratumIn"})
    return root

class SourceSpecificTests(unittest.TestCase):
    def test_complete_priority_notes_match_existing_original_references(self):
        curated,notes=mod.require_curated()
        packets=mod.require_authored(notes)
        self.assertEqual(len(notes),21)
        self.assertEqual(len(packets),21)
        self.assertEqual(len({n["pmid"] for n in notes.values()}),20)
        self.assertTrue(all(n["clinicalApproval"]=="NOT_GRANTED" for n in notes.values()))

    def test_xml_extraction_keeps_no_abstract_text_and_flags_missing_or_errata(self):
        ids={n["pmid"] for n in mod.require_curated()[1].values()}
        records=mod.parse_publications(fake_pubmed(),ids)
        self.assertEqual(len(records),20)
        self.assertEqual(sum(not x["abstractAvailable"] for x in records.values()),1)
        self.assertEqual(sum(x["correctionOrRetractionReviewRequired"]
                             for x in records.values()),1)
        self.assertTrue(all(x["abstractRetainedInArtifact"] is False for x in records.values()))
        self.assertTrue(all(x["studyToClaimVerified"]=="NOT_ASSESSED" for x in records.values()))

    def test_21_case_snapshot_and_empty_reviewer_decisions(self):
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            report=mod.build(official_root=fake_pubmed(),output=out,
                observed_at="2026-11-09T20:00:00+00:00")
            self.assertEqual(report["caseCount"],21)
            self.assertEqual(report["uniqueCitedPmids"],20)
            self.assertEqual(report["clinicalApprovals"],0)
            self.assertEqual(report["fullTextsReviewedByWorkflow"],0)
            self.assertEqual(len(report["correctionReviewPmids"]),1)
            self.assertEqual(len(report["absentAbstractSources"]),1)
            self.assertEqual(mod.verify(out)["cases"],21)
            source=(out/"source-claim-21-run.json").read_text()
            self.assertNotIn("Synthetic design and abstract text",source)
            self.assertNotIn('"fullTextReviewed": true',source)

    def test_artifact_tampering_and_approval_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            mod.build(official_root=fake_pubmed(),output=out,
                observed_at="2026-11-09T20:00:00+00:00")
            p=out/"source-claim-21-review.csv"
            with p.open("a") as f:f.write("invalid,clinical-approval\n")
            with self.assertRaises(ValueError):mod.verify(out)

    def test_medical_decision_even_with_rehashed_case_is_forbidden(self):
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            mod.build(official_root=fake_pubmed(),output=out,
                observed_at="2026-11-09T20:00:00+00:00")
            doc=json.loads((out/"source-claim-21-run.json").read_text())
            doc["humanReviewCases"][0]["medicalClaimVerification"]="VERIFIED"
            doc["humanReviewCases"][0]["contentSha256"]=mod.sha({
                k:v for k,v in doc["humanReviewCases"][0].items() if k!="contentSha256"})
            doc["runSha256"]=mod.sha({k:v for k,v in doc.items() if k!="runSha256"})
            with self.assertRaises(ValueError):mod.validate(doc)

    def test_incomplete_external_response_and_unbounded_input_are_rejected(self):
        ids={n["pmid"] for n in mod.require_curated()[1].values()}
        root=fake_pubmed()
        root.remove(root[0])
        with self.assertRaises(ValueError):mod.parse_publications(root,ids)
        with self.assertRaises(ValueError):mod.fetch_official(["0123"]*21)

if __name__=="__main__":
    unittest.main()
