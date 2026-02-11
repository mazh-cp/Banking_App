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
    const amount = form.get('amount');
    const term = form.get('term');
    const vehicle = form.get('vehicle');
    const termMonths = term ? parseInt(term.toString(), 10) : 60;
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'auto_loan',
        status: 'pending',
        amount: amount ? parseFloat(amount.toString()) : 25000,
        termMonths,
        rate: 7.25,
        metadata: { vehicle: vehicle?.toString() },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=auto_loan_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
