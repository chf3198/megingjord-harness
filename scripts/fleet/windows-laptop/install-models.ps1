#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE', '24h', 'Machine')
$models = @(
  'qwen2.5-coder:1.5b',
  'starcoder2:3b',
  'granite-code:3b',
  'qwen2.5-coder:7b',
  'qwen2.5:7b-instruct'
)
foreach ($model in $models) {
  Write-Host "[windows-laptop] pulling $model"
  ollama pull $model
}
Write-Host '[windows-laptop] OLLAMA_KEEP_ALIVE=24h confirmed and model set installed.'
