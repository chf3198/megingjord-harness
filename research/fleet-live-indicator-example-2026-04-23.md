# Fleet Live Indicator Example — 2026-04-23

Date: 2026-04-23

## Summary Table

| Item | Example | Notes |
|---|---|---|
| Surface | Visible terminal window on each fleet device | Lowest overhead view |
| Refresh | every 3 seconds | Cheap polling |
| Signals | model loaded, keep-alive timer, OpenClaw liveliness, request rate | No expensive probes |

## Proposed Example View

Windows terminal line (OpenClaw host):

`[15:42:09] node=windows-laptop openclaw=live ollama=up model=phi3:mini until=18m req_30s=4 cpu=31% ram_free=7.9GB`

Penguin-1 terminal line:

`[15:42:10] node=penguin-1 ollama=up model=tinyllama:latest until=4m req_30s=1 cpu=42% ram_free=0.92GB`

## Development Sequence (Research-First)

1. Research ticket completes and freezes signal list + polling interval.
2. Implementation ticket builds exactly this terminal display format.
3. Remote workflow ticket defines startup/login behavior for visible windows.

## Actionable Next Steps

1. Approve this display format and signal set.
2. Use it as acceptance target in #134.
3. Add startup behavior in #135 after #133 closeout.

Last updated: 2026-04-23