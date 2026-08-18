#!/usr/bin/env python3
"""Extract $http.get/post/put/delete paths from uni-app JS in the APK."""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path("vendor/apk/base")
HTTP_RE = re.compile(
    r"""\$http\.(get|post|put|delete)\(\s*["']([^"']+)["']""",
    re.I,
)
GENERIC_RE = re.compile(
    r"""(?:url\s*:\s*|baseUrl\s*\+\s*)["'](/[^"']+)["']""",
    re.I,
)


def main() -> None:
    hits: set[tuple[str, str]] = set()
    paths: set[str] = set()
    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            if not name.endswith((".js", ".json", ".html")) and "app-service" not in name:
                # Also scan .dex as latin-1 for JS-in-dex
                if not name.endswith(".dex"):
                    continue
            path = Path(dirpath) / name
            try:
                text = path.read_bytes().decode("latin-1", errors="ignore")
            except OSError:
                continue
            for method, api_path in HTTP_RE.findall(text):
                hits.add((method.lower(), api_path))
                paths.add(api_path)
            for api_path in GENERIC_RE.findall(text):
                if api_path.startswith("/") and len(api_path) < 120:
                    paths.add(api_path)

    print("=== $http calls ===")
    for method, api_path in sorted(hits):
        print(f"{method:6} {api_path}")
    print("\n=== paths ===")
    for api_path in sorted(paths):
        print(api_path)
    print(f"\nhttp calls={len(hits)} paths={len(paths)}")


if __name__ == "__main__":
    main()
