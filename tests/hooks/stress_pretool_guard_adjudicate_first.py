"""Stress harness for the #3403 adjudicate-first S6/S7 classifiers (Epic #3392).

G6 — chaos / fault-injection: adversarial / malformed inputs must not crash and must never
     resolve a genuinely-risky surface to a non-ask (no silent G4 weakening).
G7 — p99 latency budget: the classifiers run in the hook hot path, so they must stay fast.

Run directly: `python3 tests/hooks/stress_pretool_guard_adjudicate_first.py` (exit 1 on breach).
"""
import os
import sys
import time
from unittest import mock

HOOKS = os.path.join(os.path.dirname(__file__), "..", "..", "hooks", "scripts")
sys.path.insert(0, os.path.abspath(HOOKS))
import pretool_guard  # noqa: E402
from runtime_paths import runtime_hook_paths  # noqa: E402

HOOK_PATH = runtime_hook_paths()[0]


def g6_fault_injection():
    adversarial = [
        f"cp x {HOOK_PATH}/y " + "A" * 20000,                    # oversized mutation
        f"sed -i \\u202e \\x00 s/deny/allow/ {HOOK_PATH}/p.py",  # bidi/null in a mutation
        "cat " + "/" * 5000,                                      # path chaos
        "",                                                      # empty
        f"echo \U0001f4a5 >> {HOOK_PATH}/p.py",                  # emoji + real mutation
    ]
    for cmd in adversarial:
        try:
            verdict = pretool_guard.classify_hook_mutation(cmd)
        except Exception as exc:  # G6: never crash
            print(f"FAIL G6: classify_hook_mutation crashed on {cmd[:40]!r}: {exc}")
            return False
        # A genuine ungoverned mutation to a hook path must still resolve to ask (no silent weakening).
        if HOOK_PATH in cmd and " >> " + HOOK_PATH in cmd and verdict != "ask":
            print(f"FAIL G6: a hook mutation was not gated: {cmd[:40]!r} -> {verdict}")
            return False
    # Sensitive-path classifier: a tracked secret must always ask, even under adversarial wrapping.
    with mock.patch.object(pretool_guard, "evaluate_path", return_value=(False, "tracked")):
        if pretool_guard.classify_sensitive_path(["x/\\u202e/id_rsa", "a" * 9000 + ".key"], "/cwd") != "ask":
            print("FAIL G6: tracked secret-file path not gated under adversarial input")
            return False
    print("PASS G6: fault-injection (no crash, no silent G4 weakening)")
    return True


def g7_p99_budget(iterations=1000, budget_ms=15.0):
    samples = []
    cmds = [f"cat {HOOK_PATH}/p.py", f"cp x {HOOK_PATH}/p.py", "cat README.md"]
    for i in range(iterations):
        cmd = cmds[i % len(cmds)]
        start = time.perf_counter()
        pretool_guard.classify_hook_mutation(cmd)
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
