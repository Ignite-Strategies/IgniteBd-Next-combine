# Presentation LocalStorage Hook Fix

## Problem

Presentations were being hydrated via the `/api/company/hydrate` endpoint, but they weren't being:
1. Stored in localStorage by the `useCompanyHydration` hook
2. Exposed as a convenience getter from the hook
3. Available to components that use the hook

The presentations page was manually managing its own localStorage key (`presentations_${companyHQId}`), but this wasn't being populated by the company hydration hook.

## Solution

Updated `useCompanyHydration` hook to:

1. **Include presentations in state**: Added `presentations`, `blogs`, `templates`, and `landingPages` to the initial state
2. **Store presentations in localStorage**: When refreshing from API, now stores presentations in:
   - `presentations` (global key)
   - `presentations_${companyHQId}` (company-specific key, for backward compatibility)
3. **Expose presentations as convenience getter**: Added `presentations` to the return object
4. **Load presentations on mount**: When loading from localStorage, ensures presentations are included
5. **Fallback loading**: If company hydration data doesn't exist, tries to load presentations from the company-specific key

## Changes Made

### `src/hooks/useCompanyHydration.js`

1. Added content types to initial state:
   ```javascript
   presentations: [],
   blogs: [],
   templates: [],
   landingPages: [],
   ```

2. Include content types in hydrated data:
   ```javascript
   presentations: response.data.presentations || [],
   blogs: response.data.blogs || [],
   templates: response.data.templates || [],
   landingPages: response.data.landingPages || [],
   ```

3. Store presentations in localStorage:
   ```javascript
   localStorage.setItem('presentations', JSON.stringify(hydratedData.presentations));
   localStorage.setItem(`presentations_${companyHQId}`, JSON.stringify(hydratedData.presentations));
   ```

4. Expose presentations in return object:
   ```javascript
   presentations: data.presentations,
   blogs: data.blogs,
   templates: data.templates,
   landingPages: data.landingPages,
   ```

5. Enhanced localStorage loading with fallback:
   - Ensures presentations are included when loading from company hydration cache
   - Falls back to `presentations_${companyHQId}` key if main cache doesn't exist

## Usage

Now components can use presentations from the hook:

```javascript
import { useCompanyHydration } from '@/hooks/useCompanyHydration';

function MyComponent() {
  const { presentations, refresh } = useCompanyHydration(companyHQId);
  
  // presentations is now available and properly hydrated
  // with normalized slides.sections structure
}
```

## Benefits

1. **Consistent data source**: Presentations come from the same hydration endpoint as other company data
2. **Automatic updates**: When company data is refreshed, presentations are updated too
3. **Proper normalization**: Presentations loaded via hook have normalized `slides.sections` structure
4. **Backward compatible**: Still supports the `presentations_${companyHQId}` key for existing code

## Testing

1. Call `refresh()` on the hook - presentations should be loaded and stored
2. Check localStorage - should see `presentations` and `presentations_${companyHQId}` keys
3. Reload page - presentations should load from localStorage
4. Verify presentations have proper `slides.sections` structure

