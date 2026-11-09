#!/usr/bin/env python3
"""Download the one pinned CC BY 4.0 MONDO OBO release; SHA256 verification mandatory.

The normal GitHub release URL occasionally returns HTTP 504 from hosted runners.
For network errors only, retry the *same published asset* through its fixed
official GitHub REST API asset ID. Neither route may change the pinned digest.
"""
import hashlib
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

URL = "https://github.com/monarch-initiative/mondo/releases/download/v2026-10-06/mondo.obo"
# GitHub's official v2026-10-06 release asset for mondo.obo, ID 616499018.
# Metadata confirms SHA256 matches DIGEST and size 53,320,617 bytes.
API_URL = "https://api.github.com/repos/monarch-initiative/mondo/releases/assets/616499018"
DIGEST = "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b"
DEST = Path("/tmp/scf-mondo-20261006/mondo.obo")
SIZE_BOUND = 90 * 1024 * 1024
ALLOWED = {
    "github.com",
    "api.github.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
}


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _fetch(url, headers, part):
    target_url = urllib.parse.urlsplit(url)
    if target_url.scheme != "https" or target_url.hostname not in ALLOWED:
        raise ValueError("Unapproved source URL")
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response, part.open("xb") as out:
        target = urllib.parse.urlsplit(response.url)
        if target.scheme != "https" or target.hostname not in ALLOWED:
            raise ValueError("Unapproved ontology download redirect")
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > SIZE_BOUND:
                raise ValueError("Ontology release exceeded bounded size")
            out.write(chunk)
    # No fallback if a server supplies corrupt/different bytes: fail closed.
    if sha(part) != DIGEST:
        raise ValueError("Official MONDO release SHA256 mismatch")


def main():
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.is_file():
        if sha(DEST) != DIGEST:
            raise ValueError("Existing release digest mismatch; refusing overwrite")
        print("MONDO v2026-10-06 already verified at pinned SHA256")
        return
    part = DEST.with_suffix(".obo.partial")
    if part.exists():
        raise ValueError("Partial release file present; inspect before repeating")

    base_headers = {
        "User-Agent": "SCF-Ontology-DEV/1.0",
        "Accept": "application/octet-stream",
    }
    sources = (
        (URL, base_headers),
        (API_URL, {**base_headers, "X-GitHub-Api-Version": "2022-11-28"}),
    )
    for index, (url, headers) in enumerate(sources):
        try:
            _fetch(url, headers, part)
            os.replace(part, DEST)
            print("Verified pinned MONDO v2026-10-06 download:", DIGEST)
            return
        except (urllib.error.URLError, TimeoutError) as error:
            # urllib HTTPError can own an open response stream.
            if isinstance(error, urllib.error.HTTPError):
                error.close()
            part.unlink(missing_ok=True)
            if index == 0:
                print("GitHub release CDN unavailable; attempting pinned official API asset")
                continue
            raise
        except Exception:
            part.unlink(missing_ok=True)
            raise
    raise RuntimeError("Pinned ontology release could not be obtained")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Pinned MONDO download could not be authenticated/verified",file=sys.stderr)
        sys.exit(1)
