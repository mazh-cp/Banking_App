import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { prisma } from '@/lib/db';
import { maskSecret, hasEncryptionKey } from '@/lib/security/secrets';
import { getReadinessSummary } from '@/lib/runtime/ai-readiness';

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const readiness = await getReadinessSummary();

  const [openai, anthropic, lakera, lakeraProject, lakeraInputEnabled, lakeraOutputEnabled] = await Promise.all([
    prisma.appSecret.findUnique({ where: { keyName: 'OPENAI_API_KEY' } }),
    prisma.appSecret.findUnique({ where: { keyName: 'ANTHROPIC_API_KEY' } }),
    prisma.appSecret.findUnique({ where: { keyName: 'LAKERA_API_KEY' } }),
    prisma.appConfig.findUnique({ where: { configName: 'LAKERA_PROJECT_ID' } }),
    prisma.appConfig.findUnique({ where: { configName: 'LAKERA_INPUT_VALIDATION_ENABLED' } }),
    prisma.appConfig.findUnique({ where: { configName: 'LAKERA_OUTPUT_VALIDATION_ENABLED' } }),
  ]);

  const userSelect = { id: true, email: true, firstName: true, lastName: true };
  const [openaiUpdater, anthropicUpdater, lakeraUpdater, projectUpdater] = await Promise.all([
    openai?.updatedByUserId ? prisma.user.findUnique({ where: { id: openai.updatedByUserId }, select: userSelect }) : null,
    anthropic?.updatedByUserId ? prisma.user.findUnique({ where: { id: anthropic.updatedByUserId }, select: userSelect }) : null,
    lakera?.updatedByUserId ? prisma.user.findUnique({ where: { id: lakera.updatedByUserId }, select: userSelect }) : null,
    lakeraProject?.updatedByUserId ? prisma.user.findUnique({ where: { id: lakeraProject.updatedByUserId }, select: userSelect }) : null,
  ]);

  return NextResponse.json({
    encryptionAvailable: hasEncryptionKey(),
    readiness: {
      openai: readiness.openai,
      anthropic: readiness.anthropic,
      lakera: readiness.lakera,
      lakeraProjectId: readiness.lakeraProjectId,
      chatReadyOpenAI: readiness.chatReadyOpenAI,
      chatReadyAnthropic: readiness.chatReadyAnthropic,
      chatReadyWithLakeraOpenAI: readiness.chatReadyWithLakeraOpenAI,
      chatReadyWithLakeraAnthropic: readiness.chatReadyWithLakeraAnthropic,
    },
    openai: {
      isSet: !!openai,
      masked: openai ? 'sk-…****' : null,
      updatedAt: openai?.updatedAt?.toISOString() ?? null,
      updatedBy: openaiUpdater ? { email: openaiUpdater.email, firstName: openaiUpdater.firstName, lastName: openaiUpdater.lastName } : null,
    },
    anthropic: {
      isSet: !!anthropic,
      masked: anthropic ? 'sk-ant-…****' : null,
      updatedAt: anthropic?.updatedAt?.toISOString() ?? null,
      updatedBy: anthropicUpdater ? { email: anthropicUpdater.email, firstName: anthropicUpdater.firstName, lastName: anthropicUpdater.lastName } : null,
    },
    lakera: {
      isSet: !!lakera,
      masked: lakera ? '••••…****' : null,
      updatedAt: lakera?.updatedAt?.toISOString() ?? null,
      updatedBy: lakeraUpdater ? { email: lakeraUpdater.email, firstName: lakeraUpdater.firstName, lastName: lakeraUpdater.lastName } : null,
    },
    lakeraProjectId: {
      isSet: !!lakeraProject?.value,
      masked: lakeraProject?.value ? maskSecret(lakeraProject.value, 4) : null,
      updatedAt: lakeraProject?.updatedAt?.toISOString() ?? null,
      updatedBy: projectUpdater ? { email: projectUpdater.email, firstName: projectUpdater.firstName, lastName: projectUpdater.lastName } : null,
    },
    lakeraInputValidationEnabled: (lakeraInputEnabled?.value ?? 'true') === 'true',
    lakeraOutputValidationEnabled: (lakeraOutputEnabled?.value ?? 'true') === 'true',
  });
}
