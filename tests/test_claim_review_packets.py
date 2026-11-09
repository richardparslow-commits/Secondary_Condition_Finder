"""Source-to-claim packet contract; synthetic safety checks plus staged full inventory."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/automation/build_claim_review_packets.py"
spec = importlib.util.spec_from_file_location("scf_claim_review_packets", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ClaimReviewPackTests(unittest.TestCase):
    def test_priority_is_conservative_and_published_first(self):
        def edge(published=True, high=False, causal=False, registry=False):
            return {
                "publicationState": "PUBLISHED" if published else "DRAFT",
                "nexusClassification": "DIRECT_CAUSATION" if causal else "ASSOCIATION_ONLY",
                "findings": ([{"rule": "INDIVIDUAL_PROBABILITY_ALIGNMENT_REVIEW",
                               "severity": "HIGH"}] if high else []) +
                            ([{"rule": "SOURCE_REGISTRY_REVIEW",
                               "severity": "REVIEW"}] if registry else []),
            }
        self.assertEqual(mod.tier(edge(high=True)), 0)
        self.assertEqual(mod.tier(edge(causal=True)), 1)
        self.assertEqual(mod.tier(edge()), 2)
        self.assertEqual(mod.tier(edge(published=False, high=True)), 3)
        self.assertEqual(mod.tier(edge(published=False, registry=True)), 4)
        self.assertEqual(mod.tier(edge(published=False)), 5)

    def test_hash_is_order_invariant_but_detects_modification(self):
        self.assertEqual(mod.sha({"b": 2, "a": 3}), mod.sha({"a": 3, "b": 2}))
        self.assertNotEqual(mod.sha({"b": 2, "a": 3}), mod.sha({"a": 4, "b": 2}))

    def test_export_references_all_existing_claims_without_authorizing_them(self):
        if not mod.BASE.exists():
            self.skipTest("Pinned clinical mapping ledger not staged in CI")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = mod.build(root)
            self.assertEqual(manifest["packets"], 875)
            self.assertEqual(manifest["sourceReferences"], 1704)
            self.assertEqual(manifest["published"], 248)
            self.assertEqual(manifest["publishedHighPriority"], 21)
            self.assertEqual(manifest["qualifiedReviewCompleted"], 0)
            self.assertEqual(manifest["productionChanges"], 0)
            self.assertEqual(mod.verify(root)["pathways"], 875)
            packets = [json.loads(s) for s in
                       (root / "review-packets.jsonl").read_text().splitlines()]
            self.assertEqual(len(packets), 875)
            self.assertTrue(all(p["claimSpecificEvidenceAssessment"] == "NOT_ASSESSED"
                                for p in packets))
            self.assertTrue(all(p["individualVaNexusAssessment"] == "NOT_ASSESSED"
                                for p in packets))
            self.assertTrue(all(
                r["specificClaimSupport"] == "NOT_ASSESSED" and
                not r["independentlyReverifiedHere"]
                for p in packets for r in p["references"]))
            with (root / "reviewer-decisions-EMPTY.csv").open(newline="") as f:
                decisions = list(csv.DictReader(f))
            self.assertEqual(len(decisions), 875)
            self.assertTrue(all(not r["reviewDisposition"] for r in decisions))

    def test_artifact_tamper_detection(self):
        if not mod.BASE.exists():
            self.skipTest("Pinned clinical mapping ledger not staged in CI")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            mod.build(root)
            with (root / "review-packets.jsonl").open("a") as f:
                f.write('{"publicationAuthorization":"GRANTED"}\n')
            with self.assertRaises(ValueError):
                mod.verify(root)

    def test_modified_ledger_digest_fails_closed(self):
        if not mod.BASE.exists():
            self.skipTest("Pinned clinical mapping ledger not staged in CI")
        original = json.loads(mod.BASE.read_text())
        original["pathways"][0]["nexusClassification"] = "DIRECT_CAUSATION"
        with tempfile.TemporaryDirectory() as tmp:
            input_path = Path(tmp) / "tampered.json"
            input_path.write_text(json.dumps(original))
            with self.assertRaises(ValueError):
                mod.build(Path(tmp) / "out", input_path)


if __name__ == "__main__":
    unittest.main()
