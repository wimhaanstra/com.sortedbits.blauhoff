#!/usr/bin/env python3
from pathlib import Path

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")
pos = text.find('key:"_"')
print(text[pos:pos+1800])
