import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) return null;

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-6">Transactions</h1>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Description</th>
              <th className="text-left py-3 px-4">Reference</th>
              <th className="text-right py-3 px-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-600">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
                <td className="py-3 px-4 capitalize">{t.type}</td>
                <td className="py-3 px-4">{t.description ?? '—'}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-400">{t.reference ?? '—'}</td>
                <td className="py-3 px-4 text-right font-medium">
                  {t.type === 'deposit' || (t.type === 'transfer' && t.toAccountId) ? '+' : ''}
                  ${Number(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <p className="py-12 text-center text-slate-500">No transactions.</p>
        )}
      </div>
    </div>
  );
}
