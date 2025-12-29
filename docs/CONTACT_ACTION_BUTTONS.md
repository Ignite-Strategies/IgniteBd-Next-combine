# Contact Detail Page - Action Buttons Logic

## Current Implementation

### Enrichment Detection (`isEnriched`)

The frontend checks for enrichment using a `useMemo` hook that evaluates multiple indicators:

```javascript
const isEnriched = useMemo(() => {
  if (!contact) return false;
  
  return !!(
    contact.enrichmentPayload ||        // Raw Apollo JSON (most reliable)
    contact.enrichmentSource ||         // Service that enriched (e.g., "apollo")
    contact.profileSummary ||           // GPT-generated summary
    (contact.seniorityScore !== null && contact.seniorityScore !== undefined) ||  // Intelligence score
    (contact.buyingPowerScore !== null && contact.buyingPowerScore !== undefined) || // Intelligence score
    contact.enrichmentRedisKey          // Legacy Redis key (fallback)
  );
}, [contact]);
```

**Priority Order:**
1. `enrichmentPayload` - Most reliable (raw JSON stored in DB)
2. `enrichmentSource` - Indicates which service enriched
3. `profileSummary` - GPT summary from enrichment
4. Intelligence scores (`seniorityScore`, `buyingPowerScore`)
5. `enrichmentRedisKey` - Legacy fallback

### Current Button Logic

**If Enriched (`isEnriched === true`):**
- Shows: **"Build Persona"** button (purple)
- Action: Navigates to `/personas/from-contact?contactId=${contactId}`

**If Not Enriched (`isEnriched === false`):**
- Shows: **"Enrich Contact"** button (blue)
- Action: Calls `handleEnrichContact()` to enrich via Apollo
- Disabled if: `enriching` is true OR contact has no email

### Location
- File: `app/(authenticated)/contacts/[contactId]/page.jsx`
- Lines: 466-495

---

## Proposed Improvements

### Issue
The current implementation is **binary** - only one action button at a time. This can feel limiting, especially for enriched contacts where users might want to:
- Build a persona
- Send an email
- View enrichment details
- Add to a campaign
- etc.

### Solution: Action Menu/Dropdown

Instead of a single button, show **multiple action options** based on contact state:

#### For Enriched Contacts:
```
┌─────────────────────────────┐
│ [Build Persona] [Send Email]│
│ [View Details] [Add to List] │
└─────────────────────────────┘
```

#### For Non-Enriched Contacts:
```
┌─────────────────────────────┐
│ [Enrich Contact] [Send Email]│
│ [Add to List]                │
└─────────────────────────────┘
```

### Recommended Actions

**Always Available:**
- **Send Email** - Navigate to `/outreach/compose?contactId=${contactId}`
- **Add to List** - Open contact list selector modal
- **View Details** - Expand enrichment preview (if enriched)

**Conditional:**
- **Enrich Contact** - Only if not enriched
- **Build Persona** - Only if enriched
- **View Enrichment** - Only if enriched (show raw JSON or preview)

### Implementation Approach

**Option 1: Button Group (Horizontal)**
```jsx
<div className="flex items-center gap-2 flex-wrap">
  {isEnriched ? (
    <>
      <button onClick={() => router.push(`/personas/from-contact?contactId=${contactId}`)}>
        Build Persona
      </button>
      <button onClick={() => router.push(`/outreach/compose?contactId=${contactId}`)}>
        Send Email
      </button>
    </>
  ) : (
    <>
      <button onClick={handleEnrichContact}>
        Enrich Contact
      </button>
      {contact?.email && (
        <button onClick={() => router.push(`/outreach/compose?contactId=${contactId}`)}>
          Send Email
        </button>
      )}
    </>
  )}
</div>
```

**Option 2: Dropdown Menu (More Scalable)**
```jsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button>Actions</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {isEnriched ? (
      <>
        <DropdownMenuItem onClick={() => router.push(`/personas/from-contact?contactId=${contactId}`)}>
          Build Persona
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/outreach/compose?contactId=${contactId}`)}>
          Send Email
        </DropdownMenuItem>
      </>
    ) : (
      <>
        <DropdownMenuItem onClick={handleEnrichContact}>
          Enrich Contact
        </DropdownMenuItem>
        {contact?.email && (
          <DropdownMenuItem onClick={() => router.push(`/outreach/compose?contactId=${contactId}`)}>
            Send Email
          </DropdownMenuItem>
        )}
      </>
    )}
    <DropdownMenuSeparator />
    <DropdownMenuItem>Add to List</DropdownMenuItem>
    <DropdownMenuItem>View Details</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Option 3: Primary + Secondary Buttons (Recommended)**
```jsx
<div className="flex items-center gap-2">
  {/* Primary Action */}
  {isEnriched ? (
    <button className="primary-button" onClick={() => router.push(`/personas/from-contact?contactId=${contactId}`)}>
      Build Persona
    </button>
  ) : (
    <button className="primary-button" onClick={handleEnrichContact}>
      Enrich Contact
    </button>
  )}
  
  {/* Secondary Actions */}
  <div className="flex items-center gap-1">
    {contact?.email && (
      <button 
        className="secondary-button"
        onClick={() => router.push(`/outreach/compose?contactId=${contactId}`)}
        title="Send Email"
      >
        <Mail className="h-4 w-4" />
      </button>
    )}
    <button 
      className="secondary-button"
      onClick={() => {/* Add to list */}}
      title="Add to List"
    >
      <Users className="h-4 w-4" />
    </button>
  </div>
</div>
```

---

## Next Steps

1. **Decide on UI Pattern** - Button group vs dropdown vs primary+secondary
2. **Implement Email Action** - Ensure `/outreach/compose?contactId=...` works
3. **Add Other Actions** - Add to list, view details, etc.
4. **Update Success Modals** - Include email option in enrichment success modals
5. **Test Edge Cases** - No email, no enrichment, partial data, etc.

---

## Related Files

- `app/(authenticated)/contacts/[contactId]/page.jsx` - Main contact detail page
- `app/(authenticated)/outreach/compose/page.jsx` - Email compose page
- `app/(authenticated)/personas/from-contact/page.jsx` - Persona builder from contact
- `components/enrichment/ContactOutlook.tsx` - Enrichment display component

