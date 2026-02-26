# Outreach email reminder — dashboard and daily alert

## What we built

1. **Next email sends (dashboard)** — On the outreach dashboard, a block that shows follow-ups due by date (today through +7 days), grouped and chronological. "See all" links to the tracker with the same date range.
2. **Reminders API** — `GET /api/outreach/reminders` returns a list of reminders for a date range so the same data can drive the UI and a daily alert email.
3. **Alert email (SendGrid)** — You (Adam) can send a daily "you have these emails today" message by calling the reminders API and formatting the result into an email (e.g. via SendGrid or a cron + SendGrid).

---

## API: GET /api/outreach/reminders

**Auth:** Firebase token (same as rest of app).

**Query params:**

| Param         | Required | Default   | Description                    |
|---------------|----------|-----------|--------------------------------|
| companyHQId   | Yes      | —         | Company (tenant) ID            |
| dateFrom      | No       | Today     | ISO date (YYYY-MM-DD)          |
| dateTo        | No       | Today     | ISO date (YYYY-MM-DD)          |
| limit         | No       | 100       | Max reminders (cap 200)        |

**Response:**

```json
{
  "success": true,
  "reminders": [
    {
      "dueDate": "2026-02-25",
      "contactId": "clx...",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "lastSendDate": "2026-02-18T12:00:00.000Z",
      "reminderType": "automatic",
      "nextContactNote": null,
      "cadenceDays": 7
    }
  ],
  "dateFrom": "2026-02-25",
  "dateTo": "2026-03-04"
}
```

- **reminderType:** `"manual"` (remindMeOn) or `"automatic"` (cadence-based).
- **nextContactNote:** Optional note (e.g. "Follow next quarter").
- Sorted by **dueDate** then name.

---

## Daily alert email (SendGrid)

To send "you have these emails today":

1. **Call the API** (server-side or cron) for the company and **today only**:
   - `GET /api/outreach/reminders?companyHQId=<id>&dateFrom=2026-02-25&dateTo=2026-02-25`
   - Use a service account or token that can call the API.
2. **Build the email body** from `reminders`:
   - Subject: e.g. "You have N follow-ups today"
   - Body: list by contact — name, email, "Follow-up" or "Manual reminder", optional note; link to contact or tracker if you have a base URL.
3. **Send via SendGrid** (or your existing sender) to the desired inbox.

Example payload shape for the email (you can customize):

- **Subject:** `Follow-ups today: ${reminders.length} contact(s)`
- **Body (plain or HTML):** For each `r` in `reminders`: `${r.firstName} ${r.lastName} (${r.email}) — ${r.reminderType === 'manual' ? 'Manual reminder' : 'Follow-up'}${r.nextContactNote ? ` — ${r.nextContactNote}` : ''}`  
  Optional: link to `/contacts/${r.contactId}` or `/outreach/tracker?companyHQId=...&followUpDateFrom=...&followUpDateTo=...`.

No cron or SendGrid code is in the repo yet; this doc describes the contract so you can plug in your own job and template.

---

## UX: outreach dashboard and tracker

- **Dashboard:** "Next email sends" block uses the same API (today → +7 days), grouped by date, compact list with "See all".
- **Tracker:** "See all" goes to `/outreach/tracker` with `followUpDateFrom` / `followUpDateTo` so the tracker view is already filtered to the same range and sorted by next send date (chronological by date).
