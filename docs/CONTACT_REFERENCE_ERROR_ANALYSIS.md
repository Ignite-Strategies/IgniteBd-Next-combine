# Contact Lookup ReferenceError Analysis

## Executive Summary

This document analyzes the root causes of ReferenceErrors occurring during contact lookups across the IgniteBD codebase. The errors primarily stem from:

1. **Template variable resolution during SSR/prerendering** - Variables like `firstName` are referenced during build time when contact data isn't available
2. **Inconsistent contact property access patterns** - Mixed usage of optional chaining vs direct property access
3. **Missing null/undefined guards** - Contact objects accessed without existence checks
4. **Schema relation inconsistencies** - Multiple property paths for the same data (e.g., `pipelines` vs `pipeline`, `companies` vs `company` vs `contactCompany`)
5. **Template hydration with incomplete data** - Variables referenced when contact context is missing

---

## 1. Template Variable Resolution During SSR/Prerendering

### Problem
ReferenceErrors occur during Next.js build/prerendering when template variables like `firstName` are referenced but contact data isn't available.

**Evidence:**
- `FIRSTNAME_PRERENDER_FIX.md` documents: `ReferenceError: firstName is not defined`
- Error occurs during static page generation for template-related pages
- `TemplateTestService.generatePreview()` called during prerendering uses contact variables that don't exist at build time

### Root Cause
```javascript
// Template hydration code tries to access contact properties during SSR
const hydrated = template.replace(/\{\{firstName\}\}/g, contact.firstName);
// If contact is undefined/null during build, this causes ReferenceError
```

### Affected Files
- `app/(authenticated)/template/build/ai/quick-idea/page.jsx` (preview sections commented out)
- `app/(authenticated)/template/build/ai/relationship-helper/page.jsx` (preview sections commented out)
- `app/(authenticated)/template/build/templates/page.jsx` (preview sections commented out)
- `app/(authenticated)/template/build/manual/page.jsx` (preview sections commented out)
- `app/(authenticated)/template/saved/page.jsx` (preview sections commented out)

### Current Workaround
Preview generation sections have been commented out to prevent build failures. This disables the preview feature but doesn't fix the underlying issue.

---

## 2. Inconsistent Contact Property Access Patterns

### Problem
The codebase uses multiple patterns to access the same contact properties, leading to undefined references when the wrong pattern is used.

### Schema Relation Inconsistencies

#### Pipeline Access Pattern
**Multiple ways to access pipeline data:**
```javascript
// Pattern 1: contact.pipelines (relation)
const pipeline = contact.pipelines?.pipeline;

// Pattern 2: contact.pipeline (singular, possibly old schema)
const pipeline = contact.pipeline?.pipeline;

// Pattern 3: Fallback pattern (used in many places)
const pipeline = contact.pipelines || contact.pipeline;
```

**Files using fallback pattern:**
- `app/(authenticated)/contacts/view/page.jsx` (lines 143, 254, 274)
- `app/(authenticated)/pipelines/page.jsx` (lines 85, 103, 191, 253)
- `app/(authenticated)/contacts/deal-pipelines/page.jsx` (lines 49, 68, 169, 226)
- `app/(authenticated)/contacts/list-builder/preview/page.jsx` (lines 64, 70, 401)

**Issue:** If both `pipelines` and `pipeline` are undefined, accessing `.pipeline` on undefined causes ReferenceError.

#### Company Access Pattern
**Multiple ways to access company data:**
```javascript
// Pattern 1: contact.companies (relation via contactCompanyId)
const company = contact.companies?.companyName;

// Pattern 2: contact.company (possibly old schema)
const company = contact.company?.companyName;

// Pattern 3: contact.contactCompany (backward compatibility mapping)
const company = contact.contactCompany?.companyName;

// Pattern 4: contact.companyName (direct field)
const company = contact.companyName;

// Pattern 5: Fallback chain (used extensively)
const company = contact.companies?.companyName || 
                contact.company?.companyName || 
                contact.contactCompany?.companyName || 
                contact.companyName || 
                'N/A';
```

**Files using complex fallback chains:**
- `app/(authenticated)/contacts/view/page.jsx` (lines 526-530, 535, 602)
- `app/(authenticated)/contacts/[contactId]/page.jsx` (lines 609, 613, 626-627)
- `components/enrichment/ContactOutlook.tsx` (lines 196, 206, 212, 226)

**Issue:** If all company properties are undefined and code tries to access nested properties, ReferenceErrors occur.

---

## 3. Missing Null/Undefined Guards

### Problem
Contact objects are accessed without checking if they exist first, causing ReferenceErrors when contacts are null/undefined.

### Examples

#### Direct Property Access Without Guards
```javascript
// ❌ UNSAFE - No check if contact exists
const name = `${contact.firstName} ${contact.lastName}`;

// ✅ SAFE - With optional chaining
const name = `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim();
```

#### Template Hydration Without Contact Data
```javascript
// lib/services/campaignPreviewService.js:359
'{{firstName}}': contact.firstName || contact.goesBy || 'there',
// If contact is null/undefined, this throws ReferenceError
```

**Safer pattern:**
```javascript
'{{firstName}}': contact?.firstName || contact?.goesBy || 'there',
```

### Affected Patterns

#### 1. Template Variable Resolution
**File:** `lib/templateVariables.js:148`
```javascript
firstName: safeContactData.firstName || safeContactData.goesBy || 'there',
```
**Issue:** If `safeContactData` is null (not just empty object), this fails.

#### 2. Contact Service Lookups
**File:** `lib/services/variableMapperService.js:146`
```javascript
const value = contact[definition.dbField];
```
**Issue:** If `contact` is null/undefined, accessing properties throws ReferenceError.

#### 3. Contact Analysis Services
**File:** `lib/services/ContactAnalysisService.ts:185`
```javascript
name: contact.fullName || `${contact.firstName} ${contact.lastName}`,
```
**Issue:** If `contact` is null, accessing `fullName`, `firstName`, or `lastName` throws ReferenceError.

---

## 4. Database Query Result Handling

### Problem
Prisma queries may return null contacts, but code assumes contacts always exist.

### Examples

#### Single Contact Lookup
```javascript
// app/api/contacts/[contactId]/route.js
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: { pipelines: true, companies: true }
});

// Later code assumes contact exists
console.log('Contact has pipelines:', !!contact.pipelines);
// If contact is null, this throws ReferenceError
```

**Safer pattern:**
```javascript
if (!contact) {
  return NextResponse.json({ success: false, error: 'Contact not found' }, { status: 404 });
}
console.log('Contact has pipelines:', !!contact?.pipelines);
```

#### Contact List Processing
```javascript
// app/(authenticated)/contacts/view/page.jsx:139
const filteredContacts = useMemo(() => {
  return contacts.filter((contact) => {
    // If contacts array contains null/undefined entries, this fails
    const pipeline = contact.pipelines || contact.pipeline;
    return pipeline?.pipeline === pipelineFilter;
  });
}, [contacts, pipelineFilter]);
```

**Issue:** If `contacts` array contains null/undefined entries, accessing properties throws ReferenceError.

---

## 5. Template Hydration Service Issues

### Problem
Template hydration services don't properly handle missing or incomplete contact data.

### Variable Resolution Without Contact Context

**File:** `lib/services/variableMapperService.js:74-132`
```javascript
async function resolveContactVariable(variableName, context) {
  if (!context.contactId && !context.contactEmail) {
    console.warn(`Cannot resolve ${variableName}: missing contactId or contactEmail`);
    return '';
  }

  const contact = await prisma.contact.findUnique({
    where: context.contactId ? { id: context.contactId } : { email: context.contactEmail! },
    select: { firstName: true, lastName: true, fullName: true, companyName: true, title: true }
  });

  if (!contact) {
    console.warn(`Contact not found`);
    return '';
  }

  // Safe access here, but calling code might not handle empty strings
  const value = contact[fieldPath];
  return value || '';
}
```

**Issue:** While this function handles null contacts, calling code might not expect empty strings and could try to access properties on undefined.

### Template Test Service
**File:** `lib/services/campaignPreviewService.js:355-376`
```javascript
static personalizeContent(content, contact) {
  if (!content || !contact) return content; // ✅ Good guard

  const replacements = {
    '{{firstName}}': contact.firstName || contact.goesBy || 'there',
    // ... more replacements
  };
  // ...
}
```

**Issue:** The guard checks for falsy `contact`, but if `contact` is an empty object `{}`, properties are still undefined and could cause issues in template replacement.

---

## 6. Frontend Contact State Management

### Problem
Contact state in React components may be undefined during initial render or after errors.

### Examples

#### Contact Detail Page
**File:** `app/(authenticated)/contacts/[contactId]/page.jsx:37-122`
```javascript
const [contact, setContact] = useState(null); // ✅ Initialized as null

useEffect(() => {
  const loadContact = async () => {
    // Try cached contact first
    const cachedContact = contacts.find((item) => item.id === contactId);
    if (cachedContact) {
      setContact(cachedContact);
    }

    // Fetch from API
    const response = await api.get(`/api/contacts/${contactId}`);
    if (response.data?.success && response.data.contact) {
      setContact(response.data.contact);
    }
  };
  loadContact();
}, [contactId]);
```

**Issue:** If API fails and no cached contact exists, `contact` remains `null`, but render code might access properties:
```javascript
// If contact is null, this throws ReferenceError
{contact.firstName} {contact.lastName}
```

**Safer pattern:**
```javascript
{contact?.firstName || ''} {contact?.lastName || ''}
```

#### Contact List Filtering
**File:** `app/(authenticated)/contacts/view/page.jsx:139-165`
```javascript
const filteredContacts = useMemo(() => {
  return contacts.filter((contact) => {
    // If contact is null/undefined, accessing properties fails
    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const company = (contact.companies?.companyName || contact.contactCompany?.companyName || '').toLowerCase();
    // ...
  });
}, [contacts, pipelineFilter, searchTerm]);
```

**Issue:** If `contacts` array contains null/undefined entries, the filter function throws ReferenceError.

**Safer pattern:**
```javascript
return contacts.filter((contact) => {
  if (!contact) return false; // ✅ Guard against null/undefined
  // ... rest of filter logic
});
```

---

## 7. API Response Serialization Issues

### Problem
Contact serialization in API routes may fail or return incomplete data, leading to undefined properties in frontend.

### Examples

#### Serialization Error Handling
**File:** `app/api/contacts/retrieve/route.js:102-149`
```javascript
try {
  const serializedContact = JSON.parse(JSON.stringify(contact, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (value === undefined) return null; // ✅ Handles undefined
    return value;
  }));
  return NextResponse.json({ success: true, contact: serializedContact });
} catch (serializeError) {
  // Fallback tries to remove problematic fields
  const { careerTimeline, ...contactWithoutTimeline } = contact;
  // ...
}
```

**Issue:** If serialization fails and fallback also fails, the API might return an error, but frontend code might still try to access properties on undefined.

#### Missing Relation Data
**File:** `app/api/contacts/retrieve/route.js:191-200`
```javascript
contacts = await prisma.contact.findMany({
  where: { crmId: companyHQId },
  include: {
    pipelines: true,
    companies: true, // Company relation via contactCompanyId
  },
});
```

**Issue:** If a contact has no `contactCompanyId`, `companies` will be `null`, but frontend code might access `contact.companies.companyName` without checking.

---

## 8. Common ReferenceError Patterns

### Pattern 1: Direct Property Access on Null/Undefined
```javascript
// ❌ UNSAFE
const name = contact.firstName;

// ✅ SAFE
const name = contact?.firstName || '';
```

### Pattern 2: Nested Property Access Without Guards
```javascript
// ❌ UNSAFE
const company = contact.companies.companyName;

// ✅ SAFE
const company = contact?.companies?.companyName || '';
```

### Pattern 3: Array Methods on Potentially Null Arrays
```javascript
// ❌ UNSAFE
contacts.map(contact => contact.firstName);

// ✅ SAFE
(contacts || []).filter(Boolean).map(contact => contact?.firstName || '');
```

### Pattern 4: Template Variable Replacement
```javascript
// ❌ UNSAFE (during SSR)
template.replace(/\{\{firstName\}\}/g, contact.firstName);

// ✅ SAFE
template.replace(/\{\{firstName\}\}/g, contact?.firstName || 'there');
```

### Pattern 5: Optional Chaining in Template Literals
```javascript
// ❌ UNSAFE
const fullName = `${contact.firstName} ${contact.lastName}`;

// ✅ SAFE
const fullName = `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim();
```

---

## 9. Recommendations

### Immediate Fixes

1. **Add Null Guards to All Contact Property Access**
   - Use optional chaining (`?.`) everywhere
   - Add explicit null checks before property access
   - Provide default values for all contact properties

2. **Standardize Contact Property Access Patterns**
   - Choose one pattern for pipeline access (`pipelines` vs `pipeline`)
   - Choose one pattern for company access (`companies` vs `company` vs `contactCompany`)
   - Update schema to match chosen patterns
   - Remove fallback chains once standardized

3. **Fix Template Hydration for SSR**
   - Ensure template hydration only runs client-side
   - Use `useEffect` hooks for client-only code
   - Check `typeof window !== 'undefined'` before accessing contact data
   - Provide mock data for preview during SSR

4. **Add Contact Existence Checks**
   - Check if contact exists before accessing properties
   - Return early with error messages if contact is null
   - Handle null contacts gracefully in UI

5. **Filter Null Contacts from Arrays**
   - Add `.filter(Boolean)` before processing contact arrays
   - Validate contact data before adding to state
   - Handle empty contact lists gracefully

### Long-term Improvements

1. **TypeScript Migration**
   - Add proper types for Contact objects
   - Use TypeScript's null checking
   - Define interfaces for contact relations

2. **Schema Standardization**
   - Standardize relation names in Prisma schema
   - Use consistent naming conventions
   - Document which properties are nullable

3. **Error Boundaries**
   - Add React error boundaries for contact pages
   - Handle ReferenceErrors gracefully
   - Show user-friendly error messages

4. **Testing**
   - Add unit tests for contact property access
   - Test with null/undefined contacts
   - Test template hydration with missing data

5. **Documentation**
   - Document contact property access patterns
   - Create guidelines for safe contact access
   - Document which properties are always available

---

## 10. Files Requiring Immediate Attention

### High Priority (Frequent ReferenceErrors)

1. **Template Pages** (SSR/prerendering issues)
   - `app/(authenticated)/template/build/**/*.jsx` - All template build pages
   - `app/(authenticated)/template/saved/page.jsx` - Saved templates page

2. **Contact View Pages**
   - `app/(authenticated)/contacts/view/page.jsx` - Main contacts list
   - `app/(authenticated)/contacts/[contactId]/page.jsx` - Contact detail page

3. **Template Hydration Services**
   - `lib/templateVariables.js` - Core hydration logic
   - `lib/services/campaignPreviewService.js` - Campaign preview
   - `lib/services/variableMapperService.js` - Variable resolution

### Medium Priority (Potential Issues)

4. **Contact Services**
   - `lib/services/ContactAnalysisService.ts` - Contact analysis
   - `lib/services/ContactAnalysisMinimalService.ts` - Minimal analysis
   - `lib/services/contactService.ts` - Core contact service

5. **API Routes**
   - `app/api/contacts/retrieve/route.js` - Contact retrieval
   - `app/api/contacts/[contactId]/route.js` - Single contact API

6. **Components**
   - `components/ContactSelector.jsx` - Contact selector component
   - `components/enrichment/ContactOutlook.tsx` - Contact enrichment UI

---

## 11. Code Examples: Before and After

### Example 1: Contact Name Display

**Before (Unsafe):**
```javascript
const name = `${contact.firstName} ${contact.lastName}`;
```

**After (Safe):**
```javascript
const name = [contact?.firstName, contact?.lastName]
  .filter(Boolean)
  .join(' ') || contact?.goesBy || contact?.email || 'Unknown';
```

### Example 2: Company Name Access

**Before (Unsafe):**
```javascript
const company = contact.companies.companyName || contact.companyName;
```

**After (Safe):**
```javascript
const company = contact?.companies?.companyName || 
                contact?.contactCompany?.companyName || 
                contact?.companyName || 
                'No company';
```

### Example 3: Pipeline Access

**Before (Unsafe):**
```javascript
const pipeline = contact.pipelines.pipeline || contact.pipeline.pipeline;
```

**After (Safe):**
```javascript
const pipeline = contact?.pipelines?.pipeline || 
                 contact?.pipeline?.pipeline || 
                 'unassigned';
```

### Example 4: Template Hydration

**Before (Unsafe):**
```javascript
export function hydrateTemplate(template, contactData) {
  return template.replace(/\{\{firstName\}\}/g, contactData.firstName);
}
```

**After (Safe):**
```javascript
export function hydrateTemplate(template, contactData = {}) {
  const safeContact = contactData || {};
  const replacements = {
    '{{firstName}}': safeContact.firstName || safeContact.goesBy || 'there',
    '{{lastName}}': safeContact.lastName || '',
    '{{companyName}}': safeContact.companyName || 'your company',
  };
  
  let hydrated = template;
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    hydrated = hydrated.replace(regex, value);
  });
  
  return hydrated;
}
```

### Example 5: Contact Array Filtering

**Before (Unsafe):**
```javascript
const filtered = contacts.filter(contact => {
  return contact.firstName.includes(searchTerm);
});
```

**After (Safe):**
```javascript
const filtered = (contacts || [])
  .filter(Boolean) // Remove null/undefined entries
  .filter(contact => {
    const firstName = contact?.firstName || '';
    return firstName.toLowerCase().includes(searchTerm.toLowerCase());
  });
```

---

## 12. Summary

### Root Causes Identified

1. ✅ **Template variable resolution during SSR** - Variables referenced during build time
2. ✅ **Inconsistent property access patterns** - Multiple ways to access same data
3. ✅ **Missing null/undefined guards** - Direct property access without checks
4. ✅ **Schema relation inconsistencies** - `pipelines` vs `pipeline`, `companies` vs `company`
5. ✅ **Incomplete contact data handling** - Missing properties not handled gracefully
6. ✅ **Array processing without null checks** - Contact arrays may contain null entries
7. ✅ **API serialization edge cases** - Failed serialization may return incomplete data

### Impact

- **Build failures** during Next.js prerendering
- **Runtime errors** when contact data is missing
- **Poor user experience** with error messages
- **Inconsistent behavior** across different pages
- **Maintenance burden** from multiple access patterns

### Next Steps

1. **Immediate:** Add null guards to all contact property access
2. **Short-term:** Standardize contact property access patterns
3. **Medium-term:** Fix SSR/prerendering issues with templates
4. **Long-term:** Migrate to TypeScript for better type safety
5. **Ongoing:** Add tests for null/undefined contact handling

---

## Appendix: Common Contact Properties Reference

### Always Available (with defaults)
- `id` - Contact ID (string)
- `email` - Contact email (string, may be null)
- `crmId` - CompanyHQ ID (string)

### May Be Null/Undefined
- `firstName` - First name (string | null)
- `lastName` - Last name (string | null)
- `fullName` - Full name (string | null)
- `goesBy` - Preferred name (string | null)
- `title` - Job title (string | null)
- `companyName` - Company name (string | null)
- `contactCompanyId` - Company foreign key (string | null)

### Relations (May Be Null)
- `pipelines` - Pipeline relation (object | null)
  - `pipelines.pipeline` - Pipeline type (string | null)
  - `pipelines.stage` - Pipeline stage (string | null)
- `companies` - Company relation (object | null)
  - `companies.companyName` - Company name (string | null)
  - `companies.id` - Company ID (string | null)
- `contactCompany` - Backward compatibility mapping (object | null)

### Legacy Properties (May Not Exist)
- `pipeline` - Old pipeline property (object | null)
- `company` - Old company property (object | null)

---

*Last Updated: Generated from codebase analysis*
*Analysis Date: Current*

