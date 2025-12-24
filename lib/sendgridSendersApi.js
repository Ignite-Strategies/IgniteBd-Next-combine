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
    // Extract detailed error information
    const errorDetails = data?.errors?.[0] || {};
    const errorMessage = errorDetails.message || data?.message || `SendGrid API error: ${response.status}`;
    
    // Provide helpful guidance for common errors
    if (response.status === 403 || errorMessage.toLowerCase().includes('forbidden') || errorMessage.toLowerCase().includes('access')) {
      throw new Error(
        `SendGrid API access forbidden. Your API key needs "Sender Management" or "Full Access" permissions. ` +
        `Current key may only have "Mail Send" permission. ` +
        `Please update your API key in SendGrid Settings → API Keys. ` +
        `Error: ${errorMessage}`
      );
    }
    
    throw new Error(errorMessage);
  }

  return data;
}

/**
 * List all senders (verified and unverified)
 * GET /v3/senders
 * 
 * This is the ONLY endpoint we should use for fetching senders.
 * Filter client-side for verified === true
 */
export async function listSenders() {
  try {
    const data = await sendGridRequest('GET', '/senders');
    // SendGrid returns array directly, not wrapped in results
    const senders = Array.isArray(data) ? data : (data.results || []);
    return {
      success: true,
      senders: senders,
    };
  } catch (error) {
    console.error('Failed to list senders:', error);
    throw error;
  }
}

/**
 * @deprecated Use listSenders() instead
 * List all verified senders
 * GET /v3/verified_senders
 */
export async function listVerifiedSenders() {
  // Redirect to the correct endpoint
  return listSenders();
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
 * Create a sender in SendGrid (sends verification email)
 * POST /v3/senders
 * 
 * This creates a sender and sends a verification email to the sender's email address
 * The user must click the verification link in their email to complete verification
 */
export async function createVerifiedSender(senderData) {
  try {
    const data = await sendGridRequest('POST', '/senders', senderData);
    return {
      success: true,
      sender: data,
      message: 'Verification email sent. Please check your inbox.',
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

