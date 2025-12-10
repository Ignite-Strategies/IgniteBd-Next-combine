# Billing WorkPackage Hydration - localStorage First Pattern

**Date:** 2025-01-28

---

## 🎯 Pattern

**ALWAYS check localStorage FIRST before making API calls.**

When creating an invoice with a `workPackageId`:
1. Get that workPackage
2. Extract `companyHQId` from `workPackage.contact.crmId`
3. Hydrate ALL workpackages for that companyHQ
4. Store in localStorage

---

## 📊 Flow

### Create Invoice Page Load

```
1. Check localStorage for 'workPackages'
   ↓
2. If found → Use cached data (NO API CALL)
   ↓
3. If not found → Fetch from API → Store in localStorage
```

### When workPackageId Provided in URL

```
1. Check localStorage for workPackage with that ID
   ↓
2. If found:
   - Set as selected
   - Extract companyHQId from workPackage.contact.crmId
   - Hydrate all workpackages for that companyHQ
   ↓
3. If not found:
   - Fetch workPackage from API
   - Extract companyHQId from workPackage.contact.crmId
   - Hydrate all workpackages for that companyHQ
   - Store everything in localStorage
```

---

## 🔑 Key Points

### localStorage Keys
- `workPackages` - Array of all workpackages (from dashboard hydration)
- `companyHydration_${companyHQId}` - Full company hydration cache

### CompanyHQ Extraction
```javascript
// From workPackage
const companyHQId = workPackage.contact.crmId; // crmId IS the companyHQId
```

### Hydration Call
```javascript
// After getting workPackage, hydrate all workpackages for that companyHQ
await api.get(`/api/workpackages?companyHQId=${companyHQId}`);
```

---

## 📝 Implementation

### Create Invoice Page
```javascript
// 1. Check localStorage FIRST
const cached = window.localStorage.getItem('workPackages');
if (cached) {
  const parsed = JSON.parse(cached);
  setWorkPackages(parsed); // Use cached, skip API
  return;
}

// 2. If workPackageId provided, get companyHQ and hydrate
if (workPackageId) {
  const workPackage = await api.get(`/api/workpackages?id=${workPackageId}`);
  const companyHQId = workPackage.contact.crmId;
  
  // Hydrate all workpackages for this companyHQ
  const allPackages = await api.get(`/api/workpackages?companyHQId=${companyHQId}`);
  
  // Store in localStorage
  window.localStorage.setItem('workPackages', JSON.stringify(allPackages));
}
```

---

## ✅ Benefits

1. **Fast Load** - No API call if data exists in localStorage
2. **Complete Data** - When workPackageId provided, gets ALL workpackages for that companyHQ
3. **Consistent** - Same data pattern as dashboard
4. **Offline-Friendly** - Works with cached data

---

**Last Updated:** 2025-01-28

