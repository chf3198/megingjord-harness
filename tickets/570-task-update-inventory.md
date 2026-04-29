# #570 Task: Update inventory/devices.json

**Type**: task | **Status**: in-progress | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:in-progress, role:collaborator, area:infra, area:scripts

**Linked Epic**: #567 | **Blocked by**: #569

## Summary
Update `inventory/devices.json` with new model selections and performance specs from #569.

## Scope
- Update `ollamaModels` field for each device with new model list.
- Update `ollamaWarmTokPerSec` based on new model tier (estimate from research: SLM 5+, mid-tier 15+, high-end 20+).
- Update `lastUpdated` timestamp.
- Run `npm run lint` to validate JSON and 100-line file constraints.
- Verify no syntax errors; file parses cleanly.

## Acceptance Criteria
- ✅ `inventory/devices.json` updated with new models per device.
- ✅ Performance specs (tok/s) estimated per new model/hardware tier.
- ✅ JSON valid: `npm run lint` passes.
- ✅ File ≤100 lines (check line count).
- ✅ All 4 devices addressed (SLM, windows-laptop, 36gbwinresource, chromebook-2).

## Verification Gates
- **Collaborator**: JSON updated ✓, lint pass ✓ → emit COLLABORATOR_HANDOFF.
- **Admin**: JSON syntax ✓, no runtime errors ✓ → emit ADMIN_HANDOFF.
- **Consultant**: Spec consistency check ✓ → emit CONSULTANT_CLOSEOUT.

## Blocking Dependency
Blocked by #569 completion.

## Team&Model
- Collaborator (Inventory Update): Grok Code Fast 1 (Curtis Franks, 2026-04-29) — COMPLETE ✓
- Admin: Assigned for gate review.
- Consultant: Assigned for closeout.

---

## COLLABORATOR_HANDOFF

**Status**: ✅ Complete | **Date**: 2026-04-29 | **Evidence Link**: [inventory/devices.json](../inventory/devices.json)

**Inventory Updates Completed**:
- ✅ `ollamaModels` updated per #569 selections (all 4 devices):
  - SLM (penguin-1): Gemma4:e4b + Gemma3:270m + Qwen3.5:0.8b
  - windows-laptop: Qwen3:8b + Mistral-Nemo:12b + Qwen2.5:7b + Phi4:14b
  - 36gbwinresource: DeepSeek-R1:32b + Qwen3:30b + Llama4:16x17b
  - chromebook-2: No models (dev-only)
- ✅ Performance specs updated (`ollamaWarmTokPerSec`):
  - SLM: 6 tok/s (SLM tier)
  - windows-laptop: 18 tok/s (8B CPU tier)
  - 36gbwinresource: 28 tok/s (30B+ GPU tier)
- ✅ `lastUpdated` timestamp: 2026-04-29
- ✅ JSON syntax valid (jq parse + npm run lint ✓)
- ✅ File ≤100 lines (verified by lint)
- ✅ No syntax errors; all 4 devices addressed

**Verification Results**:
- npm run lint: ✅ PASS (all files within 100-line limit)
- jq syntax: ✅ PASS (JSON parses cleanly)
- Device coverage: ✅ PASS (4/4 devices)
- Spec consistency: ✅ PASS (all specs match #569 + research tiers)

**Next Phase**: Admin gates — JSON syntax ✓, performance tier validation ✓ → proceed to #571 testing.