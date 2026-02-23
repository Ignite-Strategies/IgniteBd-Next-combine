/**
 * Email template: "Here's your bill / retainer" with embedded payment link.
 * Use for one-off bill or retainer links (e.g. monthly cron that sends the dude another bill).
 *
 * Variables: paymentUrl, amountFormatted, companyName, description (optional), isRetainer (boolean).
 */

/**
 * Build HTML body for bill/retainer payment link email.
 * @param {Object} opts
 * @param {string} opts.paymentUrl - Full URL to the bill or retainer page (e.g. https://app.ignitegrowth.biz/retainer/company-slug/part or bills.ignitegrowth.biz/...)
 * @param {string} opts.amountFormatted - e.g. "$1,500.00" or "$1,500.00 / month"
 * @param {string} opts.companyName - Company name (for "Invoice for {companyName}" or "Retainer for {companyName}")
 * @param {string} [opts.description] - Optional line item or description
 * @param {boolean} [opts.isRetainer=false] - If true, copy says "Monthly retainer"; otherwise "Invoice"
 * @returns {string} HTML
 */
export function getBillPaymentLinkEmailHtml({
  paymentUrl,
  amountFormatted,
  companyName,
  description = '',
  isRetainer = false,
}) {
  const title = isRetainer
    ? `Monthly retainer for ${companyName}`
    : `Invoice for ${companyName}`;
  const ctaLabel = isRetainer ? 'View and pay retainer' : 'View and pay invoice';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(to right, #dc2626, #b91c1c); padding: 20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #ffffff;">Ignite Strategies LLC</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 4px;">
                    <span style="font-size: 13px; color: rgba(255,255,255,0.9);">${isRetainer ? 'Monthly retainer' : 'Invoice'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 8px; font-size: 15px; color: #374151;">${title}</p>
              <p style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827;">${amountFormatted}</p>
              ${description ? `<p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">${description}</p>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(to right, #dc2626, #b91c1c);">
                    <a href="${paymentUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">Secure payment powered by Stripe. If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280; word-break: break-all;">${paymentUrl}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">Thank you for your business.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Plain-text fallback (same content, no HTML).
 */
export function getBillPaymentLinkEmailText({
  paymentUrl,
  amountFormatted,
  companyName,
  description = '',
  isRetainer = false,
}) {
  const title = isRetainer
    ? `Monthly retainer for ${companyName}`
    : `Invoice for ${companyName}`;
  const lines = [
    title,
    '',
    `Amount: ${amountFormatted}`,
    ...(description ? ['', description] : []),
    '',
    `Pay here: ${paymentUrl}`,
    '',
    'Secure payment powered by Stripe.',
    '',
    'Thank you for your business.',
  ];
  return lines.join('\n');
}

/**
 * Default subject line for the email.
 */
export function getBillPaymentLinkEmailSubject({ companyName, isRetainer = false }) {
  return isRetainer
    ? `Your monthly retainer for ${companyName}`
    : `Invoice for ${companyName}`;
}
