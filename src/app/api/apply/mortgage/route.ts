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
    const property = form.get('property');
    const income = form.get('income');
    const termMonths = term ? parseInt(term.toString(), 10) * 12 : 360;
    await prisma.application.create({
      data: {
        userId: session.user.id,
        type: 'mortgage',
        status: 'pending',
        amount: amount ? parseFloat(amount.toString()) : 350000,
        termMonths,
        rate: 6.5,
        metadata: { propertyAddress: property?.toString(), income: income?.toString() },
      },
    });
    return NextResponse.redirect(new URL('/dashboard?app=mortgage_submitted', request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL('/dashboard?error=apply_failed', request.url));
  }
}
