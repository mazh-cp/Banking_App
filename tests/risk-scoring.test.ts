/**
 * Unit test: risk scoring mapping and level thresholds.
 */
import { computeRiskScore, mapScoreToLevel } from '../src/lib/security/risk-scoring';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Score 0 -> LOW
assert(mapScoreToLevel(0) === 'LOW', '0 -> LOW');
assert(mapScoreToLevel(0.2) === 'LOW', '0.2 -> LOW');

// 0.25-0.5 -> MEDIUM
assert(mapScoreToLevel(0.25) === 'MEDIUM', '0.25 -> MEDIUM');
assert(mapScoreToLevel(0.4) === 'MEDIUM', '0.4 -> MEDIUM');

// 0.5-0.75 -> HIGH
assert(mapScoreToLevel(0.5) === 'HIGH', '0.5 -> HIGH');
assert(mapScoreToLevel(0.7) === 'HIGH', '0.7 -> HIGH');

// >= 0.75 -> CRITICAL
assert(mapScoreToLevel(0.75) === 'CRITICAL', '0.75 -> CRITICAL');
assert(mapScoreToLevel(1) === 'CRITICAL', '1 -> CRITICAL');

const r1 = computeRiskScore({
  normalizedCategories: ['prompt_injection'],
  inputSeverity: 'high',
  outputSeverity: 'low',
});
assert(r1.level === 'HIGH' || r1.level === 'CRITICAL', 'prompt_injection + high severity -> HIGH/CRITICAL');
assert(r1.score >= 0.5, 'score >= 0.5');

const r2 = computeRiskScore({
  normalizedCategories: ['other'],
  inputSeverity: 'low',
  outputSeverity: 'low',
});
assert(r2.level === 'LOW' || r2.level === 'MEDIUM', 'other + low -> LOW or MEDIUM');
assert(r2.score < 0.5, 'score < 0.5 for low-risk');

console.log('Risk scoring tests passed.');
process.exit(0);
