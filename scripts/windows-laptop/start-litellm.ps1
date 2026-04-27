#!/usr/bin/env pwsh
# Deploy and start LiteLLM gateway on windows-laptop.
# Run once from repo root: .\scripts\windows-laptop\start-litellm.ps1
# Requires: Python 3.10+, pip, ANTHROPIC_API_KEY in environment

param(
  [string]$ConfigPath = "config\litellm-config.yaml",
  [switch]$Install,
  [switch]$Foreground
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Status([string]$msg) { Write-Host "[litellm] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)     { Write-Host "[litellm] OK: $msg" -ForegroundColor Green }
function Write-Fail([string]$msg)   { Write-Host "[litellm] FAIL: $msg" -ForegroundColor Red }

# Verify Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Fail "Python not found. Install Python 3.10+ and retry."
  exit 1
}

# Verify ANTHROPIC_API_KEY
if (-not $env:ANTHROPIC_API_KEY) {
  Write-Fail "ANTHROPIC_API_KEY not set. Set it before running this script."
  exit 1
}

# Install if requested or missing
if ($Install -or -not (Get-Command litellm -ErrorAction SilentlyContinue)) {
  Write-Status "Installing litellm[proxy]..."
  python -m pip install --quiet "litellm[proxy]"
  if ($LASTEXITCODE -ne 0) { Write-Fail "pip install failed"; exit 1 }
  Write-Ok "litellm installed"
}

# Resolve config path
$config = Join-Path (Get-Location) $ConfigPath
if (-not (Test-Path $config)) {
  Write-Fail "Config not found: $config"
  exit 1
}
Write-Ok "Config: $config"

# Health check — skip start if already running
$health = $null
try { $health = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop }
catch { $health = $null }
if ($health -and $health.StatusCode -eq 200) {
  Write-Ok "LiteLLM already running on :4000"
  exit 0
}

# Start
Write-Status "Starting LiteLLM gateway on port 4000..."
if ($Foreground) {
  litellm --config $config --port 4000 --host 0.0.0.0
} else {
  $log = Join-Path $env:TEMP "litellm.log"
  Start-Process -FilePath "litellm" `
    -ArgumentList "--config", $config, "--port", "4000", "--host", "0.0.0.0" `
    -RedirectStandardOutput $log -RedirectStandardError $log `
    -NoNewWindow -PassThru | Out-Null
  Start-Sleep -Seconds 3
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 5 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Write-Ok "Gateway healthy on :4000" } else { Write-Fail "Gateway unhealthy ($($r.StatusCode))" }
  } catch { Write-Fail "Gateway did not start — check $log" }
}
