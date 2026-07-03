import urllib.request
import zipfile
import os

url = 'https://cdn.playwright.dev/builds/cft/148.0.7778.96/linux64/chrome-headless-shell-linux64.zip'
path = '/home/appuser/.cache/ms-playwright/chromium-headless-shell-1223'

os.makedirs(path, exist_ok=True)
print('Downloading', url)
with urllib.request.urlopen(url, timeout=120) as response:
    data = response.read()
print('Downloaded', len(data), 'bytes')

tmp = '/tmp/headless.zip'
with open(tmp, 'wb') as f:
    f.write(data)
print('Saved to', tmp)

with zipfile.ZipFile(tmp, 'r') as z:
    z.extractall(path)
print('Extracted to', path)
