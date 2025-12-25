import sgMail from '@sendgrid/mail';

// Lazy initialization flag to avoid build-time execution
let sendGridInitialized = false;

/**
 * Initialize SendGrid API key (lazy evaluation to avoid build-time execution)
 * Environment variables should only be accessed at runtime, not during module load
 */
function initializeSendGrid() {
  if (sendGridInitialized) {
    return;
  }
  
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    sendGridInitialized = true;
    console.log('✅ SendGrid initialized for outreach');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not found - outreach email sending will fail');
  }
}

/**
 * Get SendGrid API key (lazy evaluation)
 */
function getSendGridApiKey() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.');
  }
  return apiKey;
}

/**
 * SendGrid Email Generator Service
 * 
 * This service handles sending emails via SendGrid API using verified sender information.
 * 
 * Flow:
 * 1. Route (/api/outreach/send) grabs verified sender email and name from owner record
 * 2. Route passes subject line, body, and verified sender info to this service
 * 3. Service constructs SendGrid message with verified sender
 * 4. Service pushes email via SendGrid API (sgMail.send)
 * 5. Returns messageId and statusCode for tracking
 * 
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.toName - Recipient name (optional)
 * @param {string} params.subject - Email subject line (required)
 * @param {string} params.body - Email body HTML (required)
 * @param {string} params.ownerId - Owner ID for webhook mapping (required)
 * @param {string} params.contactId - Contact ID (optional)
 * @param {string} params.tenantId - Tenant ID (optional)
 * @param {string} params.campaignId - Campaign ID (optional, for campaign tracking)
 * @param {string} params.sequenceId - Sequence ID (optional, for sequence tracking)
 * @param {string} params.sequenceStepId - Sequence step ID (optional, for step tracking)
 * @param {string} params.from - Verified sender email (required - must be verified in SendGrid)
 * @param {string} params.fromName - Verified sender name (optional, from owner.sendgridVerifiedName)
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
  // Lazy initialize SendGrid (runtime only, not build-time)
  initializeSendGrid();
  
  if (!getSendGridApiKey()) {
    throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.');
  }

  if (!to || !subject || !body || !ownerId) {
    throw new Error('to, subject, body, and ownerId are required');
  }

  // ENFORCEMENT: from email is required and must be verified
  if (!from) {
    throw new Error('Sender not verified. Please verify your sender identity before sending emails.');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(from)) {
    console.error('❌ Invalid sender email format:', from);
    throw new Error(`Invalid sender email format: ${from}. Please verify your sender identity again.`);
  }

  // Use provided from email (must be verified in SendGrid)
  // Normalize email to lowercase for consistency
  const fromEmail = from.trim().toLowerCase();
  const fromNameValue = (fromName || '').trim();
  
  console.log('📧 Preparing SendGrid message:', {
    fromEmail,
    fromName: fromNameValue || '(no name)',
    to,
    subject,
    bodyLength: body?.length,
  });

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
    console.log(`   Message object:`, JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      hasBody: !!msg.html,
      bodyLength: msg.html?.length,
      customArgs: msg.customArgs,
    }));

    const response = await sgMail.send(msg);
    const statusCode = response[0]?.statusCode;
    const messageId = response[0]?.headers?.['x-message-id'] || response[0]?.headers?.['X-Message-Id'] || null;

    if (!messageId) {
      console.warn('⚠️ SendGrid response missing messageId header - webhook tracking may fail');
      console.warn('⚠️ Response headers:', JSON.stringify(response[0]?.headers || {}));
    }

    console.log(`✅ Outreach email sent successfully`);
    console.log(`   MessageId: ${messageId || 'MISSING'}`);
    console.log(`   StatusCode: ${statusCode}`);
    console.log(`   Full response:`, JSON.stringify(response[0] || {}));

    return {
      statusCode,
      messageId,
    };
  } catch (error) {
    console.error('❌ SendGrid outreach error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusCode: error.response.statusCode,
        body: error.response.body,
        headers: error.response.headers,
      } : null,
    });
    
    if (error.response) {
      const { body, statusCode } = error.response;
      const errorDetails = body?.errors?.[0] || {};
      const errorMessage = errorDetails.message || JSON.stringify(body);
      const errorField = errorDetails.field || null;
      
      console.error('📋 SendGrid error details:', {
        statusCode,
        errorMessage,
        errorField,
        fullBody: JSON.stringify(body, null, 2),
      });
      
      // Check for sender verification issues
      if (errorMessage?.toLowerCase().includes('sender') || 
          errorMessage?.toLowerCase().includes('from') ||
          errorMessage?.toLowerCase().includes('unverified') ||
          errorMessage?.toLowerCase().includes('not verified') ||
          errorField === 'from.email') {
        throw new Error(
          `SendGrid rejected sender email "${fromEmail}". ` +
          `This email is not verified in SendGrid. ` +
          `Please verify this sender in SendGrid dashboard (Settings > Sender Authentication) before sending. ` +
          `Error: ${errorMessage}`
        );
      }
      
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

