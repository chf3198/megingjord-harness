# Support

## Getting Help

This is a private development workbench — not a public product.

### Self-Service

- **Dashboard**: `npm start` → http://localhost:8090/dashboard/
- **Fleet health**: `npm run health`
- **Lint check**: `npm run lint`
- **Deploy to runtime**: `npm run deploy:apply`

### Architecture

- See [README.md](../README.md) for repo structure and commands
- See [research/adr/](../research/adr/) for architectural decisions
- See [instructions/](../instructions/) for global governance rules

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Dashboard shows "Not Found" | Navigate to `/dashboard/` (with trailing slash) |
| `npm start` EADDRINUSE | Kill existing process: `lsof -ti:8090 \| xargs kill` |
| Fleet health fails | Check Tailscale: `tailscale status` |
| Deploy fails on hooks | Install rsync: `sudo apt install rsync` |
