# Cookie-Based Refactor Proposal (No Hooks)

## Problem with Current Approach

- **Hooks everywhere** - useState, useEffect for every ID
- **Race conditions** - Multiple useEffects firing at different times
- **localStorage only** - Can't be read server-side
- **Complex state management** - React state for simple values

## Solution: Cookies

### Benefits
1. ✅ **No hooks needed** - Just read cookies directly
2. ✅ **Server-readable** - API routes can read cookies
3. ✅ **Client-readable** - Components can read cookies
4. ✅ **Automatic sync** - Cookies sent with every request
5. ✅ **Simple** - `getCookie('companyHQId')` - that's it

### Implementation

#### 1. Cookie Utility (`lib/cookies.js`)
```javascript
// Simple getter/setter - NO HOOKS
export function getCompanyHQId() {
  return getCookie('companyHQId') || localStorage.getItem('companyHQId');
}

export function getOwnerId() {
  return getCookie('ownerId') || localStorage.getItem('ownerId');
}
```

#### 2. Compose Page (Simplified)
```javascript
// BEFORE (with hooks):
const [companyHQId, setCompanyHQId] = useState('');
useEffect(() => {
  const stored = localStorage.getItem('companyHQId');
  setCompanyHQId(stored);
}, []);

// AFTER (no hooks):
import { getCompanyHQId } from '@/lib/cookies';

function ComposeContent() {
  // Read directly - no state, no effect
  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const cookieCompanyHQId = getCompanyHQId();
  const companyHQId = urlCompanyHQId || cookieCompanyHQId;
  
  // If URL has it, sync to cookie
  if (urlCompanyHQId && urlCompanyHQId !== cookieCompanyHQId) {
    setCompanyHQId(urlCompanyHQId);
  }
}
```

#### 3. Components (Simplified)
```javascript
// BEFORE (with props):
<ContactSelector companyHQId={companyHQId} />

// AFTER (read directly):
import { getCompanyHQId } from '@/lib/cookies';

function ContactSelector() {
  const companyHQId = getCompanyHQId();
  // Use directly - no props needed
}
```

#### 4. API Routes (Can Read Cookies)
```javascript
// Server-side can read cookies
export async function GET(request) {
  const companyHQId = request.cookies.get('companyHQId');
  const ownerId = request.cookies.get('ownerId');
  
  // Use directly - no need to pass as params
}
```

## Migration Strategy

### Phase 1: Add Cookie Utility
- ✅ Create `lib/cookies.js`
- ✅ Add getter/setter functions
- ✅ Add migration from localStorage

### Phase 2: Update Compose Page
- Replace useState/useEffect with direct cookie reads
- Keep URL param as primary source
- Sync URL → cookie when URL changes

### Phase 3: Update Components
- ContactSelector: Read cookie directly (no prop)
- SenderIdentityPanel: Read cookie directly (no prop)
- TemplateSelector: Read cookie directly (no prop)

### Phase 4: Update API Routes (Optional)
- Read cookies server-side instead of requiring params
- Still accept params for backward compatibility

## Example: Before vs After

### Before (Current - Hook Hell)
```javascript
function ComposeContent() {
  const [companyHQId, setCompanyHQId] = useState('');
  const [ownerId, setOwnerId] = useState(null);
  
  useEffect(() => {
    const stored = localStorage.getItem('companyHQId');
    setCompanyHQId(stored);
  }, []);
  
  useEffect(() => {
    const stored = localStorage.getItem('ownerId');
    setOwnerId(stored);
  }, []);
  
  useEffect(() => {
    if (!companyHQId) return;
    // Load templates
  }, [companyHQId]);
  
  useEffect(() => {
    if (!ownerId) return;
    // Load sender
  }, [ownerId]);
  
  return (
    <ContactSelector companyHQId={companyHQId} />
    <SenderIdentityPanel ownerId={ownerId} />
  );
}
```

### After (Cookie-Based - Simple)
```javascript
import { getCompanyHQId, getOwnerId } from '@/lib/cookies';

function ComposeContent() {
  // Read directly - no state, no effects
  const companyHQId = searchParams?.get('companyHQId') || getCompanyHQId();
  const ownerId = getOwnerId();
  
  // If URL has companyHQId, sync to cookie
  if (searchParams?.get('companyHQId')) {
    setCompanyHQId(searchParams.get('companyHQId'));
  }
  
  return (
    <ContactSelector /> {/* Reads cookie internally */}
    <SenderIdentityPanel /> {/* Reads cookie internally */}
  );
}
```

## Benefits Summary

1. **No hooks** - Just read cookies when needed
2. **No prop drilling** - Components read cookies directly
3. **Server-readable** - API routes can access cookies
4. **Simpler code** - Less state management
5. **Automatic sync** - Cookies sent with every request
6. **Migration path** - Falls back to localStorage during transition

