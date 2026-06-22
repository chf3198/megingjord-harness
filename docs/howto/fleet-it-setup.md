# Fleet IT setup runbook (#3175 / Epic #3162 D4, D7)

IT role and agents may refresh **local, non-commitable** fleet state. Do not edit tracked `inventory/*.json` (removed from git; use `*.example.json` templates only).

## Allowed commands

| Action | Command |
|--------|---------|
| Discover Tailscale peers | `bash scripts/global/fleet-discover.sh` → `~/.megingjord/devices.json` |
| Capability probe | `npm run capability:probe` → `.dashboard/capabilities.json` |
| Fleet readiness | `npm run harness:doctor` |
| First-install bootstrap | `npm run harness:setup` |
| Dashboard wizard | Fleet view → **Fleet Setup** panel (`/api/fleet/setup/*`) |

## Credential writes

- Preferred: `MEGINGJORD_KEYCHAIN=1` + Dashboard Fleet Setup step 4
- Fallback: atomic `.env` append via `/api/fleet/setup/credentials` (never localStorage)
- Never commit `.env` or paste secrets into issues/PRs

## Collaborator-only (ticket required)

- Editing `inventory/*.example.json` templates
- Changing `scripts/global/resolve-inventory.js` merge logic
- Git history scrub (#3172) — Admin + operator approval

## Verification

```bash
npm run inventory:portability-check
node scripts/global/fleet-config.js fleet
npm run harness:doctor
```

Signed-by: Cursor IT
Team&Model: cursor:composer-2.5-fast@cursor
Role: it
