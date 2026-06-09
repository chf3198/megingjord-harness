### feat(scripts): context-preamble renderer — P1-0 slice 2 #2802

- Adds `scripts/global/fleet-context-render.js` (Epic #2791 P1-0, D12/D15):
  renders an assembled context bundle into a token-bounded prompt preamble
  (priority ticket > repo-map > wiki; flags truncation). Pairs with slice 1.
  7 tests. Dogfood-reviewed (groq-llama-70b 92/ACCEPT; applied its finding).
