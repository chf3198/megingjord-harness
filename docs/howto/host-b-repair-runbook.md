# Host-B repair runbook (F3 second-host reachability)

_Epic #3414 #3486 · IT-role actionable · $0 · Source: Phase-0 #3415 §Q3._

When the Fleet Advisor's `L-HOST-01` fires (a policy-listed host is unreachable), the mesh has dropped
from F3 (load-balanced) to F2 (single host). This runbook restores the second host. It is **IT-role**
work — fleet hardware/service repair, no ticket/commit/baton (per the IT boundary).

Until the host is back, dispatch degrades safely: `fleet-host-selector.selectLeastLoaded` skips the
down peer and routes to the reachable host; if both are down the caller falls to the free-cloud third
tier. Nothing blocks — this repair is about **restoring capacity**, not unblocking work.

## Triage ladder (stop at the first step that restores reachability)

Run each check from the orchestrator host. Host-B example: `100.78.22.13`.

### 1. Tailscale mesh reachability
```bash
tailscale status | grep -i <host-b-name>      # is the peer online in the mesh?
tailscale ping <host-b-ip>                     # mesh-level reachability (bypasses app port)
ping -c 3 <host-b-ip>                          # raw ICMP
```
- Peer absent from `tailscale status` -> the host is powered off or Tailscale isn't running there (step 2).
- Peer present but `tailscale ping` fails -> mesh/key expiry: re-auth on the host (`tailscale up`).

### 2. Power / wake
- Host powered off or asleep -> wake it (Wake-on-LAN `wakeonlan <mac>`, smart-plug, or physical).
- Laptops: disable sleep-on-lid / set the power plan to stay awake when the fleet is expected up.

### 3. Ollama service + bind address
Once the host is reachable at the OS level but the roster endpoint still fails:
```bash
# On host-b:
systemctl status ollama         # or on Windows: tasklist | findstr ollama
# Ollama must bind 0.0.0.0, not 127.0.0.1, to serve the mesh:
echo $OLLAMA_HOST               # expect 0.0.0.0:11434
# Fix (Linux): export OLLAMA_HOST=0.0.0.0:11434 and restart the service.
# Fix (Windows): set the OLLAMA_HOST user env var to 0.0.0.0:11434 and restart Ollama.
```

### 4. Firewall
```bash
# Linux (ufw):   sudo ufw allow 11434/tcp
# Windows:       New-NetFirewallRule -DisplayName "Ollama" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Allow
```
Prefer scoping the rule to the Tailscale interface/CIDR rather than opening the port to the world (G4).

### 5. Verify restoration
```bash
# roster + resident-model (load) probes should both answer on the host port
# the Advisor's next run re-probes; resolveHostPosture() then sees 2 reachable hosts -> tier F3
```
When both hosts answer, `resolveHostPosture` reports `tier: F3` and load-balances again — no operator action needed.

## What NOT to do
- Do **not** open the Ollama port to the public internet (G4). Keep it on the Tailscale interface.
- Do **not** file a ticket for a routine host restart — this is IT-role maintenance (it-ops bypass).
- Do **not** escalate to a paid provider because a peer is down — the free-cloud third tier already covers the gap ($0).

## Related
- Selector: `scripts/global/fleet-host-selector.js` (least-loaded + degrade-safe).
- Advisor rule `L-HOST-01` (`config/fleet-advisor-rules.yml`).
- Free-cloud third tier: `scripts/global/free-cloud-dispatch.js` (#2619/#2621).
