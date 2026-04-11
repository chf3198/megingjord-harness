---
name: network-platform-resources
description: Inventory of all network-accessible compute platforms, connection methods, credentials, and specs. Load this skill when a task could benefit from remote execution, offloading, or cross-platform deployment.
argument-hint: "[goal: connect|status|inventory|offload] [target: windows-laptop|chromebook|all]"
user-invocable: true
disable-model-invocation: false
---

# Network Platform Resources

## Purpose

Provide every AI agent session with an always-current inventory of reachable compute platforms, how to connect, what's installed, and when to offload work. This skill is **global** (user-level) and applies across all repositories.

---

## Platform Inventory

### 1. Primary Chromebook (local — this machine)

| Spec | Detail |
|------|--------|
| **Hostname** | `penguin` (Crostini container) |
| **OS** | Debian (ChromeOS Linux) |
| **User** | `curtisfranks` (full sudo, no password) |
| **RAM** | ~4–6.3 GB usable (mem-watchdog active) |
| **Storage** | Limited — watch disk usage |
| **Tailscale IP** | `100.87.216.75` |
| **Node.js** | v22+ |
| **Role** | Primary development, IDE host, agent execution |

**Constraints**: Low memory. Always check mem-watchdog before heavy operations. Crostini is NAT'd — cannot reach LAN directly. All cross-machine networking goes through Tailscale.

### 2. Smaller Chromebook (remote inference tier — `penguin-1`)

| Spec | Detail |
|------|--------|
| **Hostname** | `penguin-1` |
| **OS** | Debian (ChromeOS Linux) |
| **User** | `curtisfranks` |
| **RAM** | ~2–3 GB usable |
| **Storage** | Limited |
| **Tailscale IP** | `100.86.248.35` |
| **SSH Alias** | `penguin-1` or `small-chromebook` |
| **Node.js** | v22+ |
| **Ollama + Phi-3.5 Mini** | ✅ Installed (2.2 GB model, API on port 11434) |
| **Role** | Lightweight inference (routing, classification, summarization) |

**Why**: Dedicated inference tier. Offload routing decisions and classification tasks here to free up main machine RAM. Phi-3.5 Mini runs at ~120ms/token on 2 CPU cores — fast enough for decision logic, not user-facing latency.

**How to Use**:
```bash
# Infer via Phi-3.5 on penguin-1
ssh penguin-1 "curl -s http://localhost:11434/api/generate -d '{\"model\":\"phi3.5\",\"prompt\":\"classify: X or Y?\",\"stream\":false}'"

# Check inference health
node scripts/openclaw-preflight.js penguin-1 penguin-1
```

### 3. Windows Laptop (remote — Dell XPS 13 7390)

| Spec | Detail |
|------|--------|
| **Hostname** | `DESKTOP-909A7KM` |
| **OS** | Windows 11 Home (Build 26200, 64-bit) |
| **CPU** | Intel Core i7-10510U (4 cores / 8 threads) |
| **RAM** | **16 GB** DDR4 (~7–8 GB typically free) |
| **Storage** | 238 GB NVMe SSD, ~63 GB free |
| **GPU** | Intel UHD Graphics (1 GB) |
| **WiFi** | Killer Wi-Fi 6 AX1650w |
| **Tailscale IP** | `100.78.22.13` |
| **SSH alias** | `windows-laptop` |
| **User** | `admin` |
| **Node.js** | v24.13.1 |
| **npm** | 11.8.0 |
| **Git** | 2.53.0 |
| **.NET** | 8.0.25 |
| **Python** | ❌ Not installed |
| **Role** | Heavy compute, daemon hosting (OpenClaw Gateway), Docker candidate |

**Strengths**: 4× the RAM of Chromebook, 8 threads, native Node 24, Thunderbolt 3, external display support.
**Constraints**: Windows Home (no Hyper-V without workarounds), 63 GB free disk, no Python yet.

---

## Connection Method

### Architecture

```
Chromebook (Crostini)           Windows Laptop
  100.87.216.75          ←→       100.78.22.13
       ↕ Tailscale mesh (DERP relay via Dallas) ↕
       └── SSH via ProxyCommand: tailscale nc ──┘
```

**Why Tailscale**: Crostini's NAT (`100.115.92.x`) blocks direct LAN access. Tailscale creates a WireGuard mesh that bypasses all NAT/firewall issues.

### SSH Configuration

Config lives at `~/.ssh/config` on the Chromebook:

```
Host windows-laptop
    HostName 100.78.22.13
    User admin
    IdentityFile ~/.ssh/id_ed25519_windows
    ProxyCommand sudo tailscale nc %h %p
    StrictHostKeyChecking no
```

**Authentication**: Ed25519 key pair — passwordless.
- Private key: `~/.ssh/id_ed25519_windows`
- Public key installed at: `C:\ProgramData\ssh\administrators_authorized_keys` (Windows admin path)

### Quick Connect

```bash
# Interactive shell
ssh windows-laptop

# Run a command
ssh windows-laptop "powershell -Command \"Get-Process | Select-Object -First 5\""

# Copy file TO Windows
scp -o ProxyCommand="sudo tailscale nc %h %p" file.txt admin@100.78.22.13:C:/Users/Admin/

# Copy file FROM Windows
scp -o ProxyCommand="sudo tailscale nc %h %p" admin@100.78.22.13:C:/Users/Admin/file.txt ./
```

### Prerequisites (must be running)

1. **Tailscale daemon on Chromebook**:
   ```bash
   # Check status
   sudo tailscale status

   # If not running, start with userspace networking (required for Crostini)
   sudo tailscaled --state=/var/lib/tailscale/tailscaled.state --tun=userspace-networking &>/dev/null &
   ```

2. **Tailscale on Windows**: Runs as a system service (auto-start enabled).

3. **OpenSSH on Windows**: Runs as `sshd` service (auto-start enabled).

### Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| `ssh: Connection timed out` | Tailscale daemon not running | Start `tailscaled` with `--tun=userspace-networking` |
| `tailscale status` shows "Logged out" | Auth expired | `sudo tailscale up` → open URL in browser |
| SSH asks for password | Key auth broken | Re-copy pubkey to `C:\ProgramData\ssh\administrators_authorized_keys` |
| `tailscale ping` works but SSH doesn't | Firewall rule missing | On Windows: `New-NetFirewallRule -Name "OpenSSH-AllNets" -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22` |
| Tailscale shows DERP relay only | No direct path (OK — still works, ~60ms latency) | Ensure both on same WiFi for direct path |

---

## When to Offload to Windows

Use the Windows laptop when a task hits these thresholds on the Chromebook:

| Trigger | Action |
|---------|--------|
| Memory pressure (mem-watchdog warnings) | Offload build/test to Windows |
| Need Docker | Windows has WSL2 potential (Home edition needs workaround) |
| Long-running daemon (OpenClaw Gateway) | Always run on Windows — persistent, more RAM |
| Heavy npm install / build | Faster on i7 with 16 GB |
| Playwright with multiple browsers | Offload to avoid Chromebook OOM |
| Need Python | Install on Windows first (not on Chromebook's tight disk) |

## When to Keep on Chromebook

| Scenario | Reason |
|----------|--------|
| IDE + Copilot agent sessions | VS Code is already here |
| Quick edits / git operations | Lower latency, no SSH overhead |
| Cloudflare deploys | Wrangler tokens are configured here |
| Lightweight test runs | Playwright single-browser is fine |

---

## Security Notes

- SSH key is Ed25519 (no password on private key — acceptable for LAN/Tailscale mesh)
- Windows password is NOT stored anywhere in skill files or repos
- Tailscale uses WireGuard encryption end-to-end
- Windows Firewall rule allows port 22 on all interfaces (tighten to Tailscale-only if paranoid)
- The `administrators_authorized_keys` file is ACL-restricted to SYSTEM + Administrators only

---

## Adding New Platforms

When a new machine is added to the network:

1. Install Tailscale, authenticate with same account
2. Install OpenSSH server (if Linux/Windows)
3. Copy `~/.ssh/id_ed25519_windows.pub` to the new machine's authorized_keys
4. Add a `Host` entry in `~/.ssh/config`
5. Update this skill's Platform Inventory section
6. Test: `ssh <new-alias> echo "OK"`
