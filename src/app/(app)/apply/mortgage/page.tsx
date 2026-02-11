import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function MortgageApplyPage() {
  const session = await getSession();
  if (session?.user.role === 'readonly') redirect('/dashboard?error=readonly');
  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Apply for a Mortgage</h1>
      <p className="text-slate-600 mb-6">Fixed-rate home loans with competitive rates.</p>
      <div className="card max-w-lg">
        <form action="/api/apply/mortgage" method="POST" className="space-y-4">
          <input type="hidden" name="type" value="mortgage" />
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">Loan amount ($)</label>
            <input id="amount" name="amount" type="number" min="10000" step="1000" className="input-field" placeholder="350000" required />
          </div>
          <div>
            <label htmlFor="term" className="block text-sm font-medium text-slate-700 mb-1">Term (years)</label>
            <select id="term" name="term" className="input-field" required>
              <option value="15">15 years</option>
              <option value="30">30 years</option>
            </select>
          </div>
          <div>
            <label htmlFor="property" className="block text-sm font-medium text-slate-700 mb-1">Property address</label>
            <input id="property" name="property" type="text" className="input-field" placeholder="123 Main St" required />
          </div>
          <div>
            <label htmlFor="income" className="block text-sm font-medium text-slate-700 mb-1">Annual income ($)</label>
            <input id="income" name="income" type="number" min="0" step="1000" className="input-field" required />
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
