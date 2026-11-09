"""Pure/fixture tests for nine bounded public research batches, never clinical adjudication."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "scripts/automation"))
import expanded_evidence_campaign as mod
import directional_evidence_campaign as base


class PublicOnlyFake:
    def request(self,kind,params):
        if kind=="esearch":
            return {"esearchresult":{"idlist":[]}}
        if kind=="esummary":
            ids=params["id"].split(",")
            return {"result":{mid:{
                "uid":mid,"title":"Synthetic bibliographic record",
                "pubdate":"2026","pubtype":["Journal Article"],
                "articleids":[]} for mid in ids}}
        raise ValueError("Unsupported source method")


class ExpandedEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.ledger,cls.remaining,cls.selection_digest=mod.selection()
        except FileNotFoundError:
            cls.ledger=None

    def require_staged(self):
        if self.ledger is None:
            self.skipTest("Signed-off ontology audit not staged on runner")

    def test_exact_827_remaining_and_48_initial_do_not_overlap(self):
        self.require_staged()
        _,initial,_=base.inputs()
        original={(x["sourceId"],x["targetId"]) for x in initial}
        remaining={(x["sourceId"],x["targetId"]) for x in self.remaining}
        self.assertEqual(len(original),48)
        self.assertEqual(len(remaining),827)
        self.assertFalse(original & remaining)
        self.assertEqual(len(original | remaining),875)
        self.assertEqual(len(self.selection_digest),64)

    def test_scheduled_rotation_covers_every_path_exactly_once_per_cycle(self):
        self.require_staged()
        batches=[mod.choose_batch(self.remaining,i) for i in range(9)]
        self.assertEqual([len(b) for b in batches],[100]*8+[27])
        flattened=[(x["sourceId"],x["targetId"]) for b in batches for x in b]
        self.assertEqual(len(flattened),len(set(flattened)))
        self.assertEqual(set(flattened),{
            (r["sourceId"],r["targetId"]) for r in self.remaining})
        self.assertEqual([mod.selected_index("auto",i) for i in range(1,11)],
                         list(range(9))+[0])

    def test_priority_published_then_citation_flagged_draft(self):
        self.require_staged()
        counts=[sum(x["publicationState"]=="PUBLISHED"
                    for x in mod.choose_batch(self.remaining,i)) for i in range(9)]
        self.assertEqual(counts[:3],[100,100,27])
        self.assertEqual(sum(counts),227)
        self.assertEqual(sum(bool(set(x["reviewRules"]) & mod.CITATION_DEBT)
                             for x in self.remaining),480)

    def test_rejects_invalid_batch_and_untrusted_automatic_index(self):
        self.require_staged()
        for bad in [-1,9,100,"1"]:
            with self.assertRaises(ValueError):
                mod.choose_batch(self.remaining,bad)
        for arg in ["-1","9","100","2;echo", "3x"]:
            with self.assertRaises(ValueError):
                mod.selected_index(arg)
        for run in ["0","-2","bad"]:
            with self.assertRaises(ValueError):
                mod.selected_index("auto",run)

    def test_full_mocked_100_pathway_research_run_is_immutable_and_unapproved(self):
        self.require_staged()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            result=mod.run(out=root,batch_index=0,client=PublicOnlyFake(),
                           observed_at="2026-11-09T00:00:00+00:00")
            self.assertEqual(result["selected"],100)
            self.assertEqual(result["publishedSelected"],100)
            self.assertEqual(result["clinicalApproval"] if "clinicalApproval" in result
                             else result["clinicallyApproved"],0)
            doc=json.loads((root/"evidence-run.json").read_text())
            self.assertIs(base.validate_run(doc),doc)
            self.assertEqual(doc["campaignScope"],"REMAINDER_RESEARCH_ONLY")
            self.assertEqual(doc["totalRemainder"],827)
            self.assertEqual(len(doc["edges"]),100)
            self.assertTrue(all(x["clinicalDisposition"]=="HUMAN_REVIEW_REQUIRED"
                                for x in doc["edges"]))
            self.assertEqual(len(doc["discoveries"]),100)
            self.assertEqual(result["candidateSearchesUnavailable"],0)
            self.assertTrue((root/"expanded-evidence-review.csv").is_file())
            self.assertFalse((root/"directional-evidence-review.csv").exists())
            self.assertEqual((root/"expanded-evidence-review.csv").read_text().count("\n"),101)
            self.assertEqual(json.loads((root/"batch-selection.json").read_text())
                             ["selectionDigest"],self.selection_digest)

    def test_last_batch_27_pathways_validates_with_public_only_mock(self):
        self.require_staged()
        with tempfile.TemporaryDirectory() as tmp:
            result=mod.run(out=Path(tmp),batch_index=8,client=PublicOnlyFake(),
                           observed_at="2026-11-09T00:00:00+00:00")
            self.assertEqual(result["selected"],27)
            self.assertEqual(result["publishedSelected"],0)

if __name__=="__main__":
    unittest.main()
