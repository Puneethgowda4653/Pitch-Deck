import sys
sys.path.insert(0, ".")
import google.generativeai as genai

KEY1 = "AIzaSyBk5xevd5Hx3oOKfRgEOYduMdXSlUf-7jM"
KEY2 = "AIzaSyAZTs-NytCOptkXHrMtFgGasYtdsgc1ZeQ"

for label, key in [("Key 1 (company)", KEY1), ("Key 2 (industry)", KEY2)]:
    try:
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        resp = model.generate_content("Say 'OK' and nothing else.")
        print(f"PASS {label}: {resp.text.strip()[:50]}")
    except Exception as e:
        print(f"FAIL {label}: {e}")
