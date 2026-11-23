param(
  [string]$ApiBaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$env:VITE_API_BASE_URL = $ApiBaseUrl
Set-Location (Join-Path $root "frontend")
npx tauri build
