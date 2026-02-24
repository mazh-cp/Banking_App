import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const formSchema = z.object({
  amount: z.string().max(50).optional(),
  term: z.string().max(20).optional(),
  vehicle: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.user.role === 'readonly') {
      const base = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || request.url;
      return NextResponse.redirect(new URL('/dashboard?error=readonly', base));
    }
    const form = await request.formData();
    const raw = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, typeof v === 'string' ? v : '']));
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_form', request.url));
    }
    const { amount: amountStr, term, vehicle } = parsed.data;
    const amount = amountStr ? parseFloat(amountStr) : 25000;
    const termMonths = term ? parseInt(term, 10) : 60;
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'auto_loan',
        status: 'pending',
        amount: Number.isFinite(amount) ? amount : 25000,
        termMonths,
        rate: 7.25,
        metadata: { vehicle: vehicle ?? undefined },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=auto_loan_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
