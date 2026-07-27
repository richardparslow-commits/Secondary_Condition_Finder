"""Simple secondary-condition lookup tool for VA claim support exploration."""

from __future__ import annotations

import argparse
from typing import Dict, List


_SECONDARY_CONDITIONS: Dict[str, List[str]] = {
    "diabetes mellitus type ii": [
        "peripheral neuropathy",
        "diabetic retinopathy",
        "chronic kidney disease",
        "hypertension",
    ],
    "ptsd": [
        "sleep apnea",
        "depression",
        "migraines",
        "gastroesophageal reflux disease",
    ],
    "knee injury": [
        "hip pain",
        "ankle pain",
        "lumbar strain",
    ],
    "tinnitus": [
        "insomnia",
        "anxiety",
        "depression",
    ],
    "lumbar strain": [
        "radiculopathy",
        "sciatica",
        "depression",
    ],
}


def _normalize_condition_name(condition: str) -> str:
    """Normalize user input to improve lookup reliability."""
    return " ".join(condition.strip().lower().split())


def find_secondary_conditions(primary_condition: str) -> List[str]:
    """Return known secondary conditions for a primary condition."""
    normalized = _normalize_condition_name(primary_condition)
    matches = _SECONDARY_CONDITIONS.get(normalized, [])
    return sorted(set(matches))


def list_supported_conditions() -> List[str]:
    """Return all primary conditions supported by this implementation."""
    return sorted(_SECONDARY_CONDITIONS.keys())


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

    results = find_secondary_conditions(args.primary_condition)
    if not results:
        print("No known secondary conditions found for that primary condition.")
        return 1

    for condition in results:
        print(condition)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
