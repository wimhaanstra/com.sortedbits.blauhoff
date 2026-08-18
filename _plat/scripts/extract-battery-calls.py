#!/usr/bin/env python3
from pathlib import Path

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")
for needle in ["pUserBatteryList(", "pUserBatteryMonitor(", "pUserBatteryDetail("]:
    print(f"\n===== {needle} =====")
    pos = 0
    for n in range(2):
        pos = text.find(needle, pos)
        if pos < 0:
            break
        print(text[max(0, pos - 80) : pos + 700])
        print("---")
        pos += len(needle)
