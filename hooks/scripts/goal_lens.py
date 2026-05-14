#!/usr/bin/env python3
"""UserPromptSubmit hook: inject G1-G9 decision lens context.

Per #1105 D-009 hybrid (Tier B / Tier B+ implementation, scope #1123):
- Tier B (default for Manager / Collaborator / Admin sessions): inject the
  priority sentence only.
- Tier B+ (Consultant role only): also inject expanded G1..G9 definitions.

Active role is read from session context payload key 'role' or env
MEGINGJORD_ROLE. Absent role = treat as non-consultant (Tier B).
"""
import json
import os
import re
import sys

GOALS = (
    "G1 Governance > G2 Quality > G3 Zero Cost > G4 Privacy > "
    "G5 Portability > G6 Resilience > G7 Throughput > "
    "G8 Observability > G9 Interoperability"
)

ANNEAL_RE = re.compile(
    r"\b(anneal|self-anneal|recurr|mid-flight|tier-2|repeat failure|pattern)\b",
    re.IGNORECASE,
)

DEFINITIONS_TIER_B_PLUS = (
    "Goal definitions: "
    "G1 Governance: policy, role, provenance, ticket controls non-negotiable. "
    "G2 Quality: maximize correctness and engineering value. "
    "G3 Zero Cost: prefer local/fleet/free lanes before paid providers. "
    "G4 Privacy: keep sensitive context local unless explicit override. "
    "G5 Portability: avoid user-specific coupling; settings-driven. "
    "G6 Resilience: graceful degradation; fallback paths. "
    "G7 Throughput: acceptable speed after higher-priority goals met. "
    "G8 Observability: decisions visible, auditable, attributable. "
    "G9 Interoperability: preserve compatibility across runtimes."
)

DECISION_RE = re.compile(
    r"\b(decide|decision|choose|tradeoff|priority|prioritize|rank|route|"
    r"policy|architecture|design|should we|which option|compare)\b",
    re.IGNORECASE,
)

# Epic #1436 D-1436-01: in-session Tier-2 worker awareness.
# When prompts mention recurrence/anneal/repeat-failure patterns, surface
# concise guidance reminding the worker that a Tier-2 anneal event should
# be emitted proactively, without waiting for the nightly cron.
RECURRENCE_RE = re.compile(
    r"\b(anneal|self-anneal|tier-?2|mid-?flight|"
    r"recurr(?:ence|ent|ing)?|repeat(?:ed)?\s+failure|"
    r"happened\s+again|same\s+error\s+twice|drift\s+pattern)\b",
    re.IGNORECASE,
)
RECURRENCE_GUIDANCE = (
    "Tier-2 mid-flight awareness (#1436): if this is a recurring pattern "
    "(≥2 in 7d at severity ≥ medium), emit `event:goal-failure-escalation` "
    "or file a Tier-2 anneal ticket NOW — do not wait for the nightly cron. "
    "See `instructions/workflow-resilience.instructions.md` Tier-2 model "
    "and `feedback_anneal_emission_during_implementation.md`."
)


def get_active_role(payload: dict) -> str:
    """Resolve active role from payload or env (lowercase, stripped)."""
    role = str(payload.get("role", "")).lower().strip()
    if role:
        return role
    return os.environ.get("MEGINGJORD_ROLE", "").lower().strip()


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = str(payload.get("prompt", ""))
    if not prompt:
        return 0

    base = f"Goal lens: {GOALS}."
    if DECISION_RE.search(prompt):
        base += " Decision check: justify any lower-priority override with explicit evidence."
    if ANNEAL_RE.search(prompt):
        base += (
            " Anneal awareness: if a recurrence pattern is observed mid-flight, "
            "surface or file the Tier-2 signal now instead of waiting for the nightly cron."
        )

    if RECURRENCE_RE.search(prompt):
        base += " " + RECURRENCE_GUIDANCE

    role = get_active_role(payload)
    tier = "B"
    if role == "consultant":
        base += " " + DEFINITIONS_TIER_B_PLUS
        tier = "B+"

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": base,
            "goalLensTier": tier,
        }
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
