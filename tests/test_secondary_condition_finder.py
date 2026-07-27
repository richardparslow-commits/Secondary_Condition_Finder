import unittest

from secondary_condition_finder import (
    find_secondary_conditions,
    list_supported_conditions,
)


class SecondaryConditionFinderTests(unittest.TestCase):
    def test_returns_sorted_conditions_for_known_primary(self):
        results = find_secondary_conditions(" PTSD ")
        self.assertEqual(
            results,
            [
                "depression",
                "gastroesophageal reflux disease",
                "migraines",
                "sleep apnea",
            ],
        )

    def test_returns_empty_for_unknown_primary(self):
        self.assertEqual(find_secondary_conditions("unknown"), [])

    def test_supported_conditions_are_sorted(self):
        conditions = list_supported_conditions()
        self.assertEqual(conditions, sorted(conditions))
        self.assertIn("ptsd", conditions)


if __name__ == "__main__":
    unittest.main()
