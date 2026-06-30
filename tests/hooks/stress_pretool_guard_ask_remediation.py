"""Stress harness for the #3402 ask-surface remediation (Epic #3392).

Asserts the two stress facets the test matrix requires:
  G6 — chaos / fault-injection: adversarial / malformed command strings must not crash the
       decision path and must never leak an `ask` for a remediated surface.
  G7 — p99 latency budget: the remediated decision path stays fast (it runs on every command).

Run directly: `python3 tests/hooks/stress_pretool_guard_ask_remediation.py` (exit 1 on breach).
"""
import io
import json
import os
import sys
import tempfile
import time
from contextlib import redirect_stdout
from unittest import mock

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))
import pretool_guard  # noqa: E402

STATE = {"flags": {}, "admin_ops": {}, "repo_type": "generic", "active_ticket": None}
CWD = tempfile.gettempdir()


def decision(joined):
    buf = io.StringIO()
    with mock.patch.object(pretool_guard, "_check_auth_profile", return_value=None), \
         mock.patch.object(pretool_guard, "_check_role_tool_allowlist", return_value=None), \
         mock.patch.object(pretool_guard, "_check_epic_close_guard", return_value=None), \
         mock.patch.object(pretool_guard, "active_ticket_is_no_code_lane", return_value=False), \
         mock.patch.object(pretool_guard, "check_one_ticket_per_worktree", return_value=None), \
         redirect_stdout(buf):
        pretool_guard.check_terminal(joined, STATE, CWD)
    out = buf.getvalue().strip()
    return json.loads(out)["hookSpecificOutput"]["permissionDecision"] if out else None


def g6_fault_injection():
    """Adversarial / malformed inputs must not crash and must not leak an ask for S1/S2/S4."""
    adversarial = [
        "curl http://h:11434/api/generate " + "A" * 20000,        # oversized
        "curl http://h:11434/api/generate \u202e \x00 \U0001f4a5",  # bidi / null / emoji (escaped)
        "gh issue close 9 ; rm -rf /",                              # injection-ish
        "gh pr checks " + "9" * 5000,
        "",                                                        # empty
        "curl\thttp://h:11434/api/tags\n\n\n",                     # whitespace chaos
    ]
    for cmd in adversarial:
        try:
            d = decision(cmd)
        except Exception as exc:  # G6: never crash the decision path
            print(f"FAIL G6: decision crashed on {cmd[:40]!r}: {exc}")
            return False
        if d == "ask":
            print(f"FAIL G6: adversarial input leaked an ask: {cmd[:40]!r}")
            return False
    print("PASS G6: fault-injection (no crash, no ask leak)")
    return True


def g7_p99_budget(iterations=1000, budget_ms=15.0):
    """p99 of the remediated decision path stays under budget."""
    samples = []
    for i in range(iterations):
        cmd = "curl http://h:11434/api/generate" if i % 2 else "gh pr checks 9"
        start = time.perf_counter()
        decision(cmd)
        samples.append((time.perf_counter() - start) * 1000.0)
    samples.sort()
    p99 = samples[int(len(samples) * 0.99)]
    if p99 >= budget_ms:
        print(f"FAIL G7: p99={p99:.3f}ms exceeds {budget_ms}ms budget")
        return False
    print(f"PASS G7: p99={p99:.3f}ms < {budget_ms}ms budget")
    return True


if __name__ == "__main__":
    ok = g6_fault_injection() and g7_p99_budget()
    sys.exit(0 if ok else 1)
