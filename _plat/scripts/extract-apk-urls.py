#!/usr/bin/env python3
"""Extract HTTP(S) URLs and interesting strings from the unpacked APK."""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path("vendor/apk/base")
URL_RE = re.compile(rb"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%\-]+")
SKIP = (
    "google",
    "gstatic",
    "googleapis",
    "facebook",
    "crashlytics",
    "firebase",
    "android.com",
    "w3.org",
    "apache.org",
    "github.com",
    "xmlpull",
    "schema.org",
    "maven.org",
    "kotlinlang",
    "sentry",
    "exoplayer",
    "jetbrains",
    "okhttp",
    "squareup",
)
INTEREST = re.compile(
    rb"(cfess|cfenergy|47\.88|9090|aliyun|mqtt|baseUrl|BASE_URL|/login|/device|/battery|/user/)",
    re.I,
)


def decode(raw: bytes) -> str:
    return raw.decode("ascii", errors="ignore").rstrip(".,);\"'\\")


def main() -> None:
    urls: set[str] = set()
    interest: set[str] = set()
    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            path = Path(dirpath) / name
            try:
                data = path.read_bytes()
            except OSError:
                continue
            for match in URL_RE.findall(data):
                text = decode(match)
                lower = text.lower()
                if any(skip in lower for skip in SKIP):
                    continue
                if len(text) > 8:
                    urls.add(text)
            if name.endswith((".dex", ".json", ".properties", ".xml", ".js", ".txt")):
                # Pull printable ASCII runs that mention CFE / API keywords.
                for m in INTEREST.finditer(data):
                    start = max(0, m.start() - 40)
                    end = min(len(data), m.end() + 80)
                    window = data[start:end]
                    printable = re.sub(rb"[^ -~]", b" ", window).decode("ascii")
                    interest.add(" ".join(printable.split()))

    print("=== URLS ===")
    for url in sorted(urls):
        print(url)
    print(f"\nURL count: {len(urls)}")
    print("\n=== INTEREST WINDOWS ===")
    for item in sorted(interest):
        print(item)


if __name__ == "__main__":
    main()
