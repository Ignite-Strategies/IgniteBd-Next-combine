# Bill Route Debugging Guide

## Route Structure

**Route File**: `app/(public)/[companySlug]/[part]/page.jsx`  
**URL Pattern**: `bills.ignitegrowth.biz/company-slug/bill-id`  
**Next.js Path**: `/[companySlug]/[part]` (route groups don't affect URL)

## Example URL

```
https://bills.ignitegrowth.biz/ignite-strategies/advisory-test-copy-c9dsrf2q
```

**Breaks down to:**
- `companySlug` = `"ignite-strategies"`
- `part` = `"advisory-test-copy-c9dsrf2q"`
- `slug` (for DB lookup) = `"ignite-strategies/advisory-test-copy-c9dsrf2q"`

## Route Matching

Next.js should match this URL to:
- `app/(public)/[companySlug]/[part]/page.jsx`

## Troubleshooting Steps

### 1. Check Build Output
```bash
npm run build | grep "\[companySlug\]"
```
Should show: `├ ƒ /[companySlug]/[part]`

### 2. Check Database
Verify bill has:
- `slug` = `"ignite-strategies/advisory-test-copy-c9dsrf2q"`
- `publicBillUrl` = `"https://bills.ignitegrowth.biz/ignite-strategies/advisory-test-copy-c9dsrf2q"`

### 3. Check Vercel
- Is `bills.ignitegrowth.biz` added to IgniteBd-Next-combine project?
- Has the latest deployment completed?
- Check Vercel logs for route matching

### 4. Check Middleware
Middleware logs: `🔍 [BILLS] /pathname`
- Should see the request path in logs
- Should pass through to Next.js router

### 5. Check Route Priority
Next.js matches routes in this order:
1. Static routes (`/about`)
2. Dynamic routes (`/[id]`)
3. Catch-all routes (`/[...slug]`)

The route `/[companySlug]/[part]` is a dynamic route and should match.

## Common Issues

1. **404 Error**: Route not matching
   - Check build output
   - Check Vercel deployment
   - Check middleware isn't blocking

2. **Bill Not Found**: Route matches but DB lookup fails
   - Check server logs for slug mismatch
   - Verify `slug` field in database matches URL pattern

3. **Wrong Domain**: URL pointing to wrong project
   - Verify `bills.ignitegrowth.biz` DNS points to IgniteBd-Next-combine
   - Check Vercel domain configuration

## Testing Locally

To test locally, you'd need to:
1. Add `bills.ignitegrowth.biz` to `/etc/hosts` → `127.0.0.1`
2. Run `npm run dev`
3. Visit `http://bills.ignitegrowth.biz:3000/ignite-strategies/advisory-test-copy-c9dsrf2q`

Or test the route directly:
```
http://localhost:3000/ignite-strategies/advisory-test-copy-c9dsrf2q
```
