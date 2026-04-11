# Hardware Evaluation

**Last updated**: 2026-04-11
**Budget**: $250

## Current Fleet

| Machine | CPU | RAM | Disk Free | Ollama Models | Role |
|---|---|---|---|---|---|
| penguin-1 | x86_64, 6.6.99 kernel | 2.7GB | ~2.5GB | tinyllama, lfm2.5, gemma3:270m | SML agent |
| windows-laptop | x86_64 | 16GB (~8.8GB free) | ~39.5GB | mistral, phi3:mini, qwen2.5:7b | OpenClaw host |
| chromebook-2 | TBD | TBD | TBD | None | Dev/staging |

## Constraints

- penguin-1: No swap possible (kernel blocks swapon), max ~0.88GB free for models
- windows-laptop: Best local inference node, can run 7B models comfortably
- Chromebooks: LXC containers with limited RAM allocation

## $250 Hardware Recommendations

### Option A: Refurbished Mini PC (RECOMMENDED)
- **What**: Beelink/MinisForum/NUC with 16GB RAM, NVMe SSD
- **Cost**: $130–200 refurbished
- **Benefit**: Dedicated inference node, runs 7B–13B models
- **Where**: eBay, Amazon Renewed

### Option B: Raspberry Pi 5 (8GB)
- **What**: Pi 5 + case + power + SD card
- **Cost**: ~$100–120
- **Benefit**: Cheap always-on edge node
- **Limitation**: ARM, slow for LLM inference, 8GB max RAM

### Option C: RAM Upgrade for Windows Laptop
- **What**: Upgrade to 32GB if slots available
- **Cost**: ~$40–60
- **Benefit**: Run 13B+ models locally on existing hardware
- **Risk**: Need to verify upgradability

## Tesla HW4 Assessment

- **Hardware**: Custom SoC (Samsung 7nm), 16GB RAM, 256GB storage
- **Verdict**: NOT usable for general compute
- **Tesla Fleet API**: Only for vehicle data/commands, requires app registration
- **Cannot run**: Arbitrary code, LLMs, or custom inference workloads
- **Possible use**: Vehicle telemetry for data projects (requires OAuth app)

## Actionable Next Steps

1. Inventory chromebook-2 specs
2. Check windows-laptop RAM upgrade slots
3. Research specific mini PC models in $150–200 range
