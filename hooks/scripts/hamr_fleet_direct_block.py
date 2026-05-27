"""HAMR fleet-direct-block — env-gated enforcement for pretool_guard.

Refs Epic #2029 #2236 wiring follow-on. Python mirror of
scripts/global/hamr-fleet-direct-block.js (#2219). Consumes #2235
detect_bypass output; returns block decision when
MEGINGJORD_FLEET_DIRECT_BLOCK=1 AND severity='fleet-bypass'.
"""

from __future__ import annotations

import os

ENV_FLAG = "MEGINGJORD_FLEET_DIRECT_BLOCK"
REDIRECT_MSG = (
    "Direct fleet call blocked. Use scripts/global/fleet-red-team-dispatch.js "
    "(Epic #2041 #2175) for HAMR-routed dispatch via tier=fleet-local."
)


def is_enabled(env=None):
    env = env if env is not None else os.environ
    return env.get(ENV_FLAG) == "1"


def should_block(detection, env=None):
    if not is_enabled(env):
        return {"block": False, "reason": "env-flag-off"}
    if not detection or not detection.get("detected"):
        return {"block": False, "reason": "no-bypass-detected"}
    if detection.get("suppressed"):
        return {"block": False, "reason": "override-marker-suppresses"}
    if detection.get("severity") == "fleet-bypass":
        return {"block": True, "reason": "fleet-direct-blocked", "message": REDIRECT_MSG}
    if detection.get("severity") == "paid-bypass":
        return {"block": False, "reason": "paid-bypass-not-fleet-scope"}
    return {"block": False, "reason": "unknown-severity"}


def block_message(detection):
    providers = ", ".join(p["name"] for p in (detection or {}).get("providers", [])) or "unknown"
    return f"{REDIRECT_MSG} (detected providers: {providers})"
