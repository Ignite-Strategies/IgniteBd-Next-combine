# Outreach Tracker & Contact Detail Integration

**Purpose:** Document the outreach tracker implementation and how to integrate it with the contact detail page for "hydrate last email" and "outreach to this person" features.

---

## Outreach Tracker Landing Page

### Location
**Path:** `/outreach/tracker?companyHQId=xxx`

**File:** `/app/(authenticated)/outreach/tracker/page.jsx`

Matches the existing outreach structure under `(authenticated)`.

### Navigation
The page should be accessible via:
- **Left sidebar nav** - Add "Outreach Tracker" link under Outreach section
- **Or** direct URL with `companyHQId` parameter

### Features
- Shows all contacts who have at least one email send
- Filterable by:
  - Send date range (`sendDateFrom`, `sendDateTo`)
  - Follow-up date range (`followUpDateFrom`, `followUpDateTo`)
  - Response status (`hasResponded`: true/false)
- Displays:
  - Contact name/email
  - Last send date
  - Next follow-up date (with manual reminder indicator)
  - Email count
  - Status badge (Responded/Overdue/Due today/Due in X days)
- Pagination support

---

## API Endpoint

### `GET /api/outreach/tracker`

**Query Parameters:**
- `companyHQId` (required) - Company ID
- `sendDateFrom` (optional) - ISO date string
- `sendDateTo` (optional) - ISO date string
- `followUpDateFrom` (optional) - ISO date string
- `followUpDateTo` (optional) - ISO date string
- `hasResponded` (optional) - "true" | "false"
- `limit` (optional) - Default: 100
- `offset` (optional) - Default: 0

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "lastSendDate": "2025-02-20T10:00:00Z",
      "nextSendDate": "2025-02-27T10:00:00Z",
      "daysUntilDue": 4,
      "relationship": "WARM",
      "cadenceDays": 3,
      "emailCount": 2,
      "hasResponded": false,
      "emails": [
        {
          "id": "email-id",
          "sendDate": "2025-02-20T10:00:00Z",
          "subject": "Follow up",
          "source": "PLATFORM",
          "platform": "sendgrid",
          "hasResponded": false
        }
      ],
      "remindMeOn": null
    }
  ],
  "count": 10,
  "totalCount": 50,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Contact Detail Page Integration

### Differentiations: Enrich, Build Email, Build Persona, Build Persona Slug

- **Enrich** – Contact Information bar. Enrich by email; after success, a modal offers **Build Persona** (deeper persona builder from enriched contact). Build Persona is **only** offered in that post-Enrich flow, not as a standalone button.
- **Build Email** – Contact Information bar. **Not enrich-dependent.** Builds email from snippets, relationship context, and persona when available; works without having run Enrich.
- **Build Persona Slug** – Notes card. Suggests an outreach persona slug from notes via `POST /api/contacts/[contactId]/suggest-persona`. User applies in modal to persist to contact. This is the *slug* that drives snippet assembly, distinct from the full "Build Persona" flow after Enrich.
- **Generate Context** – Notes card. Same API; relationship context is in-memory only (not persisted). Used for Build Email and template logic on this page.

### Generate from Notes (Persona Slug + Relationship Context)

**Layout:** Notes section is placed above Relationship Context. Both actions live on the Notes card; results hydrate in different places (persona at top of page, relationship context in its own section below Notes).

- **Build Persona Slug** – Calls `POST /api/contacts/[contactId]/suggest-persona` (with optional `note`). Opens a modal with suggested persona slug; user must **Apply** in the modal to persist to the contact (no inline save).
- **Generate Context** – Same API; relationship context is written to local React state only and **is not persisted**. It is used for "Build email" and template logic on this page but is lost on refresh. Regenerate/Clear only affect in-memory state.

**Save behavior:**

| What | Saves inline? | What to do |
|------|----------------|------------|
| **Notes** | No | Click **Save** after editing notes to persist. |
| **Outreach Persona** | No | After "Build Persona Slug", click **Apply** in the modal to save the selected persona to the contact. |
| **Relationship Context** | No (not stored) | No save. Generate/Regenerate only update the UI for this session; refresh loses it. |

So: save notes with **Save**; apply persona in the **modal**; relationship context is session-only. There is no single "Save" that commits everything.

---

### Feature 1: Hydrate Last Email

**Purpose:** Show the most recent email sent to this contact on the contact detail page.

**Implementation:**

1. **Add API call to fetch last email:**
   ```javascript
   // In contact detail page component
   const [lastEmail, setLastEmail] = useState(null);
   
   useEffect(() => {
     if (contactId) {
       fetch(`/api/contacts/${contactId}/email-history`)
         .then(res => res.json())
         .then(data => {
           if (data.success && data.activities.length > 0) {
             // Get most recent email
             const mostRecent = data.activities[0];
             setLastEmail(mostRecent);
           }
         });
     }
   }, [contactId]);
   ```

2. **Display last email in UI:**
   ```jsx
   {lastEmail && (
     <div className="bg-white rounded-lg shadow p-4 mb-4">
       <h3 className="text-lg font-semibold mb-2">Last Email Sent</h3>
       <div className="text-sm text-gray-600 mb-2">
         {formatDate(lastEmail.date)} • {lastEmail.type === 'platform' ? 'Platform' : 'Off-Platform'}
       </div>
       <div className="font-medium mb-1">{lastEmail.subject}</div>
       {lastEmail.type === 'platform' && (
         <div className="text-sm text-gray-500">
           {lastEmail.hasResponded ? '✓ Responded' : 'No response yet'}
         </div>
       )}
     </div>
   )}
   ```

**API Endpoint:** `GET /api/contacts/[contactId]/email-history`
- Returns combined history of platform + off-platform sends
- Sorted by date (most recent first)

---

### Feature 2: "Outreach to This Person" Button

**Purpose:** Quick action button to start composing an email to this contact.

**Implementation:**

1. **Add button to contact detail page:**
   ```jsx
   <button
     onClick={() => handleOutreachClick(contact)}
     className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
   >
     Outreach to This Person
   </button>
   ```

2. **Handle click - navigate to compose:**
   ```javascript
   const handleOutreachClick = (contact) => {
     // Option 1: Navigate to compose page with contact pre-filled
     router.push(`/outreach/compose?contactId=${contact.id}&companyHQId=${companyHQId}`);
     
     // Option 2: Open compose modal/drawer
     setShowComposeModal(true);
     setSelectedContact(contact);
   };
   ```

3. **Pre-fill compose form:**
   - Use contact's `firstName`, `lastName`, `email`
   - Optionally suggest template based on `prior_relationship` and `persona_type`
   - Show last email context (subject, date) for reference

**Suggested UX Flow:**
1. User clicks "Outreach to This Person"
2. Navigate to compose page OR open compose modal
3. Pre-fill recipient: contact email
4. Show "Last contacted: [date]" context
5. Optionally suggest template based on relationship
6. User composes and sends

---

## Related API Endpoints

### Get Contact's Email History
```
GET /api/contacts/[contactId]/email-history
```
Returns combined timeline of all emails (platform + off-platform).

### Get Next Send Date
```
GET /api/contacts/[contactId]/next-send-date
```
Returns when next follow-up should be sent based on cadence rules.

### Get Contacts Due for Follow-Up
```
GET /api/contacts/due-for-followup?companyHQId=xxx
```
Returns contacts that are due for follow-up (includes manual reminders).

### Create Email Record
```
POST /api/emails
Body: {
  contactId: string,
  subject?: string,
  body?: string,
  source: "PLATFORM" | "OFF_PLATFORM",
  sendDate?: string (ISO)
}
```
Creates email record (for compose UX integration).

---

## Data Models

### Unified `emails` Model
- Tracks all emails (platform + off-platform)
- Includes response tracking (`hasResponded`, `contactResponse`, `respondedAt`)
- Links to `email_activities` and `off_platform_email_sends`

### Contact Model
- `remindMeOn` (DateTime?) - Manual reminder date
- `prior_relationship` (RelationshipEnum) - Used for cadence calculation
- `persona_type` (PersonaType) - Used for template suggestions

---

## Services

### `followUpCalculator.js`
- `getLastSendDate(contactId)` - Gets most recent send date
- `calculateNextSendDate(contactId, config)` - Calculates next follow-up date
- Uses relationship type and cadence rules

### `reminderService.js`
- `getContactsDueForFollowUp(companyHQId, options)` - Gets contacts due for follow-up
- Includes both automatic (cadence) and manual (`remindMeOn`) reminders

---

## Integration Checklist

### Contact Detail Page
- [ ] Add "Last Email Sent" section
  - [ ] Fetch email history on page load
  - [ ] Display most recent email (subject, date, type)
  - [ ] Show response status if available
- [ ] Add "Outreach to This Person" button
  - [ ] Navigate to compose page/modal
  - [ ] Pre-fill contact email
  - [ ] Show last contact context
  - [ ] Optionally suggest template
- [ ] Add "Next Follow-Up" indicator
  - [ ] Fetch next send date
  - [ ] Show days until due
  - [ ] Link to set manual reminder

### Navigation
- [ ] Add "Outreach Tracker" link to sidebar
  - [ ] Under "Outreach" section
  - [ ] Or create new "Outreach" nav group
- [ ] Ensure tracker page is accessible from contact detail
  - [ ] Link from contact detail to tracker
  - [ ] Filter tracker by this contact

### Compose Flow
- [ ] Integrate with unified `emails` model
  - [ ] Create email record before sending
  - [ ] Update email record with `messageId` after send
  - [ ] Link to `email_activities` via `emailActivityId`

---

## Example Contact Detail Page Section

```jsx
{/* Last Email Section */}
{lastEmail && (
  <div className="bg-white rounded-lg shadow p-4 mb-4">
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-lg font-semibold">Last Email Sent</h3>
      <button
        onClick={() => handleOutreachClick(contact)}
        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Outreach Again
      </button>
    </div>
    <div className="text-sm text-gray-600 mb-2">
      {formatDate(lastEmail.date)} • {lastEmail.type === 'platform' ? 'Platform' : 'Off-Platform'}
    </div>
    <div className="font-medium mb-1">{lastEmail.subject}</div>
    {lastEmail.hasResponded && (
      <div className="text-sm text-green-600 mt-2">✓ Contact responded</div>
    )}
  </div>
)}

{/* Next Follow-Up Section */}
{nextSendDate && (
  <div className="bg-white rounded-lg shadow p-4 mb-4">
    <h3 className="text-lg font-semibold mb-2">Next Follow-Up</h3>
    <div className="text-sm text-gray-600">
      Due: {formatDate(nextSendDate)}
      {daysUntilDue !== null && (
        <span className={`ml-2 ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue === 0 ? 'text-yellow-600' : 'text-blue-600'}`}>
          ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days`})
        </span>
      )}
    </div>
    <button
      onClick={() => handleSetReminder(contact.id)}
      className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
    >
      Set Manual Reminder
    </button>
  </div>
)}
```

---

## Next Steps

1. **Move tracker page** to `/app/(authenticated)/outreach/tracker` to match structure
2. **Add navigation link** in sidebar under Outreach section
3. **Implement contact detail integration:**
   - Fetch and display last email
   - Add "Outreach to This Person" button
   - Show next follow-up date
4. **Enhance compose flow** to use unified `emails` model
5. **Add email thread view** showing full conversation history

---

**Status:** 🟢 Implemented - Ready for Integration
