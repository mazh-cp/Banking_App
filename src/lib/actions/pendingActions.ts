/**
 * Pending action state machine. Only owner can read/confirm/cancel.
 * Confirm only if status=PENDING and now < expiresAt.
 * Executed only if status=CONFIRMED.
 */

import { prisma } from '@/lib/db';
import {
  CHAT_ACTION_PROPOSED,
  CHAT_ACTION_CONFIRMED,
  CHAT_ACTION_EXECUTED,
  CHAT_ACTION_FAILED,
  CHAT_ACTION_CANCELLED,
  CHAT_ACTION_EXPIRED,
} from './audit-events';

export const PENDING_ACTION_TYPE = {
  TRANSFER: 'TRANSFER',
  CREDIT_INCREASE: 'CREDIT_INCREASE',
} as const;

export const PENDING_ACTION_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  EXECUTED: 'EXECUTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type PendingActionType = (typeof PENDING_ACTION_TYPE)[keyof typeof PENDING_ACTION_TYPE];
export type PendingActionStatus = (typeof PENDING_ACTION_STATUS)[keyof typeof PENDING_ACTION_STATUS];

export type TransferPayload = { fromAccount: string; toAccount: string; amount: number };
export type CreditIncreasePayload = { increaseAmount: number; recommendedLimit?: number };

function audit(eventType: string, userId: string, metadata: Record<string, unknown>) {
  return prisma.auditEvent.create({
    data: {
      eventType,
      userId,
      actorUserId: userId,
      route: '/api/chat',
      actionTaken: eventType,
      metadata: metadata as object,
    },
  });
}

export async function createPendingAction(
  userId: string,
  type: PendingActionType,
  payload: TransferPayload | CreditIncreasePayload,
  ttlMinutes = 10,
  metadata?: Record<string, unknown>
) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const action = await prisma.pendingAction.create({
    data: {
      userId,
      type,
      status: PENDING_ACTION_STATUS.PENDING,
      payload: payload as object,
      expiresAt,
      metadata: metadata != null ? (metadata as object) : undefined,
    },
  });
  await audit(CHAT_ACTION_PROPOSED, userId, {
    actionId: action.id,
    actionType: type,
    payloadHash: JSON.stringify(payload).length,
    expiresAt: expiresAt.toISOString(),
  });
  return action;
}

export async function getLatestPendingAction(
  userId: string,
  type?: PendingActionType
): Promise<{ id: string; type: string; status: string; payload: unknown; expiresAt: Date } | null> {
  const where: { userId: string; status: string; type?: string } = { userId, status: PENDING_ACTION_STATUS.PENDING };
  if (type) where.type = type;
  const action = await prisma.pendingAction.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });
  if (!action || action.expiresAt < new Date()) return null;
  return {
    id: action.id,
    type: action.type,
    status: action.status,
    payload: action.payload,
    expiresAt: action.expiresAt,
  };
}

export async function confirmPendingAction(userId: string, actionId: string): Promise<boolean> {
  const action = await prisma.pendingAction.findFirst({
    where: { id: actionId, userId },
  });
  if (!action) return false;
  if (action.status !== PENDING_ACTION_STATUS.PENDING) return false;
  if (action.expiresAt < new Date()) {
    await prisma.pendingAction.update({
      where: { id: actionId },
      data: { status: PENDING_ACTION_STATUS.EXPIRED },
    });
    await audit(CHAT_ACTION_EXPIRED, userId, { actionId, actionType: action.type });
    return false;
  }
  await prisma.pendingAction.update({
    where: { id: actionId },
    data: { status: PENDING_ACTION_STATUS.CONFIRMED, confirmedAt: new Date() },
  });
  await audit(CHAT_ACTION_CONFIRMED, userId, { actionId, actionType: action.type });
  return true;
}

export async function cancelPendingAction(userId: string, actionId: string): Promise<boolean> {
  const action = await prisma.pendingAction.findFirst({
    where: { id: actionId, userId },
  });
  if (!action || action.status !== PENDING_ACTION_STATUS.PENDING) return false;
  await prisma.pendingAction.update({
    where: { id: actionId },
    data: { status: PENDING_ACTION_STATUS.CANCELLED },
  });
  await audit(CHAT_ACTION_CANCELLED, userId, { actionId, actionType: action.type });
  return true;
}

export async function markExecuted(userId: string, actionId: string): Promise<void> {
  await prisma.pendingAction.updateMany({
    where: { id: actionId, userId },
    data: { status: PENDING_ACTION_STATUS.EXECUTED, executedAt: new Date() },
  });
  const action = await prisma.pendingAction.findUnique({ where: { id: actionId } });
  if (action) await audit(CHAT_ACTION_EXECUTED, userId, { actionId, actionType: action.type });
}

export async function markFailed(userId: string, actionId: string, reason: string): Promise<void> {
  await prisma.pendingAction.updateMany({
    where: { id: actionId, userId },
    data: { status: PENDING_ACTION_STATUS.FAILED, failureReason: reason.slice(0, 500) },
  });
  const action = await prisma.pendingAction.findUnique({ where: { id: actionId } });
  if (action) await audit(CHAT_ACTION_FAILED, userId, { actionId, actionType: action.type, reason: reason.slice(0, 200) });
}

export async function expireOldPendingActions(): Promise<number> {
  const now = new Date();
  const expired = await prisma.pendingAction.updateMany({
    where: { status: PENDING_ACTION_STATUS.PENDING, expiresAt: { lt: now } },
    data: { status: PENDING_ACTION_STATUS.EXPIRED },
  });
  return expired.count;
}

export async function getPendingActionById(userId: string, actionId: string) {
  return prisma.pendingAction.findFirst({
    where: { id: actionId, userId },
  });
}
