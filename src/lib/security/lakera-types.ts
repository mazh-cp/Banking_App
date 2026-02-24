/**
 * Types for Lakera Guard always-on security gateway.
 * Stages: USER_INPUT, RAG_CONTEXT, TOOL_ARGS, LLM_OUTPUT.
 */

export type LakeraStage = 'USER_INPUT' | 'RAG_CONTEXT' | 'TOOL_ARGS' | 'LLM_OUTPUT';

export type LakeraAction = 'allow' | 'block' | 'mask';

export interface LakeraDecision {
  action: LakeraAction;
  reasonCodes: string[];
  redactedText?: string;
  correlationId: string;
  projectId?: string;
  /** Only minimal metadata; never raw prompt/PII */
  raw?: Record<string, unknown>;
  /** From /guard/results when optionallyExplain enabled */
  results?: unknown;
  /** True when mode is "monitor" and action was converted from block to allow (do not auto-execute e.g. TOOL_ARGS). */
  wouldHaveBeenBlocked?: boolean;
}
