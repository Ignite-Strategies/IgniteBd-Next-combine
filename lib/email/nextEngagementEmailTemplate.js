import { getTodayEST, formatDateLabelEST } from '@/lib/dateEst';

/**
 * Format next engagement data as HTML email
 */
export function formatNextEngagementEmailHtml(nextEngagements, customMessage = null) {
  const todayEST = getTodayEST();
  
  // Group by date
  const grouped = {};
  for (const item of nextEngagements) {
    const dateKey = item.nextEngagementDate || '';
    if (!dateKey) continue;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const purposeLabel = (purpose) => {
    if (!purpose) return 'Follow-up';
    const labels = {
      GENERAL_CHECK_IN: 'General check-in',
      UNRESPONSIVE: 'Unresponsive',
      PERIODIC_CHECK_IN: 'Periodic check-in',
      REFERRAL_NO_CONTACT: 'Referral (no contact)',
    };
    return labels[purpose] || purpose;
  };

  const formatDate = (dateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, dateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || dateKey;
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const name = (item) => {
    const parts = [item.firstName, item.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (item.email || '—');
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Next Engagement Report</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f9fafb;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #92400e; font-size: 24px; font-weight: 600;">Next Engagement Report</h1>
              <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px;">${escapeHtml(String(nextEngagements.length))} contact${nextEngagements.length !== 1 ? 's' : ''} with upcoming engagements</p>
            </td>
          </tr>
  `;

  // Add custom message if provided
  if (customMessage && customMessage.trim()) {
    const escapedMessage = escapeHtml(customMessage.trim()).replace(/\n/g, '<br>');
    html += `
          <!-- Custom Message -->
          <tr>
            <td style="padding: 20px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #0c4a6e; font-size: 15px; line-height: 1.6;">${escapedMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
    `;
  }

  if (sortedDates.length === 0) {
    html += `
          <tr>
            <td style="padding: 40px 24px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 15px;">No next engagements found.</p>
            </td>
          </tr>
    `;
  } else {
    for (const dateKey of sortedDates) {
      const items = grouped[dateKey];
      const sectionTitle = formatDate(dateKey);
      
      html += `
          <!-- Date Section -->
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: #fef3c7; padding: 12px 16px; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #78350f;">📅 ${escapeHtml(sectionTitle)}</h2>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
      `;

      for (const item of items) {
        const contactName = escapeHtml(name(item));
        const purpose = escapeHtml(purposeLabel(item.nextEngagementPurpose));
        const note = item.nextContactNote ? ` · ${escapeHtml(item.nextContactNote)}` : '';
        const email = item.email ? escapeHtml(item.email) : '';
        
        html += `
          <tr>
            <td style="padding: 0 24px 16px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-bottom: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 12px 0;">
                    <p style="margin: 0 0 4px 0; font-weight: 600; color: #111827; font-size: 15px;">${contactName}</p>
                    <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      ${purpose}${note}
                      ${email ? `<br><span style="color: #9ca3af;">${email}</span>` : ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `;
      }
    }
  }

  html += `
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">Generated on ${escapeHtml(new Date().toLocaleString())}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return html;
}

/**
 * Format next engagement data as plain text email
 */
export function formatNextEngagementEmailText(nextEngagements, customMessage = null) {
  const todayEST = getTodayEST();
  
  // Group by date
  const grouped = {};
  for (const item of nextEngagements) {
    const dateKey = item.nextEngagementDate || '';
    if (!dateKey) continue;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const purposeLabel = (purpose) => {
    if (!purpose) return 'Follow-up';
    const labels = {
      GENERAL_CHECK_IN: 'General check-in',
      UNRESPONSIVE: 'Unresponsive',
      PERIODIC_CHECK_IN: 'Periodic check-in',
      REFERRAL_NO_CONTACT: 'Referral (no contact)',
    };
    return labels[purpose] || purpose;
  };

  const formatDate = (dateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, dateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || dateKey;
  };

  const name = (item) => {
    const parts = [item.firstName, item.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (item.email || '—');
  };

  let text = `NEXT ENGAGEMENT REPORT\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `${nextEngagements.length} contact${nextEngagements.length !== 1 ? 's' : ''} with upcoming engagements\n\n`;

  // Add custom message if provided
  if (customMessage && customMessage.trim()) {
    text += `${customMessage.trim()}\n\n`;
    text += `${'-'.repeat(50)}\n\n`;
  }

  if (sortedDates.length === 0) {
    text += 'No next engagements found.\n';
  } else {
    for (const dateKey of sortedDates) {
      const items = grouped[dateKey];
      const sectionTitle = formatDate(dateKey);
      
      text += `\n${sectionTitle}\n`;
      text += `${'-'.repeat(50)}\n`;

      for (const item of items) {
        const contactName = name(item);
        const purpose = purposeLabel(item.nextEngagementPurpose);
        const note = item.nextContactNote ? ` · ${item.nextContactNote}` : '';
        
        text += `${contactName}\n`;
        text += `  ${purpose}${note}\n`;
        if (item.email) {
          text += `  ${item.email}\n`;
        }
        text += '\n';
      }
    }
  }

  text += `\n${'='.repeat(50)}\n`;
  text += `Generated on ${new Date().toLocaleString()}\n`;

  return text;
}
