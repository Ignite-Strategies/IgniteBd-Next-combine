/**
 * Microsoft OAuth Guardrails
 * 
 * Enforces critical invariants to prevent common OAuth configuration mistakes:
 * 
 * 1. AZURE_CLIENT_ID must ALWAYS be used as client_id in OAuth requests
 * 2. AZURE_TENANT_ID must NEVER be used for user login flows
 * 3. Authority for user login must ALWAYS be "common" (multi-tenant)
 * 
 * Why these rules matter:
 * - Using tenant ID as client_id breaks personal Microsoft accounts (@live.com, @outlook.com)
 * - Using tenant-specific authority prevents work/school accounts from other orgs
 * - Microsoft OAuth returns authorization code (?code=), NOT access token
 * - Access tokens are only obtained after exchanging the code server-side
 */

/**
 * Validates Microsoft OAuth configuration before redirecting to Microsoft
 * 
 * Throws immediately if:
 * - client_id equals AZURE_TENANT_ID (common mistake)
 * - authority URL contains tenant UUID instead of "common"
 * 
 * @param {string} clientId - The client_id to validate
 * @param {string} authority - The authority URL to validate
 * @throws {Error} If configuration is invalid
 */
export function assertValidMicrosoftOAuthConfig(clientId, authority) {
  const azureClientId = process.env.AZURE_CLIENT_ID;
  const azureTenantId = process.env.AZURE_TENANT_ID;

  if (!azureClientId) {
    throw new Error('AZURE_CLIENT_ID environment variable is required');
  }

  // CRITICAL: client_id must be AZURE_CLIENT_ID, never AZURE_TENANT_ID
  // Tenant ID is a UUID that identifies an organization
  // Client ID is a GUID that identifies the application registration
  // Using tenant ID as client_id silently breaks personal Microsoft accounts
  if (azureTenantId && clientId === azureTenantId) {
    throw new Error(
      'Invalid OAuth config: tenant ID used as client_id. ' +
      'AZURE_TENANT_ID must NEVER be used for user login flows. ' +
      'Use AZURE_CLIENT_ID instead. ' +
      'Using tenant ID breaks personal Microsoft accounts (@live.com, @outlook.com).'
    );
  }

  // Ensure client_id matches AZURE_CLIENT_ID
  if (clientId !== azureClientId) {
    throw new Error(
      `Invalid OAuth config: client_id must equal AZURE_CLIENT_ID. ` +
      `Got: ${clientId?.substring(0, 8)}..., Expected: ${azureClientId?.substring(0, 8)}...`
    );
  }

  // CRITICAL: Authority for user login must be "common" (multi-tenant)
  // Using tenant-specific authority (e.g., /{tenant-id}/) prevents:
  // - Personal Microsoft accounts from signing in
  // - Work/school accounts from other organizations
  // 
  // Tenant-specific authority is ONLY valid for token refresh AFTER initial OAuth
  const expectedAuthority = 'https://login.microsoftonline.com/common';
  if (authority !== expectedAuthority) {
    // Check if authority contains a tenant UUID (common mistake)
    if (azureTenantId && authority.includes(azureTenantId)) {
      throw new Error(
        'Invalid OAuth config: authority contains tenant ID. ' +
        'Authority for user login must be "https://login.microsoftonline.com/common" ' +
        'to support personal accounts and multi-tenant scenarios. ' +
        'Tenant-specific authority breaks personal Microsoft accounts.'
      );
    }
    
    throw new Error(
      `Invalid OAuth config: authority must be "https://login.microsoftonline.com/common" for user login. ` +
      `Got: ${authority}. ` +
      `Tenant-specific authority prevents personal accounts and multi-tenant sign-in.`
    );
  }
}

/**
 * Gets the validated Microsoft OAuth client ID
 * 
 * @returns {string} AZURE_CLIENT_ID
 * @throws {Error} If AZURE_CLIENT_ID is not set
 */
export function getMicrosoftClientId() {
  const clientId = process.env.AZURE_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID environment variable is required');
  }

  // Guardrail: Ensure it's not accidentally set to tenant ID
  const tenantId = process.env.AZURE_TENANT_ID;
  if (tenantId && clientId === tenantId) {
    throw new Error(
      'Configuration error: AZURE_CLIENT_ID equals AZURE_TENANT_ID. ' +
      'These must be different values. Client ID identifies the app, tenant ID identifies the org.'
    );
  }

  return clientId;
}

/**
 * Gets the Microsoft OAuth authority for user login
 * 
 * Always returns "common" for multi-tenant support.
 * 
 * NOTE: Tenant-specific authority is ONLY used for token refresh
 * after the initial OAuth flow completes. Never use tenant authority
 * for the initial login/callback flow.
 * 
 * @returns {string} "https://login.microsoftonline.com/common"
 */
export function getMicrosoftAuthority() {
  return 'https://login.microsoftonline.com/common';
}
