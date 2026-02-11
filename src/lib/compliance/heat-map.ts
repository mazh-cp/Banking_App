/**
 * Compliance heat map: ISO 27001, SOC 2, NIST AI RMF control mapping and traceability.
 */

export type FrameworkId = 'iso27001' | 'soc2' | 'nist_ai_rmf';

export type ControlMapping = {
  id: string;
  label: string;
  framework: FrameworkId;
  family?: string;
  coverage: 'High' | 'Medium' | 'Low' | 'Gap';
  features: string[];
}

export const CONTROL_MAPPINGS: ControlMapping[] = [
  {
    id: 'policy',
    label: 'Information security policy',
    framework: 'iso27001',
    family: 'A.5',
    coverage: 'High',
    features: ['Master prompt wrapper', 'Persona governance', 'Bank policy context'],
  },
  {
    id: 'access',
    label: 'Access control',
    framework: 'iso27001',
    family: 'A.9',
    coverage: 'High',
    features: ['Session auth', 'Role-based access', 'Read-only accounts', 'Admin-only audit/compliance'],
  },
  {
    id: 'secure-dev',
    label: 'Secure development',
    framework: 'iso27001',
    family: 'A.14',
    coverage: 'Medium',
    features: ['Prompt firewall', 'Input validation', 'Tool allow-list', 'No user input in system prompt'],
  },
  {
    id: 'ops-security',
    label: 'Operations security',
    framework: 'iso27001',
    family: 'A.12',
    coverage: 'High',
    features: ['Lakera runtime scanning', 'Pre/post scan on chat', 'File content scan before RAG', 'Quarantine for HIGH/CRITICAL'],
  },
  {
    id: 'incident',
    label: 'Incident management',
    framework: 'iso27001',
    family: 'A.16',
    coverage: 'Medium',
    features: ['Audit log (requestId, riskLevel, categories, action)', 'Blocked/safe-rewrite tracking', 'File scan results persisted'],
  },
  {
    id: 'compliance-ops',
    label: 'Compliance',
    framework: 'iso27001',
    family: 'A.18',
    coverage: 'Medium',
    features: ['Compliance dashboard', 'Control-to-feature traceability', 'Runtime evidence from logs'],
  },
  {
    id: 'soc2-security',
    label: 'Security',
    framework: 'soc2',
    coverage: 'High',
    features: ['Lakera runtime scanning', 'CSRF protection', 'HttpOnly cookies', 'Rate limiting', 'File type/size validation'],
  },
  {
    id: 'soc2-availability',
    label: 'Availability',
    framework: 'soc2',
    coverage: 'Low',
    features: ['Stateless API', 'DB-backed sessions'],
  },
  {
    id: 'soc2-confidentiality',
    label: 'Confidentiality',
    framework: 'soc2',
    coverage: 'High',
    features: ['Tenant isolation (RAG by userId)', 'PII redaction in logs', 'Uploads outside web root'],
  },
  {
    id: 'soc2-integrity',
    label: 'Processing Integrity',
    framework: 'soc2',
    coverage: 'Medium',
    features: ['Input validation', 'Safe-rewrite on flagged output', 'Chunk scan before embedding'],
  },
  {
    id: 'soc2-privacy',
    label: 'Privacy',
    framework: 'soc2',
    coverage: 'Medium',
    features: ['Minimal PII in audit', 'Masking in model instructions', 'No raw file path exposure'],
  },
  {
    id: 'nist-govern',
    label: 'Govern',
    framework: 'nist_ai_rmf',
    coverage: 'Medium',
    features: ['Master wrapper', 'Persona governance', 'Risk scoring rubric'],
  },
  {
    id: 'nist-map',
    label: 'Map',
    framework: 'nist_ai_rmf',
    coverage: 'High',
    features: ['Risk map (categories, levels)', 'Top 10 LLM apps', 'File scan risk levels'],
  },
  {
    id: 'nist-measure',
    label: 'Measure',
    framework: 'nist_ai_rmf',
    coverage: 'High',
    features: ['Lakera scan on input/output/file', 'Risk score and level per request', 'Audit metrics (blocked %, scanned %)'],
  },
  {
    id: 'nist-manage',
    label: 'Manage',
    framework: 'nist_ai_rmf',
    coverage: 'High',
    features: ['Block/safe-rewrite on threshold', 'Quarantine for high-risk files', 'Admin dashboards for oversight'],
  },
];

export type FrameworkSummary = {
  id: FrameworkId;
  name: string;
  controls: ControlMapping[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  gapCount: number;
};

export function getFrameworkSummaries(): FrameworkSummary[] {
  const byFramework = new Map<FrameworkId, ControlMapping[]>();
  for (const c of CONTROL_MAPPINGS) {
    const list = byFramework.get(c.framework) ?? [];
    list.push(c);
    byFramework.set(c.framework, list);
  }
  const names: Record<FrameworkId, string> = {
    iso27001: 'ISO 27001:2022',
    soc2: 'SOC 2',
    nist_ai_rmf: 'NIST AI RMF',
  };
  return Array.from(byFramework.entries()).map(([id, controls]) => {
    let high = 0, medium = 0, low = 0, gap = 0;
    for (const c of controls) {
      if (c.coverage === 'High') high++;
      else if (c.coverage === 'Medium') medium++;
      else if (c.coverage === 'Low') low++;
      else gap++;
    }
    return {
      id,
      name: names[id],
      controls,
      highCount: high,
      mediumCount: medium,
      lowCount: low,
      gapCount: gap,
    };
  });
}
