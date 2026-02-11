import { getSession } from '@/lib/auth';
import PreferredNameForm from './PreferredNameForm';
import SsnLast4Form from './SsnLast4Form';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-6">Profile</h1>
      <div className="card max-w-md space-y-6">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-slate-500">Name</dt>
            <dd className="font-medium">{session.user.firstName} {session.user.lastName}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Email</dt>
            <dd className="font-medium">{session.user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Role</dt>
            <dd className="font-medium capitalize">{session.user.role}</dd>
          </div>
        </dl>
        <div>
          <PreferredNameForm initialPreferredName={session.user.preferredName} />
        </div>
        <div id="identity" className="pt-4 border-t border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Identity</h2>
          <SsnLast4Form />
        </div>
        <p className="text-sm text-slate-500">
          This is a simulation. No real banking data is stored.
        </p>
      </div>
    </div>
  );
}
