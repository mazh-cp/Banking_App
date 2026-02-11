import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { SettingsClient } from './SettingsClient';

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/admin/settings');
  try {
    await requireAdmin();
  } catch {
    redirect('/dashboard');
  }
  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Admin Settings</h1>
      <p className="text-slate-600 mb-6">Manage API keys and config. Only admins can view or change these. Keys are encrypted at rest and never sent to the client.</p>
      <SettingsClient />
    </div>
  );
}
