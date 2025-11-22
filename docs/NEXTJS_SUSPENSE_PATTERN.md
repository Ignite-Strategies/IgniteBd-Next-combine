# Next.js Suspense Pattern for Routing Hooks

## Problem

Next.js 14/15 enforces that `useSearchParams()`, `usePathname()`, and `useRouter()` must be wrapped in `<Suspense>` when used in pages that are prerendered during static generation.

**Error:**
```
useSearchParams() should be wrapped in a suspense boundary at page "/path/to/page"
Error occurred prerendering page "/path/to/page"
```

## Universal Solution Pattern

### Rule 1: Client Components
Any component using routing hooks must be a **client component**:
```tsx
'use client';

import { useSearchParams } from 'next/navigation';

export default function MyComponent() {
  const searchParams = useSearchParams();
  // ...
}
```

### Rule 2: Suspense Boundary
If the parent page is a **server component** (default in app router), wrap the client component in `<Suspense>`:

**Pattern A: Separate Client Component (Recommended)**
```tsx
// page.tsx (Server Component - no 'use client')
import { Suspense } from 'react';
import MyClientComponent from './MyClientComponent';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyClientComponent />
    </Suspense>
  );
}
```

```tsx
// MyClientComponent.tsx (Client Component)
'use client';

import { useSearchParams } from 'next/navigation';

export default function MyClientComponent() {
  const searchParams = useSearchParams();
  const param = searchParams.get('param');
  
  return <div>{param}</div>;
}
```

**Pattern B: Client Page with Suspense**
```tsx
// page.tsx (Client Component)
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function Content() {
  const searchParams = useSearchParams();
  // ...
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Content />
    </Suspense>
  );
}
```

## Applied Fixes

### ✅ Fixed: `/ignite/work-item/product-definition`
- **Before**: Client component using `useSearchParams()` directly
- **After**: Extracted to `ProductDefinitionClient.tsx`, wrapped in Suspense in server page component

### ✅ Already Correct: Other Pages
The following pages already follow the pattern correctly:
- `/outreach` - Wrapped in Suspense
- `/assessment/results` - Wrapped in Suspense  
- `/client-operations/execution/timelines` - Wrapped in Suspense
- `/workpackages/blank` - Wrapped in Suspense
- `/workpackages/assemble/templates` - Wrapped in Suspense

## Checklist for New Pages

When creating a new page that uses routing hooks:

- [ ] If using `useSearchParams()`, `usePathname()`, or `useRouter()`:
  - [ ] Component must have `'use client'` directive
  - [ ] If parent is a server component, wrap in `<Suspense>`
  - [ ] Provide a meaningful fallback UI

## Common Patterns

### Pattern 1: Server Page → Client Component in Suspense
```tsx
// page.tsx
import { Suspense } from 'react';
import ClientContent from './ClientContent';

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientContent />
    </Suspense>
  );
}
```

### Pattern 2: Client Page with Internal Suspense
```tsx
// page.tsx
'use client';
import { Suspense } from 'react';

function Content() {
  const params = useSearchParams();
  // ...
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Content />
    </Suspense>
  );
}
```

## Why This Matters

- **Static Generation**: Next.js tries to prerender pages at build time
- **Client Hooks**: `useSearchParams()` requires client-side execution
- **Suspense**: Tells Next.js to defer rendering until client-side hydration
- **Build Errors**: Without Suspense, Next.js throws build errors during static generation

## References

- [Next.js useSearchParams Documentation](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Next.js Suspense Documentation](https://nextjs.org/docs/app/api-reference/react-components/suspense)

