import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { FileUploadForm } from './FileUploadForm';

export default async function FilesPage() {
  const session = await getSession();
  if (!session) return null;

  const files = await prisma.fileUpload.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { fileScans: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-6">Files & RAG</h1>
      <p className="text-slate-600 mb-6">
        {session.user.role === 'readonly'
          ? 'Read-only accounts can view the list of uploads but cannot upload new files.'
          : 'Upload documents. They will be scanned, chunked, and embedded for use in Chat when RAG is enabled.'}
      </p>

      {session.user.role !== 'readonly' && <FileUploadForm />}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Your uploads</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">Filename</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Size</th>
                <th className="text-left py-3 px-4">Upload / Scan status</th>
                <th className="text-left py-3 px-4">Chunks</th>
                <th className="text-left py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const scan = f.fileScans[0];
                return (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 px-4 font-medium">{f.originalName ?? f.filename}</td>
                    <td className="py-3 px-4 text-slate-600">{f.ext?.toUpperCase() ?? f.mimeType?.slice(0, 10)}</td>
                    <td className="py-3 px-4 text-slate-600">{(f.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-4">
                      {f.quarantined ? (
                        <span className="text-red-600">Quarantined</span>
                      ) : f.approved ? (
                        <span className="text-green-600">Approved</span>
                      ) : (
                        <span className="text-amber-600">Pending</span>
                      )}
                      {scan?.riskLevel && (
                        <span className="ml-1 text-xs text-slate-500">({scan.riskLevel})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{f.chunkCount}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(f.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {files.length === 0 && (
            <p className="py-8 text-center text-slate-500">No uploads yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
