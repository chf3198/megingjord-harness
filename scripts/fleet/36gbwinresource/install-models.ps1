#!/usr/bin/env pwsh
param([switch]$IncludeReasoning)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE', '24h', 'Machine')
$models = @(
  'starcoder2:3b',
  'granite-code:3b',
  'qwen2.5-coder:7b-instruct-q3_K_S',
  'qwen2.5-coder:7b'
)
if ($IncludeReasoning) { $models += 'qwen2.5-coder:32b' }
foreach ($model in $models) {
  Write-Host "[36gbwinresource] pulling $model"
  ollama pull $model
}
Write-Host '[36gbwinresource] OLLAMA_KEEP_ALIVE=24h confirmed and model set installed.'
