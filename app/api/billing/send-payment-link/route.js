/**
 * POST /api/billing/send-payment-link
 * Send the "here's your bill / retainer" template email with embedded payment link.
 * Use from UI (e.g. "Email link" on a bill or retainer) or from cron when sending monthly bill.
 * Requires auth (Firebase).
 *
 * Body: { to, toName?, paymentUrl, amountFormatted, companyName, description?, isRetainer? }
 */
import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { sendBillPaymentLinkEmail } from '@/lib/email/sendBillPaymentLinkEmail';

export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      to,
      toName,
      paymentUrl,
      amountFormatted,
      companyName,
      description = '',
      isRetainer = false,
    } = body;

    if (!to || !paymentUrl || !amountFormatted || !companyName) {
      return NextResponse.json(
        { success: false, error: 'to, paymentUrl, amountFormatted, and companyName are required' },
        { status: 400 }
      );
    }

    const result = await sendBillPaymentLinkEmail({
      to,
      toName,
      paymentUrl,
      amountFormatted,
      companyName,
      description,
      isRetainer,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Payment link email sent.',
    });
  } catch (error) {
    console.error('❌ POST /api/billing/send-payment-link:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to send payment link email' },
      { status: 500 }
    );
  }
}
