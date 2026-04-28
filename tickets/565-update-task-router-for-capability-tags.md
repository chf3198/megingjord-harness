# #565 Implement: task-router consumes device capability tags

**Type**: task | **Status**: backlog | **Priority**: P2
**Labels**: type:task, status:backlog, area:scripts
**Epic**: #561
**Blocked by**: #564

## Objective
Make routing capability-aware by reading tags from inventory/devices.json.

## Acceptance Focus
- Fleet lane selects highest-fit resource automatically
- No device-name hardcoding in selection logic
- Lint and tests pass