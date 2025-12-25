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
    console.log('✅ SendGrid initialized');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not found - email sending will fail');
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
 * Send email via SendGrid
 * @param {Object} mailData - Email data
 * @param {string} mailData.to - Recipient email address
 * @param {string} mailData.toName - Recipient name (optional)
 * @param {string} mailData.subject - Email subject
 * @param {string} mailData.html - Email HTML body
 * @param {string} mailData.text - Email text body (optional)
 * @param {string} mailData.from - Sender email (optional, uses env default)
 * @param {string} mailData.fromName - Sender name (optional, uses env default)
 * @param {string[]} mailData.cc - CC recipients (optional)
 * @param {string[]} mailData.bcc - BCC recipients (optional)
 * @param {boolean} mailData.trackOpens - Enable open tracking (default: true)
 * @param {boolean} mailData.trackClicks - Enable click tracking (default: true)
 * @returns {Promise<Object>} SendGrid response
 */
export async function sendEmail(mailData) {
  // Lazy initialize SendGrid (runtime only, not build-time)
  initializeSendGrid();
  
  if (!getSendGridApiKey()) {
    throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.');
  }

  const {
    to,
    toName,
    subject,
    html,
    text,
    from,
    fromName,
    cc,
    bcc,
    trackOpens = true,
    trackClicks = true,
  } = mailData;

  if (!to || !subject || !html) {
    throw new Error('to, subject, and html are required');
  }

  // Get sender info from environment or use defaults
  const fromEmail = from || process.env.SENDGRID_FROM_EMAIL || 'noreply@ignitegrowth.biz';
  const fromNameValue = fromName || process.env.SENDGRID_FROM_NAME || 'IgniteGrowth';

  // Prepare email message
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
    html,
    ...(text && { text }),
    ...(cc && cc.length > 0 && { cc }),
    ...(bcc && bcc.length > 0 && { bcc }),
    trackingSettings: {
      clickTracking: { enable: trackClicks },
      openTracking: { enable: trackOpens },
    },
  };

  try {
    const response = await sgMail.send(msg);
    const statusCode = response[0]?.statusCode;
    const messageId = response[0]?.headers?.['x-message-id'] || response[0]?.headers?.['X-Message-Id'] || null;
    
    if (!messageId) {
      console.warn('⚠️ SendGrid response missing messageId header');
    }
    
    return {
      success: true,
      statusCode,
      messageId,
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    
    if (error.response) {
      const { body, statusCode } = error.response;
      throw new Error(
        `SendGrid API error (${statusCode}): ${body?.errors?.[0]?.message || JSON.stringify(body)}`
      );
    }
    
    throw error;
  }
}

/**
 * Send batch emails via SendGrid
 * @param {Object[]} emails - Array of email data objects
 * @param {number} delaySeconds - Delay between emails in seconds (default: 2)
 * @returns {Promise<Object>} Results with success/failure counts
 */
export async function sendBatchEmails(emails, delaySeconds = 2) {
  // Lazy initialize SendGrid (runtime only, not build-time)
  initializeSendGrid();
  
  if (!getSendGridApiKey()) {
    throw new Error('SendGrid API key not configured');
  }

  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('emails array is required and must not be empty');
  }

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < emails.length; i++) {
    const emailData = emails[i];
    
    try {
      const result = await sendEmail(emailData);
      results.push({
        to: emailData.to,
        status: 'success',
        messageId: result.messageId,
      });
      successCount++;
      
      console.log(`✅ ${i + 1}/${emails.length} sent to ${emailData.to}`);
    } catch (error) {
      results.push({
        to: emailData.to,
        status: 'failed',
        error: error.message,
      });
      failureCount++;
      
      console.error(`❌ ${i + 1}/${emails.length} failed for ${emailData.to}:`, error.message);
    }
    
    // Delay before next email (except last one)
    if (i < emails.length - 1 && delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  return {
    success: true,
    total: emails.length,
    sent: successCount,
    failed: failureCount,
    results,
  };
}

/**
 * Check if SendGrid is configured
 * @returns {Object} Configuration status
 */
export function getSendGridConfig() {
  // Lazy initialize SendGrid (runtime only, not build-time)
  initializeSendGrid();
  
  const apiKey = process.env.SENDGRID_API_KEY;
  return {
    configured: !!apiKey,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@ignitegrowth.biz',
    fromName: process.env.SENDGRID_FROM_NAME || 'IgniteGrowth',
  };
}

