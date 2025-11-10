# Hub Hydration Guide: Surgical Points

## Overview

**Focus:** Surgical hydration points for "hubs" only.

**Architecture:**
- **Welcome Hub** → Sets `ownerId` and `companyHQId` via `useOwner` hook
- **Contacts Hub** → Gets all contacts from `companyHQId`, stores in localStorage

---

## localStorage Naming Convention

### Core Keys (Always Present)

```javascript
// Owner level
'ownerId'        // string - Owner database ID
'owner'          // JSON string - Full Owner object
'firebaseId'     // string - Firebase UID

// Company level
'companyHQId'    // string - CompanyHQ database ID (tenant identifier)
'companyHQ'      // JSON string - Full CompanyHQ object
```

### Feature Data Keys (Hub-Specific)

```javascript
// Contacts Hub
'contacts'       // JSON string - Array of Contact objects

// Future hubs (following same pattern)
'contactLists'   // JSON string - Array of ContactList objects
'companies'       // JSON string - Array of Company objects (prospect/client)
'proposals'      // JSON string - Array of Proposal objects
'products'       // JSON string - Array of Product objects
'personas'       // JSON string - Array of Persona objects
'campaigns'      // JSON string - Array of Campaign objects
```

### Naming Rules

1. **camelCase** for all keys
2. **Singular** for objects: `owner`, `companyHQ`
3. **Plural** for arrays: `contacts`, `proposals`, `products`
4. **No prefixes** - keys are global (scoped by companyHQId in data)
5. **Consistent** - same key name across all code

---

## Hooks in Next.js

**Yes, we use hooks in Next.js!**

- **Client Components** (`'use client'`) can use all React hooks
- **Server Components** (default) cannot use hooks
- **Custom hooks** are just functions that use React hooks

**Pattern:**
```javascript
'use client'; // Required for hooks

import { useState, useEffect } from 'react';

export function useCustomHook() {
  const [state, setState] = useState();
  // ... hook logic
  return { state };
}
```

---

## Hub 1: Welcome Hub (`/welcome`)

### Purpose
- Hydrate owner data
- Set `ownerId` and `companyHQId` in localStorage
- Route based on completeness

### Implementation

**Hook:** `useOwner()` - Provides owner and companyHQId management

```javascript
'use client';

import { useOwner } from '@/hooks/useOwner';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const { ownerId, owner, companyHQId, loading, hydrated, refresh } = useOwner();

  useEffect(() => {
    // If not hydrated, refresh from API
    if (!hydrated && !loading) {
      refresh();
    }
  }, [hydrated, loading, refresh]);

  // Determine next route
  useEffect(() => {
    if (!hydrated || loading) return;

    if (!companyHQId || !owner?.ownedCompanies?.length) {
      router.push('/company/create-or-choose');
    } else {
      router.push('/growth-dashboard');
    }
  }, [hydrated, loading, companyHQId, owner, router]);

  // ... render UI
}
```

### What Gets Stored

```javascript
// From useOwner hook refresh():
localStorage.setItem('ownerId', ownerData.id);
localStorage.setItem('owner', JSON.stringify(ownerData));
if (ownerData.companyHQId) {
  localStorage.setItem('companyHQId', ownerData.companyHQId);
  localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
}
```

### API Call
- `GET /api/owner/hydrate` - Returns owner with companyHQ data

---

## Hub 2: Contacts Hub (`/contacts`)

### Purpose
- Get all contacts for the tenant (using `companyHQId`)
- Store in localStorage as `contacts`
- Provide via React Context to child pages

### Implementation

**Layout:** `src/app/(authenticated)/contacts/layout.jsx`

```javascript
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';

const ContactsContext = createContext({
  contacts: [],
  loading: false,
  hydrated: false,
  refresh: async () => {},
});

export function useContacts() {
  return useContext(ContactsContext);
}

export default function ContactsLayout({ children }) {
  const { companyHQId } = useCompanyHQ(); // Get companyHQId from hook
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Step 1: Check localStorage cache
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cached = localStorage.getItem('contacts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setContacts(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached contacts', error);
      }
    }
  }, []);

  // Step 2: Fetch from API when companyHQId is available
  const refresh = useCallback(async () => {
    if (!companyHQId) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      const fetchedContacts = response.data?.contacts ?? [];
      
      setContacts(fetchedContacts);
      
      // Step 3: Store in localStorage
      localStorage.setItem('contacts', JSON.stringify(fetchedContacts));
      setHydrated(true);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [companyHQId]);

  // Step 4: Auto-fetch if not hydrated
  useEffect(() => {
    if (companyHQId && !hydrated) {
      refresh();
    }
  }, [companyHQId, hydrated, refresh]);

  return (
    <ContactsContext.Provider value={{ contacts, loading, hydrated, refresh }}>
      {children}
    </ContactsContext.Provider>
  );
}
```

### What Gets Stored

```javascript
// From refresh():
localStorage.setItem('contacts', JSON.stringify(contacts));
```

### API Call
- `GET /api/contacts?companyHQId=${companyHQId}` - Returns all contacts for tenant

### Usage in Pages

```javascript
'use client';

import { useContacts } from '../layout';

export default function ContactsPage() {
  const { contacts, loading, hydrated, refresh } = useContacts();
  
  // Use contacts data...
}
```

---

## Pattern for Future Hubs

### Template

```javascript
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import api from '@/lib/api';

const FeatureContext = createContext({
  data: [],
  loading: false,
  hydrated: false,
  refresh: async () => {},
});

export function useFeature() {
  return useContext(FeatureContext);
}

export default function FeatureLayout({ children }) {
  const { companyHQId } = useCompanyHQ();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 1. Check localStorage cache
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('featureData'); // Replace with actual key
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setData(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached data', error);
      }
    }
  }, []);

  // 2. Fetch from API
  const refresh = useCallback(async () => {
    if (!companyHQId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/feature?companyHQId=${companyHQId}`);
      const fetched = response.data?.data ?? [];
      setData(fetched);
      localStorage.setItem('featureData', JSON.stringify(fetched)); // Replace key
      setHydrated(true);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [companyHQId]);

  // 3. Auto-fetch if not hydrated
  useEffect(() => {
    if (companyHQId && !hydrated) {
      refresh();
    }
  }, [companyHQId, hydrated, refresh]);

  return (
    <FeatureContext.Provider value={{ data, loading, hydrated, refresh }}>
      {children}
    </FeatureContext.Provider>
  );
}
```

---

## Summary

### Welcome Hub
- **Hook:** `useOwner()`
- **Stores:** `ownerId`, `owner`, `companyHQId`, `companyHQ`
- **API:** `GET /api/owner/hydrate`

### Contacts Hub
- **Hook:** `useCompanyHQ()` + `useContacts()`
- **Stores:** `contacts` (array)
- **API:** `GET /api/contacts?companyHQId=${companyHQId}`

### Pattern
1. Use `useCompanyHQ()` to get `companyHQId`
2. Check localStorage for cached data
3. If cached, use for fast initial render
4. Fetch fresh from API using `companyHQId`
5. Store in localStorage
6. Provide via React Context

---

**Last Updated**: November 2025  
**Focus**: Surgical hydration for hubs only  
**Principle**: Maximize localStorage, minimal API calls

