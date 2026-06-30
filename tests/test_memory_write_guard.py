"""Tests for memory_write_guard (Epic #3380 / #3383). Run: pytest tests/test_memory_write_guard.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hooks", "scripts"))
import memory_write_guard as g  # noqa: E402

MEM = "/home/u/.claude/projects/x/memory/feedback_foo.md"


def test_guardrail_candidate_without_disposition_advises():
    body = "The merge-gate false-blocks via gh json; enforcer rejects the redirect."
    decision, _ = g.check_memory_write(MEM, body)
    assert decision == "advise"


def test_guardrail_candidate_with_disposition_allowed():
    body = "merge-gate false-block via gh json.\ndisposition: guardrail #4321"
    decision, _ = g.check_memory_write(MEM, body)
    assert decision == "allow"


def test_defer_disposition_allowed():
    body = "validator misfire collision in regex.\ndisposition: defer needs design"
    assert g.check_memory_write(MEM, body)[0] == "allow"


def test_judgment_note_frictionless():
    body = "Client prefers cost over speed; never drop to a paid model. Patience over speed."
    assert g.check_memory_write(MEM, body)[0] == "allow"


def test_judgment_wins_on_collision():
    # names a mechanical surface AND a preference -> judgment wins -> allow (no guardrail push)
    body = "Client prefers the merge-gate stay strict even when it false-blocks."
    assert g.check_memory_write(MEM, body)[0] == "allow"


def test_non_memory_path_allowed():
    assert g.check_memory_write("/repo/src/foo.js", "merge-gate false-block")[0] == "allow"


def test_empty_and_none_fail_open():
    assert g.check_memory_write(MEM, "")[0] == "allow"
    assert g.check_memory_write(MEM, None)[0] == "allow"


def test_bypass_env_allows_with_audit():
    body = "merge-gate false-block misfire"
    decision, reason = g.check_memory_write(MEM, body, env={"MEMORY_GUARD_BYPASS": "1"})
    assert decision == "allow" and "bypass" in reason.lower()


def test_chaos_never_raises_and_only_allow_or_advise():
    rnd = 12345
    noise = ["merge-gate false-block", "client prefers x", "", "\x00�",
             "a" * 9000, "disposition: guardrail #1", "step 1 step 2 step 3", "<<>>|&"]
    for i in range(5000):
        rnd = (rnd * 1103515245 + 12345) & 0x7FFFFFFF
        body = noise[rnd % len(noise)]
        path = MEM if (rnd >> 3) % 2 else "/x/src/a.js"
        decision, _ = g.check_memory_write(path, body)
        assert decision in ("allow", "advise")


def test_classify_note_fail_open_on_bad_lexicon(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{not json")
    assert g.classify_note("merge-gate false-block", lexicon=g.load_lexicon(str(bad))) in (
        "semantic-memory", "guardrail-candidate")
