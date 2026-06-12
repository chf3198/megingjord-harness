# Tavily Security Ownership

Refs #2963

## Owners

- Primary owner: role:consultant for privacy and adversarial review quality.
- Implementation owner: role:collaborator for query minimization and test coverage.
- Runtime owner: role:admin for deploy-time parity checks.

## Review Cadence

- Per change: run Tavily safety harness tests before PR.
- Weekly: review telemetry for `tavily-free` and `tavily-paid` decision distribution.
- Monthly: re-validate retention assertion inputs against vendor policy URL.
- Release gate: fail release if prompt-injection canary test is skipped or failing.

## Required Evidence

- Query minimization and redaction tests.
- Prompt-injection canary test output.
- Citation provenance assertion results.
- Retention assertion metadata with policy URL.

## Escalation

- If canary detects unsafe prompt handling: open `priority:P1` ticket.
- If retention policy evidence is missing: block merge until metadata is restored.
- If citation provenance fails: mark route as non-compliant and enforce fallback.
