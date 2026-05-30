"""HAMR merge-claim client (#2458).

Phase-1 Move 3 of Epic #2451: cross-team merge serialization.
Wraps POST /merge-claim/acquire, POST /merge-claim/release, GET /merge-claim/status.

Feature-flagged via MEGINGJORD_MERGE_CLAIM. When off, acquire returns sentinel
'feature-off' claim that release ignores (no-op pattern preserves admin flow).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Optional

HAMR_BASE = os.environ.get("HAMR_BASE_URL", "https://hamr.chf3198.workers.dev")
DEFAULT_TEAM = os.environ.get("HAMR_TEAM", "claude-code")
TIMEOUT_S = 10
SENTINEL_CLAIM_FEATURE_OFF = "feature-off"


def feature_enabled() -> bool:
    return os.environ.get("MEGINGJORD_MERGE_CLAIM", "").strip() == "1"


def _post(path: str, headers: dict, body: bytes = b"") -> Optional[dict]:
    url = f"{HAMR_BASE}{path}"
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"error": f"http_{e.code}"}
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None  # G6: caller decides degrade behavior


def _get(path: str) -> Optional[dict]:
    url = f"{HAMR_BASE}{path}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read())
    except (urllib.error.URLError, OSError, json.JSONDecodeError):
        return None


def _auth_headers(team: str) -> dict:
    # DPoP token sourced from env; production-mode token rotation is HAMR concern (#894)
    token = os.environ.get("HAMR_DPOP_TOKEN", "stub")
    return {
        "authorization": f"DPoP {token}",
        "x-hamr-team": team,
        "content-type": "application/json",
    }


def acquire(ticket_n: int, team: Optional[str] = None) -> Optional[dict]:
    """Acquire merge-claim for ticket. Returns {claim_id, ttl_s, expires_at} on success.
    Returns sentinel {claim_id: 'feature-off'} when feature flag off (no-op admin pass-through).
    Returns None on network failure; {'error': ...} on HAMR rejection."""
    if not feature_enabled():
        return {"claim_id": SENTINEL_CLAIM_FEATURE_OFF, "ttl_s": 0}
    return _post(
        f"/merge-claim/acquire/{ticket_n}",
        _auth_headers(team or DEFAULT_TEAM),
    )


def release(claim_id: str, team: Optional[str] = None) -> Optional[dict]:
    """Release a claim by ID. No-op on sentinel."""
    if claim_id == SENTINEL_CLAIM_FEATURE_OFF or not feature_enabled():
        return {"released": True, "noop": True}
    return _post(
        f"/merge-claim/release/{claim_id}",
        _auth_headers(team or DEFAULT_TEAM),
    )


def status(ticket_n: int) -> Optional[dict]:
    """Query current claim status; no auth required."""
    if not feature_enabled():
        return {"held": False, "feature_off": True}
    return _get(f"/merge-claim/status/{ticket_n}")
