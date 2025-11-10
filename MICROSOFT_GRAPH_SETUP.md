# Microsoft Graph API Integration Setup Guide

This guide explains how to set up and use Microsoft Graph API in your Next.js application.

## Prerequisites

1. **Azure AD App Registration**: You need to register an application in Azure Active Directory (Azure AD) to get a Client ID.

## Setup Steps

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in the details:
   - **Name**: Your app name (e.g., "Ignite BD")
   - **Supported account types**: Choose based on your needs (Single tenant, Multi-tenant, etc.)
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:3000` (for development) and your production URL
5. Click **Register**
6. Note your **Application (client) ID**

### 2. Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**
3. Add the following permissions:
   - `User.Read` - Read user profile
   - `Contacts.Read` - Read user contacts
   - `Contacts.ReadWrite` - Read and write user contacts
   - `Mail.Read` - Read user mail
   - `Mail.Send` - Send mail as user
   - `Calendars.Read` - Read user calendars
   - `Calendars.ReadWrite` - Read and write user calendars
4. Click **Add permissions**
5. **Important**: If this is for production, you may need admin consent for some permissions

### 3. Environment Variables

Add the following to your `.env.local` file:

```bash
# Microsoft Graph / Azure AD Configuration
NEXT_PUBLIC_AZURE_CLIENT_ID=your-client-id-here
NEXT_PUBLIC_AZURE_AUTHORITY=https://login.microsoftonline.com/common
# Optional: Use specific tenant
# NEXT_PUBLIC_AZURE_AUTHORITY=https://login.microsoftonline.com/{your-tenant-id}
```

### 4. Redirect URI Configuration

Make sure your redirect URIs are configured correctly in Azure AD:
- Development: `http://localhost:3000`
- Production: `https://your-production-domain.com`

## Usage

### Using the Hook in Components

```jsx
'use client';

import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';

export default function MyComponent() {
  const {
    signIn,
    signOut,
    isAuthenticated,
    user,
    hydrateContacts,
    sendMessage,
    getCalendarEvents,
    loading,
    error,
  } = useMicrosoftGraph();

  const handleSignIn = async () => {
    const result = await signIn();
    if (result.success) {
      console.log('Signed in successfully');
    }
  };

  const handleFetchContacts = async () => {
    const result = await hydrateContacts();
    if (result.success) {
      console.log(`Fetched ${result.count} contacts`);
      console.log(result.contacts);
    }
  };

  const handleSendEmail = async () => {
    try {
      await sendMessage({
        subject: 'Test Email',
        body: '<p>This is a test email</p>',
        toRecipients: ['recipient@example.com'],
        contentType: 'HTML',
      });
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        <button onClick={handleSignIn}>Sign in with Microsoft</button>
      ) : (
        <>
          <p>Welcome, {user?.displayName || user?.mail}</p>
          <button onClick={handleFetchContacts}>Fetch Contacts</button>
          <button onClick={handleSendEmail}>Send Email</button>
          <button onClick={signOut}>Sign Out</button>
        </>
      )}
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### API Methods Available

#### Authentication
- `signIn()` - Sign in with Microsoft account
- `signOut()` - Sign out from Microsoft account
- `isAuthenticated` - Boolean indicating if user is authenticated
- `user` - User profile object

#### Contacts
- `hydrateContacts()` - Fetch all contacts from Microsoft Graph
- `createContact(contactData)` - Create a new contact

#### Messaging
- `sendMessage(message)` - Send an email via Microsoft Graph
  - `message.subject` - Email subject (required)
  - `message.body` - Email body (required)
  - `message.toRecipients` - Array of recipient email addresses (required)
  - `message.ccRecipients` - Array of CC email addresses (optional)
  - `message.bccRecipients` - Array of BCC email addresses (optional)
  - `message.contentType` - 'HTML' or 'Text' (default: 'HTML')

#### Calendar
- `getCalendarEvents(startDateTime, endDateTime)` - Fetch calendar events
  - `startDateTime` - ISO 8601 format (optional)
  - `endDateTime` - ISO 8601 format (optional)

### Server-Side API Routes

The integration includes server-side API routes for Microsoft Graph operations:

#### GET `/api/microsoft-graph/contacts`
Fetch contacts from Microsoft Graph (server-side).

**Query Parameters:**
- `accessToken` - Microsoft Graph access token (required)

**Headers:**
- `Authorization: Bearer <firebase-token>` - Firebase authentication token (required)

#### POST `/api/microsoft-graph/send-mail`
Send email via Microsoft Graph (server-side).

**Body:**
```json
{
  "accessToken": "microsoft-graph-access-token",
  "subject": "Email subject",
  "body": "Email body",
  "toRecipients": ["recipient@example.com"],
  "ccRecipients": ["cc@example.com"], // optional
  "bccRecipients": ["bcc@example.com"], // optional
  "contentType": "HTML" // optional, default: "HTML"
}
```

**Headers:**
- `Authorization: Bearer <firebase-token>` - Firebase authentication token (required)

## File Structure

```
src/
  ├── lib/
  │   ├── microsoftGraph.js          # Microsoft Graph service and MSAL setup
  │   └── microsoftGraphConfig.js    # Configuration file
  ├── hooks/
  │   └── useMicrosoftGraph.js       # React hook for Microsoft Graph
  └── app/
      └── api/
          └── microsoft-graph/
              ├── contacts/
              │   └── route.js       # Server-side contacts API
              └── send-mail/
                  └── route.js       # Server-side send mail API
```

## Troubleshooting

### "Microsoft Graph configuration is missing" Error
- Make sure `NEXT_PUBLIC_AZURE_CLIENT_ID` is set in your `.env.local` file
- Restart your development server after adding environment variables

### "interaction_required" Error
- This usually means the user needs to sign in again or grant additional permissions
- The hook will automatically trigger a popup login when this occurs

### Redirect URI Mismatch
- Make sure the redirect URI in Azure AD matches your application URL exactly
- For development: `http://localhost:3000`
- For production: Your actual production URL

### Permission Denied Errors
- Check that all required API permissions are added in Azure AD
- Some permissions may require admin consent
- Make sure the user has granted consent for the application

## Additional Resources

- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/overview)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

