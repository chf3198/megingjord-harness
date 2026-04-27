#!/usr/bin/env pwsh
# Register LiteLLM as a Windows service via NSSM so it auto-starts.
# Run once as Administrator: .\scripts\windows-laptop\install-litellm-service.ps1
# Requires: NSSM (https://nssm.cc) in PATH, ANTHROPIC_API_KEY set at system level

param(
  [string]$ServiceName = "LiteLLM",
  [string]$ConfigPath  = "config\litellm-config.yaml",
  [switch]$Remove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Status([string]$msg) { Write-Host "[service] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)     { Write-Host "[service] OK: $msg" -ForegroundColor Green }
function Write-Fail([string]$msg)   { Write-Host "[service] FAIL: $msg" -ForegroundColor Red }

if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
  Write-Fail "NSSM not found. Download from https://nssm.cc and add to PATH."
  exit 1
}

if ($Remove) {
  Write-Status "Removing service $ServiceName..."
  nssm stop $ServiceName 2>$null
  nssm remove $ServiceName confirm
  Write-Ok "Service removed"
  exit 0
}

$litellm = (Get-Command litellm -ErrorAction Stop).Source
$config  = Join-Path (Get-Location) $ConfigPath
$logDir  = Join-Path $env:LOCALAPPDATA "LiteLLM"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Status "Installing service '$ServiceName'..."
nssm install $ServiceName $litellm "--config" $config "--port" "4000" "--host" "0.0.0.0"
nssm set $ServiceName AppStdout (Join-Path $logDir "stdout.log")
nssm set $ServiceName AppStderr (Join-Path $logDir "stderr.log")
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateBytes 10485760

# Pass ANTHROPIC_API_KEY from current session to service environment
if ($env:ANTHROPIC_API_KEY) {
  nssm set $ServiceName AppEnvironmentExtra "ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY"
} else {
  Write-Fail "ANTHROPIC_API_KEY not set — set it via: nssm set $ServiceName AppEnvironmentExtra ANTHROPIC_API_KEY=sk-..."
}

nssm start $ServiceName
Write-Ok "Service '$ServiceName' installed and started. Logs: $logDir"
