'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PreferredNameForm({
  initialPreferredName,
}: {
  initialPreferredName: string | null | undefined;
}) {
  const [value, setValue] = useState(initialPreferredName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredName: value.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || 'Failed to save');
        return;
      }
      setMessage('Saved. Your chat greeting will use this name.');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="preferredName" className="block text-sm text-slate-500">
        Preferred name (for chat greeting)
      </label>
      <div className="flex gap-2">
        <input
          id="preferredName"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Alex"
          className="input-field flex-1 max-w-xs"
          maxLength={100}
        />
        <button type="submit" disabled={saving} className="btn-primary whitespace-nowrap">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </form>
  );
}
