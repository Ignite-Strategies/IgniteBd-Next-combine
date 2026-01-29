# Bill Display Architecture

## Overview

Bills are **created and assigned** in **Ignite-platform-manager**, but **displayed** in **IgniteBd-Next-combine**.

## Flow

### 1. Bill Creation & Assignment (Platform Manager)
- **Repo**: `Ignite-platform-manager`
- **Route**: `/platform/bills/[id]/edit`
- **API**: `/api/platform/bills/assign` (proxies to IgniteBd)
- **Action**: User assigns bill to company

### 2. URL Generation (IgniteBd)
- **Repo**: `IgniteBd-Next-combine`
- **API**: `/api/bills/assign`
- **Generates**: `publicBillUrl = https://bills.ignitegrowth.biz/company-slug/bill-id`
- **Stores**: `slug` and `publicBillUrl` in `bills` table

### 3. Bill Display (IgniteBd)
- **Repo**: `IgniteBd-Next-combine` ✅
- **Route**: `app/(public)/[companySlug]/[part]/page.jsx`
- **URL**: `bills.ignitegrowth.biz/company-slug/bill-id`
- **Component**: `InvoiceBill` (professional invoice style)
- **No Auth**: Completely public, no AppShell

## Route Structure

```
IgniteBd-Next-combine/
  app/
    (public)/
      [companySlug]/
        [part]/
          page.jsx      ← Handles bills.ignitegrowth.biz/company-slug/bill-id
          loading.jsx    ← Loading state with Ignite logo
      layout.jsx         ← Skips AppShell for bill routes
      bill/
        [companySlug]/
          [part]/
            page.jsx    ← Handles app.ignitegrowth.biz/bill/company-slug/bill-id (legacy)
```

## Vercel Configuration

**bills.ignitegrowth.biz** must be configured in Vercel to point to:
- **Project**: IgniteBd-Next-combine (not platform manager!)
- **Domain**: bills.ignitegrowth.biz
- **Same deployment** as app.ignitegrowth.biz

## Troubleshooting

If bills aren't loading:

1. **Check Vercel**: Is `bills.ignitegrowth.biz` added to IgniteBd-Next-combine project?
2. **Check Deployment**: Has IgniteBd-Next-combine been deployed after route changes?
3. **Check Route**: Verify `/[companySlug]/[part]` route is built (check build logs)
4. **Check Database**: Verify bill has `slug` and `publicBillUrl` set
5. **Check Logs**: Server logs will show "Bill not found for slug: X" if route works but DB lookup fails

## Testing

1. Create/assign bill in Platform Manager
2. Copy the `publicBillUrl` (should be `bills.ignitegrowth.biz/...`)
3. Visit URL directly
4. Should see InvoiceBill component (professional invoice style)
