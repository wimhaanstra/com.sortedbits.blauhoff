#!/usr/bin/env python3
from pathlib import Path
import re

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")
needles = [
    "/api/user/login",
    "/api/user/battery_list",
    "/api/user/battery_monitor",
    "/api/user/battery_detail",
    "/api/user/register",
    "token",
    "Authorization",
]
for needle in needles:
    idx = 0
    count = 0
    print(f"\n===== {needle} =====")
    while count < 3:
        pos = text.find(needle, idx)
        if pos < 0:
            break
        start = max(0, pos - 250)
        end = min(len(text), pos + 400)
        snippet = text[start:end].replace("\n", " ")
        print(snippet)
        print("---")
        idx = pos + len(needle)
        count += 1
