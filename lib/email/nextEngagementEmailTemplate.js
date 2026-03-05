import { getTodayEST, formatDateLabelEST, dayDiffEST, formatDateEST } from '@/lib/dateEst';

/**
 * Format next engagement data as HTML email — mirrors the Outreach Tracker layout.
 * Columns: Contact (name + title + company + email), Last Engagement, Next Follow-Up, Status
 */
export function formatNextEngagementEmailHtml(nextEngagements, customMessage = null) {
  const todayEST = getTodayEST();

  // Group by next engagement date
  const grouped = {};
  for (const item of nextEngagements) {
    const dateKey = item.nextEngagementDate || '';
    if (!dateKey) continue;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const fullName = (item) => {
    const parts = [item.firstName, item.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (item.email || '—');
  };

  const sectionLabel = (dateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, dateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || dateKey;
  };

  const statusBadge = (dateKey) => {
    const diff = dayDiffEST(todayEST, dateKey);
    if (diff === null) return { label: '—', bg: '#f3f4f6', color: '#6b7280' };
    if (diff < 0) return { label: `Overdue (${Math.abs(diff)}d)`, bg: '#fee2e2', color: '#991b1b' };
    if (diff === 0) return { label: 'Due today', bg: '#fef9c3', color: '#713f12' };
    return { label: `Due in ${diff}d`, bg: '#dbeafe', color: '#1e40af' };
  };

  const formatShortDate = (isoStr) => {
    if (!isoStr) return '—';
    return formatDateEST(isoStr.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const engagementTypeLabel = (type) => {
    const labels = {
      OUTBOUND_EMAIL: 'Outbound email',
      CONTACT_RESPONSE: 'Contact response',
      MEETING: 'Meeting',
      MANUAL: 'Manual',
    };
    return labels[type] || '';
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Next Engagement Report</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f9fafb;color:#111827;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f9fafb;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="700" style="max-width:700px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:24px 28px;">
              <h1 style="margin:0;color:#92400e;font-size:22px;font-weight:700;">Next Engagement Report</h1>
              <p style="margin:6px 0 0;color:#78350f;font-size:14px;">${escapeHtml(String(nextEngagements.length))} contact${nextEngagements.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </td>
          </tr>
`;

  if (customMessage && customMessage.trim()) {
    html += `
          <!-- Custom Message -->
          <tr>
            <td style="padding:20px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:4px;">
                <tr><td style="padding:14px 16px;"><p style="margin:0;color:#0c4a6e;font-size:14px;line-height:1.6;">${escapeHtml(customMessage.trim()).replace(/\n/g, '<br>')}</p></td></tr>
              </table>
            </td>
          </tr>
`;
  }

  if (sortedDates.length === 0) {
    html += `
          <tr><td style="padding:40px 28px;text-align:center;color:#6b7280;font-size:15px;">No next engagements found.</td></tr>
`;
  } else {
    for (const dateKey of sortedDates) {
      const items = grouped[dateKey];
      const label = sectionLabel(dateKey);

      // Date group header
      html += `
          <!-- Date Group: ${escapeHtml(label)} -->
          <tr>
            <td style="padding:20px 28px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fef3c7;padding:10px 14px;border-left:4px solid #f59e0b;border-radius:4px;">
                    <span style="font-size:13px;font-weight:600;color:#78350f;">📅 ${escapeHtml(label)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Table header -->
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr style="background-color:#f9fafb;">
                  <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:35%;">Contact</td>
                  <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:20%;">Last Engagement</td>
                  <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:20%;">Next Follow-Up</td>
                  <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;width:25%;">Status</td>
                </tr>
`;

      for (const item of items) {
        const badge = statusBadge(dateKey);
        const lastEngStr = item.lastEngagementDate ? formatShortDate(item.lastEngagementDate) : '—';
        const lastEngType = item.lastEngagementType ? engagementTypeLabel(item.lastEngagementType) : '';
        const nextEngStr = formatShortDate(dateKey);

        html += `
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:12px 12px;vertical-align:top;">
                    <div style="font-size:14px;font-weight:600;color:#111827;">${escapeHtml(fullName(item))}${item.title ? `<span style="font-size:12px;font-weight:400;color:#9ca3af;margin-left:6px;">${escapeHtml(item.title)}</span>` : ''}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${item.company ? `<span style="font-weight:500;color:#374151;">${escapeHtml(item.company)}</span> · ` : ''}${item.email ? escapeHtml(item.email) : ''}</div>
                  </td>
                  <td style="padding:12px 12px;vertical-align:top;">
                    <div style="font-size:13px;color:#374151;">${escapeHtml(lastEngStr)}</div>
                    ${lastEngType ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(lastEngType)}</div>` : ''}
                  </td>
                  <td style="padding:12px 12px;vertical-align:top;">
                    <div style="font-size:13px;color:#374151;">${escapeHtml(nextEngStr)}</div>
                  </td>
                  <td style="padding:12px 12px;vertical-align:top;">
                    <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background-color:${badge.bg};color:${badge.color};">${escapeHtml(badge.label)}</span>
                  </td>
                </tr>
`;
      }

      html += `
              </table>
            </td>
          </tr>
`;
    }
  }

  html += `
          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Ignite BD · Next Engagement Report</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

/**
 * Plain text version — mirrors the same structure.
 */
export function formatNextEngagementEmailText(nextEngagements, customMessage = null) {
  const todayEST = getTodayEST();

  const grouped = {};
  for (const item of nextEngagements) {
    const dateKey = item.nextEngagementDate || '';
    if (!dateKey) continue;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const fullName = (item) => {
    const parts = [item.firstName, item.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : (item.email || '—');
  };

  const sectionLabel = (dateKey) => {
    const { label, actual } = formatDateLabelEST(todayEST, dateKey);
    if (label === 'Today') return 'Due today';
    if (label === 'Tomorrow') return 'Due tomorrow';
    if (label === 'Yesterday') return 'Yesterday';
    return actual || dateKey;
  };

  const statusLabel = (dateKey) => {
    const diff = dayDiffEST(todayEST, dateKey);
    if (diff === null) return '—';
    if (diff < 0) return `Overdue (${Math.abs(diff)}d)`;
    if (diff === 0) return 'Due today';
    return `Due in ${diff}d`;
  };

  const engagementTypeLabel = (type) => {
    const labels = { OUTBOUND_EMAIL: 'Outbound', CONTACT_RESPONSE: 'Response', MEETING: 'Meeting', MANUAL: 'Manual' };
    return labels[type] || '';
  };

  let text = `NEXT ENGAGEMENT REPORT\n${'='.repeat(60)}\n`;
  text += `${nextEngagements.length} contact${nextEngagements.length !== 1 ? 's' : ''} · ${new Date().toLocaleDateString()}\n\n`;

  if (customMessage && customMessage.trim()) {
    text += `${customMessage.trim()}\n\n${'-'.repeat(60)}\n\n`;
  }

  if (sortedDates.length === 0) {
    text += 'No next engagements found.\n';
  } else {
    for (const dateKey of sortedDates) {
      const items = grouped[dateKey];
      text += `\n${sectionLabel(dateKey).toUpperCase()}\n${'-'.repeat(60)}\n`;
      text += `${'CONTACT'.padEnd(30)} ${'LAST ENGAGEMENT'.padEnd(20)} ${'NEXT FOLLOW-UP'.padEnd(16)} STATUS\n`;
      text += `${'-'.repeat(60)}\n`;

      for (const item of items) {
        const nameStr = fullName(item).slice(0, 28).padEnd(30);
        const lastStr = item.lastEngagementDate
          ? `${item.lastEngagementDate.slice(0, 10)}${item.lastEngagementType ? ` (${engagementTypeLabel(item.lastEngagementType)})` : ''}`
          : '—';
        const nextStr = dateKey;
        const status = statusLabel(dateKey);

        text += `${nameStr} ${lastStr.slice(0, 18).padEnd(20)} ${nextStr.padEnd(16)} ${status}\n`;
        if (item.company || item.title) {
          text += `  ${[item.title, item.company].filter(Boolean).join(' · ')}\n`;
        }
        if (item.email) text += `  ${item.email}\n`;
        text += '\n';
      }
    }
  }

  text += `\n${'='.repeat(60)}\nIgnite BD · Next Engagement Report\n`;
  return text;
}
