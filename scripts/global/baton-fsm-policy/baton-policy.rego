# baton-policy.rego — OPA/Rego policy expressing the baton FSM
# transition+guard relation. Data-driven: the transitions table is
# loaded as `data.transitions`, and a rule `decision` computes
# allow/deny with the first missing evidence bit as reason.
# Refs #3286, Epic #3284.
package baton.policy

import future.keywords.in

default decision := {"result": "deny", "reason": "illegal-transition", "required_next": "none"}

# Terminal-sink guard: DONE (7) and CANCELLED (8) deny all events.
terminal_states := {7, 8}

# Compute the decision for a given (state, event, evidence_mask) input.
decision := result if {
    not input.state in terminal_states
    some row in data.transitions
    row.fromState == input.state
    row.event == input.event
    required := row.requiredMask
    satisfied := bits.and(input.evidence_mask, required) == required
    satisfied
    result := {
        "result": "allow",
        "reason": "none",
        "required_next": row.toState,
    }
}

decision := result if {
    not input.state in terminal_states
    some row in data.transitions
    row.fromState == input.state
    row.event == input.event
    required := row.requiredMask
    not bits.and(input.evidence_mask, required) == required
    missing := bits.and(bits.negate(input.evidence_mask), required)
    first_bit := first_set_bit(missing)
    result := {
        "result": "deny",
        "reason": first_bit,
        "required_next": row.toState,
    }
}

# Helper: find the index of the lowest set bit in a mask.
first_set_bit(mask) := idx if {
    some idx in numbers.range(0, 10)
    bits.and(mask, bits.lsh(1, idx)) != 0
} else := 0
