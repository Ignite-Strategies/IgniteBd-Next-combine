# Company Health Investigation - Routes & Functions

## Frontend Page
- **File**: `app/(authenticated)/companies/page.jsx`
- **Component**: `CompanyHubPageContent`
- **Key Functions**:
  - `handleSubmit()` - Submits company name, calls lookup API
  - `handleContactSelect(contact)` - Selects contact from filtered list
  - `handleAssociateContact()` - Associates selected contact with company
  - `handleReset()` - Resets all state

## API Routes

### Company Lookup
- **Route**: `POST /api/companies/lookup`
- **File**: `app/api/companies/lookup/route.ts`
- **Function**: `POST(request: Request)`
- **Purpose**: Check DB first, then Apollo if not found. Auto-creates company if enriched from Apollo.
- **Body**: `{ companyHQId, query: "company name or domain" }`
- **Returns**: `{ success, company, source: 'database' | 'apollo' }`

### Contact Hydration
- **Route**: `POST /api/contacts/hydrate`
- **File**: `app/api/contacts/hydrate/route.js`
- **Function**: `POST(request)`
- **Purpose**: Fetch all contacts for CompanyHQ with relations
- **Body**: `{ companyHQId }`
- **Returns**: `{ success, contacts, count }`

### Contact Association
- **Route**: `PUT /api/contacts/[contactId]`
- **File**: `app/api/contacts/[contactId]/route.js`
- **Function**: `PUT(request, { params })`
- **Purpose**: Update contact, including associating with company
- **Body**: `{ companyId }`
- **Returns**: `{ success, contact }`

## Supporting Routes (Not Directly Used)

### Company CRUD
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/[companyId]` - Get company by ID

### Company Enrichment
- `POST /api/companies/enrich` - Manual enrichment endpoint

## Key Dependencies

### Lib Functions
- `searchCompanyByDomain()` - Apollo API wrapper (`lib/apollo`)
- `normalizeCompanyApollo()` - Normalize Apollo response (`lib/enrichment/normalizeCompanyApollo`)
- `extractCompanyIntelligenceScores()` - Extract health scores (`lib/intelligence/EnrichmentParserService`)
- `enrichCompanyPositioning()` - Add positioning data (`lib/intelligence/EnrichmentParserService`)
- `resolveMembership()` - Membership guard (`lib/membership`)

