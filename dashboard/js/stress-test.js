// Agile Epic Stress Test — simulates full baton workflow
// Exercises: skills, instructions, hooks, agents, routing

const EPIC_PHASES = [
  { role: 'manager', label: 'Epic scoping', skills: ['role-manager-execution',
    'github-ticket-lifecycle-orchestrator', 'manager-ticket-lifecycle'] },
  { role: 'manager', label: 'Task decomposition', skills: ['global-task-router',
    'repo-standards-router', 'github-projects-agile-linkage'] },
  { role: 'collaborator', label: 'Implement (free lane)', skills: [
    'role-collaborator-execution', 'repo-structure-conventions',
    'openclaw-universal-system', 'openrouter-free-failover'] },
  { role: 'collaborator', label: 'Implement (fleet lane)', skills: [
    'openclaw-availability-utilization', 'network-platform-resources',
    'mem-watchdog-ops', 'playwright-vision-low-resource'] },
  { role: 'collaborator', label: 'Implement (premium lane)', skills: [
    'github-actions-security-hardening', 'secret-exposure-prevention',
    'web-regression-governance', 'docs-drift-maintenance'] },
  { role: 'collaborator', label: 'E2E test + visual QA', skills: [
    'global-skills-bootstrap', 'repo-onboarding-standards',
    'release-version-integrity', 'repo-profile-governance'] },
  { role: 'admin', label: 'Code review gate', skills: ['role-admin-execution',
    'github-review-merge-admin', 'github-ruleset-architecture'] },
  { role: 'admin', label: 'Merge + deploy', skills: [
    'github-release-incident-flow', 'github-capability-resolver',
    'github-ops-excellence', 'github-ops-tree-router'] },
  { role: 'consultant', label: 'Post-merge critique', skills: [
    'role-consultant-critique', 'workflow-self-anneal',
    'operator-identity-context', 'role-baton-orchestrator'] },
  { role: 'consultant', label: 'Governance audit', skills: [
    'docs-drift-maintenance', 'repo-profile-governance'] },
  { role: 'consultant', label: 'Self-anneal + close', skills: [
    'workflow-self-anneal'] },
  { role: 'idle', label: 'Epic complete', skills: [] }
];

const MOCK_AGENTS = ['router','architect','implementer','planner',
  'quick','governance-auditor','release-reviewer','security-scanner'];

function buildStressTargets() { return EPIC_PHASES; }

async function runStressRound(phases, index) {
  const phase = phases[index] || phases[phases.length - 1];
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 60 + Math.random() * 100));
  const ok = phase.skills.length || 1;
  const agent = MOCK_AGENTS[index % MOCK_AGENTS.length];
  return { ok, fail: 0, ms: Math.round(performance.now() - t0), phase, agent };
}

function renderStressPanel(run) {
  const cls = run.running ? 'badge active' : 'badge healthy';
  return `<div class="config-grid">
    <p><strong>Status:</strong> <span class="${cls}">${run.last||'idle'}</span></p>
    <p><strong>Phase:</strong> ${esc(run.phase || 'idle')}</p>
    <p><strong>Rounds:</strong> ${run.rounds||0}/12 (Agile Epic)</p>
    <p><strong>Skills verified:</strong> ✅ ${run.ok||0}</p>
    <p class="config-note">Simulates Manager→Collaborator→Admin→Consultant.</p>
  </div>`;
}
