#!/usr/bin/env python3
"""Ask-time reference monitor (Epic #3822 C1 / #3825, Gap A).

Deterministic, in-process (regex/string only, <=~50 ms -- NO node shell-out, NO
synchronous panel) classifier for the operator's own `AskUserQuestion` tool path.
It classifies a pending client question on REVERSIBILITY against the 4 retained
carve-outs (config/retained-human-touchpoints.json) so pretool_guard.py can:

  human-carveout -> emit("ask")   genuine carve-out; the client is the correct authority
  self-resolve   -> emit("deny")  reversible; route to the free cross-model panel, SILENT
  adjudicate     -> emit("deny")  unknown/ambiguous; fail-safe to the panel (never a bare prompt)

This is the ENFORCED interceptor the #3823 (>=90-rated) design D2 specifies: a
before-tool-call reference monitor independent of the operator's own reasoning
(Uchibeke 2026 -- an in-context instruction cannot be the control; the model that
wants to ask is the same model that would have to stop itself). The pretool_guard
`matcher:"*"` hook is wired in all four runtimes, so this is bypass-resistant by
construction.

Carve-out signal regexes MIRROR config/retained-human-touchpoints.json carve-out
classes and EXTEND scripts/global/adjudication-guardrail.js:44-49 (the JS panel's
carve-out set). A parity test (tests/ask-reference-monitor.spec.js) asserts every
config carve-out id has a pattern group here, so a future carve-out cannot be added
to config without a monitor pattern (anti-drift poka-yoke).

Design bias (constraint 4, anti-confirmation-fatigue + anti-over-escalation):
carve-outs are checked FIRST (a partial carve-out signal reaches the human, never a
silent panel-route), and the default for a non-carve-out is self-resolve (deny +
panel, ZERO client ceremony). Callers treat ANY exception as a carve-out ("ask") --
fail-closed to reaching the human, never a silent allow. Design source: #3823 D2/D4.
"""
import os
import re

# One pattern group per config carve-out id (parity-tested). Class strings mirror
# config/retained-human-touchpoints.json `carve_outs[].class`. Regexes are narrow --
# conservative signal sets so a routine clarification is NOT over-routed to the human
# (mirrors adjudication-guardrail.js HUMAN_CARVEOUT + credential-availability.js).
CARVEOUT_PATTERNS = [
    (
        "design-direction",
        "design",
        re.compile(
            r"\b(?:design direction|visual design|look and feel|\bbrand\b|aesthetic|"
            r"UX direction|redesign|re-?architect|architecture|architectural|event[- ]sourced|"
            r"scope expansion|greenfield|rewrite\s+from\s+scratch|major\s+refactor|"
            r"product\s+(?:direction|decision)|roadmap|feature\s+scope|"
            r"new\s+\w[\w\s-]{0,25}?(?:architecture|design|framework|pattern)|"
            r"adopt\s+\w[\w\s-]{0,30}?(?:architecture|framework|pattern|model))\b",
            re.IGNORECASE,
        ),
    ),
    (
        "uat-confirmation",
        "uat",
        re.compile(
            r"\b(?:UAT|user acceptance|acceptance test|sign\s*off\s+on|"
            r"approve\s+the\s+release|acceptable\s+to\s+you|ready\s+to\s+ship\b|"
            r"match(?:es)?\s+(?:what\s+)?you\s+expected|as\s+you\s+expected|"
            r"match(?:es)?\s+your\s+expectation|look\s+right\s+to\s+you|"
            r"does\s+(?:this|the|it)\b[\w\s]{0,40}?\b(?:look|match|render)\b"
            r"[\w\s]{0,25}?\b(?:right|expected|correct|expect)\b)",
            re.IGNORECASE,
        ),
    ),
    (
        "irreversible-destruction",
        "irreversible",
        re.compile(
            r"\b(?:irreversible|unrecoverable|permanently\s+delete|\bwipe\b|\bpurge\b|"
            r"\btruncate\b|force[- ]push(?:\s+to\s+main)?|hard\s+reset|rm\s+-rf|"
            r"drop\s+(?:database|table)|destroy\b|"
            r"revoke\b[\w\s-]{0,15}?\b(?:key|credential|access|token)\b|"
            r"rotate\b[\w\s-]{0,15}?\b(?:key|secret|credential)\b|"
            r"send\b[\w\s-]{0,20}?\b(?:email|message|notification)\b[\w\s-]{0,10}?\bto\b|"
            r"\bpublish\b|\bspend\b|\bpayment\b|\bcharge\b[\w\s-]{0,15}?\b(?:card|account)\b|"
            r"overwrite\b[\w\s]{0,30}?\b(?:commit|commits|history|main|branch)\b|"
            r"delete\b[\w\s]{0,25}?\b(?:branch|remote|production|prod|tag|data|record|user|account)\b)",
            re.IGNORECASE,
        ),
    ),
    (
        "security-policy-weakening",
        "security-weakening",
        re.compile(
            r"\bdisable\b[\w\s-]{0,40}?\b(?:guard|gate|check|protection|control|"
            r"enforcement|policy|validator)\b|"
            r"\bturn\s+off\b[\w\s-]{0,25}?\b(?:guard|gate|check|protection|enforcement)\b|"
            r"\bskip\b[\w\s-]{0,20}?\b(?:gate|check|guard|validation|ci|review)\b|"
            r"\bweaken(?:ing|s|ed)?\b[\w\s-]{0,25}?\b(?:security|control|gate|guard|"
            r"policy|governance|enforcement)\b|"
            r"\bauthorize\s+weakening\b|--no-verify\b|--force\b|"
            r"\bremove\b[\w\s-]{0,30}?\b(?:security|governance)\b[\w\s-]{0,20}?"
            r"\b(?:control|gate|guard|policy)\b|"
            r"\b(?:broaden|widen)\b[\w\s-]{0,15}?\bpermissions?\b|"
            r"\bgrant\b[\w\s-]{0,15}?\bbypass\b|"
            r"\bbypass\b[\w\s-]{0,20}?\b(?:gate|guard|check|control|enforcement)\b",
            re.IGNORECASE,
        ),
    ),
]

# Explicit "I don't know how to proceed" signal -> fail-safe to the panel (adjudicate),
# NOT a silent allow and NOT a bare client prompt. (Carve-outs are checked first.)
AMBIGUOUS_RE = re.compile(
    r"\b(?:not\s+sure|unsure|no\s+idea|unclear|what\s+do\s+you\s+think|"
    r"how\s+(?:should|do)\s+(?:i|we)\s+proceed|which\s+way\s+(?:should|do)|"
    r"help\s+me\s+decide|i'?m\s+stuck)\b",
    re.IGNORECASE,
)


def classify_text(text):
    """Classify a joined question string.

    Returns (route, carveout_id, carveout_class):
      route in {'human-carveout','self-resolve','adjudicate'}
      carveout_id/class are the matched config carve-out (else None).
    """
    joined = text or ""
    # 1. Carve-outs FIRST -- bias toward reaching the human on a partial signal.
    for cid, cls, rx in CARVEOUT_PATTERNS:
        if rx.search(joined):
            return ("human-carveout", cid, cls)
    # 2. Explicit unknown/ambiguity -> fail-safe to the free panel.
    if AMBIGUOUS_RE.search(joined):
        return ("adjudicate", None, None)
    # 3. Default: reversible, non-carve-out -> self-resolve (panel, SILENT).
    return ("self-resolve", None, None)


def extract_ask_text(tool_input):
    """Flatten an AskUserQuestion payload to the classifiable text.

    Real shape: {"questions":[{"question","header","options":[{"label","description"}]}]}.
    Defensive: falls back to joining every string value when the shape is unexpected.
    """
    parts = []
    try:
        if isinstance(tool_input, dict) and isinstance(tool_input.get("questions"), list):
            for q in tool_input["questions"]:
                if not isinstance(q, dict):
                    parts.append(str(q))
                    continue
                for key in ("question", "header"):
                    val = q.get(key)
                    if isinstance(val, str):
                        parts.append(val)
                for opt in q.get("options", []) or []:
                    if isinstance(opt, dict):
                        for key in ("label", "description"):
                            val = opt.get(key)
                            if isinstance(val, str):
                                parts.append(val)
                    elif isinstance(opt, str):
                        parts.append(opt)
        if parts:
            return " ".join(parts)
    except Exception:
        pass
    return " ".join(_iter_strings(tool_input))


def _iter_strings(value):
    """Yield every string leaf of a nested dict/list (defensive fallback)."""
    out = []
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for v in value.values():
            out.extend(_iter_strings(v))
    elif isinstance(value, (list, tuple)):
        for v in value:
            out.extend(_iter_strings(v))
    return out


def classify_ask_route(tool_input):
    """Hook entry: extract the AskUserQuestion text and classify it."""
    return classify_text(extract_ask_text(tool_input))


def emit_ask_redirect_telemetry(route, carve_out_class, text):
    """Metadata-only, redacted observability event for a routed ask (G8, audit-without-ceremony).

    Writes route + carve-out-class-or-null + a one-way SHA-256 of the prompt text
    (NEVER the raw text) to ~/.megingjord/ask-redirect.jsonl. No client-facing
    confirmation, no per-ask spam. Best-effort: any error is swallowed -- telemetry
    must never break the gate (G6).
    """
    try:
        import hashlib
        import json
        import time

        rec = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "version": 3,
            "service": "pretool-guard",
            "env": "local",
            "event": "ask-redirect",
            "route": route,
            "carve_out_class": carve_out_class,
            "prompt_sha256": hashlib.sha256((text or "").encode("utf-8")).hexdigest(),
        }
        path = os.path.expanduser("~/.megingjord/ask-redirect.jsonl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(rec) + "\n")
    except Exception:
        pass  # G6: telemetry never breaks the gate


# Stable marker literals shared with pretool_guard.py `emit("ask", ...)` reasons and
# registered in config/retained-human-touchpoints.json.sanctioned_ask_surfaces so
# client-prompt-surface-check.js recognizes them (and flags any FUTURE unregistered ask).
CARVEOUT_ASK_MARKER = "Retained human carve-out (ask-time reference monitor)"
FAILCLOSED_ASK_MARKER = "Ask-time reference monitor fail-closed"
