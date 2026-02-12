/**
 * Simple deterministic eligibility for credit increase (utilization, on-time, cap).
 */

import type { CreditProfile } from './banking-service';
import { CREDIT_INCREASE_LIMITS } from '@/lib/config/limits';

export type EligibilityResult = {
  eligible: boolean;
  recommendedIncrease: number;
  newLimit: number;
  reason?: string;
};

const MAX_UTILIZATION_FOR_INCREASE = 0.5;
const DEFAULT_RECOMMENDED_INCREASE = 500;

export function computeCreditIncreaseEligibility(
  profile: CreditProfile,
  requestedAmount: number
): EligibilityResult {
  const { creditLimit, currentBalance, utilization } = profile;
  const maxIncrease = CREDIT_INCREASE_LIMITS.maxIncrease;
  const minIncrease = CREDIT_INCREASE_LIMITS.minIncrease;

  if (utilization > MAX_UTILIZATION_FOR_INCREASE) {
    return {
      eligible: false,
      recommendedIncrease: 0,
      newLimit: creditLimit,
      reason: 'Utilization is too high. Pay down your balance to improve eligibility.',
    };
  }

  const effectiveRequest = requestedAmount > 0 ? Math.min(requestedAmount, maxIncrease) : DEFAULT_RECOMMENDED_INCREASE;
  const capped = Math.min(Math.max(effectiveRequest, minIncrease), maxIncrease);
  const newLimit = creditLimit + capped;

  return {
    eligible: true,
    recommendedIncrease: capped,
    newLimit,
  };
}
