#!/usr/bin/env python3
from pathlib import Path

text = Path("vendor/apk/base/assets/apps/__UNI__107C171/www/app-service.js").read_text(encoding="latin-1")
for needle in ["submit_obj.account", "account:this.submit_obj", 'account:t.submit_obj', "submit_obj={", "email:this.submit_obj.email", "pUserLogin"]:
    print(f"\n===== {needle} count={text.count(needle)} =====")
    pos = text.find(needle)
    if pos >= 0:
        print(text[max(0,pos-120):pos+400])

# login page data()
pos = text.find('placeholder:t._$s(2,"a-placeholder",t.$t("index.13")')
print("\n===== around login data =====")
# find login_user data function near pUserLogin call
pos = text.rfind("data:function(){return{", 0, text.find("pUserLogin(t.submit_obj)"))
print(text[pos:pos+500])
