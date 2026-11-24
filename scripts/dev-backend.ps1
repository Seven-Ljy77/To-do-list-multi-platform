$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Set-Location (Join-Path $root "backend")
& (Join-Path $root "backend\.venv\Scripts\python.exe") -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
