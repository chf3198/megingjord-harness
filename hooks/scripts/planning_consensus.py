#!/usr/bin/env python3
"""Planning-consensus verification helpers for ticket first-edit gating."""
import json
import re
import subprocess
from pathlib import Path

RE_BRANCH_ISSUE = re.compile(r"(?:feat|fix|hotfix)/(\d+)-")
RE_ARTIFACT_PASS = re.compile(r"^##\s+.*PLANNING[_-]CONSENSUS\s+[-:]\s+PASS", re.I | re.M)
RE_SCORE_ROW = re.compile(r"\|\s*\d+\s*\|\s*([^|]+)\|\s*\**\s*(\d+(?:\.\d+)?)\s*\**\s*\|")
DEFAULT_POLICY = {
    "threshold": 93,
    "min_models": 2,
    "require_cross_family": True,
    "agreement_band": 5,
    "max_rounds": 3,
}


def load_policy(cwd: str) -> dict:
    policy = dict(DEFAULT_POLICY)
    path = Path(cwd) / "hooks" / "consensus-policy.json"
    with path.open(encoding="utf-8") as fh:
        loaded = json.load(fh)
    policy.update({k: loaded[k] for k in DEFAULT_POLICY.keys() if k in loaded})
    return policy


def _scores_and_families(body: str) -> tuple[list[float], set[str]]:
    scores, families = [], set()
    for match in RE_SCORE_ROW.finditer(body):
        judge_col, score = match.groups()
        scores.append(float(score))
        fam_match = re.search(r"\(([^)]+)\)", judge_col)
        if fam_match:
            families.add(fam_match.group(1).strip().lower())
        else:
            families.add(judge_col.strip().lower())
    return scores, families


def evaluate_consensus_comment(body: str, policy: dict) -> bool:
    text = body or ""
    if not RE_ARTIFACT_PASS.search(text):
        return False
    lower = text.lower()
    if "| round |" not in lower or "| judge" not in lower:
        return False
    if "Signed-by:" not in text or "Team&Model:" not in text or "Role:" not in text:
        return False
    scores, families = _scores_and_families(text)
    if len(scores) < int(policy["min_models"]):
        return False
    if any(score < float(policy["threshold"]) for score in scores):
        return False
    if (max(scores) - min(scores)) > float(policy["agreement_band"]):
        return False
    if bool(policy["require_cross_family"]) and len(families) < 2:
        return False
    return True


def issue_has_planning_consensus(ticket: int, cwd: str) -> bool:
    policy = load_policy(cwd)
    run = subprocess.run(
        ["gh", "issue", "view", str(ticket), "--json", "comments"],
        cwd=cwd, check=False, capture_output=True, text=True, timeout=20,
    )
    if run.returncode != 0:
        return False
    data = json.loads(run.stdout or "{}")
    comments = data.get("comments", [])
    return any(evaluate_consensus_comment(c.get("body", ""), policy) for c in comments)


def linked_issue_has_planning_consensus(cwd: str) -> bool:
    branch = subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        text=True, stderr=subprocess.DEVNULL, cwd=cwd,
    ).strip()
    match = RE_BRANCH_ISSUE.match(branch)
    if not match:
        return True
    return issue_has_planning_consensus(int(match.group(1)), cwd)
