import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { createBillCheckoutSession } from '@/lib/stripe/billCheckout';
import { generateBillSlug } from '@/lib/billSlug';

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://app.ignitegrowth.biz');

/**
 * POST /api/bills/send
 *
 * DEPRECATED: Use POST /api/bills/assign instead - it sets companyId and generates URL in one operation.
 * This endpoint kept for backwards compatibility but redirects to assign flow.
 */
export async function POST(request: Request) {
  return NextResponse.json(
    { success: false, error: 'This endpoint is deprecated. Use POST /api/bills/assign instead - it sets companyId and generates payment URL in one operation.' },
    { status: 410 }
  );
}
