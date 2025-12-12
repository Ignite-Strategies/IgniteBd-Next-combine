# 'use client' Directive Guide

**Last Updated**: December 2024  
**Next.js Version**: 14+ (App Router)

---

## What is 'use client'?

The `'use client'` directive is a Next.js 13+ feature that marks a component (and all its children) as a **Client Component**. This tells Next.js to:

1. **Bundle this component for the browser** - Include it in the client-side JavaScript bundle
2. **Enable React hooks** - Allow `useState`, `useEffect`, `useRouter`, etc.
3. **Enable browser APIs** - Access `window`, `localStorage`, `document`, etc.
4. **Enable event handlers** - `onClick`, `onChange`, `onSubmit`, etc.

**Without `'use client'`**, a component is a **Server Component** by default, which:
- Renders on the server
- Cannot use hooks or browser APIs
- Cannot have event handlers
- Can directly access databases (Prisma) and server-only APIs
- Is not included in the client bundle (smaller JS)

---

## When to Use 'use client'

### ✅ USE 'use client' When:

1. **Interactive UI** - Buttons, forms, inputs, dropdowns
   ```jsx
   'use client';
   
   export default function Button() {
     const [clicked, setClicked] = useState(false);
     return <button onClick={() => setClicked(true)}>Click me</button>;
   }
   ```

2. **React Hooks** - `useState`, `useEffect`, `useRouter`, `useContext`
   ```jsx
   'use client';
   
   export default function SearchBar() {
     const [query, setQuery] = useState('');
     const router = useRouter();
     // ...
   }
   ```

3. **Browser APIs** - `window`, `localStorage`, `document`, `navigator`
   ```jsx
   'use client';
   
   export default function ThemeToggle() {
     useEffect(() => {
       const theme = localStorage.getItem('theme');
       // ...
     }, []);
   }
   ```

4. **Event Handlers** - `onClick`, `onChange`, `onSubmit`
   ```jsx
   'use client';
   
   export default function Form() {
     const handleSubmit = (e) => {
       e.preventDefault();
       // ...
     };
     return <form onSubmit={handleSubmit}>...</form>;
   }
   ```

5. **Third-party Client Libraries** - Libraries that require browser APIs
   ```jsx
   'use client';
   
   import { Chart } from 'chart.js'; // Requires browser APIs
   ```

### ❌ DON'T Use 'use client' When:

1. **Static Content** - Text, images, layouts
   ```jsx
   // No 'use client' needed
   export default function Header({ title }) {
     return <h1>{title}</h1>;
   }
   ```

2. **Data Fetching (Server)** - Direct Prisma calls, server-only APIs
   ```jsx
   // No 'use client' - Server Component
   import { prisma } from '@/lib/prisma';
   
   export default async function UserList() {
     const users = await prisma.user.findMany();
     return <div>{/* render users */}</div>;
   }
   ```

3. **SEO Content** - Blog posts, product descriptions
   ```jsx
   // Server Component - better for SEO
   export default function BlogPost({ content }) {
     return <article>{content}</article>;
   }
   ```

---

## How We're Implementing It

### Current Pattern in IgniteBD

**All page components use `'use client'`** because:
- We need interactive UI (search, filters, forms)
- We use React hooks extensively (`useState`, `useEffect`, `useRouter`)
- We access `localStorage` for `companyHQId`
- We make API calls from the client

**Example: Execution Page**
```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ExecutionPage() {
  const router = useRouter();
  const [workPackage, setWorkPackage] = useState(null);
  // ... interactive UI
}
```

### Component Hierarchy

**Client Components can import Server Components**, but **Server Components cannot import Client Components**.

```
Server Component (page.jsx - no 'use client')
  └── Client Component (Button.jsx - 'use client')
       └── Server Component (Text.jsx - no 'use client') ✅ OK
```

**But this fails:**
```
Server Component (page.jsx - no 'use client')
  └── Client Component (Button.jsx - 'use client') ❌ ERROR
```

### Our Current Architecture

**All pages are Client Components** because:
1. **Authentication checks** - We check Firebase auth state
2. **Dynamic routing** - We use `useRouter` for navigation
3. **State management** - We use `useState` for UI state
4. **API calls** - We call our Next.js API routes from the client
5. **localStorage** - We store `companyHQId` in localStorage

**Example Structure:**
```
src/app/(authenticated)/execution/page.jsx
  'use client' ← Page is client component
  
  └── components/execution/PhasesSection.jsx
       'use client' ← Component is client component
       
       └── components/execution/PhaseCard.jsx
            'use client' ← Component is client component
```

---

## Common Patterns

### Pattern 1: Page with Interactive UI

```jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}
```

### Pattern 2: Component with Event Handlers

```jsx
'use client';

export default function SearchBar({ onSearch }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const query = e.target.query.value;
    onSearch(query);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="query" />
      <button type="submit">Search</button>
    </form>
  );
}
```

### Pattern 3: Component with Browser APIs

```jsx
'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored) setTheme(stored);
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };
  
  return <button onClick={toggleTheme}>Toggle Theme</button>;
}
```

### Pattern 4: Component with API Calls

```jsx
'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function DataList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      const response = await api.get('/api/data');
      setData(response.data);
      setLoading(false);
    };
    fetchData();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  return <div>{/* render data */}</div>;
}
```

---

## File Count in Our Codebase

**126 files** use `'use client'` in `IgniteBd-Next-combine/src`:

- **Page components** (`page.jsx`) - All interactive pages
- **Layout components** (`layout.jsx`) - Layouts with state/hooks
- **Custom components** - Buttons, forms, interactive UI
- **Hooks** (`hooks/*.js`) - Custom React hooks
- **Context providers** - React Context providers

**Examples:**
- `src/app/(authenticated)/execution/page.jsx`
- `src/components/execution/PhaseCard.jsx`
- `src/components/Sidebar.jsx`
- `src/hooks/useWorkPackageHydration.js`

---

## Best Practices

### 1. **Keep 'use client' at the Top**

```jsx
'use client'; // ← Must be first line

import { useState } from 'react';
// ... rest of code
```

### 2. **Minimize Client Components**

Only mark components as client components if they need:
- Hooks
- Event handlers
- Browser APIs

**Bad:**
```jsx
'use client'; // ❌ Unnecessary

export default function StaticText({ text }) {
  return <p>{text}</p>;
}
```

**Good:**
```jsx
// ✅ No 'use client' - Server Component
export default function StaticText({ text }) {
  return <p>{text}</p>;
}
```

### 3. **Isolate Client Code**

Keep client-specific code in separate components:

```jsx
// Server Component (no 'use client')
export default function Page() {
  return (
    <div>
      <StaticContent />
      <InteractiveButton /> {/* Client Component */}
    </div>
  );
}

// Client Component
'use client';
function InteractiveButton() {
  const [clicked, setClicked] = useState(false);
  return <button onClick={() => setClicked(true)}>Click</button>;
}
```

### 4. **Use Server Components for Data Fetching**

When possible, fetch data in Server Components:

```jsx
// Server Component - can use Prisma directly
import { prisma } from '@/lib/prisma';

export default async function UserList() {
  const users = await prisma.user.findMany();
  return <UserListClient users={users} />;
}

// Client Component - receives data as props
'use client';
function UserListClient({ users }) {
  const [filter, setFilter] = useState('');
  // ... interactive filtering
}
```

---

## Migration from Pages Router

**Old (Pages Router):**
- All components were client components by default
- No distinction between server and client

**New (App Router):**
- Components are Server Components by default
- Must explicitly mark with `'use client'` for interactivity
- Can use Server Components for better performance

---

## Troubleshooting

### Error: "useState is not defined"

**Problem:** Using hooks in a Server Component

**Solution:** Add `'use client'` at the top of the file

```jsx
'use client'; // ← Add this

import { useState } from 'react';
```

### Error: "localStorage is not defined"

**Problem:** Accessing `localStorage` in a Server Component

**Solution:** Move to a Client Component or use `useEffect`

```jsx
'use client';

import { useEffect, useState } from 'react';

export default function Component() {
  const [value, setValue] = useState('');
  
  useEffect(() => {
    // Only runs on client
    const stored = localStorage.getItem('key');
    setValue(stored);
  }, []);
}
```

### Error: "Cannot import Client Component into Server Component"

**Problem:** Importing a Client Component into a Server Component

**Solution:** Either:
1. Make the parent a Client Component
2. Pass the Client Component as a child (not import)

```jsx
// ❌ Bad
import ClientButton from './ClientButton';

export default function ServerPage() {
  return <ClientButton />; // Error
}

// ✅ Good
'use client';
import ClientButton from './ClientButton';

export default function ClientPage() {
  return <ClientButton />; // OK
}
```

---

## Related Documentation

- **`docs/architecture/overview.md`** - Overall architecture
- **`docs/architecture/hydration.md`** - Data hydration patterns
- **Next.js Docs**: [Server and Client Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

---

**Last Updated**: December 2024  
**Next.js Version**: 14+ (App Router)  
**Pattern**: All pages are Client Components for interactivity

