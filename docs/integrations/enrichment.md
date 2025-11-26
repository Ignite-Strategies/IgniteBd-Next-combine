# Contact Enrichment - Apollo Integration

**Last Updated**: January 2025  
**Status**: ✅ Active  
**Provider**: Apollo.io  
**Purpose**: Contact enrichment service to find and populate contact information using email or LinkedIn URL

> 📖 **For the complete vision and mental model**, see [ENRICHMENT_VISION.md](./ENRICHMENT_VISION.md)  
> This document covers the technical integration details. The vision doc explains how enrichment intelligence scores differ from BD Intelligence fit scores and persona alignment.

---

## Overview

**Apollo** is a contact enrichment service that helps find and populate missing contact information when you have basic identifiers like an email address or LinkedIn URL.

### Use Cases

**Enrich by Email:**
- ✅ Email address
- Returns: Full name, phone, title, company, location, LinkedIn URL, and more

**Enrich by LinkedIn URL:**
- ✅ LinkedIn profile URL
- Returns: Email, phone, title, company, location, and more

### What Apollo Enriches

When you provide:
- Email address, OR
- LinkedIn URL

Apollo returns:
- ✅ Full name (first, last, full)
- ✅ Email address (if enriching by LinkedIn)
- ✅ Phone number
- ✅ Job title
- ✅ Seniority level
- ✅ Department
- ✅ LinkedIn URL
- ✅ Location (city, state, country)
- ✅ Company name
- ✅ Company domain
- ✅ Additional metadata

---

## Architecture

### Service Location
**Main Helper**: `src/lib/apollo.ts`

### API Endpoint
- **Base URL**: `https://api.apollo.io/api/v1`
- **People Match**: `POST /people/match`
- **Authentication**: API key in request body (`api_key`)

### Current Implementation

**Enrichment Flow**:
```
User Input (Email/LinkedIn) → /api/contacts/enrich → Apollo API → Contact (DB)
```

**UI Flow**:
```
/contacts/enrich → Search/Upload/Import → Enrich → /contacts/enrich/success
```

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/contacts/enrich` | POST | Enrich a contact by email or LinkedIn URL |
| `/api/apollo-test` | GET | Test Apollo API key and connection |

---

## API Functions

### 1. Search Person by Email

```typescript
import { searchPersonByEmail } from '@/lib/apollo';

const response = await searchPersonByEmail('john.doe@example.com');
// Returns: ApolloPersonMatchResponse with person data
```

**Request**:
```json
POST https://api.apollo.io/api/v1/people/match
{
  "api_key": "your_api_key",
  "email": "john.doe@example.com"
}
```

### 2. Search Person by LinkedIn URL

```typescript
import { searchPersonByLinkedInUrl } from '@/lib/apollo';

const response = await searchPersonByLinkedInUrl('https://linkedin.com/in/john-doe');
// Returns: ApolloPersonMatchResponse with person data
```

**Request**:
```json
POST https://api.apollo.io/api/v1/people/match
{
  "api_key": "your_api_key",
  "linkedin_url": "https://linkedin.com/in/john-doe"
}
```

### 3. Enrich Contact (Main Function)

```typescript
import { enrichContact } from '@/lib/apollo';

// By email
const data = await enrichContact('john.doe@example.com');

// By LinkedIn URL
const data = await enrichContact(undefined, 'https://linkedin.com/in/john-doe');

// Returns: NormalizedContactData ready for Contact model
```

**Normalized Response Structure**:
```typescript
{
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  seniority?: string;
  department?: string;
  linkedinUrl?: string;
  phone?: string | null;
  city?: string;
  state?: string;
  country?: string;
  companyName?: string;
  companyDomain?: string;
}
```

### 4. Search Company by Domain

```typescript
import { searchCompanyByDomain } from '@/lib/apollo';

const companyData = await searchCompanyByDomain('example.com');
// Returns: Company data from Apollo
```

---

## Database Schema

The `Contact` model includes enrichment fields:

```prisma
model Contact {
  // ... other fields
  fullName            String?   // Full name from enrichment
  seniority           String?   // Seniority level from enrichment
  department          String?   // Department from enrichment
  linkedinUrl         String?   // LinkedIn URL from enrichment
  city                String?   // City from enrichment
  state               String?   // State from enrichment
  country             String?   // Country from enrichment
  companyDomain       String?   // Company domain from enrichment
  enrichmentSource    String?   // "Apollo"
  enrichmentFetchedAt DateTime? // When enrichment was fetched
  enrichmentPayload   Json?     // Full enrichment response
}
```

---

## Usage

### Via API Route

**Enrich a Contact**:
```bash
POST /api/contacts/enrich
Content-Type: application/json

{
  "contactId": "contact-id-here",
  "email": "john.doe@example.com",
  "linkedinUrl": "https://linkedin.com/in/john-doe" // optional
}
```

**Response**:
```json
{
  "success": true,
  "contact": { /* updated contact object */ },
  "enrichedData": { /* normalized enrichment data */ }
}
```

### Via UI

1. Navigate to `/contacts/enrich` (available in sidebar under "Engage" section)
2. Choose enrichment method:
   - **Search Contact**: Enter email or LinkedIn URL
   - **Upload CSV**: Upload CSV file with emails
   - **Microsoft Email**: Import contacts from Microsoft Graph
3. Select contacts to enrich
4. Click "Enrich" button
5. View results on success page

---

## Enrichment Data Mapping

When a contact is enriched, the following data is extracted and stored:

| Apollo Field | Contact Field | Notes |
|--------------|---------------|-------|
| `person.email` | `email` | Email address (from LinkedIn enrichment) |
| `person.name` | `fullName` | Full name |
| `person.first_name` | `firstName` | First name |
| `person.last_name` | `lastName` | Last name |
| `person.title` | `title` | Job title |
| `person.seniority` | `seniority` | Seniority level |
| `person.department` | `department` | Department |
| `person.linkedin_url` | `linkedinUrl` | LinkedIn profile URL |
| `person.phone_numbers[0]` | `phone` | Primary phone number |
| `person.city` | `city` | City |
| `person.state` | `state` | State |
| `person.country` | `country` | Country |
| `person.organization.name` | `companyName` | Company name |
| `person.organization.primary_domain` | `companyDomain` | Company domain |
| Full response | `enrichmentPayload` | Complete JSON response |

### Contact Update Logic

```typescript
// Only update fields that have values (don't overwrite with undefined)
const updateData = {
  enrichmentSource: 'Apollo',
  enrichmentFetchedAt: new Date(),
  enrichmentPayload: enrichedData,
};

// Conditionally update fields
if (enrichedData.fullName) updateData.fullName = enrichedData.fullName;
if (enrichedData.firstName) updateData.firstName = enrichedData.firstName;
// ... etc
```

---

## Configuration

### Environment Variables

**Required**:
- `APOLLO_API_KEY` - Apollo API key for authentication

**How to Get API Key**:
1. Sign up for Apollo.io account
2. Navigate to Settings → API
3. Generate or copy your API key
4. Add to environment variables

### API Configuration

- **Base URL**: `https://api.apollo.io/api/v1`
- **Authentication**: API key in request body (`api_key` field) - Note: Apollo also supports `X-Api-Key` header method
- **Rate Limits**: Check Apollo documentation for current limits
- **Request Format**: JSON body with `api_key` and search parameters

---

## Apollo API Verification

### Verified Endpoints

✅ **People Match** (`POST /api/v1/people/match`)
- Supports `email` parameter
- Supports `linkedin_url` parameter
- Returns person data with all enrichment fields

✅ **Organizations Search** (`POST /api/v1/organizations/search`)
- Supports domain-based company search
- Returns company information

### Request Format

**Email Enrichment**:
```json
{
  "api_key": "your_api_key",
  "email": "person@example.com"
}
```

**LinkedIn Enrichment**:
```json
{
  "api_key": "your_api_key",
  "linkedin_url": "https://linkedin.com/in/person"
}
```

**Note**: Apollo API supports both authentication methods:
- `api_key` in request body (current implementation)
- `X-Api-Key` header (alternative method)

### Response Format

```json
{
  "person": {
    "id": "person-id",
    "first_name": "John",
    "last_name": "Doe",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "title": "Software Engineer",
    "seniority": "senior",
    "department": "Engineering",
    "linkedin_url": "https://linkedin.com/in/john-doe",
    "phone_numbers": [
      {
        "raw_number": "+1234567890",
        "sanitized_number": "+1234567890"
      }
    ],
    "city": "San Francisco",
    "state": "CA",
    "country": "United States",
    "organization": {
      "name": "Example Corp",
      "primary_domain": "example.com",
      "website_url": "https://example.com"
    }
  }
}
```

---

## UI Components

### Enrich Page (`/contacts/enrich`)

**Features**:
- Search by email or LinkedIn URL
- Upload CSV with emails
- Import from Microsoft Graph
- Bulk selection and enrichment
- Real-time enrichment status

**Components**:
- Mode selection cards (Search, CSV, Microsoft)
- Search type toggle (Email/LinkedIn)
- Contact selection interface
- Enrichment progress indicator

### Success Page (`/contacts/enrich/success`)

**Features**:
- Summary statistics (total, successful, failed)
- Detailed results for each contact
- Action buttons:
  - Add to Persona Builder
  - View Contact
  - Enrich More Contacts
  - Go to Persona Builder

---

## Testing

### Test Endpoint

**Test Apollo API Connection**:
```bash
GET /api/apollo-test
```

**Response**:
```json
{
  "success": true,
  "message": "Apollo API key is working",
  "testEmail": "test@example.com",
  "apolloResponse": { /* raw Apollo response */ }
}
```

### Manual Testing

1. Set `APOLLO_API_KEY` environment variable
2. Navigate to `/contacts/enrich`
3. Enter a test email or LinkedIn URL
4. Click "Search" then "Enrich"
5. Verify contact is updated with enrichment data

---

## Best Practices

### 1. Validate Inputs

Always validate email or LinkedIn URL before making API calls:
- Email must contain `@`
- LinkedIn URL must contain `linkedin.com`

### 2. Handle Missing Data

Gracefully handle cases where:
- No contact found in Apollo
- Partial data returned
- API errors or rate limits

### 3. Store Full Payload

Store the complete `enrichmentPayload` JSON for:
- Debugging
- Future data extraction
- Audit trail

### 4. Track Enrichment Source

Always set `enrichmentSource: 'Apollo'` to track where data came from.

### 5. Rate Limiting

Be mindful of Apollo API rate limits:
- Monitor API usage
- Implement retry logic for rate limit errors
- Consider batching requests when possible

### 6. Data Privacy

- Only enrich contacts you have permission to enrich
- Respect data privacy regulations
- Store enrichment timestamps for compliance

---

## Error Handling

### Common Errors

**API Key Missing**:
```
Error: APOLLO_API_KEY environment variable is not set
```
**Solution**: Set `APOLLO_API_KEY` in environment variables

**Invalid Email**:
```
Error: Valid email address is required
```
**Solution**: Ensure email contains `@` symbol

**Invalid LinkedIn URL**:
```
Error: Invalid LinkedIn URL format
```
**Solution**: Provide full LinkedIn URL (e.g., `https://linkedin.com/in/...`)

**Contact Not Found**:
```
Error: Enrichment failed - No person found
```
**Solution**: Contact may not exist in Apollo's database

**Rate Limit**:
```
Error: Apollo API error: 429 - Rate limit exceeded
```
**Solution**: Wait and retry, or upgrade Apollo plan

---

## Migration from Lusha

### Key Differences

| Aspect | Lusha | Apollo |
|--------|-------|--------|
| **Enrichment Method** | Name + Company | Email or LinkedIn URL |
| **API Endpoint** | `/prospecting/contact/search/` | `/api/v1/people/match` |
| **Authentication** | API key in header | API key in body |
| **Response Format** | Multi-step (search then enrich) | Single-step match |
| **LinkedIn Support** | Limited | Full support |

### Migration Steps

1. ✅ Replace Lusha service with Apollo helper
2. ✅ Update Contact model with new enrichment fields
3. ✅ Update API routes to use Apollo
4. ✅ Update UI to support email/LinkedIn enrichment
5. ⚠️ Update existing enriched contacts (optional)

---

## Future Improvements

### 1. Bulk Enrichment
- Implement batch enrichment API
- Add progress tracking for large batches
- Optimize rate limiting

### 2. Enrichment Analytics
- Track success rates
- Monitor API costs
- Identify enrichment patterns
- Track data freshness

### 3. Multiple Enrichment Sources
- Add fallback providers
- Compare results from multiple sources
- Confidence scoring

### 4. Real-time Enrichment
- Auto-enrich on contact creation
- Background enrichment jobs
- Webhook support

### 5. Enrichment History
- Track enrichment attempts
- Store historical data
- Compare enrichment versions

---

## Related Documentation

- **[Enrichment Vision](./ENRICHMENT_VISION.md)** - Complete mental model: enrichment intelligence vs BD Intelligence fit scores vs persona alignment
- [Contact Management Architecture](../architecture/contacts.md)
- [BD Intelligence](../bd-intelligence/BD_INTELLIGENCE.md) - Product-contact fit scoring (separate system)
- [Apollo API Helper](../../src/lib/apollo.ts)
- [Enrichment API Route](../../src/app/api/contacts/enrich/route.ts)
- [Environment Variables](../setup/environment-variables.md)

---

## Summary

**Apollo** is used to enrich contacts when you have an email address or LinkedIn URL and need additional contact details.

**Current Implementation Status**:
- ✅ Email-based enrichment
- ✅ LinkedIn URL-based enrichment
- ✅ UI for manual enrichment
- ✅ CSV upload support
- ✅ Microsoft Graph integration
- ✅ Success page with results

**To Use**:
1. Set `APOLLO_API_KEY` environment variable
2. Navigate to `/contacts/enrich` from sidebar
3. Enter email or LinkedIn URL
4. Click "Enrich"
5. View results on success page

**API Functions**:
- `searchPersonByEmail(email)` - Search by email
- `searchPersonByLinkedInUrl(url)` - Search by LinkedIn URL
- `enrichContact(email?, linkedinUrl?)` - Main enrichment function
- `searchCompanyByDomain(domain)` - Search company by domain

---

**Last Updated**: December 2024  
**Service**: Apollo Contact Enrichment  
**Purpose**: Find and populate contact information using email or LinkedIn URL  
**Status**: ✅ Active and Production Ready

