import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Nav from '@/components/Nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login?redirect=' + encodeURIComponent('/dashboard'));

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav role={session.user.role} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
