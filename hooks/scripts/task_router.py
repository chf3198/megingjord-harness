#!/usr/bin/env python3
"""Task router helpers for prompt classification and state persistence."""
import json
import subprocess

from runtime_paths import script_candidates


def _candidates() -> list[Path]:
    return script_candidates("task-router.js")


def classify_prompt(prompt: str) -> dict | None:
    for script in _candidates():
        if not script.exists():
            continue
        cmd = ["node", str(script), "classify", "--prompt", prompt, "--json"]
        try:
            out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            data = json.loads(out)
            if isinstance(data, dict):
                return data
        except Exception:
            continue
    return None


def apply_route(state: dict, route: dict | None) -> dict:
    if not route:
        return state
    state["routing"] = {
        "lane": route.get("lane", "free"),
        "backend": route.get("backend", "auto"),
        "recommended_model": route.get("recommendedModel", "Auto"),
        "confidence": route.get("confidence", "medium"),
        "rationale": route.get("rationale", "none"),
    }
    return state
