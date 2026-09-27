# tools

Python helper scripts (outside the web app). `mux.py` (WAV → MP3 / MP4 via ffmpeg) arrives in M4.

Setup (PowerShell, from repo root):

```powershell
py -3.12 -m venv tools/.venv
tools/.venv/Scripts/Activate.ps1
pip install -r tools/requirements.txt
```

Requires `ffmpeg` on PATH.
