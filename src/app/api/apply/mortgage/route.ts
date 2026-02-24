import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const formSchema = z.object({
  amount: z.string().max(50).optional(),
  term: z.string().max(20).optional(),
  property: z.string().max(500).optional(),
  income: z.string().max(200).optional(),
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
    const { amount: amountStr, term, property, income } = parsed.data;
    const amount = amountStr ? parseFloat(amountStr) : 350000;
    const termMonths = term ? parseInt(term, 10) * 12 : 360;
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'mortgage',
        status: 'pending',
        amount: Number.isFinite(amount) ? amount : 350000,
        termMonths,
        rate: 6.5,
        metadata: { propertyAddress: property ?? undefined, income: income ?? undefined },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=mortgage_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
