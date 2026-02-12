'use client';

import { useState, useRef, useEffect } from 'react';
import { PERSONAS, SCENARIO_PRESETS } from '@/lib/constants';
import {
  ASSISTANT_FULL_NAME,
  DEFAULT_GREETING,
} from '@/lib/config/branding';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  blocked?: boolean;
  safeRewrite?: boolean;
  dataAsOf?: string;
  usedRag?: boolean;
  meta?: { systemGenerated?: boolean; type?: string };
  pendingActionId?: string;
  pendingActionSummary?: { type: string; fromAccount?: string; toAccount?: string; amount?: number; increaseAmount?: number; newLimit?: number };
};

const GREETING_STORAGE_KEY = 'finguard_chat_hasGreeted';
const CONVERSATION_ID_KEY = 'finguard_chat_cid';

function getGreetedKey(userId: string) {
  return `${GREETING_STORAGE_KEY}_${userId}`;
}

function getConversationIdKey(userId: string) {
  return `${CONVERSATION_ID_KEY}_${userId}`;
}

function getInitials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase().slice(0, 2);
  }
  return (t[0] ?? '?').toUpperCase();
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Render assistant content with unknown-link defense: URLs not in allowlist are plain text + "Unverified link". */
function SafeMessageContent({ content, allowedDomains }: { content: string; allowedDomains: string[] }) {
  const allowed = new Set(allowedDomains.map((d) => d.toLowerCase()));
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_REGEX.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const url = m[0];
    const index = m.index;
    if (index > lastIndex) parts.push(content.slice(lastIndex, index));
    const domain = domainFromUrl(url);
    if (domain && allowed.has(domain)) {
      parts.push(<a key={index} href={url} target="_blank" rel="noopener noreferrer" className="text-bank-primary underline">{url}</a>);
    } else {
      parts.push(
        <span key={index} className="inline-flex flex-col">
          <span className="text-slate-600">{url}</span>
          <span className="text-xs text-amber-700">Unverified link</span>
        </span>
      );
    }
    lastIndex = index + url.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  if (parts.length === 0) return <>{content}</>;
  return <>{parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <span key={i}>{p}</span>))}</>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [persona, setPersona] = useState<string>(PERSONAS[0].id);
  const [attackSimulation, setAttackSimulation] = useState(false);
  const [securityMode, setSecurityMode] = useState(true);
  const [useRag, setUseRag] = useState(true);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** When set, we're in maintenance mode. If array, admin view (missing keys); if empty array, generic message. */
  const [maintenanceBanner, setMaintenanceBanner] = useState<'generic' | string[] | null>(null);
  /** When true, show verification banner and hint to enter last 4 digits. */
  const [verificationRequired, setVerificationRequired] = useState(false);
  /** When set, user is verified; show "Verified ✅ (expires at ...)" until this time passes. */
  const [verifiedExpiresAt, setVerifiedExpiresAt] = useState<string | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const greetingInjected = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleConfirmAction = async (actionId: string, confirm: boolean) => {
    setConfirmingActionId(actionId);
    try {
      const res = await fetch('/api/chat/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      const resultMessage = data.message ?? (confirm ? 'Action completed.' : 'Request cancelled.');
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.pendingActionId === actionId ? { ...m, pendingActionId: undefined, pendingActionSummary: undefined } : m
        );
        return [...next, { role: 'assistant' as const, content: resultMessage }];
      });
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Could not complete. Please try again.' }]);
    } finally {
      setConfirmingActionId(null);
    }
  };

  // Fetch current user for display name and conversation id
  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        const u = data.user;
        if (u?.id) {
          setUserId(u.id);
          const displayName =
            u.preferredName?.trim() ||
            [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
            null;
          setUserName(displayName || null);
          let cid = typeof localStorage !== 'undefined' ? localStorage.getItem(getConversationIdKey(u.id)) : null;
          if (!cid) {
            cid = crypto.randomUUID?.() ?? `conv-${Date.now()}`;
            try {
              localStorage.setItem(getConversationIdKey(u.id), cid);
            } catch {
              // ignore
            }
          }
          setConversationId(cid);
        }
      })
      .catch(() => {});
  }, []);

  // Allowed domains for unknown-link UX (render unverified links as plain text)
  useEffect(() => {
    fetch('/api/config/allowed-domains')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data?.allowedDomains && Array.isArray(data.allowedDomains) && setAllowedDomains(data.allowedDomains))
      .catch(() => {});
  }, []);

  // SSN-first: fetch verification status on chat load so verification step shows immediately
  useEffect(() => {
    if (!userId) return;
    fetch('/api/chat/verification-status')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.verificationRequired === true) {
          setVerificationRequired(true);
        } else {
          setVerificationRequired(false);
          if (data.verifiedExpiresAt) setVerifiedExpiresAt(data.verifiedExpiresAt);
        }
      })
      .catch(() => {});
  }, [userId]);

  // Inject greeting once per user when conversation is empty
  useEffect(() => {
    if (greetingInjected.current || messages.length > 0) return;
    if (userId === null) return;

    const greetedKey = getGreetedKey(userId);
    let hasGreeted = false;
    try {
      hasGreeted = localStorage.getItem(greetedKey) === '1';
    } catch {
      // ignore
    }

    const greetingContent = DEFAULT_GREETING(userName ?? undefined);
    const greeting: Message = {
      role: 'assistant',
      content: greetingContent,
      meta: { systemGenerated: true, type: 'greeting' },
    };

    setMessages([greeting]);
    greetingInjected.current = true;
    try {
      localStorage.setItem(greetedKey, '1');
    } catch {
      // ignore
    }
  }, [userId, userName, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const applyPreset = (key: keyof typeof SCENARIO_PRESETS) => {
    const p = SCENARIO_PRESETS[key];
    setInput(p.prompt);
    setPreset(key);
  };

  const messagesForApi = messages.filter((m) => !m.meta?.systemGenerated);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setPreset(null);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi
            .concat([{ role: 'user', content: text }])
            .map((msg) => ({ role: msg.role, content: msg.content })),
          persona,
          attackSimulation,
          securityMode,
          useRag,
        }),
      });
      let data: {
        message?: string;
        meta?: { maintenance?: boolean; missingKeys?: string[] };
        blocked?: boolean;
        safeRewrite?: boolean;
        dataAsOf?: string;
        usedRag?: boolean;
        error?: string;
        verificationRequired?: boolean;
        verificationNotConfigured?: boolean;
        verificationSuccess?: boolean;
        pendingActionId?: string;
        pendingActionSummary?: { type: string; fromAccount?: string; toAccount?: string; amount?: number; increaseAmount?: number; newLimit?: number };
      };
      try {
        data = await res.json();
      } catch {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', blocked: false },
        ]);
        return;
      }

      if (!res.ok) {
        const fallback = data?.message || data?.error || 'Sorry, something went wrong. Please try again.';
        setMessages((m) => [...m, { role: 'assistant', content: fallback, blocked: false }]);
        return;
      }

      if (data.meta?.maintenance) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: data.message || 'System is under Maintenance' },
        ]);
        setMaintenanceBanner(Array.isArray(data.meta.missingKeys) ? data.meta.missingKeys : 'generic');
        return;
      }
      if (data.blocked) {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: data.message || 'Message blocked.', blocked: true },
        ]);
        setVerificationRequired(false);
        return;
      }
      if (data.verificationRequired === true && !data.verificationSuccess) {
        setVerificationRequired(true);
      } else if (data.verificationSuccess === true || data.verificationNotConfigured === true) {
        setVerificationRequired(false);
        if (data.verificationSuccess && (data as { expiresAt?: string }).expiresAt) {
          setVerifiedExpiresAt((data as { expiresAt: string }).expiresAt);
        }
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.message || '',
          safeRewrite: data.safeRewrite,
          dataAsOf: data.dataAsOf,
          usedRag: data.usedRag,
          pendingActionId: data.pendingActionId,
          pendingActionSummary: data.pendingActionSummary,
        },
      ]);
      setMaintenanceBanner(null);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Sorry, something went wrong.', blocked: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const currentPersona = PERSONAS.find((p) => p.id === persona);
  const userLabel = userName || 'You';

  const maintenanceLabel = (key: string) => {
    const labels: Record<string, string> = {
      OPENAI_API_KEY: 'OpenAI key',
      ANTHROPIC_API_KEY: 'Anthropic key',
      LAKERA_API_KEY: 'Lakera key',
      LAKERA_PROJECT_ID: 'Lakera Project ID',
    };
    return labels[key] ?? key;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-bank-dark mb-4">Secure Chat</h1>

      {maintenanceBanner !== null && (
        <div className="card mb-4 bg-amber-50 border-amber-200">
          {Array.isArray(maintenanceBanner) && maintenanceBanner.length > 0 ? (
            <p className="text-sm text-amber-800">
              Missing configuration: {maintenanceBanner.map(maintenanceLabel).join(' / ')}
            </p>
          ) : (
            <p className="text-sm text-amber-800">AI services temporarily unavailable.</p>
          )}
        </div>
      )}

      {verificationRequired && (
        <div className="card mb-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800">Verification required</p>
          <p className="text-xs text-blue-700 mt-1">Enter 4 digits in the message box below to verify your identity (simulation).</p>
        </div>
      )}
      {verifiedExpiresAt && new Date(verifiedExpiresAt) > new Date() && (
        <div className="card mb-4 bg-green-50 border-green-200">
          <p className="text-sm font-medium text-green-800">Verified ✅ (expires in {Math.max(0, Math.ceil((new Date(verifiedExpiresAt).getTime() - Date.now()) / 60000))} min)</p>
        </div>
      )}

      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Settings</h2>
        <div className="flex flex-wrap gap-6">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Persona</label>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="input-field py-1.5 text-sm"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="attack"
              type="checkbox"
              checked={attackSimulation}
              onChange={(e) => setAttackSimulation(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="attack" className="text-sm">Attack simulation</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="security"
              type="checkbox"
              checked={securityMode}
              onChange={(e) => setSecurityMode(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="security" className="text-sm">Security mode</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="rag"
              type="checkbox"
              checked={useRag}
              onChange={(e) => setUseRag(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="rag" className="text-sm">Use RAG (approved docs)</label>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Scenario presets</h2>
        <p className="text-xs text-slate-500 mb-3">Load a preset into the input (for testing security).</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIO_PRESETS) as Array<keyof typeof SCENARIO_PRESETS>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                preset === key
                  ? 'bg-bank-muted border-bank-primary text-bank-dark'
                  : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              {SCENARIO_PRESETS[key].name}
            </button>
          ))}
        </div>
      </div>

      <div className="card flex flex-col h-[420px]">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && !userId && (
            <p className="text-slate-500 text-sm">
              Send a message to start. With Security mode on, harmful or off-topic inputs may be blocked.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bank-primary text-white text-xs font-medium"
                  title={ASSISTANT_FULL_NAME}
                >
                  A
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-slate-500 mb-0.5">
                  {m.role === 'assistant'
                    ? ASSISTANT_FULL_NAME
                    : userLabel}
                </span>
                {m.role === 'assistant' && currentPersona && (
                  <span className="text-xs text-slate-400 mb-0.5">Mode: {currentPersona.name}</span>
                )}
                <div
                  className={`rounded-lg px-4 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-bank-primary text-white'
                      : m.blocked
                      ? 'bg-amber-100 text-amber-900'
                      : m.safeRewrite
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <SafeMessageContent content={m.content} allowedDomains={allowedDomains} />
                  ) : (
                    m.content
                  )}
                  {m.blocked && (
                    <span className="block mt-1 text-xs font-medium text-amber-800">
                      Security policy enforced
                    </span>
                  )}
                  {m.safeRewrite && !m.blocked && (
                    <span className="block mt-1 text-xs text-slate-500">
                      (Response was rewritten for safety.)
                    </span>
                  )}
                  {m.dataAsOf && (
                    <span className="block mt-1 text-xs text-slate-500">
                      Data as of {m.dataAsOf}
                    </span>
                  )}
                  {m.usedRag && !m.blocked && (
                    <span className="block mt-1 text-xs text-slate-500">
                      Answered using your documents
                    </span>
                  )}
                  {m.role === 'assistant' && m.pendingActionId && m.pendingActionSummary && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs font-medium text-amber-800 mb-2">Confirm or cancel</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmAction(m.pendingActionId!, true)}
                          disabled={confirmingActionId === m.pendingActionId}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {confirmingActionId === m.pendingActionId ? '…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmAction(m.pendingActionId!, false)}
                          disabled={confirmingActionId === m.pendingActionId}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {m.role === 'user' && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white text-xs font-medium"
                  title={userLabel}
                >
                  {getInitials(userLabel)}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bank-primary text-white text-xs font-medium"
                title={ASSISTANT_FULL_NAME}
              >
                A
              </div>
              <div className="bg-slate-100 rounded-lg px-4 py-2 text-sm text-slate-500">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 pt-4 border-t border-slate-200"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={verificationRequired ? 'Enter 4 digits' : 'Type a message...'}
            className="input-field flex-1"
            maxLength={4096}
            inputMode={verificationRequired ? 'numeric' : 'text'}
          />
          <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
