param()

$projectRoot = "E:\AKELA\codex\forgeai-gym-coach"
$nodePath = Join-Path $projectRoot "tools\node-v22.20.0-win-x64\node.exe"
$serverPath = Join-Path $projectRoot "server\src\index.js"
$envPath = Join-Path $projectRoot ".env"

if (-not (Test-Path $nodePath)) {
  Write-Error "Node runtime not found at $nodePath"
  exit 1
}

if (-not (Test-Path $serverPath)) {
  Write-Error "Server entry not found at $serverPath"
  exit 1
}

if (-not (Test-Path $envPath)) {
  Write-Error "Missing .env file at $envPath. Copy .env.example to .env and fill in your values first."
  exit 1
}

Write-Host ""
Write-Host "Starting Outbound Forge..." -ForegroundColor Cyan
Write-Host "Using .env at: $envPath" -ForegroundColor Green
Write-Host "Open: http://127.0.0.1:4020" -ForegroundColor Green
Write-Host ""

if (-not $env:PORT) {
  $env:PORT = "4020"
}

& $nodePath $serverPath
