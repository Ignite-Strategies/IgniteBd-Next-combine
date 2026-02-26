# Record Off-Platform: Single Page for Both Entry Points

**Rule: Off-platform recording and contact-scoped “Add Email Manually” are the same flow. One page, one implementation.**

---

## Entry points

| Entry point | URL | Contact |
|------------|-----|--------|
| Outreach (no contact) | `/outreach/record-off-platform?companyHQId=...` | User selects contact on the page |
| Contact page | `/outreach/record-off-platform?contactId=...&companyHQId=...` | Contact pre-loaded from URL |

Both use **the same page**: `app/(authenticated)/outreach/record-off-platform/page.jsx`.

- From **Outreach**: link from main outreach UI (e.g. “Manual Entry”) → no `contactId`; user must select or search contact.
- From **Contact**: “Add Email Manually” on contact’s Email History section → `contactId` in URL; that contact is pre-selected and can be changed.

---

## Implementation contract

- **Do not** add a separate contact-scoped “record off-platform” form or modal. Any new behavior (conversation parsing, sender/contact fields, main email + response 1 + additional responses) must be implemented **only** on the record-off-platform page.
- **Do** support both cases in that single page:
  - With `contactIdFromUrl`: pre-fill contact, allow clearing/switching.
  - Without: require user to select contact (or paste email and resolve).
- Copy and validation (e.g. “Select the contact below”, sender email, response fields) must be identical for both entry points.

---

## References

- Page: `app/(authenticated)/outreach/record-off-platform/page.jsx`
- Contact page link: `app/(authenticated)/contacts/[contactId]/page.jsx` (Email History → “Add Email Manually”)
- Outreach link: `app/(authenticated)/outreach/page.jsx` (Manual Entry button)
- API: `POST /api/contacts/[contactId]/off-platform-send` (same for both)
