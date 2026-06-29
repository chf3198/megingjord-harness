# #3342 Part B — stale Goal-Health-Score tier decay (Layer-3 fix).
# Fixture-free: runs under plain `python3 tests/test_goal_tier_ghs_decay_3342.py`
# (repo has no pytest), and is also collectible by pytest in CI.
import datetime
import json
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "hooks" / "scripts"))
import goal_tier_resolver as g  # noqa: E402


def _state(ts, tier="B++"):
    p = pathlib.Path(tempfile.mkdtemp()) / "s.json"
    hist = [] if ts is None else [{"ts": ts, "value": 0.5}]
    p.write_text(json.dumps({"actuators": {"A1": {"tier": tier}}, "ghs_history": hist}))
    return p


def _ago(days):
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()


def test_stale_decays_to_baseline():
    assert g.read_tier_from_state(_state(_ago(30))) == "B"


def test_fresh_preserves_elevation():
    assert g.read_tier_from_state(_state(_ago(0))) == "B++"


def test_empty_history_decays():
    assert g.read_tier_from_state(_state(None)) == "B"


def test_malformed_ts_decays():
    assert g.read_tier_from_state(_state("not-a-date")) == "B"


def test_boundary_inside_window_preserves():
    assert g.read_tier_from_state(_state(_ago(6))) == "B++"


def test_rollback_env_preserves():
    os.environ["GHS_DECAY_DISABLED"] = "1"
    try:
        assert g.read_tier_from_state(_state(_ago(30))) == "B++"
    finally:
        os.environ.pop("GHS_DECAY_DISABLED", None)


def test_baseline_b_never_changes():
    assert g.read_tier_from_state(_state(_ago(30), tier="B")) == "B"


def test_ghs_is_stale_helper():
    assert g.ghs_is_stale({"ghs_history": [{"ts": _ago(30)}]}) is True
    assert g.ghs_is_stale({"ghs_history": [{"ts": _ago(0)}]}) is False
    assert g.ghs_is_stale({}) is True


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
    print(f"{len(fns)} tests passed")
