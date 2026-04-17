# Dashboard Responsive Grid Strategy

**Status**: Accepted | **Date**: 2026-04-17 | **Ticket**: #215

## Summary

Replace single 640px breakpoint with 3-tier responsive grid.
No view scrolls at half-window (960×540). Phone to desktop.

## Breakpoint Design

| Tier | Range | Columns | Panel Height | Nav |
|------|-------|---------|-------------|-----|
| Desktop | ≥1024px | 2-col `1fr 1fr` | `calc((100dvh - 64px - 28px) / 3)` | Horizontal |
| Tablet | 641–1023px | 2-col `1fr 1fr` | Compressed padding | Horizontal, smaller |
| Phone | ≤640px | 1-col `1fr` | Auto (stacked) | Wrap, touch targets |

## Grid Template Per View

### LIVE (3 panels) — 960×540 target
```
[baton]    [activity]
[context-flow ← full-width]
```
Grid: `grid-template-columns: 1fr 1fr` + context-flow `grid-column: 1/-1`

### LOGS (3 panels) — 960×540 target
```
[health-log] [router-log]
[ticket-log ← full-width]
```
Grid: 2+1 layout. Internal scroll `max-height: calc(50dvh - 48px)`.

### OPS (6 panels) — 960×540 target
```
[github]     [quotas]
[router]     [governance]
[llm-context][wiki-health]
```
Grid: 2×3. Row height: `calc((100dvh - 64px - 28px - 1rem) / 3)`.

### FLEET (5 panels) — 960×540 target
```
[devices]    [services]
[resources ← full-width]
[config]     [stress-test]
```
Grid: 2+1+2. Resources is full-width table.

### WIKI (2 panels)
```
[metrics ← sidebar] [reader ← main]
```
Grid: `1fr 2fr` side-by-side.

### HELP (1 panel)
Full-width, full-height. `grid-column: 1/-1`.

## Panel Overflow Strategy

| Type | Strategy | CSS |
|------|----------|-----|
| Log panels | Internal scroll | `overflow-y: auto; max-height: calc(...)` |
| SVG panels | viewBox responsive | `width: 100%; height: auto` |
| Table panels | Internal scroll | `overflow-y: auto; max-height: calc(...)` |
| Stat panels | Fit content | `overflow: hidden` |
| Card panels | Wrap/collapse | `flex-wrap: wrap` |

## Nav/Header Responsive

| Tier | Header Height | Nav Style |
|------|--------------|-----------|
| Desktop | 56px | Horizontal buttons, full labels |
| Tablet | 56px | Horizontal, smaller padding |
| Phone | ~96px (wraps) | 2-row wrap, 44px touch targets |

## Key CSS Techniques

- `dvh` (dynamic viewport height) for mobile address bar
- `content-visibility: auto` retained for off-screen panels
- `container` queries for panel-internal responsive (future)
- `minmax(0, 1fr)` to prevent panel overflow

## Actionable Next Steps

1. Implement in css/app.css breakpoints (#219)
2. Add per-view grid modifiers in css/views.css
3. Update panel CSS for internal scroll caps
