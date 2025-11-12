# Contact Management Architecture (Next.js Stack)

**Last Updated**: November 2025  
**Status**: ✅ Fully Implemented  
**Priority**: High - Contact management is core to BD platform

---

## Overview

The contact management system uses a **localStorage-first hydration strategy** with **context-based state management**. Contacts are hydrated once per tenant (companyHQId) and cached in localStorage for fast initial renders, with fresh API data fetched in the background.

---

## Hydration Flow

### 1. Initial Hydration (ContactsLayout)

**Location**: `src/app/(authenticated)/contacts/layout.jsx`

**Flow**:
```
companyHQId (from localStorage)
  ↓
Check localStorage cache for 'contacts'
  ↓
If cached: Use for fast initial render (set hydrated = true)
  ↓
Fetch from API: GET /api/contacts?companyHQId=${companyHQId}
  ↓
Update state + localStorage with fresh data
```

**API Response**:
```javascript
{
  success: true,
  contacts: [
    {
      id: "contact-id",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      // ... all contact fields
      pipeline: {
        pipeline: "prospect",
        stage: "contract"
      },
      contactCompany: {
        id: "company-id",
        companyName: "Acme Corp"
      }
    }
  ]
}
```

**Key Points**:
- API includes `pipeline: true` and `contactCompany: true` in the Prisma query
- Full contact objects with pipeline data are stored in localStorage
- Contacts array includes **all contacts** for the tenant (companyHQId)
- Pipeline data is **embedded** in each contact object (not separate)

---

## localStorage Structure

### Contacts Cache

**Key**: `contacts`

**Value**: Array of Contact objects with pipeline and company data

```javascript
[
  {
    id: "contact-id",
    companyId: "companyHQId", // Tenant identifier
    firstName: "John",
    lastName: "Doe",
    goesBy: "Johnny",
    email: "john@example.com",
    phone: "+1234567890",
    title: "CEO",
    contactCompanyId: "company-id",
    buyerDecision: "Senior Person",
    howMet: "Personal Relationship",
    notes: "Met at conference...",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    pipeline: {
      id: "pipeline-id",
      contactId: "contact-id",
      pipeline: "prospect", // Pipeline type
      stage: "contract"     // Pipeline stage
    },
    contactCompany: {
      id: "company-id",
      companyHQId: "companyHQId",
      companyName: "Acme Corp",
      website: "https://acme.com",
      // ... other company fields
    }
  }
]
```

**Important**: 
- Pipeline data is **embedded** in each contact (not a separate array)
- Company data is **embedded** in each contact (not a separate array)
- All contacts for the tenant are stored in a single array

---

## Context API (ContactsContext)

### ContactsLayout Provider

**Location**: `src/app/(authenticated)/contacts/layout.jsx`

**Context Value**:
```javascript
{
  contacts: Contact[],           // Array of all contacts (from localStorage + API)
  setContacts: Function,         // Update contacts array
  companyHQId: string,           // Tenant identifier
  hydrated: boolean,             // Whether initial cache was loaded
  hydrating: boolean,            // Whether API fetch is in progress
  refreshContacts: Function,     // Manually refresh from API
  updateContact: Function,       // Update a single contact (id, updates)
  addContact: Function,          // Add a new contact
  removeContact: Function,       // Remove a contact (id)
}
```

### Usage

```javascript
import { useContactsContext } from '../layout.jsx';

function MyComponent() {
  const { contacts, hydrated, refreshContacts } = useContactsContext();
  
  // contacts is always available (from cache or API)
  // hydrated indicates if cache was loaded
  // refreshContacts() fetches fresh data from API
}
```

---

## Contact Detail Page

### Location
`src/app/(authenticated)/contacts/[contactId]/page.jsx`

### Data Flow

```
1. Get contactId from URL params
   ↓
2. Try to find contact in cached contacts array (fast initial render)
   ↓
3. If found: Display immediately (set contact state)
   ↓
4. Fetch fresh data from API: GET /api/contacts/${contactId}
   ↓
5. Update contact state with fresh data
   ↓
6. If refreshContacts exists: Call to update contacts cache
```

### Implementation

```javascript
const { contacts, refreshContacts } = useContactsContext();
const [contact, setContact] = useState(null);

// Step 1: Try cached contact (fast initial render)
const cachedContact = contacts.find((item) => item.id === contactId);
if (cachedContact) {
  setContact(cachedContact);
  // Don't set loading to false yet - still fetching fresh data
}

// Step 2: Fetch fresh data from API
const response = await api.get(`/api/contacts/${contactId}`);
if (response.data?.success && response.data.contact) {
  setContact(response.data.contact);
  // Update the contact in the contacts list cache
  if (refreshContacts) {
    refreshContacts();
  }
}
```

### Benefits

1. **Fast Initial Render**: Contact detail page shows data immediately from cache
2. **Fresh Data**: API fetch ensures data is up-to-date
3. **Fallback**: If API fails, cached data is still displayed
4. **Cache Sync**: Fresh data updates the contacts cache for consistency

---

## API Endpoints

### Get All Contacts

**Endpoint**: `GET /api/contacts?companyHQId=${companyHQId}`

**Response**:
```javascript
{
  success: true,
  contacts: Contact[]  // Array with pipeline and contactCompany included
}
```

**Prisma Query**:
```javascript
const contacts = await prisma.contact.findMany({
  where: { companyId: companyHQId },
  include: {
    pipeline: true,        // Includes pipeline data
    contactCompany: true,  // Includes company data
  },
  orderBy: { createdAt: 'desc' },
});
```

### Get Single Contact

**Endpoint**: `GET /api/contacts/${contactId}`

**Response**:
```javascript
{
  success: true,
  contact: Contact  // Single contact with pipeline and contactCompany included
}
```

**Prisma Query**:
```javascript
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: {
    pipeline: true,        // Includes pipeline data
    contactCompany: true,  // Includes company data
  },
});
```

---

## Deal Pipelines Page

### Location
`src/app/(authenticated)/contacts/deal-pipelines/page.jsx`

### Data Source

The deal pipelines page uses the **cached contacts array** from ContactsContext:

```javascript
const { contacts } = useContactsContext();

// Filter contacts by pipeline
const contactsByPipeline = useMemo(() => {
  return contacts.reduce((acc, contact) => {
    const pipelineId = slugify(contact.pipeline?.pipeline);
    if (!pipelineId) return acc;
    const list = acc.get(pipelineId) ?? [];
    list.push(contact);
    acc.set(pipelineId, list);
    return acc;
  }, new Map());
}, [contacts]);
```

### Features

1. **Pipeline Filtering**: Filter contacts by pipeline type (prospect, client, collaborator, institution)
2. **Stage Filtering**: Filter contacts by pipeline stage (interest, meeting, proposal, contract, etc.)
3. **Contact Detail Links**: Click contact row to navigate to contact detail page
4. **Stage Display**: Shows current stage for each contact with badges

### Benefits

- **No Additional API Calls**: Uses cached contacts array
- **Fast Rendering**: No loading states needed (data already available)
- **Real-time Updates**: When contacts cache is updated, pipelines page updates automatically

---

## Cache Management

### Cache Updates

Contacts cache is updated in these scenarios:

1. **Initial Hydration**: When ContactsLayout mounts and fetches from API
2. **Manual Refresh**: When `refreshContacts()` is called
3. **Contact Detail**: When contact detail page fetches fresh data and calls `refreshContacts()`
4. **Contact Updates**: When `updateContact()` is called (updates state + localStorage)
5. **Contact Add**: When `addContact()` is called (adds to state + localStorage)
6. **Contact Remove**: When `removeContact()` is called (removes from state + localStorage)

### Cache Invalidation

The cache is **not automatically invalidated**. It's updated when:
- User manually refreshes
- Contact is updated/added/removed
- Contact detail page fetches fresh data

**Future**: Consider adding cache invalidation based on timestamps or webhooks.

---

## Multi-Tenancy

### Tenant Isolation

All contacts are scoped to `companyHQId`:

- **Storage**: Contacts stored with `companyId = companyHQId`
- **Hydration**: API queries filter by `companyHQId`
- **Cache**: localStorage key is `contacts` (shared across all tenants - could be improved)
- **Security**: API routes verify Firebase token and check companyHQId access

### Current Limitation

**localStorage key is shared**: All tenants share the same `contacts` key in localStorage. This works because:
- Only one tenant is active at a time
- User switches tenants by logging in with different account
- Cache is cleared/rehydrated when companyHQId changes

**Future Improvement**: Use `contacts-${companyHQId}` as the key for true multi-tenant cache isolation.

---

## Pipeline Data

### Pipeline Inclusion

Pipeline data is **always included** when hydrating contacts:

- **API Query**: `include: { pipeline: true }`
- **Cache Storage**: Pipeline data is embedded in each contact object
- **Access**: `contact.pipeline.pipeline` and `contact.pipeline.stage`

### Pipeline Structure

```javascript
contact.pipeline = {
  id: "pipeline-id",
  contactId: "contact-id",
  pipeline: "prospect",  // Pipeline type: prospect, client, collaborator, institution
  stage: "contract"      // Pipeline stage: interest, meeting, proposal, contract, etc.
}
```

### Missing Pipeline

If a contact doesn't have a pipeline:
- `contact.pipeline` is `null` or `undefined`
- Deal pipelines page filters out contacts without pipeline
- Contact detail page shows "Unassigned" for pipeline/stage

---

## Company Data

### Company Inclusion

Company data is **always included** when hydrating contacts:

- **API Query**: `include: { contactCompany: true }`
- **Cache Storage**: Company data is embedded in each contact object
- **Access**: `contact.contactCompany.companyName`, etc.

### Company Structure

```javascript
contact.contactCompany = {
  id: "company-id",
  companyHQId: "companyHQId",
  companyName: "Acme Corp",
  website: "https://acme.com",
  address: "123 Main St",
  industry: "Technology",
  // ... other company fields
}
```

### Missing Company

If a contact doesn't have a company:
- `contact.contactCompany` is `null` or `undefined`
- UI shows "—" or "Unassigned" for company field
- Contact can still exist without a company association

---

## Performance Considerations

### Initial Load

1. **Fast Cache Read**: localStorage read is synchronous and fast
2. **Immediate Render**: Contacts available immediately from cache
3. **Background Fetch**: API fetch happens in background
4. **Progressive Enhancement**: UI updates when fresh data arrives

### Contact Detail

1. **Cache Hit**: Contact found in cache → instant display
2. **API Fetch**: Fresh data fetched in background
3. **Fallback**: If API fails, cached data is still shown

### Deal Pipelines

1. **No API Calls**: Uses cached contacts array
2. **Memoization**: Contacts filtered by pipeline/stage are memoized
3. **Fast Filtering**: Filter operations are O(n) but fast for typical contact counts

---

## Best Practices

### 1. Always Use Context

```javascript
// ✅ Good: Use context
const { contacts } = useContactsContext();

// ❌ Bad: Read from localStorage directly
const contacts = JSON.parse(localStorage.getItem('contacts'));
```

### 2. Check Hydration State

```javascript
// ✅ Good: Check if hydrated
const { contacts, hydrated } = useContactsContext();
if (!hydrated) {
  return <Loading />;
}

// ✅ Good: Handle loading state
const { contacts, hydrating } = useContactsContext();
if (hydrating) {
  return <Loading />;
}
```

### 3. Update Cache When Mutating

```javascript
// ✅ Good: Use context methods
const { updateContact, addContact, removeContact } = useContactsContext();
updateContact(contactId, { email: 'new@example.com' });

// ❌ Bad: Update state directly
setContacts(contacts.map(c => c.id === id ? { ...c, email: 'new@example.com' } : c));
```

### 4. Refresh After Mutations

```javascript
// ✅ Good: Refresh after API mutation
await api.post('/api/contacts', newContact);
refreshContacts();

// ❌ Bad: Assume cache is updated
await api.post('/api/contacts', newContact);
// Cache is stale!
```

---

## Future Improvements

### 1. Multi-Tenant Cache

**Current**: `localStorage.setItem('contacts', ...)`  
**Future**: `localStorage.setItem(`contacts-${companyHQId}`, ...)`

### 2. Cache Invalidation

**Current**: Manual refresh only  
**Future**: Automatic invalidation based on timestamps or webhooks

### 3. Optimistic Updates

**Current**: Update after API response  
**Future**: Update immediately, rollback on error

### 4. Partial Updates

**Current**: Full contact object in cache  
**Future**: Store only necessary fields, fetch full object on demand

### 5. IndexedDB

**Current**: localStorage (5-10MB limit)  
**Future**: IndexedDB for larger datasets (unlimited size)

---

## Summary

### Key Points

1. **localStorage-First**: Contacts are cached in localStorage for fast initial renders
2. **Context-Based**: ContactsContext provides contacts array to all child components
3. **Pipeline Embedded**: Pipeline data is embedded in each contact object
4. **Company Embedded**: Company data is embedded in each contact object
5. **Fast Detail Page**: Contact detail page uses cached data for instant display
6. **Background Refresh**: Fresh data is fetched in background and updates cache
7. **Multi-Tenant**: All contacts scoped to companyHQId (tenant isolation)

### Data Flow

```
companyHQId → API → Contacts Array (with pipeline + company) → localStorage → Context → Components
```

### Benefits

- ✅ Fast initial renders (localStorage cache)
- ✅ Offline support (cached data available)
- ✅ Consistent state (context-based)
- ✅ Easy updates (context methods)
- ✅ Progressive enhancement (background refresh)

---

**Last Updated**: November 2025  
**Architecture**: localStorage-first hydration with context-based state management  
**Principle**: Cache for speed, API for freshness

