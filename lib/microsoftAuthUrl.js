/**
 * Microsoft OAuth Authorization URL Generator
 * 
 * PURE SERVICE - No side effects, no dependencies, no context
 * 
 * This function's ONLY responsibility is to generate a Microsoft OAuth authorize URL.
 * It does NOT:
 * - Make API calls
 * - Check authentication
 * - Resolve ownerId
 * - Perform redirects
 * - Log anything
 * 
 * Input: OAuth parameters
 * Output: A single string URL
 */

/**
 * Builds Microsoft OAuth authorization URL
 * 
 * @param {Object} params
 * @param {string} params.clientId - Azure App Registration Client ID
 * @param {string} params.redirectUri - OAuth redirect URI (must match Azure config)
 * @param {string[]} params.scopes - Array of OAuth scopes
 * @param {string} params.state - OAuth state parameter (CSRF protection)
 * @returns {string} Microsoft OAuth authorization URL
 */
export function buildMicrosoftAuthorizeUrl({
  clientId,
  redirectUri,
  scopes,
  state,
}) {
  // Authority MUST be exact - supports personal + work/school accounts
  const authority = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code', // Authorization Code Flow
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes.join(' '),
    state: state,
  });

  return `${authority}?${params.toString()}`;
}

