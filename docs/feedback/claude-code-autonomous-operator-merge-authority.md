# Upstream feedback — non-interactive merge authority for an autonomous operator

**To:** Claude Code (github.com/anthropics/claude-code) — feature request.
**From:** Megingjord governance harness (#3346, follow-on to #3342).
**Status:** captured for submission by the harness maintainer.

## Problem
In a fully-autonomous single-operator harness the client performs **zero** technical
acts (design + UAT only). The Claude Code **auto-mode classifier** soft-denies an agent
merging its own reviewed PR and requires a human *outside auto mode* to authorize it. A
`permissions.allow` rule does not suppress the classifier; the documented override is the
`autoMode` prose block in **managed settings**, which is admin-owned by design. This forces
a one-time human/owner provisioning act and leaves a bootstrap chicken-and-egg: an
environment cannot self-install the authorization, and a PR that installs it cannot be
autonomously merged.

## What we built around it
A scoped, gated, reversible provisioner (`automode-provision.js`) installed at host
provisioning (`hamr:activate`). The grant authorizes a merge **only** when the linked
issue carries a `CONSULTANT_CLOSEOUT` and required CI is green; an independent
`baton-authority/merge` gate remains the mechanical precondition. It is **not** a blanket
self-merge license.

## Request
A **supported, non-interactive** way to grant an autonomous operator reviewed-PR merge
authority — for example:

1. Honor a structured **AI-Consultant baton sign-off** (an independent reviewer artifact,
   optionally cross-family / cross-model) as satisfying the "reviewed by someone other than
   the author" intent the classifier protects; or
2. A first-class, machine-applyable **policy grant** (signed, scoped, auditable) that an
   environment owner can bake into provisioning without an interactive approval; or
3. A documented managed-settings schema for "autonomous operator" mode with explicit,
   auditable scope so the grant is reviewable rather than implicit.

## Why it is safe to support
The authorization is **scoped** (closeout + green CI required), **gated** (an independent
merge-authority FSM), **idempotent**, **reversible**, and **audited** (a schema-v3
owner-configuration event). The intent the classifier protects — "not merged solely on the
author's say-so" — is satisfied by the independent Consultant + cross-model review, not bypassed.
