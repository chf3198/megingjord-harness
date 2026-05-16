// HAMR /mcp rotation:check route — Epic #1716 Phase 3 (#1724) deployment.
// Mirrors scripts/global/hamr-rotation-check.js logic in Worker TypeScript.
// Reads roles_observed from request; returns pass/fail per the 3 rotation rules.

type TeamModel = string | null | undefined;

interface RolesObserved {
  manager?: TeamModel;
  collaborator?: TeamModel;
  collaborator_self_check?: TeamModel;
  implementation?: TeamModel;
  admin?: TeamModel;
  consultant?: TeamModel;
}

interface CheckParams {
  operator_mode?: 'strict-rotation' | 'advisory-only' | 'single-model-fleet';
  labels?: string[];
  roles_observed?: RolesObserved;
  ticket_number?: number;
}

interface Violation {
  rule: string;
  detail: string;
}

function extractTeam(tm: TeamModel): string | null {
  if (typeof tm !== 'string') return null;
  const idx = tm.indexOf(':');
  return idx > 0 ? tm.slice(0, idx).trim() : null;
}

function checkRule1(r: RolesObserved): Violation | null {
  if (!r.collaborator_self_check || !r.implementation) return null;
  const impl = extractTeam(r.implementation);
  const chk = extractTeam(r.collaborator_self_check);
  return impl && chk && impl === chk
    ? { rule: 'rule_1_collab_self_review', detail: `self-review team '${chk}' matches implementation team '${impl}'` }
    : null;
}

function checkRule2(r: RolesObserved): Violation | null {
  if (!r.admin) return null;
  const at = extractTeam(r.admin);
  const prior = [r.manager, r.collaborator].map(extractTeam).filter(Boolean) as string[];
  return at && prior.includes(at)
    ? { rule: 'rule_2_admin_diversity', detail: `admin team '${at}' appears in earlier role` }
    : null;
}

function checkRule3(r: RolesObserved): Violation | null {
  if (!r.consultant) return null;
  const ct = extractTeam(r.consultant);
  const prior = [r.manager, r.collaborator, r.admin].map(extractTeam).filter(Boolean) as string[];
  return ct && prior.includes(ct)
    ? { rule: 'rule_3_consultant_independent', detail: `consultant team '${ct}' appears in earlier role` }
    : null;
}

function skipReason(labels: string[] | undefined, mode: string): string | null {
  if (mode === 'single-model-fleet') return 'single-model-fleet';
  const set = new Set(labels || []);
  if (set.has('model-diversity:waived')) return 'v1-waived';
  if (set.has('rotation-required-waived')) return 'v2-waived';
  return null;
}

export function rotationCheck(params: CheckParams): Record<string, unknown> {
  const mode = params.operator_mode || 'strict-rotation';
  const skipped = skipReason(params.labels, mode);
  if (skipped) {
    return { decision: 'pass', skipped, operator_mode: mode, advisory_or_required: mode === 'strict-rotation' ? 'required' : 'advisory' };
  }
  const r = params.roles_observed || {};
  const violations = [checkRule1(r), checkRule2(r), checkRule3(r)].filter(Boolean) as Violation[];
  const decision = violations.length === 0 ? 'pass' : (mode === 'strict-rotation' ? 'fail' : 'advisory_violation');
  return {
    decision,
    rule_evaluated: violations.length > 0 ? violations[0].rule : null,
    violations,
    operator_mode: mode,
    advisory_or_required: mode === 'strict-rotation' ? 'required' : 'advisory',
  };
}
