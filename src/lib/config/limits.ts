/**
 * Transfer and action limits. Used by transferFunds and eligibility.
 */

export const TRANSFER_LIMITS = {
  /** Max amount per single transfer (USD) */
  maxPerTransfer: Number(process.env.TRANSFER_MAX_PER_TRANSFER) || 50_000,
  /** Max total transfers per user per day (count) */
  maxPerDay: Number(process.env.TRANSFER_MAX_PER_DAY) || 10,
  /** Min amount (USD) */
  minAmount: 0.01,
};

export const CREDIT_INCREASE_LIMITS = {
  /** Max requested increase amount (USD) */
  maxIncrease: Number(process.env.CREDIT_INCREASE_MAX) || 10_000,
  /** Min requested increase (USD) */
  minIncrease: 100,
};
