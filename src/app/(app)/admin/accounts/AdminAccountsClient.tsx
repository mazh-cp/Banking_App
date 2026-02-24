'use client';

import { useState } from 'react';

type AccountRow = { id: string; type: string; accountNumber: string; balance: number; status: string };
type UserRow = { id: string; email: string; firstName: string; lastName: string; accounts: AccountRow[] };

export function AdminAccountsClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [topUpUserId, setTopUpUserId] = useState('');
  const [topUpAccountId, setTopUpAccountId] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const userId = topUpUserId.trim();
    const accountId = topUpAccountId.trim();
    const amount = parseFloat(topUpAmount);
    if (!userId || !accountId || !Number.isFinite(amount) || amount <= 0) {
      setMessage('Select user, account, and a positive amount.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/accounts/top-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accountId, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Top-up failed');
        return;
      }
      setMessage(`Success: new balance $${data.newBalance.toFixed(2)}. Transaction ${data.transactionId}`);
      setTopUpAmount('');
      const listRes = await fetch('/api/admin/accounts');
      if (listRes.ok) {
        const listData = await listRes.json();
        setUsers(listData.users ?? users);
      }
    } catch {
      setMessage('Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">All accounts</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Account</th>
                <th className="text-left py-3 px-4">Number</th>
                <th className="text-right py-3 px-4">Balance</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) =>
                u.accounts.length ? (
                  u.accounts.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">
                        {u.firstName} {u.lastName} ({u.email})
                      </td>
                      <td className="py-3 px-4">{a.type}</td>
                      <td className="py-3 px-4 font-mono">{a.accountNumber}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        ${a.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-3 px-4" colSpan={4}>
                      {u.email} – no accounts
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Top-up funds</h2>
        <form onSubmit={handleTopUp} className="card max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
            <select
              value={topUpUserId}
              onChange={(e) => {
                setTopUpUserId(e.target.value);
                setTopUpAccountId('');
              }}
              className="input-field w-full"
              required
            >
              <option value="">Select user</option>
              {users.filter((u) => u.accounts.length > 0).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
            <select
              value={topUpAccountId}
              onChange={(e) => setTopUpAccountId(e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select account</option>
              {users
                .find((u) => u.id === topUpUserId)
                ?.accounts.filter((a) => a.type === 'checking' || a.type === 'savings')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.type} – {a.accountNumber} (${a.balance.toFixed(2)})
                  </option>
                )) ?? []}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. 100"
              required
            />
          </div>
          {message && <p className="text-sm text-slate-600">{message}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting…' : 'Top up'}
          </button>
        </form>
      </section>
    </div>
  );
}
