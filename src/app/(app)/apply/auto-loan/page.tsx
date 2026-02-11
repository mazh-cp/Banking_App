import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function AutoLoanApplyPage() {
  const session = await getSession();
  if (session?.user.role === 'readonly') redirect('/dashboard?error=readonly');
  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Apply for an Auto Loan</h1>
      <p className="text-slate-600 mb-6">Finance your vehicle with competitive rates.</p>
      <div className="card max-w-lg">
        <form action="/api/apply/auto-loan" method="POST" className="space-y-4">
          <input type="hidden" name="type" value="auto_loan" />
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">Loan amount ($)</label>
            <input id="amount" name="amount" type="number" min="1000" step="500" className="input-field" placeholder="25000" required />
          </div>
          <div>
            <label htmlFor="term" className="block text-sm font-medium text-slate-700 mb-1">Term (months)</label>
            <select id="term" name="term" className="input-field" required>
              <option value="36">36 months</option>
              <option value="48">48 months</option>
              <option value="60">60 months</option>
              <option value="72">72 months</option>
            </select>
          </div>
          <div>
            <label htmlFor="vehicle" className="block text-sm font-medium text-slate-700 mb-1">Vehicle description</label>
            <input id="vehicle" name="vehicle" type="text" className="input-field" placeholder="e.g. 2024 Sedan" required />
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
