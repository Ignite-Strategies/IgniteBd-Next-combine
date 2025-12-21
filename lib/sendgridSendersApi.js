/**
 * SendGrid Senders API Client
 * 
 * Manages verified sender identities via SendGrid REST API
 * Documentation: https://docs.sendgrid.com/api-reference/senders
 */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_API_BASE = 'https://api.sendgrid.com/v3';

/**
 * Make authenticated request to SendGrid API
 */
async function sendGridRequest(method, endpoint, body = null) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured');
  }

  const url = `${SENDGRID_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.errors?.[0]?.message || data?.message || `SendGrid API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

/**
 * List all verified senders
 * GET /v3/verified_senders
 */
export async function listVerifiedSenders() {
  try {
    const data = await sendGridRequest('GET', '/verified_senders');
    return {
      success: true,
      senders: data.results || [],
    };
  } catch (error) {
    console.error('Failed to list verified senders:', error);
    throw error;
  }
}

/**
 * Get a specific verified sender by ID
 * GET /v3/verified_senders/{id}
 */
export async function getVerifiedSender(senderId) {
  try {
    const data = await sendGridRequest('GET', `/verified_senders/${senderId}`);
    return {
      success: true,
      sender: data,
    };
  } catch (error) {
    console.error('Failed to get verified sender:', error);
    throw error;
  }
}

/**
 * Create/initiate verification for a new sender
 * POST /v3/verified_senders
 * 
 * @param {Object} senderData
 * @param {Object} senderData.from - From object with email and name
 * @param {string} senderData.from.email - Email address
 * @param {string} senderData.from.name - Display name
 * @param {Object} senderData.reply_to - Reply-to object (optional)
 * @param {string} senderData.reply_to.email - Reply-to email
 */
export async function createVerifiedSender(senderData) {
  try {
    // SendGrid API expects specific format
    const payload = {
      from: senderData.from,
      reply_to: senderData.reply_to || senderData.from, // Use from email as reply-to if not specified
    };
    
    const data = await sendGridRequest('POST', '/verified_senders', payload);
    return {
      success: true,
      sender: data,
    };
  } catch (error) {
    console.error('Failed to create verified sender:', error);
    throw error;
  }
}

/**
 * Resend verification email for a sender
 * POST /v3/verified_senders/{id}/resend
 */
export async function resendVerification(senderId) {
  try {
    const data = await sendGridRequest('POST', `/verified_senders/${senderId}/resend`);
    return {
      success: true,
      message: 'Verification email sent',
    };
  } catch (error) {
    console.error('Failed to resend verification:', error);
    throw error;
  }
}

/**
 * Delete a verified sender
 * DELETE /v3/verified_senders/{id}
 */
export async function deleteVerifiedSender(senderId) {
  try {
    await sendGridRequest('DELETE', `/verified_senders/${senderId}`);
    return {
      success: true,
      message: 'Sender deleted',
    };
  } catch (error) {
    console.error('Failed to delete verified sender:', error);
    throw error;
  }
}

