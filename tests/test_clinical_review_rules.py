"""Pure contradiction-detector unit tests with synthetic, non-patient inputs."""
import importlib.util
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "scripts/lib/build-clinical-review-ledger.py"
spec = importlib.util.spec_from_file_location("clinical_ledger", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def mapping(classification="DIRECT_CAUSATION", narrative="", note="",
            probability="NOT_ASSERTED", title=None, guessed=False):
    return {
        "rationale": narrative,
        "sourceReferences": [{
            "citation": "Synthetic PubMed fixture PMID 12345678",
            "note": note, "verificationScope": "clinical-evidence",
            "verified": True,
        }],
        "nexusClaim": {"nexusClassification": classification,
                       "etiologicalTrigger": narrative},
        "causalMechanism": {"hypothesizedOnly": guessed},
        "evidentiaryProfile": {
            "vaNexusProbabilityAlignment": probability,
            "conservativeRationale": title or "Requires case-specific review",
        },
    }


class ClinicalReviewRules(unittest.TestCase):
    def rules(self, item):
        findings, _ = module.scan_relationship({}, item, {"12345678"})
        return {x["rule"] for x in findings}, findings

    def test_direct_causation_and_bidirectional_disclaimer_is_flagged(self):
        rules, findings = self.rules(mapping(
            narrative="The evidence is probably bidirectional and rather than proving "
                      "individual causation supports an association-focused study."))
        self.assertIn("CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE", rules)
        self.assertTrue(any(x["severity"] == "HIGH" for x in findings))

    def test_association_only_not_falsely_flagged_for_same_words(self):
        rules, _ = self.rules(mapping(
            classification="ASSOCIATION_ONLY",
            narrative="Association focused; does not establish individual causation."))
        self.assertNotIn("CAUSAL_CLASSIFICATION_WITH_LIMITING_EVIDENCE_LANGUAGE", rules)
        self.assertNotIn("DIRECTIONAL_RELATIONSHIP_REVIEW", rules)

    def test_probability_wording_is_a_review_signal_not_a_verdict(self):
        rules, _ = self.rules(mapping(
            probability="AT_LEAST_AS_LIKELY_AS_NOT",
            title="In this individual's presentation, the nexus is supported"))
        self.assertIn("INDIVIDUAL_PROBABILITY_ALIGNMENT_REVIEW", rules)
        self.assertIn("INDIVIDUAL_NEXUS_ASSERTION_IN_GENERIC_KNOWLEDGE_BASE", rules)

    def test_hypothesized_mechanism_and_direct_label_conflict(self):
        rules, _ = self.rules(mapping(guessed=True))
        self.assertIn("CAUSAL_CLASSIFICATION_WITH_HYPOTHESIZED_MECHANISM", rules)

    def test_unverified_clinical_reference_flag(self):
        x = mapping()
        x["sourceReferences"][0]["verified"] = False
        rules, _ = self.rules(x)
        self.assertIn("CLINICAL_REFERENCE_STATUS_REVIEW", rules)

    def test_verified_source_does_not_mean_new_clinical_approval(self):
        rules, _ = self.rules(mapping())
        self.assertNotIn("CLINICAL_REFERENCE_STATUS_REVIEW", rules)
        self.assertIn("DIRECTIONAL_RELATIONSHIP_REVIEW", rules)

    def test_legal_framework_misclassified_as_clinical(self):
        x = mapping()
        x["sourceReferences"][0]["authorityCategory"] = "current-regulatory-authority"
        rules, _ = self.rules(x)
        self.assertIn("LEGAL_AUTHORITY_MISUSED_AS_CLINICAL_EVIDENCE", rules)

    def test_unknown_nexus_class_fails_closed(self):
        with self.assertRaises(RuntimeError):
            self.rules(mapping(classification="GUARANTEED_CAUSATION"))

    def test_deterministic_digest(self):
        self.assertEqual(module.digest({"z": 2, "a": 1}), module.digest({"a": 1, "z": 2}))


if __name__ == "__main__":
    unittest.main()
