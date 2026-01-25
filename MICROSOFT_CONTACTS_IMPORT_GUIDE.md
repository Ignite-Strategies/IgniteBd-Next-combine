# Microsoft Contacts Import - Quick Guide

## Two Ways to Import Contacts

After connecting your Microsoft account, you'll see two options:

### 1. 📧 **Ingest from Emails** (Email Contacts)

**What it does:**
- Scans your recent Outlook email messages (up to 200 messages)
- Extracts unique contacts from people you've emailed
- Shows statistics: message count, first contact date, last contact date

**What you get:**
- Email address
- Display name (parsed into first/last name)
- Domain
- Message statistics

**What's filtered out:**
- Automated emails (noreply@, no-reply@, etc.)
- Business service emails (SendGrid, MailChimp, Stripe, etc.)
- Service notifications

**Best for:**
- Finding people you've actually communicated with
- Building a contact list from your email history
- Seeing engagement stats (how often you email someone)

---

### 2. 👥 **Ingest from Contacts** (Microsoft Contacts Address Book)

**What it does:**
- Imports contacts directly from your Microsoft Contacts address book
- Shows which contacts already exist in your database
- Includes additional metadata when available

**What you get:**
- Email address
- Display name (parsed into first/last name)
- Domain
- **Company name** (when available)
- **Job title** (when available)
- Already exists indicator

**Best for:**
- Importing your saved contacts
- Getting complete contact information (company, title)
- One-time bulk import of your address book

---

## Key Differences

| Feature | Email Contacts | Actual Contacts |
|---------|---------------|-----------------|
| **Source** | Outlook email messages | Microsoft Contacts address book |
| **Data** | Email, name, stats | Email, name, company, job title |
| **Stats** | Message count, dates | None |
| **Company Info** | ❌ No | ✅ Yes (when available) |
| **Job Title** | ❌ No | ✅ Yes (when available) |
| **Already Exists** | ❌ Not shown | ✅ Shown |
| **Filtering** | ✅ Auto-filters automated emails | ✅ Auto-filters automated emails |

## How It Works

1. **Connect Microsoft** → OAuth flow to authorize access
2. **Choose Source** → Select "Emails" or "Contacts"
3. **Preview** → See up to 50 contacts (cached for 45 minutes)
4. **Select** → Check the contacts you want to import
5. **Import** → Contacts are saved to your database

## Technical Details

### Email Contacts API
- **Preview**: `GET /api/microsoft/email-contacts/preview`
- **Save**: `POST /api/microsoft/email-contacts/save`
- **Graph API**: `/me/messages` endpoint
- **Cache**: Redis key `preview:microsoft_email:${ownerId}`

### Actual Contacts API
- **Preview**: `GET /api/microsoft/contacts/preview`
- **Save**: `POST /api/microsoft/contacts/save`
- **Graph API**: `/me/contacts` endpoint
- **Cache**: Redis key `preview:microsoft_contacts:${ownerId}`

## Current Limitations

1. **Company/Job Title Not Stored**: 
   - Microsoft Contacts provides `companyName` and `jobTitle`
   - These are shown in preview but not saved to Contact model
   - Would need Contact model update to store these fields

2. **Preview Limit**: 
   - Both return maximum 50 contacts per preview
   - Refresh to get next batch

3. **No Pipeline Creation**:
   - Contacts are created without pipeline/stage
   - May need to create default pipeline after import

## Files

- **UI**: `app/(authenticated)/contacts/ingest/microsoft/page.jsx`
- **Email Preview**: `app/api/microsoft/email-contacts/preview/route.js`
- **Email Save**: `app/api/microsoft/email-contacts/save/route.js`
- **Contacts Preview**: `app/api/microsoft/contacts/preview/route.js`
- **Contacts Save**: `app/api/microsoft/contacts/save/route.js`

