#!/usr/bin/env python3
from pathlib import Path

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")

for needle in [
    "pUserLogin",
    "fnLogin",
    "account",
    "password",
    "setStorageSync(\"token\"",
    "header",
    "token:",
    "Authorization",
    "beforeRequest",
    "uni.request",
    "content-type",
    "Content-Type",
]:
    print(f"\n##### {needle} count={text.count(needle)}")

# interceptor / http helper
for needle in ["beforeRequest", "setStorageSync(\"token\"", "pUserLogin(this.submit", "submit_obj"]:
    idx = 0
    print(f"\n===== {needle} =====")
    n = 0
    while n < 2:
        pos = text.find(needle, idx)
        if pos < 0:
            break
        print(text[max(0, pos - 200) : pos + 500])
        print("---")
        idx = pos + len(needle)
        n += 1
