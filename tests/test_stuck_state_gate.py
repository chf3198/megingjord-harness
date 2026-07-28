# #3766 — pytest for the stuck_state_gate Stop hook (live wiring of the #3748 detector).
# Fixture-free: runs under plain `python3 tests/test_stuck_state_gate.py` and is pytest-collectible.
# Drives the REAL Node bridge (node present in CI) so this is an end-to-end wiring test, and asserts
# the advisory invariant: main() ALWAYS returns 0 and NEVER blocks the turn.
import io
import json
import os
import pathlib
import sys
import tempfile
from contextlib import redirect_stderr

_ROOT = pathlib.Path(__file__).resolve().parent.parent
os.environ["MEGINGJORD_REPO_ROOT"] = str(_ROOT)
os.environ["MEGINGJORD_STUCK_EVENTS"] = str(pathlib.Path(tempfile.mkdtemp()) / "events.jsonl")
sys.path.insert(0, str(_ROOT / "hooks" / "scripts"))
import stuck_state_gate as g  # noqa: E402

_LOOP = [{"tool": "Bash", "command": "npm test"}] * 3


def _run(payload):
    """Drive main() with a stdin payload; return (exit_code, stderr_text)."""
    buf, err = io.StringIO(json.dumps(payload)), io.StringIO()
    buf.isatty = lambda: False  # type: ignore[assignment]
    old = sys.stdin
    sys.stdin = buf
    try:
        with redirect_stderr(err):
            code = g.main()
    finally:
        sys.stdin = old
    return code, err.getvalue()


def test_derive_signals_text_marker():
    s = g.derive_signals({"assistant_response": "I keep going in circles and can't proceed."})
    assert s.get("explicit") == "stuck-pr"


def test_derive_signals_precomputed_passthrough():
    s = g.derive_signals({"stuck_signals": {"iterationCount": 25}})
    assert s["iterationCount"] == 25


def test_run_bridge_loop_detected_adjudicate():
    r = g.run_bridge({"invocations": _LOOP})
    assert r.get("detected") is True and r.get("route") == "adjudicate"


def test_run_bridge_irreversible_human_carveout():
    r = g.run_bridge({"iterationCount": 25, "reversibility": "irreversible"})
    assert r.get("route") == "human-carveout"


def test_main_loop_is_advisory_never_blocks():
    code, err = _run({"stuck_signals": {"invocations": _LOOP}})
    assert code == 0
    assert "ADVISORY" in err and "adjudicat" in err


def test_main_carveout_escalates():
    code, err = _run({"stuck_signals": {"iterationCount": 25, "reversibility": "irreversible"}})
    assert code == 0
    assert "human-carveout" in err


def test_main_clean_stop_is_silent_noop():
    code, err = _run({"assistant_response": "All tests pass; done."})
    assert code == 0 and err == ""


def test_main_stop_hook_active_no_recursion():
    code, err = _run({"stop_hook_active": True, "stuck_signals": {"iterationCount": 25}})
    assert code == 0 and err == ""


def test_main_garbage_is_failsafe():
    buf, err = io.StringIO("not json!!!"), io.StringIO()
    buf.isatty = lambda: False  # type: ignore[assignment]
    old = sys.stdin
    sys.stdin = buf
    try:
        with redirect_stderr(err):
            assert g.main() == 0
    finally:
        sys.stdin = old


def test_emit_event_writes_schema_v3():
    p = pathlib.Path(tempfile.mkdtemp()) / "ev.jsonl"
    os.environ["MEGINGJORD_STUCK_EVENTS"] = str(p)
    import importlib
    importlib.reload(g)
    g.emit_event({"triggers": ["loop-fingerprint"], "route": "adjudicate"})
    row = json.loads(p.read_text().strip())
    assert row["version"] == 3 and row["event"] == "governance.stuck_state_detected"
    assert row["advisory"] is True and row["route"] == "adjudicate"
    os.environ["MEGINGJORD_REPO_ROOT"] = str(_ROOT)  # reload clobbers module env read; restore


if __name__ == "__main__":
    import traceback
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  ok  {fn.__name__}")
        except Exception:  # noqa: BLE001
            failed += 1
            print(f"FAIL  {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
