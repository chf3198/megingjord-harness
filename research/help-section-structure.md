# Help Center Section Structure — Recommended Layout

**Date**: 2025-07-18
**Ticket**: #71 (Epic #70)
**Based on**: GitHub Docs, Diátaxis, Material Design, NN/g research

## Recommended Hierarchy

```
HELP CENTER
├── Getting Started
│   ├── What is DevEnv Ops?              [Explanation]
│   ├── Quick tour                        [Tutorial]
│   └── Understanding fleet topology      [Explanation]
│
├── Using the Dashboard
│   ├── Checking fleet health             [How-to]
│   ├── Investigating a device            [How-to]
│   ├── Understanding service indicators  [Explanation]
│   ├── Running stress tests              [How-to]
│   └── Keyboard shortcuts                [Reference]
│
├── Troubleshooting
│   ├── Device shows as offline           [How-to]
│   ├── Service status is degraded        [How-to]
│   ├── Dashboard won't load              [How-to]
│   └── Data appears stale               [How-to]
│
├── Reference
│   ├── Status indicator legend           [Reference]
│   ├── Health check endpoints            [Reference]
│   ├── Inventory data format             [Reference]
│   └── Configuration options             [Reference]
│
├── For Developers
│   ├── Architecture overview             [Explanation]
│   ├── Development setup                 [Tutorial]
│   ├── Adding a new panel                [How-to]
│   ├── File structure reference          [Reference]
│   ├── Alpine.js patterns                [Explanation]
│   └── Contributing guide                [How-to]
│
└── Feedback
    ├── Report an issue
    └── Request a feature
```

## Article Template (GitHub Docs pattern)

1. Title (task-oriented, sentence case)
2. Intro (one sentence, search keywords)
3. Prerequisites (if any)
4. Body (numbered steps or headings)
5. Troubleshooting (if applicable)
6. Next steps (link to follow-up)

## Key Principle: Diátaxis

Never mix tutorial, how-to, reference, and explanation content.
Each section should be ONE type only.
