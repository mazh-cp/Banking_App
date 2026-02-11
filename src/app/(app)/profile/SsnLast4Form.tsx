'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SsnLast4Form() {
  const [last4, setLast4] = useState('');
  const [isSet, setIsSet] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/profile/ssn-last4')
      .then((r) => r.json())
      .then((d) => setIsSet(d.set === true))
      .catch(() => setIsSet(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = last4.replace(/\D/g, '').slice(0, 4);
    if (digits.length !== 4) {
      setMessage('Enter exactly 4 digits.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/profile/ssn-last4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: digits }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(d.error || 'Failed to save');
        return;
      }
      setMessage('Saved. We never display your digits.');
      setLast4('');
      setIsSet(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (isSet === null) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-700">Identity verification (simulation)</h3>
      <p className="text-xs text-slate-500">
        Used only to gate sensitive chat answers in this simulator. We store only a hashed value; never full SSN.
      </p>
      {isSet ? (
        <p className="text-sm text-green-700 font-medium">Status: Set</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div>
            <label htmlFor="ssnLast4" className="block text-xs text-slate-500 mb-1">
              Last 4 digits (simulation)
            </label>
            <input
              id="ssnLast4"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="****"
              className="input-field w-24 font-mono"
              maxLength={4}
            />
          </div>
          <button type="submit" disabled={saving || last4.length !== 4} className="btn-primary whitespace-nowrap">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}
      {message && <p className="text-sm text-slate-600">{message}</p>}
    </div>
  );
}
