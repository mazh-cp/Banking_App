import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function CreditCardApplyPage() {
  const session = await getSession();
  if (session?.user.role === 'readonly') redirect('/dashboard?error=readonly');
  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Apply for a Credit Card</h1>
      <p className="text-slate-600 mb-6">FinGuard Rewards Card — earn points on every purchase.</p>
      <div className="card max-w-lg">
        <form action="/api/apply/credit-card" method="POST" className="space-y-4">
          <input type="hidden" name="type" value="credit_card" />
          <div>
            <label htmlFor="income" className="block text-sm font-medium text-slate-700 mb-1">Annual income ($)</label>
            <input id="income" name="income" type="number" min="0" step="1000" className="input-field" placeholder="50000" required />
          </div>
          <div>
            <label htmlFor="employment" className="block text-sm font-medium text-slate-700 mb-1">Employment status</label>
            <select id="employment" name="employment" className="input-field" required>
              <option value="">Select</option>
              <option value="employed">Employed</option>
              <option value="self_employed">Self-employed</option>
              <option value="retired">Retired</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn-primary">Submit application</button>
            <Link href="/dashboard" className="btn-secondary">Cancel</Link>
          </div>
        </form>
        <p className="mt-4 text-sm text-slate-500">Simulation only. No real credit check.</p>
      </div>
    </div>
  );
}
