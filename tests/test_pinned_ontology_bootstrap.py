"""Deterministic MONDO subset bootstrap: no network or medical approvals."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[1] / "scripts/automation/stage_pinned_ontology.py"
spec = importlib.util.spec_from_file_location("stage_mondo", PATH)
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class PinnedOntologyBootstrap(unittest.TestCase):
    def test_shipped_pinned_manifest_and_hashes_are_approved(self):
        self.assertEqual(stage.sha256(stage.SOURCE / "app_audits.csv"),
                         json.loads((stage.SOURCE / "manifest.json").read_text())
                         ["tables"]["app_audits"]["sha256"])
        self.assertEqual(stage.sha256(stage.SOURCE / "app_candidates.csv"),
                         json.loads((stage.SOURCE / "manifest.json").read_text())
                         ["tables"]["app_candidates"]["sha256"])

    def test_clean_runner_stages_small_audit_without_downloading_full_ontology(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(stage, "DEST", Path(folder) / "staged"):
                stage.main()
                self.assertTrue((Path(folder) / "staged/manifest.json").exists())
                self.assertTrue((Path(folder) / "staged/app_audits.csv").exists())
                self.assertTrue((Path(folder) / "staged/app_candidates.csv").exists())
                self.assertFalse((Path(folder) / "staged/mondo.obo").exists())
                stage.main()  # idempotent

    def test_manipulated_manifest_and_data_are_refused_even_if_existing_dest_is_empty(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "src"
            shutil.copytree(stage.SOURCE, source)
            manifest = json.loads((source / "manifest.json").read_text())
            manifest["snapshot"] = "0" * 64
            (source / "manifest.json").write_text(json.dumps(manifest))
            with patch.object(stage, "SOURCE", source), patch.object(stage, "DEST", Path(folder) / "out"):
                with self.assertRaises(ValueError):
                    stage.main()

        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "src"
            shutil.copytree(stage.SOURCE, source)
            with (source / "app_audits.csv").open("a") as fp:
                fp.write("wrong,row,999\n")
            with patch.object(stage, "SOURCE", source), patch.object(stage, "DEST", Path(folder) / "out"):
                with self.assertRaises(ValueError):
                    stage.main()

    def test_unapproved_existing_staging_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "staged"
            dest.mkdir()
            (dest / "app_audits.csv").write_text("tampered")
            with patch.object(stage, "DEST", dest):
                with self.assertRaises(ValueError):
                    stage.main()
            self.assertEqual((dest / "app_audits.csv").read_text(), "tampered")


if __name__ == "__main__":
    unittest.main()
