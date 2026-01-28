import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bills/public/[companySlug]/[part]
 * Public, no auth. Look up bill send by slug = companySlug/part
 * (dynamic URL: bill/companyname/billname-shortId).
 * Returns bill + company + checkoutUrl for the bill page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companySlug: string; part: string }> }
) {
  try {
    const { companySlug, part } = await params;
    if (!companySlug?.trim() || !part?.trim()) {
      return NextResponse.json({ error: 'Company and part required' }, { status: 400 });
    }

    const slug = `${companySlug.trim()}/${part.trim()}`;

    // Find bill by slug directly (slug is now on bills table)
    const bill = await prisma.bills.findUnique({
      where: { slug },
      include: {
        company_hqs: { select: { id: true, companyName: true } },
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (bill.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This bill is no longer available for payment.', status: bill.status },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      bill: {
        id: bill.id,
        name: bill.name,
        description: bill.description,
        amountCents: bill.amountCents,
        currency: bill.currency,
      },
      company: bill.company_hqs ? {
        id: bill.company_hqs.id,
        companyName: bill.company_hqs.companyName,
      } : null,
      checkoutUrl: bill.checkoutUrl,
      publicBillUrl: bill.publicBillUrl,
    });
  } catch (e) {
    console.error('❌ GET /api/bills/public/[companySlug]/[part]:', e);
    return NextResponse.json(
      { error: 'Failed to load bill', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
