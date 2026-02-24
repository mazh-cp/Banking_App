import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const formSchema = z.object({
  income: z.string().max(200).optional(),
  employment: z.string().max(200).optional(),
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
    const { income, employment } = parsed.data;
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'credit_card',
        status: 'pending',
        amount: 5000,
        metadata: { income: income ?? undefined, employment: employment ?? undefined, cardType: 'rewards' },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=credit_card_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
