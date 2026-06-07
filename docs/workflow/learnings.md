# Workflow Learnings

## 2026-06-02
- #2617: Make overlap boundaries explicit at manager handoff (`related_tickets`, `overlap_decision`) so conflict prevention is enforced by schema, not operator memory.
- #2626: Direct fleet model calls without bounded timeout can stall sessions; use guarded wrappers or explicit timeout flags.

## 2026-06-07
- #2569: Don't ask the client for a credential already in the approved local `.env`. Before any credential prompt, call `credential-availability.js#preCredentialPromptCheck([names])` — `use-local` if available, else `report-absent-no-prompt` (report + terminal-entry, never request the raw secret in chat). Builds on #2645's `loadLocalEnv`.
