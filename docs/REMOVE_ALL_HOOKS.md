# Remove ALL Hooks - Direct localStorage Pattern

## Pattern to Apply Everywhere

**Replace this:**
```javascript
import { useOwner } from '@/hooks/useOwner';
const { ownerId, owner } = useOwner();
```

**With this:**
```javascript
// Direct read from localStorage - NO HOOKS
const [ownerId, setOwnerId] = useState(null);
const [owner, setOwner] = useState(null);
useEffect(() => {
  if (typeof window === 'undefined') return;
  const storedOwnerId = localStorage.getItem('ownerId');
  const storedOwner = localStorage.getItem('owner');
  if (storedOwnerId) setOwnerId(storedOwnerId);
  if (storedOwner) {
    try {
      setOwner(JSON.parse(storedOwner));
    } catch (e) {
      console.warn('Failed to parse owner', e);
    }
  }
}, []);
```

## Why This Works

1. **ownerId is in localStorage** - Set by welcome page
2. **Axios token handles auth** - Interceptor adds Firebase token automatically
3. **No hooks needed** - Direct synchronous reads are instant
4. **No delays** - No waiting for hook hydration

## Pages Still Using Hooks (22 files)

- [ ] companies/page.jsx
- [ ] contacts/list-builder/preview/page.jsx
- [ ] workpackages/view/page.jsx (deprecated - skip)
- [ ] products/builder/page.jsx
- [ ] events/preferences/page.tsx
- [ ] contacts/companies/page.jsx
- [ ] pipelines/page.jsx
- [ ] personas/from-contact/page.jsx
- [ ] builder/template/[templateId]/page.jsx
- [ ] events/plan-picker/page.tsx
- [ ] events/confirm-plan/page.tsx
- [ ] events/search-pick/[tunerId]/page.tsx
- [ ] outreach/campaigns/create/page.jsx
- [ ] outreach/campaigns/page.jsx
- [ ] outreach/campaigns/[campaignId]/edit/page.jsx
- [ ] assessment/page.jsx
- [ ] portal/uploads/page.jsx
- [ ] outreach/sender-verify/page.jsx
- [ ] contacts/ingest/microsoft/page.jsx
- [ ] contacts/enrich/microsoft/page.jsx
- [ ] content/presentations/create/page.jsx
- [ ] client-operations/proposals/layout.jsx

## Notes

- **Skip workpackages** - Deprecated
- **Axios token = auth** - Don't pass ownerId for auth, backend gets it from token
- **ownerId in params** - Only if API needs it for business logic (filtering, etc.)

