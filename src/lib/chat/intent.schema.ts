import { z } from 'zod';

const accountSlot = z.enum(['checking', 'savings', 'credit']);

export const intentSlotsSchema = z.object({
  amount: z.number().positive().optional(),
  from_account: accountSlot.optional(),
  to_account: accountSlot.optional(),
  requested_credit_limit: z.number().positive().optional(),
  requested_increase_amount: z.number().positive().optional(),
});

export const intentResultSchema = z.object({
  intent: z.enum([
    'balance_inquiry',
    'transactions',
    'credit_profile',
    'credit_increase_request',
    'transfer_request',
    'general_qna',
    'unknown',
  ]),
  confidence: z.number().min(0).max(1),
  needs_clarification: z.boolean(),
  slots: intentSlotsSchema,
});

export type IntentResult = z.infer<typeof intentResultSchema>;
export type IntentSlots = z.infer<typeof intentSlotsSchema>;
