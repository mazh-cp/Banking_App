import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { screenText, severityFromReasonCodes } from '@/lib/security/lakera-guard';
import { getSecret, getConfig } from '@/lib/admin/secrets-store';
import { mapScoreToLevel } from '@/lib/security/risk-scoring';
import { extractText } from '@/lib/files/extract-text';
import { getStoragePath, storeFile, sha256 } from '@/lib/files/storage';
import { checkRateLimit } from '@/lib/rate-limit';
import { getEmbeddingClient, getEmbeddingModel } from '@/lib/llm-embedding-client';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_BYTES = Number(process.env.MAX_FILE_UPLOAD_BYTES) || 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 800;
const OVERLAP = 100;

const ALLOWED_MIMES = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);
const ALLOWED_EXT = new Set(['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv']);

function getExt(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start = end - OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role === 'readonly') {
    return NextResponse.json({ error: 'Read-only accounts cannot upload files' }, { status: 403 });
  }

  const { allowed } = checkRateLimit(session.user.id + ':upload');
  if (!allowed) {
    return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const mimeType = (file.type || 'application/octet-stream').toLowerCase().split(';')[0].trim();
  const ext = getExt(file.name);
  if (!ALLOWED_MIMES.has(mimeType) && !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'File type not allowed. Allowed: txt, pdf, doc, docx, xls, xlsx, csv' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = uuidv4();
  const storagePath = getStoragePath(session.user.id, fileId, ext);
  await storeFile(storagePath, buffer);
  const sha256Hash = sha256(buffer);

  const { text, warnings, pageCount, sheetCount } = await extractText(buffer, mimeType, ext);
  if (!text || text.length < 3) {
    return NextResponse.json({ error: 'No text could be extracted from the file' }, { status: 400 });
  }

  const [lakeraKey, projectId] = await Promise.all([getSecret('LAKERA_API_KEY'), getConfig('LAKERA_PROJECT_ID')]);
  const fileDecision = await screenText({
    stage: 'RAG_CONTEXT',
    text: text.slice(0, 50000),
    userId: session.user.id,
    correlationId: fileId,
    apiKey: lakeraKey,
    projectId,
  });

  const fileFlagged = fileDecision.action === 'block' || fileDecision.action === 'mask';
  const fileSeverity = severityFromReasonCodes(fileDecision.reasonCodes);
  const severityToScore: Record<string, number> = { low: 0.1, medium: 0.35, high: 0.6, critical: 0.85 };
  const score = severityToScore[fileSeverity] ?? (fileFlagged ? 0.7 : 0.1);
  const riskLevel = mapScoreToLevel(score);
  const quarantined = riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
  const autoApprove = process.env.RAG_AUTO_APPROVE_LOW_MED === 'true';
  const approved = !quarantined && (autoApprove || false);

  const scanResultRaw = {
    request_uuid: (fileDecision.raw as { request_uuid?: string })?.request_uuid,
    flagged: fileFlagged,
    reasonCodes: fileDecision.reasonCodes,
    severity: fileSeverity,
  };

  const upload = await prisma.fileUpload.create({
    data: {
      userId: session.user.id,
      filename: fileId + (ext ? '.' + ext : ''),
      originalName: file.name,
      mimeType,
      ext,
      sizeBytes: file.size,
      sha256: sha256Hash,
      storagePath,
      scanResult: scanResultRaw as object,
      approved,
      quarantined,
      chunkCount: 0,
    },
  });

  await prisma.fileScan.create({
    data: {
      fileUploadId: upload.id,
      userId: session.user.id,
      categories: fileDecision.reasonCodes as unknown as object,
      severity: fileSeverity,
      flagged: fileFlagged,
      score,
      riskLevel,
      extractorWarnings: warnings as unknown as object,
    },
  });

  if (quarantined) {
    await prisma.auditEvent.create({
      data: {
        eventType: 'FILE_QUARANTINED',
        userId: session.user.id,
        actorUserId: session.user.id,
        route: '/api/files/upload',
        riskLevel,
        metadata: { fileUploadId: upload.id, filename: file.name },
      },
    });
    return NextResponse.json({
      id: upload.id,
      filename: file.name,
      approved: false,
      quarantined: true,
      riskLevel,
      message: 'File quarantined due to security scan. It will not be used for RAG.',
      chunkCount: 0,
    });
  }

  const chunks = chunkText(text);
  const embeddingClient = getEmbeddingClient(process.env.OPENAI_API_KEY ?? process.env.LITELLM_API_KEY);
  const model = getEmbeddingModel();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].slice(0, 8000);
    const chunkDecision = await screenText({
      stage: 'RAG_CONTEXT',
      text: chunk,
      userId: session.user.id,
      correlationId: `${fileId}-chunk-${i}`,
      apiKey: lakeraKey,
      projectId,
    });
    const chunkFlagged = chunkDecision.action === 'block' || chunkDecision.action === 'mask';
    const chunkSeverity = severityFromReasonCodes(chunkDecision.reasonCodes);
    const chunkScore = severityToScore[chunkSeverity] ?? (chunkFlagged ? 0.7 : 0.1);
    const chunkLevel = mapScoreToLevel(chunkScore);
    if (chunkLevel === 'HIGH' || chunkLevel === 'CRITICAL') {
      await prisma.fileUpload.update({
        where: { id: upload.id },
        data: { quarantined: true, approved: false },
      });
      await prisma.documentChunk.deleteMany({ where: { fileUploadId: upload.id } });
      await prisma.auditEvent.create({
        data: {
          eventType: 'FILE_QUARANTINED',
          userId: session.user.id,
          actorUserId: session.user.id,
          route: '/api/files/upload',
          riskLevel: chunkLevel,
          metadata: { fileUploadId: upload.id, filename: file.name, reason: 'chunk_flagged' },
        },
      });
      return NextResponse.json({
        id: upload.id,
        filename: file.name,
        approved: false,
        quarantined: true,
        riskLevel: chunkLevel,
        message: 'A chunk was flagged; file quarantined and not ingested.',
        chunkCount: 0,
      });
    }
    const embRes = await embeddingClient.embeddings.create({ model, input: chunk });
    const embedding = embRes.data[0]?.embedding;
    if (embedding) {
      await prisma.documentChunk.create({
        data: {
          fileUploadId: upload.id,
          content: chunk,
          embedding: embedding as unknown as object,
          chunkIndex: i,
        },
      });
    }
  }

  await prisma.fileUpload.update({
    where: { id: upload.id },
    data: { chunkCount: chunks.length },
  });

  return NextResponse.json({
    id: upload.id,
    filename: file.name,
    approved,
    quarantined: false,
    riskLevel,
    chunkCount: chunks.length,
    pageCount: pageCount ?? undefined,
    sheetCount: sheetCount ?? undefined,
  });
}
