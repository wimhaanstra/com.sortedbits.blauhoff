#!/usr/bin/env python3
from pathlib import Path

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")
pos = text.find("pUserLogin(")
print("first pUserLogin at", pos)
print(text[pos : pos + 1200])
print("\n\n===== second =====")
pos2 = text.find("pUserLogin(", pos + 10)
print(text[pos2 : pos2 + 1500])
