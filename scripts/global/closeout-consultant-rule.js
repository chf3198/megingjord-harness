'use strict';
// Refs #1288 — Consultant-only Epic close authority + cross-team signer rule.
// Per Epic #1271 AC6: same-team different-actor four-eyes is regulatorily insufficient
// for Epic close (SOX/DORA/ISO 27001 organizational independence). Cross-team Consultant
// required for type:epic close. Same-team Consultant remains acceptable for non-Epic close.

function teamOf(teamModel) {
  if (!teamModel) return null;
  const m = teamModel.match(/^([^:]+):/);
  return m ? m[1] : null;
}

function validateConsultantClose({ closeout, comments }) {
  const violations = [];
  const closeoutTeamModel = (closeout.body.match(/Team&Model:\s*(\S+)/) || [])[1] || null;
  const closeoutTeam = teamOf(closeoutTeamModel);
  if (!closeoutTeam) {
    violations.push('Cannot determine Consultant team from Team&Model field');
    return violations;
  }

  const manager = comments.find(c => c.body.includes('MANAGER_HANDOFF'));
  if (manager) {
    const managerTeam = teamOf((manager.body.match(/Team&Model:\s*(\S+)/) || [])[1]);
    if (managerTeam && managerTeam === closeoutTeam) {
      violations.push(
        `Epic CONSULTANT_EPIC_CLOSEOUT team (${closeoutTeam}) matches MANAGER_HANDOFF team — ` +
        `Epic close requires cross-team Consultant per Epic #1271 AC6 (SOX/DORA/ISO baseline; ` +
        `same-team AI actors share model weights and fail in correlated ways)`
      );
    }
  }

  if (!/CONSULTANT_(EPIC_)?CLOSEOUT/.test(closeout.body)) {
    violations.push('Epic close requires CONSULTANT_EPIC_CLOSEOUT or CONSULTANT_CLOSEOUT artifact');
  }

  if (closeout.body.includes('Role: manager')) {
    violations.push('Epic close artifact signed Role: manager — Consultant signer required');
  }

  return violations;
}

module.exports = { validateConsultantClose, teamOf };
