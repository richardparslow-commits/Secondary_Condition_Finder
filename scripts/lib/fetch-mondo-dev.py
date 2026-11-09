#!/usr/bin/env python3
"""Download the one pinned CC BY 4.0 MONDO OBO release; SHA256 verification mandatory."""
import hashlib
import os
from pathlib import Path
import sys
import urllib.parse
import urllib.request

URL = "https://github.com/monarch-initiative/mondo/releases/download/v2026-10-06/mondo.obo"
DIGEST = "2631e8e165d41def1a46749adb1ce0a336c8aba7f6bc0978729592cee8fed60b"
DEST = Path("/tmp/scf-mondo-20261006/mondo.obo")
SIZE_BOUND = 90 * 1024 * 1024
ALLOWED = {"github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

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
    req = urllib.request.Request(URL, headers={"User-Agent":"SCF-Ontology-DEV/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as response, part.open("xb") as out:
            target = urllib.parse.urlsplit(response.url)
            if target.scheme != "https" or target.hostname not in ALLOWED:
                raise ValueError("Unapproved ontology download redirect")
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > SIZE_BOUND:
                    raise ValueError("Ontology release exceeded bounded size")
                out.write(chunk)
        if sha(part) != DIGEST:
            raise ValueError("Official MONDO release SHA256 mismatch")
        os.replace(part, DEST)
        print("Verified pinned MONDO v2026-10-06 download:", DIGEST)
    except Exception:
        part.unlink(missing_ok=True)
        raise

if __name__ == "__main__":
    try: main()
    except Exception:
        print("Pinned MONDO download could not be authenticated/verified",file=sys.stderr)
        sys.exit(1)
