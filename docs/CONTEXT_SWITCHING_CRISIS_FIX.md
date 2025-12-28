# Context Switching Crisis - Complete Fix Plan

## 🔥 The Problem

We discovered a cascade of issues where contacts were being created in the wrong CompanyHQ due to:
1. **Unclear context state** - Users don't know which CompanyHQ container they're in
2. **Session state bleeding** - Context switching between browser tabs causing wrong `companyHQId` in localStorage
3. **Seed script issues** - Joel's BusinessPoint Law CompanyHQ seeded incorrectly
4. **Contact creation confusion** - Multiple save routes with unclear responsibilities

---

## 1. Context Shape - Who's Container Am I In?!

### Current State
- Users have no clear visual indication of which CompanyHQ they're currently operating in
- localStorage stores `companyHQId` but UI doesn't prominently display it
- Context switching is "silent" - happens without clear feedback

### Proposed Solution

#### A. Add Context Indicator Component
**File**: `components/CompanyHQContextIndicator.jsx`

```jsx
'use client';
import { useOwner } from '@/hooks/useOwner';
import { Building2, AlertCircle } from 'lucide-react';

export function CompanyHQContextIndicator() {
  const { companyHQ, companyHQId, memberships } = useOwner();
  
  if (!companyHQ) return null;
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-blue-900">
          Working in: {companyHQ.companyName}
        </span>
        <span className="text-sm text-blue-600">
          (ID: {companyHQId?.substring(0, 8)}...)
        </span>
      </div>
      {memberships && memberships.length > 1 && (
        <div className="mt-2 text-sm text-blue-700">
          You have access to {memberships.length} CompanyHQ(s)
        </div>
      )}
    </div>
  );
}
```

#### B. Add to Layout/Header
**File**: `app/(authenticated)/layout.jsx`

- Add `CompanyHQContextIndicator` to authenticated layout
- Show in header/navbar so it's always visible
- Make it clickable to show all available CompanyHQs and allow switching

#### C. Add Context Validation Hook
**File**: `hooks/useContextValidation.js`

```js
'use client';
import { useEffect, useState } from 'react';
import { useOwner } from './useOwner';

/**
 * Validates that current companyHQId is in user's memberships
 * Shows warning if context is invalid
 */
export function useContextValidation() {
  const { companyHQId, memberships } = useOwner();
  const [isValid, setIsValid] = useState(true);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    if (!companyHQId || !memberships || memberships.length === 0) {
      setIsValid(false);
      setWarning('No CompanyHQ context. Please refresh or log in again.');
      return;
    }

    const hasAccess = memberships.some(m => m.companyHqId === companyHQId);
    if (!hasAccess) {
      setIsValid(false);
      setWarning(`⚠️ You don't have access to CompanyHQ ${companyHQId}. Please switch contexts.`);
      return;
    }

    setIsValid(true);
    setWarning(null);
  }, [companyHQId, memberships]);

  return { isValid, warning };
}
```

#### D. Add Context Switcher Component
**File**: `components/CompanyHQSwitcher.jsx`

```jsx
'use client';
import { useOwner } from '@/hooks/useOwner';
import { switchCompanyHQ } from '@/lib/companyhq-switcher';
import { Building2, Check } from 'lucide-react';

export function CompanyHQSwitcher() {
  const { companyHQId, memberships, refresh } = useOwner();

  const handleSwitch = async (newCompanyHQId) => {
    const result = switchCompanyHQ(newCompanyHQId);
    if (result) {
      await refresh(); // Refresh owner data
      window.location.reload(); // Reload to apply new context
    }
  };

  return (
    <div className="dropdown">
      {/* Dropdown UI showing all memberships */}
      {memberships?.map(membership => (
        <button
          key={membership.companyHqId}
          onClick={() => handleSwitch(membership.companyHqId)}
          className={companyHQId === membership.companyHqId ? 'active' : ''}
        >
          {membership.company_hqs.companyName}
          {companyHQId === membership.companyHqId && <Check />}
          <span className="badge">{membership.role}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## 2. Session State Management - Tab Isolation & Persistence

### Current State
- `localStorage` is shared across browser tabs
- Context switching in one tab affects all tabs
- No session-scoped storage for context
- Users can be logged into different CompanyHQs in different tabs (confusing!)

### Proposed Solution

#### A. Use SessionStorage for Tab-Specific Context
**File**: `lib/contextManager.js`

```js
/**
 * Context Manager
 * Manages CompanyHQ context with tab isolation
 */

/**
 * Get current CompanyHQ context (checks sessionStorage first, then localStorage)
 */
export function getCurrentCompanyHQId() {
  if (typeof window === 'undefined') return null;
  
  // Tab-specific context (sessionStorage) takes precedence
  const sessionContext = sessionStorage.getItem('companyHQId');
  if (sessionContext) {
    // Validate it's still in user's memberships
    const memberships = getMemberships();
    const isValid = memberships?.some(m => m.companyHqId === sessionContext);
    if (isValid) {
      return sessionContext;
    }
    // Invalid context, clear it
    sessionStorage.removeItem('companyHQId');
  }
  
  // Fallback to localStorage (global context)
  return localStorage.getItem('companyHQId');
}

/**
 * Set CompanyHQ context (sets both sessionStorage and localStorage)
 */
export function setCompanyHQContext(companyHQId) {
  if (typeof window === 'undefined') return false;
  
  // Validate membership
  const memberships = getMemberships();
  const hasAccess = memberships?.some(m => m.companyHqId === companyHQId);
  if (!hasAccess) {
    console.error(`❌ Cannot set context: No membership in CompanyHQ ${companyHQId}`);
    return false;
  }
  
  // Set in both storages
  sessionStorage.setItem('companyHQId', companyHQId);
  localStorage.setItem('companyHQId', companyHQId);
  
  // Fire event for other tabs
  window.dispatchEvent(new CustomEvent('companyHQContextChanged', { 
    detail: { companyHQId } 
  }));
  
  return true;
}

/**
 * Get memberships from localStorage
 */
function getMemberships() {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('memberships');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Listen for context changes from other tabs
 */
export function listenForContextChanges(callback) {
  if (typeof window === 'undefined') return () => {};
  
  const handler = (event) => {
    // Optionally sync to sessionStorage if user wants
    // For now, we keep tab isolation
    callback(event.detail);
  };
  
  window.addEventListener('companyHQContextChanged', handler);
  
  return () => {
    window.removeEventListener('companyHQContextChanged', handler);
  };
}
```

#### B. Update useOwner Hook
**File**: `hooks/useOwner.js`

```js
import { getCurrentCompanyHQId, setCompanyHQContext } from '@/lib/contextManager';

export function useOwner() {
  // ... existing code ...
  
  // On mount, use sessionStorage-aware context
  useEffect(() => {
    const contextId = getCurrentCompanyHQId();
    if (contextId) {
      setCompanyHQId(contextId);
    }
  }, []);
  
  // Update context setter to use new manager
  const setContext = useCallback((newCompanyHQId) => {
    if (setCompanyHQContext(newCompanyHQId)) {
      setCompanyHQId(newCompanyHQId);
      refresh(); // Refresh data
    }
  }, [refresh]);
  
  return { ...existing, setContext };
}
```

#### C. Add Tab Isolation Warning
**File**: `components/TabContextWarning.jsx`

```jsx
'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function TabContextWarning() {
  const [showWarning, setShowWarning] = useState(false);
  
  useEffect(() => {
    // Detect if localStorage context differs from sessionStorage
    const sessionContext = sessionStorage.getItem('companyHQId');
    const localContext = localStorage.getItem('companyHQId');
    
    if (sessionContext && localContext && sessionContext !== localContext) {
      setShowWarning(true);
    }
  }, []);
  
  if (!showWarning) return null;
  
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">
          This tab has a different CompanyHQ context than other tabs. 
          Context is isolated per tab to prevent confusion.
        </span>
      </div>
    </div>
  );
}
```

#### D. Update CompanyHQ Switcher
**File**: `lib/companyhq-switcher.js`

```js
import { setCompanyHQContext } from './contextManager';

export function switchCompanyHQ(companyHQId) {
  if (typeof window === 'undefined') return null;

  // Validate membership
  const memberships = getAllMemberships();
  const membership = memberships.find(m => m.companyHqId === companyHQId);
  if (!membership) {
    console.warn(`No membership found for CompanyHQ: ${companyHQId}`);
    return null;
  }

  // Use new context manager (sets both sessionStorage and localStorage)
  if (!setCompanyHQContext(companyHQId)) {
    return null;
  }

  // Update companyHQ object in localStorage
  localStorage.setItem('companyHQ', JSON.stringify(membership.company_hqs));

  console.log(`✅ Switched to CompanyHQ: ${membership.company_hqs.companyName}`);
  console.log(`📌 Context isolated to this tab (sessionStorage)`);

  return {
    companyHQId: membership.companyHqId,
    companyHQ: membership.company_hqs,
    role: membership.role,
  };
}
```

---

## 3. Joel's BusinessPoint Law Seed - THE REAL PROBLEM! 🔴

### The Issue
**The seed script created BusinessPoint Law CompanyHQ with `id: 'businesspoint-law-hq'` (a readable STRING) instead of a UUID!**

This is wrong because:
- CompanyHQ IDs should be UUIDs (like other CompanyHQs)
- Contacts created while in this CompanyHQ get `crmId: 'businesspoint-law-hq'` (correct relative to the ID, but wrong because the ID itself is wrong)
- This breaks the pattern and causes confusion

### What Happened
1. Seed script used `id: 'businesspoint-law-hq'` instead of `randomUUID()`
2. User was manager in BusinessPoint Law
3. Joshua was enriched → contact created with `crmId: 'businesspoint-law-hq'`
4. This is technically "correct" (matches CompanyHQ ID) but the CompanyHQ ID itself is wrong!

### Proposed Solution

#### A. Update Seed Script
**File**: `scripts/seed-joel-companyhq.js`

```js
// Use UUID for CompanyHQ ID (consistent with other CompanyHQs)
const { randomUUID } = require('crypto');

async function seedJoelCompanyHQ() {
  // ... existing owner resolution code ...
  
  // Define a constant for the CompanyHQ ID so we can reference it
  const BUSINESSPOINT_LAW_HQ_ID = 'businesspoint-law-hq-uuid'; // Or use randomUUID() for new
  
  // Check if it already exists with old ID
  const oldHQ = await prisma.company_hqs.findUnique({
    where: { id: 'businesspoint-law-hq' }
  });
  
  let companyHQ;
  
  if (oldHQ) {
    // Migrate: Update to new UUID-based ID
    console.log('⚠️ Found old BusinessPoint Law CompanyHQ with readable ID');
    console.log('🔄 Migrating to UUID-based ID...');
    
    const newId = randomUUID();
    
    // Update CompanyHQ
    companyHQ = await prisma.company_hqs.update({
      where: { id: 'businesspoint-law-hq' },
      data: { id: newId }
    });
    
    // Update all related records
    await prisma.contact.updateMany({
      where: { crmId: 'businesspoint-law-hq' },
      data: { crmId: newId }
    });
    
    await prisma.company_memberships.updateMany({
      where: { companyHqId: 'businesspoint-law-hq' },
      data: { companyHqId: newId }
    });
    
    // ... update all other relations ...
    
    console.log(`✅ Migrated to new ID: ${newId}`);
  } else {
    // Create new with UUID
    const newId = randomUUID();
    companyHQ = await prisma.company_hqs.create({
      data: {
        id: newId,
        companyName: 'BusinessPoint Law',
        companyIndustry: 'Legal Services',
        ownerId: joel.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    console.log(`✅ Created BusinessPoint Law CompanyHQ: ${newId}`);
  }
  
  // ... rest of membership creation ...
}
```

#### B. Add Verification Script
**File**: `scripts/verify-businesspoint-seed.js`

```js
/**
 * Verify BusinessPoint Law CompanyHQ seed is correct
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySeed() {
  console.log('🔍 Verifying BusinessPoint Law seed...\n');
  
  // Find BusinessPoint Law CompanyHQ
  const hq = await prisma.company_hqs.findFirst({
    where: {
      companyName: 'BusinessPoint Law'
    },
    include: {
      company_memberships: {
        include: {
          owners: true
        }
      },
      contacts_contacts_crmIdTocompany_hqs: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  });
  
  if (!hq) {
    console.log('❌ BusinessPoint Law CompanyHQ not found');
    process.exit(1);
  }
  
  console.log(`✅ Found CompanyHQ:`);
  console.log(`   ID: ${hq.id}`);
  console.log(`   Name: ${hq.companyName}`);
  console.log(`   ID Format: ${hq.id.match(/^[a-f0-9-]{36}$/) ? '✅ UUID' : '❌ Not UUID'}`);
  console.log(`   Memberships: ${hq.company_memberships.length}`);
  hq.company_memberships.forEach(m => {
    console.log(`     - ${m.owners.email}: ${m.role}`);
  });
  console.log(`   Contacts: ${hq.contacts_contacts_crmIdTocompany_hqs.length}`);
  
  // Check for contacts with wrong crmId
  const allContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { email: { contains: 'businesspointlaw.com', mode: 'insensitive' } },
        { lastName: 'Gulick' }
      ]
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      crmId: true,
    }
  });
  
  const wrongContacts = allContacts.filter(c => c.crmId !== hq.id);
  if (wrongContacts.length > 0) {
    console.log(`\n⚠️ Found ${wrongContacts.length} contacts with wrong crmId:`);
    wrongContacts.forEach(c => {
      console.log(`   - ${c.email || c.firstName} ${c.lastName}: crmId=${c.crmId} (should be ${hq.id})`);
    });
  }
  
  await prisma.$disconnect();
}

verifySeed();
```

---

## 4. Contact Create Save Routes - Clear Responsibilities

### Current Confusion
- Multiple routes: `/api/contacts/create`, `/api/contacts`, `/api/contacts/batch`
- Unclear which route to use when
- Different validation logic in each
- Some routes have different `crmId` handling

### Proposed Solution

#### A. Document Route Responsibilities

**File**: `docs/api/CONTACT_ROUTES.md`

```markdown
# Contact Creation Routes

## Route Matrix

| Route | Purpose | When to Use | crmId Source |
|-------|---------|-------------|--------------|
| `POST /api/contacts/create` | Single contact, simple upsert | Manual entry, LinkedIn enrich | Required in body |
| `POST /api/contacts` | Deprecated - delegates to create | Legacy support | Required in body |
| `POST /api/contacts/batch` | CSV upload, bulk import | CSV imports | From owner's primary CompanyHQ |
| `POST /api/contacts/enrich/save` | Save enriched data to existing contact | After Apollo enrichment | From contact's existing crmId |

## Validation Flow

All routes MUST:
1. ✅ Verify Firebase auth
2. ✅ Validate `crmId` is provided (or derived from owner)
3. ✅ Verify `crmId` exists in `company_hqs` table
4. ✅ Verify owner has membership in CompanyHQ (via `resolveMembership`)
5. ✅ Ensure `crmId` format is valid (not a company name)

## Error Responses

- `400`: Missing required fields (crmId, email, etc.)
- `401`: Not authenticated
- `403`: No membership in requested CompanyHQ
- `404`: CompanyHQ not found
- `409`: Contact exists in different CompanyHQ
```

#### B. Standardize Validation

**File**: `lib/validation/contactValidation.js`

```js
import { resolveMembership } from '@/lib/membership';
import { prisma } from '@/lib/prisma';

/**
 * Validate CompanyHQ context before contact operations
 * Throws errors with proper status codes
 */
export async function validateCompanyHQContext(ownerId, crmId) {
  if (!crmId) {
    const error = new Error('crmId (companyHQId) is required');
    error.status = 400;
    throw error;
  }

  // Validate format (should be UUID or valid ID, not company name)
  if (crmId.includes(' ') || (crmId.length < 10 && !crmId.match(/^[a-f0-9-]{36}$/i))) {
    console.warn(`⚠️ Suspicious crmId format: ${crmId}`);
  }

  // Verify CompanyHQ exists
  const companyHQ = await prisma.company_hqs.findUnique({
    where: { id: crmId },
    select: { id: true, companyName: true },
  });

  if (!companyHQ) {
    const error = new Error(`CompanyHQ not found: ${crmId}`);
    error.status = 404;
    error.details = { requestedCompanyHQId: crmId };
    throw error;
  }

  // Verify membership
  const { membership } = await resolveMembership(ownerId, crmId);
  if (!membership) {
    const error = new Error(`No membership in CompanyHQ: ${companyHQ.companyName}`);
    error.status = 403;
    error.details = {
      requestedCompanyHQId: crmId,
      companyHQName: companyHQ.companyName,
      ownerId,
    };
    throw error;
  }

  return {
    companyHQ,
    membership,
  };
}
```

#### C. Update All Routes to Use Validation

**Example for `/api/contacts/create/route.js`:**

```js
import { validateCompanyHQContext } from '@/lib/validation/contactValidation';

export async function POST(request) {
  // ... auth ...
  
  try {
    const body = await request.json();
    const { crmId, firstName, lastName, email } = body;
    
    // Standardized validation
    const { companyHQ, membership } = await validateCompanyHQContext(owner.id, crmId);
    console.log(`✅ ${membership.role} access verified for ${companyHQ.companyName}`);
    
    // ... rest of contact creation ...
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.details,
      },
      { status: error.status || 500 }
    );
  }
}
```

---

## Implementation Priority

1. **🔴 CRITICAL**: Fix contact creation validation (prevent wrong CompanyHQ)
2. **🟠 HIGH**: Add context indicator component (users need to see where they are)
3. **🟡 MEDIUM**: Implement sessionStorage for tab isolation
4. **🟢 LOW**: Fix Joel's seed script (can be done after other fixes)

---

## Testing Checklist

- [ ] Create contact in correct CompanyHQ → ✅ Success
- [ ] Create contact in wrong CompanyHQ → ❌ 403 Error with clear message
- [ ] Switch CompanyHQ context → UI updates immediately
- [ ] Open multiple tabs → Each tab has independent context
- [ ] Enrich contact in wrong context → ❌ Validation error
- [ ] Verify Joel's seed → All contacts have correct crmId
- [ ] Context indicator shows current CompanyHQ → ✅ Visible in UI

---

## Migration Scripts Needed

1. **Fix Joshua's crmId**: Update contact with wrong crmId to correct one
2. **Migrate old BusinessPoint Law ID**: If using readable ID, migrate to UUID
3. **Audit all contacts**: Find all contacts with suspicious crmId values

---

## Questions to Answer

1. Should CompanyHQ IDs be UUIDs only, or allow readable IDs?
2. Should context be shared across tabs or isolated per tab?
3. What's the primary CompanyHQ for users with multiple memberships?
4. Should we log all context switches for audit purposes?

