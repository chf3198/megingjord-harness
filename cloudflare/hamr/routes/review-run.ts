// HAMR /mcp review:run route — Epic #1736 Phase 3.2 (#1753).
// Worker-side stub for sub-agent fan-out. Actual sub-agent invocation
// happens via provider adapters; this route shapes the response per #1744.

interface Finding {
  severity: 'low' | 'medium' | 'high';
  category: string;
  file: string;
  line: number;
  message: string;
  confidence: number;
  sub_agent: string;
  trigger?: string;
}

interface RunParams {
  ticket_number?: number;
  pr_number?: number;
  diff_url?: string;
  operator_mode?: 'advisory-only' | 'enforcing';
  sub_agents?: string[];
  findings?: Finding[];  // accepted from caller; route aggregates + applies gates
}

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2 } as const;

function severityDistribution(findings: Finding[]) {
  const dist = { low: 0, medium: 0, high: 0 };
  for (const f of findings) {
    if (f.severity in dist) dist[f.severity]++;
  }
  return dist;
}

function applyGate(findings: Finding[], mode: string): string {
  const dist = severityDistribution(findings);
  if (mode === 'advisory-only') {
    return (dist.high > 0 || dist.medium > 0) ? 'advisory_findings' : 'pass';
  }
  if (mode === 'enforcing') {
    return (dist.high > 0 || dist.medium > 0) ? 'fail' : 'pass';
  }
  return 'pass';
}

export function reviewRun(params: RunParams): Record<string, unknown> {
  const findings = params.findings || [];
  const mode = params.operator_mode || 'advisory-only';
  const decision = applyGate(findings, mode);
  const dist = severityDistribution(findings);
  const autoEscalateTriggered = findings.some(f => f.trigger && f.severity === 'high');
  return {
    decision,
    findings_count: findings.length,
    severity_distribution: dist,
    auto_escalate_triggered: autoEscalateTriggered,
    sub_agents_requested: params.sub_agents || ['bug-detect', 'security', 'test-coverage', 'architectural-drift'],
    operator_mode: mode,
  };
}
