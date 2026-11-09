"""Citation provenance reconciliation tests — never approve clinical claims."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scripts/automation/citation_provenance_reconcile.py"
spec = importlib.util.spec_from_file_location("citation_triage", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class CitationTriageTests(unittest.TestCase):
    def test_full_507_flagged_draft_cohort_and_1311_reference_links(self):
        ledger, packets, registry = mod.load_inputs()
        rows = mod.review(ledger, packets, registry, {})
        self.assertEqual(len(rows), 507)
        self.assertEqual(sum(r["citationCount"] for r in rows), 1311)
        self.assertTrue(all(r["publicationState"] == "DRAFT" for r in rows))
        self.assertTrue(all(r["medicalCausationVerified"] is False for r in rows))
        self.assertTrue(all(r["publicationAuthorized"] is False for r in rows))

    def test_source_registry_status_is_preserved_as_metadata_not_approval(self):
        ledger, packets, registry = mod.load_inputs()
        rows = mod.review(ledger, packets, registry, {"12345678": {"METADATA_RETRIEVED"}})
        self.assertTrue(all(r["reviewDisposition"] ==
                            "HUMAN_SOURCE_TO_CLAIM_REVIEW_REQUIRED" for r in rows))
        self.assertTrue(all(c["newSpecificClaimVerification"] == "NOT_PERFORMED"
                            for r in rows for c in r["references"]))

    def test_metadata_ingest_rejects_other_ledger_or_claim_approval(self):
        for bad in [
            {"sourceLedgerId":"not-the-ledger","articles":[]},
            {"sourceLedgerId":"dcd6681315b0b36c4a0a8270405f5446f0bd75d01465fefae1114f2206bcd7aa",
             "articles":[{"pmid":"12345678","status":"METADATA_RETRIEVED",
                          "clinicalSupport":"VERIFIED"}]},
        ]:
            with tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)/"data.json"
                path.write_text(json.dumps(bad))
                with self.assertRaises(ValueError):
                    mod.metadata_index(path)

    def test_export_hash_parity_and_tamper_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)
            manifest=mod.produce(out)
            self.assertEqual(manifest["flaggedDraftPathways"],507)
            self.assertEqual(manifest["flaggedReferenceLinks"],1311)
            self.assertEqual(manifest["clinicalApprovals"],0)
            self.assertEqual(mod.verify(out)["flaggedPathways"],507)
            with (out/"citation-review-507.csv").open("a") as f:
                f.write("forged-review,approved\n")
            with self.assertRaises(ValueError):
                mod.verify(out)

    def test_all_unique_bibliography_ids_are_canonical_and_not_marked_accepted(self):
        ledger, packets, registry = mod.load_inputs()
        rows=mod.review(ledger,packets,registry,{})
        ids={p["pmid"] for row in rows for ref in row["references"] for p in ref["pubmed"]}
        self.assertEqual(len(ids),1128)
        self.assertTrue(all(p["claimSupport"]=="NOT_ASSESSED"
                            for row in rows for ref in row["references"] for p in ref["pubmed"]))

if __name__=="__main__":
    unittest.main()
