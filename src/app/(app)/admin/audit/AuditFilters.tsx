'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function AuditFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) p.set(key, value);
      else p.delete(key);
      router.push(`/admin/audit?${p.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="card flex flex-wrap items-end gap-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Risk level</label>
        <select
          value={searchParams.get('riskLevel') ?? ''}
          onChange={(e) => update('riskLevel', e.target.value)}
          className="input-field py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Persona</label>
        <select
          value={searchParams.get('persona') ?? ''}
          onChange={(e) => update('persona', e.target.value)}
          className="input-field py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="support">support</option>
          <option value="banking">banking</option>
          <option value="cards">cards</option>
          <option value="lending">lending</option>
          <option value="fraud">fraud</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Category</label>
        <select
          value={searchParams.get('category') ?? ''}
          onChange={(e) => update('category', e.target.value)}
          className="input-field py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="prompt_injection">prompt_injection</option>
          <option value="data_exfil">data_exfil</option>
          <option value="fraud">fraud</option>
          <option value="jailbreak">jailbreak</option>
          <option value="system_prompt_extraction">system_prompt_extraction</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">From (date)</label>
        <input
          type="date"
          value={searchParams.get('from') ?? ''}
          onChange={(e) => update('from', e.target.value)}
          className="input-field py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">To (date)</label>
        <input
          type="date"
          value={searchParams.get('to') ?? ''}
          onChange={(e) => update('to', e.target.value)}
          className="input-field py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
