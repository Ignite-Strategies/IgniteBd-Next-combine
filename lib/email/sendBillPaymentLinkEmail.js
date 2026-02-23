/**
 * Send "here's your bill / retainer" email with embedded payment link.
 * Uses SendGrid via sendgridClient. For use by cron, API, or manual trigger.
 */

import { sendEmail } from '../sendgridClient.js';
import {
  getBillPaymentLinkEmailHtml,
  getBillPaymentLinkEmailText,
  getBillPaymentLinkEmailSubject,
} from './billPaymentLinkTemplate';

/**
 * Send bill or retainer payment link email.
 *
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} [opts.toName] - Recipient name (optional)
 * @param {string} opts.paymentUrl - Full URL to bill or retainer page
 * @param {string} opts.amountFormatted - e.g. "$1,500.00" or "$1,500.00 / month"
 * @param {string} opts.companyName - Company name
 * @param {string} [opts.description] - Optional line/item description
 * @param {boolean} [opts.isRetainer=false] - true for retainer copy
 * @param {string} [opts.from] - Override from email
 * @param {string} [opts.fromName] - Override from name
 * @param {string} [opts.subject] - Override subject; default from getBillPaymentLinkEmailSubject
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export async function sendBillPaymentLinkEmail({
  to,
  toName,
  paymentUrl,
  amountFormatted,
  companyName,
  description = '',
  isRetainer = false,
  from,
  fromName,
  subject: subjectOverride,
}) {
  const subject =
    subjectOverride ?? getBillPaymentLinkEmailSubject({ companyName, isRetainer });
  const html = getBillPaymentLinkEmailHtml({
    paymentUrl,
    amountFormatted,
    companyName,
    description,
    isRetainer,
  });
  const text = getBillPaymentLinkEmailText({
    paymentUrl,
    amountFormatted,
    companyName,
    description,
    isRetainer,
  });

  try {
    const result = await sendEmail({
      to,
      toName,
      subject,
      html,
      text,
      from,
      fromName,
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('sendBillPaymentLinkEmail error:', error?.message);
    return { success: false, error: error?.message };
  }
}
