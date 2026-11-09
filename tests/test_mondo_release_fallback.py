"""Pinned MONDO retrieval must fail closed and use only the official API fallback."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "scripts/lib/fetch-mondo-dev.py"
spec = importlib.util.spec_from_file_location("fetch_mondo_dev", SOURCE)
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)


class FakeResponse(io.BytesIO):
    def __init__(self, data, url="https://release-assets.githubusercontent.com/official-pinned-asset"):
        super().__init__(data)
        self.url = url


class MondoReleaseFallbackTests(unittest.TestCase):
    DATA = b"Synthetic pinned public ontology fixture"
    DIGEST = hashlib.sha256(DATA).hexdigest()

    def test_primary_network_504_uses_same_pinned_official_api_asset(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "mondo.obo"
            calls = []

            def opener(request, timeout):
                calls.append(request.full_url)
                if len(calls) == 1:
                    raise urllib.error.HTTPError(fetch.URL, 504, "Gateway Timeout", None, None)
                return FakeResponse(self.DATA)

            with patch.object(fetch, "DEST", dest), patch.object(fetch, "DIGEST", self.DIGEST), \
                    patch.object(fetch.urllib.request, "urlopen", side_effect=opener):
                fetch.main()

            self.assertEqual(dest.read_bytes(), self.DATA)
            self.assertEqual(calls, [fetch.URL, fetch.API_URL])
            self.assertFalse(dest.with_suffix(".obo.partial").exists())

    def test_sha_mismatch_rejects_even_official_fallback(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "mondo.obo"
            calls = [0]

            def opener(request, timeout):
                calls[0] += 1
                if calls[0] == 1:
                    raise urllib.error.HTTPError(fetch.URL, 504, "Gateway Timeout", None, None)
                return FakeResponse(b"tampered ontology bytes")

            with patch.object(fetch, "DEST", dest), patch.object(fetch, "DIGEST", self.DIGEST), \
                    patch.object(fetch.urllib.request, "urlopen", side_effect=opener):
                with self.assertRaises(ValueError):
                    fetch.main()

            self.assertEqual(calls[0], 2)
            self.assertFalse(dest.exists())
            self.assertFalse(dest.with_suffix(".obo.partial").exists())

    def test_untrusted_redirect_fails_without_attempting_fallback(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "mondo.obo"
            calls = []

            def opener(request, timeout):
                calls.append(request.full_url)
                return FakeResponse(self.DATA, "https://untrusted.invalid/ontology.obo")

            with patch.object(fetch, "DEST", dest), patch.object(fetch, "DIGEST", self.DIGEST), \
                    patch.object(fetch.urllib.request, "urlopen", side_effect=opener):
                with self.assertRaises(ValueError):
                    fetch.main()

            self.assertEqual(calls, [fetch.URL])
            self.assertFalse(dest.exists())

    def test_pinned_asset_identity_is_not_a_floating_release(self):
        self.assertEqual(fetch.DIGEST,
            "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b")
        self.assertEqual(fetch.API_URL,
            "https://api.github.com/repos/monarch-initiative/mondo/releases/assets/616499018")

    def test_cached_verified_release_requires_no_network(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / "mondo.obo"
            dest.write_bytes(self.DATA)
            with patch.object(fetch, "DEST", dest), patch.object(fetch, "DIGEST", self.DIGEST), \
                    patch.object(fetch.urllib.request, "urlopen", side_effect=AssertionError("network forbidden")):
                fetch.main()
            self.assertEqual(dest.read_bytes(), self.DATA)


if __name__ == "__main__":
    unittest.main()
