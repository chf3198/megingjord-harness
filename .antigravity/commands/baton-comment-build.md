---
name: "baton-comment-build"
description: "Generate structured markdown for baton handoff comments."
argument-hint: "--artifact <MANAGER_HANDOFF|COLLABORATOR_HANDOFF|ADMIN_HANDOFF|CONSULTANT_CLOSEOUT> --role <role> --ticket <N> --team-model <team:model@substrate>"
---

# Baton Comment Build

Invoke this command to build structured markdown comments for the baton lifecycle.

## Dispatch

```bash
node scripts/global/baton-comment-build.js \
  --artifact <artifact> \
  --role <role> \
  --ticket <N> \
  --team-model <team:model@substrate> \
  [--fields-json <file.json>]
```

## Output

Outputs the signed, structured markdown text to stdout.
