'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Nav({ role = 'customer' }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === 'admin';
  const isReadOnly = role === 'readonly';

  const allLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/apply/credit-card', label: 'Credit Card', writeOnly: true },
    { href: '/apply/mortgage', label: 'Mortgage', writeOnly: true },
    { href: '/apply/auto-loan', label: 'Auto Loan', writeOnly: true },
    { href: '/transactions', label: 'Transactions' },
    { href: '/chat', label: 'Chat' },
    { href: '/files', label: 'Files' },
    { href: '/profile', label: 'Profile' },
  ];
  const links = isReadOnly ? allLinks.filter((l) => !('writeOnly' in l && l.writeOnly)) : allLinks;

  const adminLinks = [
    { href: '/admin/settings', label: 'Settings' },
    { href: '/admin/architecture', label: 'Architecture' },
    { href: '/admin/activity', label: 'Activity' },
    { href: '/admin/security-warnings', label: 'Security Warnings' },
    { href: '/admin/security-events', label: 'Security Events' },
    { href: '/admin/audit', label: 'Audit' },
    { href: '/admin/risk-map', label: 'Risk Map' },
    { href: '/admin/compliance', label: 'Compliance' },
    { href: '/admin/demo', label: 'Demo' },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="bg-bank-dark text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold text-bank-accent">
              FinGuard
            </Link>
            {isReadOnly && <span className="text-xs bg-slate-600 text-slate-200 px-2 py-0.5 rounded">Read-only</span>}
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium ${
                  pathname === l.href ? 'text-bank-accent' : 'text-slate-200 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && adminLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium text-amber-300 ${
                  pathname === l.href ? 'underline' : 'hover:text-amber-200'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="text-sm text-slate-300 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
