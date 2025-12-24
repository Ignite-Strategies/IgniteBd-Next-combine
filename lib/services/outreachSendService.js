import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized for outreach');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not found - outreach email sending will fail');
}

/**
 * Send outreach email via SendGrid
 * Uses verified sender from owner or environment variables
 * Includes customArgs for webhook mapping
 * Supports campaigns and sequences (Apollo-like)
 * 
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.toName - Recipient name (optional)
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body (HTML)
 * @param {string} params.ownerId - Owner ID for webhook mapping
 * @param {string} params.contactId - Contact ID (optional)
 * @param {string} params.tenantId - Tenant ID (optional)
 * @param {string} params.campaignId - Campaign ID (optional, for campaign tracking)
 * @param {string} params.sequenceId - Sequence ID (optional, for sequence tracking)
 * @param {string} params.sequenceStepId - Sequence step ID (optional, for step tracking)
 * @param {string} params.from - Sender email (required - must be verified in SendGrid)
 * @param {string} params.fromName - Sender name (optional)
 * @returns {Promise<Object>} { statusCode, messageId }
 */
export async function sendOutreachEmail({
  to,
  toName,
  subject,
  body,
  ownerId,
  contactId = null,
  tenantId = null,
  campaignId = null,
  sequenceId = null,
  sequenceStepId = null,
  from = null,
  fromName = null,
}) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.');
  }

  if (!to || !subject || !body || !ownerId) {
    throw new Error('to, subject, body, and ownerId are required');
  }

  // ENFORCEMENT: from email is required and must be verified
  if (!from) {
    throw new Error('Sender not verified. Please verify your sender identity before sending emails.');
  }

  // Use provided from email (must be verified in SendGrid)
  const fromEmail = from;
  const fromNameValue = fromName || '';

  // Prepare email message with customArgs for webhook mapping
  const msg = {
    to: {
      email: to,
      name: toName || to.split('@')[0],
    },
    from: {
      email: fromEmail,
      name: fromNameValue,
    },
    subject,
    html: body,
    // Custom arguments for webhook event mapping (Apollo-like tracking)
    customArgs: {
      ownerId: ownerId.toString(),
      ...(contactId && { contactId: contactId.toString() }),
      ...(tenantId && { tenantId: tenantId.toString() }),
      ...(campaignId && { campaignId: campaignId.toString() }),
      ...(sequenceId && { sequenceId: sequenceId.toString() }),
      ...(sequenceStepId && { sequenceStepId: sequenceStepId.toString() }),
    },
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };

  try {
    console.log(`📧 Sending outreach email to ${to}...`);
    console.log(`   Subject: ${subject}`);
    console.log(`   From: ${fromEmail}${fromNameValue ? ` (${fromNameValue})` : ''}`);
    console.log(`   OwnerId: ${ownerId}`);
    console.log(`   ContactId: ${contactId || 'none'}`);
    console.log(`   TenantId: ${tenantId || 'none'}`);
    console.log(`   CampaignId: ${campaignId || 'none'}`);
    console.log(`   SequenceId: ${sequenceId || 'none'}`);
    console.log(`   SequenceStepId: ${sequenceStepId || 'none'}`);
    console.log(`   CustomArgs:`, JSON.stringify(msg.customArgs));

    const response = await sgMail.send(msg);
    const statusCode = response[0]?.statusCode;
    const messageId = response[0]?.headers?.['x-message-id'] || response[0]?.headers?.['X-Message-Id'] || null;

    if (!messageId) {
      console.warn('⚠️ SendGrid response missing messageId header - webhook tracking may fail');
    }

    console.log(`✅ Outreach email sent successfully`);
    console.log(`   MessageId: ${messageId || 'MISSING'}`);
    console.log(`   StatusCode: ${statusCode}`);

    return {
      statusCode,
      messageId,
    };
  } catch (error) {
    console.error('❌ SendGrid outreach error:', error);
    
    if (error.response) {
      const { body, statusCode } = error.response;
      const errorMessage = body?.errors?.[0]?.message || JSON.stringify(body);
      
      // Provide user-friendly error messages for common issues
      if (statusCode === 401) {
        if (errorMessage?.toLowerCase().includes('credits') || errorMessage?.toLowerCase().includes('exceeded')) {
          throw new Error('SendGrid account has exceeded its email credits. Please upgrade your SendGrid plan or wait for credits to reset.');
        }
        throw new Error('SendGrid authentication failed. Please check your API key configuration.');
      }
      
      if (statusCode === 403) {
        throw new Error('SendGrid API key does not have permission to send emails. Please check API key permissions.');
      }
      
      throw new Error(`SendGrid API error (${statusCode}): ${errorMessage}`);
    }
    
    throw error;
  }
}

