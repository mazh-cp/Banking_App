'use client';

import { useState } from 'react';
import type { DemoAttack } from '@/lib/security/demo-attacks';

export function DemoAttackCard({ attack }: { attack: DemoAttack }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(attack.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-slate-800">{attack.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          attack.expectedOutcome === 'blocked' ? 'bg-red-100 text-red-800' :
          attack.expectedOutcome === 'safe_rewrite' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
        }`}>
          Expected: {attack.expectedOutcome.replace('_', ' ')}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-1">Category: {attack.category}</p>
      <p className="mt-2 text-sm text-slate-700 bg-slate-50 p-2 rounded font-mono break-words">
        {attack.prompt}
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 text-sm text-bank-primary hover:underline"
      >
        {copied ? 'Copied!' : 'Copy prompt'}
      </button>
    </div>
  );
}
