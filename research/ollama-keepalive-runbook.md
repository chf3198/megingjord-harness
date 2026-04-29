# Ollama Keep-Alive Configuration Runbook

## Problem

Ollama's default `OLLAMA_KEEP_ALIVE=5m` evicts loaded models after 5 minutes idle.
On windows-laptop, this causes a rapid offline/recovered cycle in fleet health logs —
each probe after a cold period races the model reload (~1.2s for phi3:mini) and times out.
Result: 67% offline rate in `logs/fleet-health.jsonl` despite the service being up.

## Fix: Set OLLAMA_KEEP_ALIVE=24h

### Windows system environment variable (persistent)

1. Open **System Properties** → **Advanced** → **Environment Variables**
2. Under **System variables**, click **New**
3. Variable name: `OLLAMA_KEEP_ALIVE`
4. Variable value: `24h`
5. Click OK, then restart the Ollama service:
   ```
   net stop ollama
   net start ollama
   ```

### Verify

```powershell
[System.Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "Machine")
# Expected: 24h
```

Check that models stay loaded after >5 minutes idle:
```
curl http://localhost:11434/api/tags
# Should return models without delay
```

## Why 24h

- 24h keeps models warm across a full workday without manual intervention.
- Memory impact: qwen2.5:7b-instruct holds ~4.5GB VRAM; windows-laptop has 16GB RAM.
  No eviction is needed — this node has sufficient RAM headroom.
- Power: Ollama process is idle; model weights stay in RAM. Negligible power delta.

## Affected Device

- `windows-laptop` (tailscale 100.78.22.13) — fallback fleet target for #573
- See `inventory/devices.json` → `maintenanceNote` for the config requirement marker

## Verification Gate (AC3 — manual)

After applying the fix, monitor `logs/fleet-health.jsonl` for 30 minutes.
A healthy node shows `"status":"online"` entries without offline/recovered cycles.
