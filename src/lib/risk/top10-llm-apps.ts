/**
 * Top 10 LLM application risk map for financial services (board module).
 */

export type Likelihood = 'low' | 'med' | 'high';
export type Impact = 'low' | 'med' | 'high' | 'critical';
export type CompositeRisk = 'low' | 'med' | 'high' | 'critical';

export type LLMAppRisk = {
  id: string;
  name: string;
  description: string;
  commonAttackVectors: string[];
  likelihood: Likelihood;
  impact: Impact;
  compositeRisk: CompositeRisk;
};

export const TOP_10_LLM_APPS: LLMAppRisk[] = [
  {
    id: 'chat-support',
    name: 'Customer support chatbots',
    description: 'LLM-powered support for balance, transactions, and product FAQs.',
    commonAttackVectors: ['Prompt injection', 'Jailbreaking', 'PII extraction', 'Fraud coaching'],
    likelihood: 'high',
    impact: 'high',
    compositeRisk: 'high',
  },
  {
    id: 'underwriting-assist',
    name: 'Underwriting / credit decision support',
    description: 'Assistance with loan applications and eligibility explanations.',
    commonAttackVectors: ['Data exfiltration', 'Bias manipulation', 'Policy override', 'System prompt extraction'],
    likelihood: 'med',
    impact: 'high',
    compositeRisk: 'high',
  },
  {
    id: 'fraud-detection',
    name: 'Fraud detection and triage',
    description: 'Conversational interfaces for fraud alerts and reporting.',
    commonAttackVectors: ['Fraud coaching', 'Adversarial inputs', 'Evasion of detection'],
    likelihood: 'med',
    impact: 'critical',
    compositeRisk: 'critical',
  },
  {
    id: 'document-qa',
    name: 'Document Q&A and RAG',
    description: 'RAG over policies, disclosures, and internal docs.',
    commonAttackVectors: ['RAG poisoning', 'Prompt injection via docs', 'Data exfil via citations'],
    likelihood: 'high',
    impact: 'med',
    compositeRisk: 'high',
  },
  {
    id: 'code-assist',
    name: 'Internal code / script assistance',
    description: 'Code generation and review for ops and dev.',
    commonAttackVectors: ['Malicious code injection', 'Secrets in prompts', 'Supply chain via generated code'],
    likelihood: 'med',
    impact: 'high',
    compositeRisk: 'high',
  },
  {
    id: 'email-draft',
    name: 'Email and communication drafting',
    description: 'Drafting customer emails and internal comms.',
    commonAttackVectors: ['Prompt injection', 'PII leakage', 'Tone manipulation'],
    likelihood: 'med',
    impact: 'med',
    compositeRisk: 'med',
  },
  {
    id: 'compliance-qa',
    name: 'Compliance and regulatory Q&A',
    description: 'Answers from compliance manuals and regs.',
    commonAttackVectors: ['Misleading citations', 'Policy override', 'Out-of-date guidance'],
    likelihood: 'low',
    impact: 'high',
    compositeRisk: 'med',
  },
  {
    id: 'translation',
    name: 'Translation and localization',
    description: 'Translation of customer-facing and internal content.',
    commonAttackVectors: ['Injection in source text', 'Bias or abuse in output', 'PII in translations'],
    likelihood: 'low',
    impact: 'med',
    compositeRisk: 'low',
  },
  {
    id: 'summarization',
    name: 'Meeting and document summarization',
    description: 'Summaries of calls, meetings, and long documents.',
    commonAttackVectors: ['PII in summaries', 'Data exfil via summaries', 'Context confusion'],
    likelihood: 'med',
    impact: 'med',
    compositeRisk: 'med',
  },
  {
    id: 'tool-orchestration',
    name: 'Tool use and workflow orchestration',
    description: 'LLM calling APIs for transfers, payments, or data retrieval.',
    commonAttackVectors: ['Tool abuse', 'Privilege escalation', 'Unauthorized actions'],
    likelihood: 'med',
    impact: 'critical',
    compositeRisk: 'critical',
  },
];
