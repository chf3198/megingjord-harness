# Workflow Learnings

## 2026-06-02
- #2617: Make overlap boundaries explicit at manager handoff (`related_tickets`, `overlap_decision`) so conflict prevention is enforced by schema, not operator memory.
- #2626: Direct fleet model calls without bounded timeout can stall sessions; use guarded wrappers or explicit timeout flags.
