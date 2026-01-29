# Bill Payment Subdomain Setup

## Overview

Public bill payment pages are currently served at:
- `https://app.ignitegrowth.biz/bill/[companySlug]/[part]`

For a cleaner, more professional URL structure, bills can be served from a dedicated subdomain:
- `https://bills.ignitegrowth.biz/[companySlug]/[part]`

## Current Implementation

Bill pages are standalone, minimal pages that:
- ✅ Do NOT show admin UI (Navigation, CompanyHQContextHeader, Sidebar)
- ✅ Have their own full-page gradient background
- ✅ Are server-rendered for instant load
- ✅ Use the `BillContainer` component for consistent branding

The `AppShell` component excludes `/bill` routes from showing admin UI, even when users are authenticated.

## Subdomain Setup (Optional)

### Benefits
1. **Cleaner URLs**: `bills.ignitegrowth.biz/company-name/bill-id` vs `app.ignitegrowth.biz/bill/company-name/bill-id`
2. **Better Branding**: Dedicated subdomain for payment pages
3. **Separation of Concerns**: Payment pages completely separate from app management

### Implementation Steps

#### 1. DNS Configuration
Add a CNAME record:
```
bills.ignitegrowth.biz → CNAME → app.ignitegrowth.biz
```

#### 2. Vercel Configuration
In Vercel project settings:
- Add `bills.ignitegrowth.biz` as a domain
- Configure SSL certificate
- Set up redirects if needed

#### 3. Next.js Configuration
Update `next.config.js` to handle the subdomain:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
  async rewrites() {
    return [
      {
        source: '/:companySlug/:part',
        destination: '/bill/:companySlug/:part',
        has: [
          {
            type: 'host',
            value: 'bills.ignitegrowth.biz',
          },
        ],
      },
    ];
  },
};
```

#### 4. Update Payment URL Generation
Update `app/api/bills/assign/route.ts` to use the subdomain:

```typescript
// Option 1: Use subdomain if configured
const BILLS_DOMAIN = process.env.BILLS_DOMAIN || 'app.ignitegrowth.biz';
const publicBillUrl = `${BILLS_DOMAIN}/bill/${companySlug}/${part}`;

// Option 2: Always use subdomain
const publicBillUrl = `https://bills.ignitegrowth.biz/${companySlug}/${part}`;
```

#### 5. Environment Variables
Add to `.env`:
```
BILLS_DOMAIN=bills.ignitegrowth.biz
```

## Current Status

✅ Bill pages are isolated from admin UI  
✅ Standalone container with minimal branding  
✅ Server-side rendering for performance  
✅ **Subdomain setup implemented** - Cleaner URLs active

## Implementation Complete

The bills subdomain is now configured with cleaner URLs:

- **Old format**: `app.ignitegrowth.biz/bill/company-slug/bill-id`
- **New format**: `bills.ignitegrowth.biz/company-slug/bill-id` ✨

### What Was Changed

1. **Next.js Rewrites** (`next.config.mjs`):
   - Added rewrite rule: `bills.ignitegrowth.biz/:companySlug/:part` → `/bill/:companySlug/:part`
   - Allows cleaner URLs on bills subdomain while maintaining route compatibility

2. **URL Generation** (`app/api/bills/assign/route.ts`):
   - Updated to generate URLs using `bills.ignitegrowth.biz` subdomain
   - Uses `BILLS_DOMAIN` environment variable (defaults to `bills.ignitegrowth.biz`)
   - Format: `https://bills.ignitegrowth.biz/company-slug/bill-id`

### Backward Compatibility

- Old URLs (`app.ignitegrowth.biz/bill/...`) still work
- Existing bills in database continue to function
- New bills will use the cleaner format automatically

## Testing

After subdomain setup:
1. Verify DNS propagation: `dig bills.ignitegrowth.biz`
2. Test bill URL: `https://bills.ignitegrowth.biz/[companySlug]/[part]`
3. Verify no admin UI appears (even when logged in)
4. Test payment flow end-to-end
