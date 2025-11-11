# SendGrid Email Integration

## Overview

SendGrid is a better choice for outreach emails than Microsoft Graph API because:
- ✅ **No OAuth required** - Just an API key
- ✅ **Better for bulk emails** - Designed for transactional/bulk sending
- ✅ **More reliable** - Better deliverability than personal email APIs
- ✅ **Simpler setup** - No user authentication needed
- ✅ **Better analytics** - Open/click tracking built-in
- ✅ **No token management** - No refresh tokens, no expiration

## Architecture

### SendGrid Client (`/lib/sendgridClient.js`)
- `sendEmail(mailData)` - Send single email
- `sendBatchEmails(emails, delaySeconds)` - Send batch emails with delays
- `getSendGridConfig()` - Check configuration status

### API Routes
- `POST /api/email/send` - Send single or batch emails
- `GET /api/email/config` - Get SendGrid configuration status

## Environment Variables

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxx  # Your SendGrid API key
SENDGRID_FROM_EMAIL=noreply@ignitegrowth.biz  # Sender email (must be verified in SendGrid)
SENDGRID_FROM_NAME=IgniteGrowth  # Sender name
```

## Setup

### 1. Get SendGrid API Key

1. Sign up at [SendGrid](https://sendgrid.com)
2. Go to **Settings** > **API Keys**
3. Create a new API key with **Mail Send** permissions
4. Copy the API key (starts with `SG.`)

### 2. Verify Sender Domain

1. Go to **Settings** > **Sender Authentication**
2. Verify your domain (`ignitegrowth.biz`)
3. Add DNS records as instructed
4. Wait for verification (can take a few hours)

### 3. Set Environment Variables

Add to your deployment environment:
```bash
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM_EMAIL=noreply@ignitegrowth.biz
SENDGRID_FROM_NAME=IgniteGrowth
```

## Usage

### Send Single Email

```javascript
import api from '@/lib/api';

// Send single email
const response = await api.post('/api/email/send', {
  to: 'recipient@example.com',
  toName: 'John Doe',
  subject: 'Hello from IgniteGrowth',
  html: '<p>This is a test email</p>',
  text: 'This is a test email', // optional
});
```

### Send Batch Emails

```javascript
// Send batch emails
const response = await api.post('/api/email/send', {
  batch: true,
  emails: [
    {
      to: 'user1@example.com',
      toName: 'User 1',
      subject: 'Hello',
      html: '<p>Hello User 1</p>',
    },
    {
      to: 'user2@example.com',
      toName: 'User 2',
      subject: 'Hello',
      html: '<p>Hello User 2</p>',
    },
  ],
  delaySeconds: 2, // Delay between emails
});
```

### Check Configuration

```javascript
// Check if SendGrid is configured
const response = await api.get('/api/email/config');
console.log(response.data.configured); // true/false
```

## Benefits Over Microsoft Graph

| Feature | SendGrid | Microsoft Graph |
|---------|----------|-----------------|
| Setup | API key only | OAuth flow required |
| User Auth | Not needed | User must connect |
| Bulk Sending | ✅ Optimized | ⚠️ Rate limited |
| Deliverability | ✅ High | ⚠️ Personal inbox |
| Analytics | ✅ Built-in | ⚠️ Limited |
| Token Management | ✅ None | ❌ Refresh tokens |
| Domain Verification | ✅ One-time | ❌ Per user |

## Integration with Settings

The integrations page now shows:
1. **SendGrid Email** - Primary email sending (no auth needed)
2. **Microsoft Outlook** - Optional (for contact sync, personal sending)

## Migration from Microsoft Graph

If you were using Microsoft Graph, you can:
1. Keep both integrations (SendGrid for outreach, Microsoft for contacts)
2. Or switch entirely to SendGrid (simpler, no OAuth)

## Next Steps

1. ✅ Install `@sendgrid/mail` package
2. ✅ Set `SENDGRID_API_KEY` in environment variables
3. ✅ Verify sender domain in SendGrid
4. ✅ Test email sending via `/api/email/send`
5. ✅ Update outreach features to use SendGrid instead of Microsoft Graph

## Testing

```bash
# Test single email
curl -X POST https://ignitegrowth.biz/api/email/send \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test</p>"
  }'

# Check configuration
curl -X GET https://ignitegrowth.biz/api/email/config \
  -H "Authorization: Bearer <firebase-token>"
```

## Troubleshooting

### "SendGrid API key not configured"
- **Fix**: Set `SENDGRID_API_KEY` in environment variables

### "Sender email not verified"
- **Fix**: Verify sender domain in SendGrid dashboard

### "Rate limit exceeded"
- **Fix**: SendGrid free tier has limits. Upgrade plan or add delays between emails.

### "Email not delivered"
- **Check**: SendGrid activity feed for bounce/spam reports
- **Fix**: Verify domain, check spam filters, warm up IP (if dedicated IP)

## Summary

SendGrid is the better choice for outreach emails:
- ✅ Simpler (no OAuth)
- ✅ More reliable
- ✅ Better for bulk
- ✅ Better analytics
- ✅ No token management

Microsoft Graph is still useful for:
- Contact syncing
- Personal email sending
- Calendar integration

But for outreach campaigns, SendGrid is the way to go! 🚀

