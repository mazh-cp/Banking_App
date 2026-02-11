'use client';

import { useState, useEffect } from 'react';

type KeyMeta = {
  isSet: boolean;
  masked: string | null;
  updatedAt: string | null;
  updatedBy: { email: string; firstName: string; lastName: string } | null;
};

type Readiness = {
  openai: boolean;
  anthropic: boolean;
  lakera: boolean;
  lakeraProjectId: boolean;
  chatReadyOpenAI: boolean;
  chatReadyAnthropic: boolean;
  chatReadyWithLakeraOpenAI: boolean;
  chatReadyWithLakeraAnthropic: boolean;
};

type SettingsData = {
  encryptionAvailable?: boolean;
  readiness?: Readiness;
  openai: KeyMeta;
  anthropic: KeyMeta;
  lakera: KeyMeta;
  lakeraProjectId: KeyMeta & { masked?: string | null };
  lakeraInputValidationEnabled?: boolean;
  lakeraOutputValidationEnabled?: boolean;
};

export function SettingsClient() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'openai' | 'anthropic' | 'lakera' | 'lakeraProject' | 'remove' | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ target: string; success: boolean; message: string } | null>(null);

  const load = () => fetch('/api/admin/settings').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null)).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSet = async (keyName: string, value: string) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName, value }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetConfig = async (configName: string, value: string) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configName, value }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setModal(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeKey) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/settings/secret?keyName=${encodeURIComponent(removeKey)}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setModal(null);
      setRemoveKey(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (target: string) => {
    setTestResult(null);
    const res = await fetch('/api/admin/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const j = await res.json();
    setTestResult({ target, success: j.success, message: j.message || (j.error ?? '') });
  };

  if (loading) return <div className="text-slate-500">Loading…</div>;
  if (!data) return <div className="text-red-600">Failed to load settings.</div>;

  const by = (m: KeyMeta) => m.updatedBy ? `${m.updatedBy.firstName} ${m.updatedBy.lastName} (${m.updatedBy.email})` : '—';
  const date = (m: KeyMeta) => (m.updatedAt ? new Date(m.updatedAt).toLocaleString() : '—');
  const r = data.readiness;
  const encryptionOk = data.encryptionAvailable !== false;

  return (
    <div className="space-y-6">
      {!encryptionOk && (
        <div className="card bg-amber-50 border-amber-200">
          <h2 className="text-lg font-semibold text-amber-900 mb-2">Encryption key required to store API keys</h2>
          <p className="text-sm text-amber-800 mb-2">
            To save OpenAI, Anthropic, and Lakera keys in Admin Settings, set <code className="bg-amber-100 px-1 rounded">SECRETS_ENCRYPTION_KEY</code> in your <code className="bg-amber-100 px-1 rounded">.env</code> file. Generate a 32-byte hex key with:
          </p>
          <pre className="text-xs bg-amber-100 p-3 rounded overflow-x-auto">openssl rand -hex 32</pre>
          <p className="text-sm text-amber-800 mt-2">
            Add to <code className="bg-amber-100 px-1 rounded">.env</code>: <code className="bg-amber-100 px-1 rounded">SECRETS_ENCRYPTION_KEY=&lt;paste the output&gt;</code>, then restart the dev server.
          </p>
          <p className="text-sm text-amber-800 mt-2">
            <strong>Alternative for local dev:</strong> You can set <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code>, <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code>, <code className="bg-amber-100 px-1 rounded">LAKERA_API_KEY</code>, and <code className="bg-amber-100 px-1 rounded">LAKERA_PROJECT_ID</code> directly in <code className="bg-amber-100 px-1 rounded">.env</code>. The app will use those when no key is stored in Settings.
          </p>
        </div>
      )}

      {r && (
        <div className="card bg-slate-50 border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">System Readiness</h2>
          <div className="grid gap-2 text-sm mb-3">
            <p><span className="font-medium">OpenAI:</span> {r.openai ? 'Set' : 'Not Set'}</p>
            <p><span className="font-medium">Anthropic:</span> {r.anthropic ? 'Set' : 'Not Set'}</p>
            <p><span className="font-medium">Lakera:</span> {r.lakera ? 'Set' : 'Not Set'}</p>
            <p><span className="font-medium">Lakera Project ID:</span> {r.lakeraProjectId ? 'Set' : 'Not Set'}</p>
          </div>
          <p className="text-sm font-medium text-slate-700">
            {r.chatReadyOpenAI && (r.chatReadyWithLakeraOpenAI ? 'AI Chat Ready (OpenAI, with security scanning).' : 'AI Chat Ready (OpenAI).')}
            {r.chatReadyAnthropic && (r.chatReadyWithLakeraAnthropic ? ' AI Chat Ready (Anthropic, with security scanning).' : ' AI Chat Ready (Anthropic).')}
            {!r.chatReadyOpenAI && !r.chatReadyAnthropic && 'Chat will respond with maintenance message until at least one provider key is set.'}
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">OpenAI API Key</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`px-2 py-1 rounded text-sm ${data.openai.isSet ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
            {data.openai.isSet ? 'SET' : 'NOT SET'}
          </span>
          {data.openai.masked && <span className="font-mono text-slate-600">{data.openai.masked}</span>}
          <span className="text-sm text-slate-500">Updated: {date(data.openai)} by {by(data.openai)}</span>
          <button type="button" onClick={() => setModal('openai')} className="btn-secondary text-sm">Set / Update</button>
          {data.openai.isSet && <button type="button" onClick={() => { setRemoveKey('OPENAI_API_KEY'); setModal('remove'); }} className="text-sm text-red-600 hover:underline">Remove</button>}
          <button type="button" onClick={() => handleTest('openai')} className="btn-primary text-sm">Test Connection</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Anthropic API Key</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`px-2 py-1 rounded text-sm ${data.anthropic.isSet ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
            {data.anthropic.isSet ? 'SET' : 'NOT SET'}
          </span>
          {data.anthropic.masked && <span className="font-mono text-slate-600">{data.anthropic.masked}</span>}
          <span className="text-sm text-slate-500">Updated: {date(data.anthropic)} by {by(data.anthropic)}</span>
          <button type="button" onClick={() => setModal('anthropic')} className="btn-secondary text-sm">Set / Update</button>
          {data.anthropic.isSet && <button type="button" onClick={() => { setRemoveKey('ANTHROPIC_API_KEY'); setModal('remove'); }} className="text-sm text-red-600 hover:underline">Remove</button>}
          <button type="button" onClick={() => handleTest('anthropic')} className="btn-primary text-sm">Test Connection</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Lakera API Key</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`px-2 py-1 rounded text-sm ${data.lakera.isSet ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
            {data.lakera.isSet ? 'SET' : 'NOT SET'}
          </span>
          {data.lakera.masked && <span className="font-mono text-slate-600">{data.lakera.masked}</span>}
          <span className="text-sm text-slate-500">Updated: {date(data.lakera)} by {by(data.lakera)}</span>
          <button type="button" onClick={() => setModal('lakera')} className="btn-secondary text-sm">Set / Update</button>
          {data.lakera.isSet && <button type="button" onClick={() => { setRemoveKey('LAKERA_API_KEY'); setModal('remove'); }} className="text-sm text-red-600 hover:underline">Remove</button>}
          <button type="button" onClick={() => handleTest('lakera')} className="btn-primary text-sm">Test Connection</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Lakera Project ID</h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`px-2 py-1 rounded text-sm ${data.lakeraProjectId.isSet ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'}`}>
            {data.lakeraProjectId.isSet ? 'SET' : 'NOT SET'}
          </span>
          {data.lakeraProjectId.masked && <span className="font-mono text-slate-600">{data.lakeraProjectId.masked}</span>}
          <span className="text-sm text-slate-500">Updated: {date(data.lakeraProjectId)} by {by(data.lakeraProjectId)}</span>
          <button type="button" onClick={() => setModal('lakeraProject')} className="btn-secondary text-sm">Set / Update</button>
          <button type="button" onClick={() => handleTest('lakeraProject')} className="btn-primary text-sm">Test</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Lakera AI validation</h2>
        <p className="text-sm text-slate-600 mb-4">Control whether chat input and output are scanned by Lakera Guard. When disabled, scanning is skipped for that stage.</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Input validation</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetConfig('LAKERA_INPUT_VALIDATION_ENABLED', 'true')}
                disabled={submitting || data.lakeraInputValidationEnabled !== false}
                className={`px-3 py-1.5 rounded text-sm ${data.lakeraInputValidationEnabled !== false ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Enable
              </button>
              <button
                type="button"
                onClick={() => handleSetConfig('LAKERA_INPUT_VALIDATION_ENABLED', 'false')}
                disabled={submitting || data.lakeraInputValidationEnabled === false}
                className={`px-3 py-1.5 rounded text-sm ${data.lakeraInputValidationEnabled === false ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Disable
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Output validation</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetConfig('LAKERA_OUTPUT_VALIDATION_ENABLED', 'true')}
                disabled={submitting || data.lakeraOutputValidationEnabled !== false}
                className={`px-3 py-1.5 rounded text-sm ${data.lakeraOutputValidationEnabled !== false ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Enable
              </button>
              <button
                type="button"
                onClick={() => handleSetConfig('LAKERA_OUTPUT_VALIDATION_ENABLED', 'false')}
                disabled={submitting || data.lakeraOutputValidationEnabled === false}
                className={`px-3 py-1.5 rounded text-sm ${data.lakeraOutputValidationEnabled === false ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      </div>

      {testResult && (
        <div className={`card ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-sm">{testResult.success ? '✓' : '✗'} {testResult.target}: {testResult.message}</p>
        </div>
      )}

      {modal === 'openai' && (
        <SecretModal
          title="OpenAI API Key"
          keyName="OPENAI_API_KEY"
          onClose={() => setModal(null)}
          onSubmit={(value) => handleSet('OPENAI_API_KEY', value)}
          submitting={submitting}
          error={error}
        />
      )}
      {modal === 'anthropic' && (
        <SecretModal
          title="Anthropic API Key"
          keyName="ANTHROPIC_API_KEY"
          onClose={() => setModal(null)}
          onSubmit={(value) => handleSet('ANTHROPIC_API_KEY', value)}
          submitting={submitting}
          error={error}
        />
      )}
      {modal === 'lakera' && (
        <SecretModal
          title="Lakera API Key"
          keyName="LAKERA_API_KEY"
          onClose={() => setModal(null)}
          onSubmit={(value) => handleSet('LAKERA_API_KEY', value)}
          submitting={submitting}
          error={error}
        />
      )}
      {modal === 'lakeraProject' && (
        <ConfigModal
          title="Lakera Project ID"
          onClose={() => setModal(null)}
          onSubmit={(value) => handleSetConfig('LAKERA_PROJECT_ID', value)}
          submitting={submitting}
          error={error}
        />
      )}
      {modal === 'remove' && removeKey && (
        <ConfirmRemoveModal
          keyName={removeKey}
          onClose={() => { setModal(null); setRemoveKey(null); }}
          onConfirm={handleRemove}
          submitting={submitting}
          error={error}
          password={confirmPassword}
          setPassword={setConfirmPassword}
        />
      )}
    </div>
  );
}

function SecretModal({
  title,
  keyName,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  title: string;
  keyName: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
  submitting: boolean;
  error: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-sm text-slate-500 mb-2">Enter the API key. It will be encrypted and never shown again.</p>
        <input
          type="password"
          autoComplete="off"
          placeholder="sk-..."
          className="input-field mb-4"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && (
          <>
            <p className="text-red-600 text-sm mb-2">{error}</p>
            {error.includes('SECRETS_ENCRYPTION_KEY') && (
              <p className="text-xs text-slate-600 mb-2">
                Add <code className="bg-slate-100 px-1 rounded">SECRETS_ENCRYPTION_KEY</code> to your <code className="bg-slate-100 px-1 rounded">.env</code> (e.g. run <code className="bg-slate-100 px-1 rounded">openssl rand -hex 32</code> and paste the result), then restart the dev server. See the yellow banner above for full steps.
              </p>
            )}
          </>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => onSubmit(value)} disabled={submitting || !value.trim()} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

function ConfigModal({
  title,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
  submitting: boolean;
  error: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <input
          type="text"
          autoComplete="off"
          placeholder="Project ID"
          className="input-field mb-4"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => onSubmit(value)} disabled={submitting} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRemoveModal({
  keyName,
  onClose,
  onConfirm,
  submitting,
  error,
  password,
  setPassword,
}: {
  keyName: string;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error: string;
  password: string;
  setPassword: (s: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="text-lg font-semibold mb-2">Remove {keyName}</h3>
        <p className="text-sm text-slate-500 mb-4">Confirm removal. The app will fall back to env vars if set.</p>
        <label className="block text-sm text-slate-600 mb-1">Re-enter your password to confirm (optional)</label>
        <input
          type="password"
          autoComplete="off"
          className="input-field mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Remove</button>
        </div>
      </div>
    </div>
  );
}
