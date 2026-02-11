import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.user.role === 'readonly') {
      const base = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || request.url;
      return NextResponse.redirect(new URL('/dashboard?error=readonly', base));
    }
    const form = await request.formData();
    const income = form.get('income');
    const employment = form.get('employment');
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'credit_card',
        status: 'pending',
        amount: 5000,
        metadata: { income: income?.toString(), employment: employment?.toString(), cardType: 'rewards' },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=credit_card_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
