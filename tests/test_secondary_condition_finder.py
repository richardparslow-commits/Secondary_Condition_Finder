import unittest

from secondary_condition_finder import (
    find_secondary_condition_suggestions,
    find_secondary_conditions,
    list_supported_conditions,
)


class SecondaryConditionFinderTests(unittest.TestCase):
    def test_returns_sorted_conditions_for_known_primary(self):
        results = find_secondary_conditions(" PTSD ")
        self.assertEqual(
            results,
            [
                "sleep apnea",
                "depression",
                "migraines",
                "gastroesophageal reflux disease",
            ],
        )

    def test_returns_ranked_annotated_suggestions(self):
        suggestions = find_secondary_condition_suggestions("ptsd")
        self.assertEqual(suggestions[0]["rank"], 1)
        self.assertEqual(suggestions[0]["condition"], "sleep apnea")
        self.assertTrue(suggestions[0]["annotation"])
        self.assertGreaterEqual(len(suggestions[0]["source_references"]), 1)

    def test_returns_empty_for_unknown_primary(self):
        self.assertEqual(find_secondary_conditions("unknown"), [])
        self.assertEqual(find_secondary_condition_suggestions("unknown"), [])

    def test_supported_conditions_are_sorted(self):
        conditions = list_supported_conditions()
        self.assertEqual(conditions, sorted(conditions))
        self.assertIn("ptsd", conditions)


if __name__ == "__main__":
    unittest.main()
