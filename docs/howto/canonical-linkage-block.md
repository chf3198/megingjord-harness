# Canonical PR-body linkage block

_Refs #1614 AC4. Resolver: [`scripts/global/linkage-resolver.js`](../../scripts/global/linkage-resolver.js)._

Governance gates resolve **the one ticket a PR is accountable for** from the PR body.
Historically they used a first-match `/Refs\s+#(\d+)/i` scan, which had two defects that
caused recurring CI churn (operators hand-ordered `Refs` lines to work around it):

1. It **ignored the auto-close keyword** — `Closes #A` followed by `Refs #B` resolved to **B**.
2. It **picked the first `Refs`** even when a research/parent reference preceded the real ticket.

`resolveLinkedTicket(body)` replaces that scan with a deterministic precedence. Author the linkage
block so it resolves unambiguously.

## The canonical block

Put the linkage on its own lines near the top of the PR body:

```
Refs #<this-ticket>
merge-evidence-deferred-final: #<this-ticket>
```

- `Refs #<this-ticket>` **first** — the ticket this PR is accountable for.
- One merge-evidence form on its own line:
  - **Preferred** `merge-evidence-deferred-final: #<this-ticket>` — satisfies the merge-evidence
    gate without GitHub auto-closing the issue (Consultant keeps explicit close authority, #2303).
  - **Backward-compat** `Closes #<this-ticket>` (or `Fixes` / `Resolves`) — triggers auto-close.

Additional context references go on **separate** lines and are never selected as the ticket:

```
Refs Epic #<parent-epic>     # parent epic — excluded from child-ticket linkage
Refs #<research-dep>         # research dependency — only chosen if it is the FIRST Refs
```

## Resolution precedence (what the gates actually do)

`resolveLinkedTicket(body)` returns `{ ticket, source }`, first hit wins:

| Precedence | Pattern (line-anchored) | `source` |
|---|---|---|
| 1 | `Closes` / `Fixes` / `Resolves #N` | `close-keyword` |
| 2 | `merge-evidence-deferred-final: #N` | `deferred-final` |
| 3 | first `Refs #N` | `refs` |
| — | nothing matched | `none` (ticket `null`) |

Rules baked into the resolver:

- **`Refs Epic #N` is never the child ticket.** The `Refs #` anchor cannot match `Refs Epic #N`
  (the word `Epic` sits between the `Refs` keyword and the `#`).
- **Line-anchored.** A keyword mid-sentence ("we should fix #5 later") is prose, not a directive.
- **Issue numbers are 1–9 digits.** Pathological long digit runs do not overflow.

Because precedence 1–2 name the ticket explicitly, ordering of `Refs` lines no longer matters for a
governed PR that carries a `Closes` / deferred-final marker — the historical "put `Refs #<ticket>`
first" workaround is only the precedence-3 fallback.

## Consumers

`scripts/global/linkage-resolver.js` is the single source. Wired consumers:
`.github/workflows/baton-gates.yml`, `.github/workflows/closeout-lint.yml`, and
`scripts/global/megalint/changelog-fragment-presence.js`. New gates that resolve a linked ticket
from body text MUST require this resolver rather than re-implementing a `Refs` scan.

Regression coverage: [`tests/linkage-resolver.spec.js`](../../tests/linkage-resolver.spec.js) and the
adversarial [`tests/stress-linkage-resolver.spec.js`](../../tests/stress-linkage-resolver.spec.js).
