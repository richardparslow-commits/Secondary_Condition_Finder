import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "automation" / "export-ontology-expansion-dev.py"
SPEC = importlib.util.spec_from_file_location("export_ontology_expansion_dev", MODULE_PATH)
EXPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORT)

TABLE_HASHES = {
    "app_audits": "c19ee92c68b985dec8e3dc91eaf29abecb78745a212d6c1080aaed51547731e6",
    "app_candidates": "60abb80c7db9ddad6f1d220b433f47d9dbfe31c05e106fdfefa67d80baadc27e",
    "app_pathways": "2b14c776e50188965e35169ba1372cbf4674441caccab88eb2d0e6ee7c82a067",
    "concepts": "6f8d2ab7d19328e68ce8158ed3159625c74209fd1610b4a7244145cb3eb5912c",
    "parents": "4223c0e732699c41c2393d0ae6db94549cd7fb9324e1ea366389442a58bb8ba2",
    "synonyms": "51dc1dc74e81b783330f4b32f5cc5150839c3c1a77cada5ff5846a93d78717a3",
    "xrefs": "b53b5df203b710a4b5196226f8de1d2d179662ccacc12671867e185945c7066b",
}


def manifest():
    return {
        "source_sha256": EXPORT.SOURCE_SHA256,
        "tables": {name: {"sha256": digest} for name, digest in TABLE_HASHES.items()},
        "snapshot": EXPORT.PIN,
    }


class OntologyExpansionProvenanceTest(unittest.TestCase):
    def test_recomputes_the_pinned_composite_snapshot(self):
        self.assertEqual(EXPORT.snapshot_digest(EXPORT.SOURCE_SHA256, manifest()["tables"]), EXPORT.PIN)
        self.assertEqual(EXPORT.validate_manifest(manifest()), EXPORT.PIN)

    def test_rejects_a_tampered_table_hash_even_when_the_snapshot_field_is_unchanged(self):
        changed = manifest()
        changed["tables"]["concepts"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "snapshot digest mismatch"):
            EXPORT.validate_manifest(changed)

    def test_rejects_an_unapproved_source_hash(self):
        changed = manifest()
        changed["source_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Unexpected MONDO source digest"):
            EXPORT.validate_manifest(changed)

    def test_rejects_an_incomplete_table_set(self):
        changed = manifest()
        del changed["tables"]["synonyms"]
        with self.assertRaisesRegex(ValueError, "Unexpected ontology table set"):
            EXPORT.validate_manifest(changed)


if __name__ == "__main__":
    unittest.main()
