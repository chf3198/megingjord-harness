// Cedar policy for signer-alias-canonical (#1970 C5 pilot).
// Mirrors the JS implementation at scripts/global/megalint/signer-registry-check.js.
// Per AC2: parallels JS behavior; replay-eval target ≥99% parity (#1970 amended AC4).
//
// Schema: Principal=BatonArtifact, Action=Sign, Resource=Issue
// BatonArtifact attributes:
//   artifact (str): MANAGER_HANDOFF | COLLABORATOR_HANDOFF | ADMIN_HANDOFF | CONSULTANT_CLOSEOUT
//   signed_by (str): the human-alias from inventory/team-model-signatures.json
//   team_model (str): team:model@substrate
//   role (str): manager | collaborator | admin | consultant
// Issue attributes:
//   labels (set<str>): the issue's labels

// Permit: artifact signer matches the canonical alias for its declared role.
permit (
  principal in BatonArtifact::"valid-signers",
  action == Action::"Sign",
  resource
)
when {
  // Each role has a canonical alias derived from inventory.
  // Cedar can't dynamically lookup; the registry is encoded in entity attributes.
  principal.signed_by in resource.canonical_aliases[principal.role]
};

// Forbid: artifact-role mismatch (the artifact name disagrees with declared role).
forbid (
  principal,
  action == Action::"Sign",
  resource
)
when {
  (principal.artifact == "MANAGER_HANDOFF" && principal.role != "manager") ||
  (principal.artifact == "COLLABORATOR_HANDOFF" && principal.role != "collaborator") ||
  (principal.artifact == "ADMIN_HANDOFF" && principal.role != "admin") ||
  (principal.artifact == "CONSULTANT_CLOSEOUT" && principal.role != "consultant")
};

// Forbid: signer reused across two adjacent baton phases on the same issue
// (admin signer must differ from collaborator signer per signer-independence rule).
forbid (
  principal,
  action == Action::"Sign",
  resource
)
when {
  principal.artifact == "ADMIN_HANDOFF" &&
  principal.signed_by == resource.collab_signed_by
};
