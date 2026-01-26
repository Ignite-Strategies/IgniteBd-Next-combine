// Microsoft OAuth token exchange service.
// This is server-only infrastructure and must not be coupled to identity,
// navigation, or database persistence.

/**
 * Exchanges Microsoft OAuth authorization code for access tokens
 * 
 * SERVER-ONLY: This function runs only on the server.
 * It does NOT:
 * - Use Axios
 * - Perform redirects
 * - Write to database
 * - Use Firebase
 * - Resolve ownerId
 * - Log beyond errors
 * 
 * This is pure infrastructure - it only exchanges code for tokens.
 * 
 * @param {Object} params
 * @param {string} params.code - Authorization code from Microsoft OAuth callback
 * @param {string} params.redirectUri - OAuth redirect URI (must match login request)
 * @returns {Promise<Object>} Token data: { accessToken, refreshToken, expiresAt, tenantId, email?, displayName? }
 */
export async function exchangeMicrosoftAuthCode({
  code,
  redirectUri,
}) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Azure OAuth configuration missing: AZURE_CLIENT_ID and AZURE_CLIENT_SECRET required');
  }

  // Token exchange endpoint (EXACT)
  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  // POST form-encoded body (required format for Microsoft)
  const formData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  });

  // Exchange code for tokens (server-side fetch, NOT Axios)
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft token exchange failed: ${response.status} ${errorText}`);
  }

  const tokenData = await response.json();

  // Extract tokens from response
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour if not provided

  // Compute expiration time
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Extract tenant ID and user info from ID token
  let tenantId = null;
  let email = null;
  let displayName = null;

  if (tokenData.id_token) {
    try {
      // ID token is JWT: header.payload.signature
      const idTokenParts = tokenData.id_token.split('.');
      if (idTokenParts.length === 3) {
        // Decode payload (base64url)
        const payload = JSON.parse(
          Buffer.from(idTokenParts[1], 'base64url').toString('utf-8')
        );

        // Extract tenant ID (tid)
        tenantId = payload.tid || null;

        // Extract email (preferred_username or email)
        email = payload.preferred_username || payload.email || null;

        // Extract display name
        displayName = payload.name || payload.given_name || null;
      }
    } catch (err) {
      // Non-critical: ID token decode failed, but we still have access token
      console.error('Failed to decode ID token:', err);
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tenantId,
    email,
    displayName,
  };
}







