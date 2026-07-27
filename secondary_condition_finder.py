"""Simple secondary-condition lookup tool for VA claim support exploration."""

from __future__ import annotations

import argparse
from typing import Dict, List, TypedDict


class SecondaryConditionSuggestion(TypedDict):
    condition: str
    rank: int
    annotation: str
    source_references: List[str]


_SECONDARY_CONDITION_SUGGESTIONS: Dict[str, List[SecondaryConditionSuggestion]] = {
    "diabetes mellitus type ii": [
        {
            "condition": "peripheral neuropathy",
            "rank": 1,
            "annotation": "Frequent nerve complication associated with long-term diabetes.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.5.B"],
        },
        {
            "condition": "diabetic retinopathy",
            "rank": 2,
            "annotation": "Recognized diabetes-related eye condition used in nexus reviews.",
            "source_references": ["38 CFR §4.119 (DC 7913)", "VA M21-1, V.iii.5.B"],
        },
        {
            "condition": "chronic kidney disease",
            "rank": 3,
            "annotation": "Documented renal complication for persistent diabetes cases.",
            "source_references": ["38 CFR §4.115a", "VA M21-1, V.iii.5.B"],
        },
        {
            "condition": "hypertension",
            "rank": 4,
            "annotation": "Commonly evaluated as aggravated by metabolic disease history.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.5.B"],
        },
    ],
    "ptsd": [
        {
            "condition": "sleep apnea",
            "rank": 1,
            "annotation": "Often reviewed where PTSD symptoms and sleep disruption co-occur.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.13.A"],
        },
        {
            "condition": "depression",
            "rank": 2,
            "annotation": "Regularly considered when psychiatric symptoms worsen over time.",
            "source_references": ["38 CFR §4.130", "VA M21-1, V.iii.13.A"],
        },
        {
            "condition": "migraines",
            "rank": 3,
            "annotation": "Can appear in records where stress and sleep deficits are present.",
            "source_references": ["38 CFR §4.124a", "VA M21-1, V.iii.13.A"],
        },
        {
            "condition": "gastroesophageal reflux disease",
            "rank": 4,
            "annotation": "Occasionally evaluated as stress-related or medication-associated.",
            "source_references": ["38 CFR §4.114", "VA M21-1, V.iii.13.A"],
        },
    ],
    "knee injury": [
        {
            "condition": "hip pain",
            "rank": 1,
            "annotation": "Compensatory gait changes can increase hip strain over time.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.1.B"],
        },
        {
            "condition": "ankle pain",
            "rank": 2,
            "annotation": "Altered weight-bearing patterns may affect ankle mechanics.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.1.B"],
        },
        {
            "condition": "lumbar strain",
            "rank": 3,
            "annotation": "Biomechanical compensation can contribute to lower-back strain.",
            "source_references": ["38 CFR §4.71a", "VA M21-1, V.iii.1.B"],
        },
    ],
    "tinnitus": [
        {
            "condition": "insomnia",
            "rank": 1,
            "annotation": "Persistent ringing frequently disrupts sleep continuity.",
            "source_references": ["38 CFR §3.310", "VA M21-1, V.iii.2.B"],
        },
        {
            "condition": "anxiety",
            "rank": 2,
            "annotation": "Chronic symptom burden may increase anxiety-related complaints.",
            "source_references": ["38 CFR §4.130", "VA M21-1, V.iii.2.B"],
        },
        {
            "condition": "depression",
            "rank": 3,
            "annotation": "Mood effects are often documented with long-standing tinnitus.",
            "source_references": ["38 CFR §4.130", "VA M21-1, V.iii.2.B"],
        },
    ],
    "lumbar strain": [
        {
            "condition": "radiculopathy",
            "rank": 1,
            "annotation": "Neurologic symptoms can develop with chronic lumbar issues.",
            "source_references": ["38 CFR §4.71a", "VA M21-1, V.iii.1.A"],
        },
        {
            "condition": "sciatica",
            "rank": 2,
            "annotation": "Commonly assessed when radiating leg pain is documented.",
            "source_references": ["38 CFR §4.124a", "VA M21-1, V.iii.1.A"],
        },
        {
            "condition": "depression",
            "rank": 3,
            "annotation": "Chronic pain burden can correlate with depressive symptoms.",
            "source_references": ["38 CFR §4.130", "VA M21-1, V.iii.1.A"],
        },
    ],
}


def _normalize_condition_name(condition: str) -> str:
    """Normalize user input to improve lookup reliability."""
    return " ".join(condition.strip().lower().split())


def find_secondary_condition_suggestions(
    primary_condition: str,
) -> List[SecondaryConditionSuggestion]:
    """Return ranked secondary-condition suggestions with annotations and sources."""
    normalized = _normalize_condition_name(primary_condition)
    matches = _SECONDARY_CONDITION_SUGGESTIONS.get(normalized, [])
    return sorted(matches, key=lambda match: (match["rank"], match["condition"]))


def find_secondary_conditions(primary_condition: str) -> List[str]:
    """Return condition names for compatibility with the original API."""
    suggestions = find_secondary_condition_suggestions(primary_condition)
    return [suggestion["condition"] for suggestion in suggestions]


def list_supported_conditions() -> List[str]:
    """Return all primary conditions supported by this implementation."""
    return sorted(_SECONDARY_CONDITION_SUGGESTIONS.keys())


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find possible secondary conditions based on a primary condition.",
    )
    parser.add_argument("primary_condition", nargs="?", help="Primary condition name")
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all supported primary conditions",
    )
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    if args.list:
        for condition in list_supported_conditions():
            print(condition)
        return 0

    if not args.primary_condition:
        parser.error("primary_condition is required unless --list is used")

    results = find_secondary_condition_suggestions(args.primary_condition)
    if not results:
        print("No known secondary conditions found for that primary condition.")
        return 1

    for suggestion in results:
        print(f"{suggestion['rank']}. {suggestion['condition']}")
        print(f"   annotation: {suggestion['annotation']}")
        print(f"   sources: {', '.join(suggestion['source_references'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
