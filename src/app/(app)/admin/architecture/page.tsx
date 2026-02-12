import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ArchitectureDiagram from './ArchitectureDiagram';

export default async function AdminArchitecturePage() {
  const session = await getSession();
  if (!session || session.user.role !== 'admin') redirect('/dashboard');
  return (
    <div>
      <h1 className="text-2xl font-bold text-bank-dark mb-2">Architecture</h1>
      <p className="text-slate-600 mb-6">System components and data flow. Balances from Banking Tools/APIs (authoritative); RAG for documents/context only; Lakera gates on USER_INPUT, TOOL_ARGS (actions), LLM_OUTPUT.</p>
      <ArchitectureDiagram />
    </div>
  );
}
