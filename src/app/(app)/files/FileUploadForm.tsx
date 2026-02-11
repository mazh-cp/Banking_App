'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FileUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || loading) return;
    setError('');
    setLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: form });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        if (!res.ok) setError(res.status === 413 ? 'File or request too large.' : 'Upload failed.');
        return;
      }
      if (!res.ok) {
        setError(data.error || (res.status === 413 ? 'File or request too large.' : 'Upload failed.'));
        return;
      }
      setFile(null);
      router.refresh();
    } catch {
      setError('Network error. Check file size (max 10MB) and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Choose file (PDF, Word, Excel, CSV, TXT)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-bank-muted file:text-bank-dark"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={!file || loading} className="btn-primary">
          {loading ? 'Uploading...' : 'Upload & ingest'}
        </button>
      </form>
    </div>
  );
}
