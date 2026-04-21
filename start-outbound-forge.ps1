param(
  [string]$Username = "admin",
  [string]$Password = "change-me-now",
  [string]$SessionSecret = "replace-with-a-long-random-secret"
)

$projectRoot = "E:\AKELA\codex\forgeai-gym-coach"
$nodePath = "E:\AKELA\codex\forgeai-gym-coach\tools\node-v22.20.0-win-x64-full\node-v22.20.0-win-x64\node.exe"
$serverPath = Join-Path $projectRoot "server\src\index.js"

if (-not (Test-Path $nodePath)) {
  Write-Error "Node runtime not found at $nodePath"
  exit 1
}

if (-not (Test-Path $serverPath)) {
  Write-Error "Server entry not found at $serverPath"
  exit 1
}

$env:AUTH_USERNAME = $Username
$env:AUTH_PASSWORD = $Password
$env:AUTH_SESSION_SECRET = $SessionSecret

Write-Host ""
Write-Host "Starting Outbound Forge..." -ForegroundColor Cyan
Write-Host "Username: $Username" -ForegroundColor Green
Write-Host "Password: $Password" -ForegroundColor Yellow
Write-Host "Open: http://127.0.0.1:4020" -ForegroundColor Green
Write-Host ""

if (-not $env:PORT) {
  $env:PORT = "4020"
}

& $nodePath $serverPath
