param(
  [string]$ApiBaseUrl = "http://192.168.1.12:8000"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $frontend "src-tauri\gen\android"))) {
  throw "Android 工程还没有初始化。先运行：cd frontend; npx tauri android init"
}

$env:VITE_API_BASE_URL = $ApiBaseUrl
Set-Location $frontend
npx tauri android build --apk
