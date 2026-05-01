---
title: "Fleet-Activity Event Source for Context Flow Animations"
ticket: "#525"
epic: "#381"
date: 2026-05-01
author: "Aria Mason"
team_model: "claude:claude-sonnet-4-6@anthropic"
role: consultant
---

# Fleet-Activity Event Source for Context Flow Animations

Research ticket #525 — findings for epic #381 implementation.

## 1. Event Transport (AC 1)

**Recommended transport: Server-Sent Events (SSE) — already implemented.**

The existing `scripts/sse-handler.js` watches `.dashboard/events.jsonl` and broadcasts
each new line as an SSE event to all connected clients at `/api/events/stream`. No new
infrastructure is required; the Context Flow animation feature can subscribe directly to
this stream.

Key details:
- `fs.watch()` on `.dashboard/events.jsonl` detects new appended lines
- `broadcast(ev.type || 'activity', ev)` emits to all clients in a `Set`
- Client reconnect is handled by `dashboard/js/event-source.js` (`connectSSE`), which
  falls back to 5-second polling if the SSE connection drops

**Event schema** (from `dashboard/js/event-bus.js`):
```json
{ "type": "baton:role", "issue": 525, "role": "collaborator",
  "agent": "aria-harper", "model": "claude-sonnet-4-6",
  "title": "Research fleet...", "status": "in-progress",
  "ts": "2026-05-01T04:00:00Z", "detail": "" }
```

## 2. Event-to-Animation Path Mapping (AC 2)

Context Flow SVG node index (from `dashboard/js/context-flow.js`):

| Index | Node label |
|-------|-----------|
| 0 | VS Code |
| 1 | AUTO router |
| 2 | Cloud LLM |
| 3 | GitHub |
| 4 | Tailscale |
| 5 | OpenClaw |
| 6 | Ollama |
| 7 | CB-2 |
| 8 | CB-1 |
| 9 | Win Laptop |

### Recommended event→animation mapping

| Event type | Model/role hint | Animation path |
|---|---|---|
| `git:commit` | any | VS Code (0) pulse → GitHub (3) arrow active |
| `git:pr` | any | VS Code (0) → GitHub (3) arrow active |
| `git:merge` | any | GitHub (3) node pulse |
| `baton:role` / `ticket:role` | `fleet` in model string | VS Code (0) → AUTO (1) → Tailscale (4) → OpenClaw (5) → Ollama (6) path |
| `baton:role` / `ticket:role` | `cloud` or `groq` or `cerebras` | VS Code (0) → AUTO (1) → Cloud LLM (2) path |
| `baton:role` / `ticket:role` | `haiku` or `sonnet` or `claude` | VS Code (0) → AUTO (1) → Cloud LLM (2) path |
| `deploy:*` | any | Win Laptop (9) → CB-1 (8) or CB-2 (7) flash |
| `test:*` | any | GitHub (3) → VS Code (0) feedback arrow |
| `ticket:created` / `ticket:status` | any | GitHub (3) node pulse |

**Model routing hint detection** (from `event-bus.js` `STATUS_ROLE_MAP` and `_batonHistory`):
- `ev.model` field: check for `qwen`, `ollama`, `fleet`, `openclaw` → fleet path
- `ev.model` field: check for `claude`, `gpt`, `groq`, `cerebras`, `gemini` → cloud path
- `ev.agent` field may also carry the fleet/cloud hint

## 3. Idle Suppression and Animation Expiry Rules (AC 3)

### Debounce (burst suppression)
Multiple events arriving within a 2-second window should collapse to a single animation
cycle. A module-level `_lastAnimationTs` timestamp (same pattern as `_lastAutoRecord` in
`wiki-reader.js`) gates rapid-fire events:

```javascript
const ANIM_DEBOUNCE_MS = 2000;
let _lastAnimationTs = 0;

function maybeAnimate(path) {
  const now = Date.now();
  if (now - _lastAnimationTs < ANIM_DEBOUNCE_MS) return;
  _lastAnimationTs = now;
  triggerAnimation(path);
}
```

### Animation expiry (CSS-class approach)
Add a CSS class to targeted SVG nodes/arrows on event; remove after 3 seconds via
`setTimeout`. Use `animation-fill-mode: forwards` so the final keyframe state holds
until removal:

```javascript
function triggerAnimation(nodeOrArrow) {
  nodeOrArrow.classList.add('cf-active');
  setTimeout(() => nodeOrArrow.classList.remove('cf-active'), 3000);
}
```

CSS:
```css
.cf-active {
  animation: cf-pulse 0.6s ease-out forwards;
}
@keyframes cf-pulse {
  0%   { opacity: 1; filter: drop-shadow(0 0 4px #60a5fa); }
  100% { opacity: 0.4; filter: none; }
}
```

### Idle state
When no events arrive for >30 seconds, all `cf-active` classes should be removed and
nodes should return to their default dim state. A single `setInterval` (30s) can sweep
and remove any lingering active classes (defensive cleanup for any `setTimeout` that may
have been skipped during tab suspension).

## 4. Implementation Guidance for Epic #381

1. Add `connectSSE(app)` subscription in `dashboard/js/context-flow.js` (or a new
   `context-flow-events.js` sibling file to stay under 100-line limit)
2. In the SSE `message` handler, call `maybeAnimate(resolvePath(ev))` where
   `resolvePath` maps the event to a node/arrow index pair
3. Wire `triggerAnimation` to toggle the `.cf-active` CSS class on the SVG `<path>` or
   `<circle>` element corresponding to the path
4. Keep static SVG render in `context-flow.js` unchanged; only the event-wiring layer is new
5. The 100-line limit likely requires splitting the event-wiring into a new file

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| SSE drops on mobile/sleep | Low | Existing 5s polling fallback in `event-source.js` covers it |
| Tab suspended during animation | Low | 30s idle sweep clears stale `.cf-active` classes |
| `ev.model` field absent | Medium | Fallback to `ev.agent` or default to cloud path when ambiguous |
| Tight 100-line limit for new file | Medium | Split event wiring from static SVG into separate file |

## 6. Conclusion

All three ACs are satisfied by the existing SSE infrastructure. No new transport or
backend changes are needed. Epic #381 child tickets can be scoped as:
1. Add CSS animation keyframes to dashboard styles
2. Add event-wiring module (`context-flow-events.js`) consuming SSE stream
3. Wire module into Alpine app init
