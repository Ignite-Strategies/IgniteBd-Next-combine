# State management and reminder-aware context

*(Starter doc — pick up in the morning.)*

## Goal

- Centralize **reminder / follow-up state** and **context** so the app is “reminder aware” where it matters (e.g. compose, contact detail, pipeline).
- Avoid duplicated logic and inconsistent “next send” / “due” signals across dashboard, tracker, and contact-level UI.

## Open questions / directions

1. **Where does “reminder context” live?**
   - Global (e.g. React context or store) vs per-route vs per-component.
   - What needs to be in context: companyHQId, date range (today → +7), list of reminders for that range, follow-up reason enum (no response, forwarded awaiting, manual, cadence)?

2. **Who consumes it?**
   - Outreach dashboard (Next email sends block).
   - Tracker page (filtered list).
   - Compose / contact detail: “This contact is due for follow-up (no response)” or “Forwarded, no update — due in 3 days.”
   - Optional: pipeline view, company hub.

3. **Hydration and freshness**
   - When do we fetch reminders? On outreach layout load? On demand when opening compose?
   - Cache invalidation: after sending an email, recording a response, or moving pipeline stage (e.g. to “forwarded”).

4. **Connector / forwarded in 7 days**
   - Client wants connector (forwarded) follow-up in **7 days**.
   - Detection (see OUTREACH_FOLLOW_UP_REASON_ENUM.md):
     - **Easier:** “Responded since” = no response after last send (no `hasResponded` on activities after last send).
     - **Second:** When we move person to pipeline stage “forwarded,” set next follow-up to +Y days (e.g. 7). May need explicit “set next follow-up to 7 days from now” when setting stage to forwarded.

5. **State shape (draft)**
   - Reminder-aware context might expose: `{ companyHQId, reminders[], dateFrom, dateTo, loading, error, refetch }`.
   - Each reminder: `{ contactId, dueDate, followUpReason, reminderType, cadenceDays, … }`.
   - Helpers: `getReminderForContact(contactId)`, `isDueInRange(contactId, from, to)`.

## Related

- `docs/OUTREACH_FOLLOW_UP_REASON_ENUM.md` — follow-up reason enum (no response, forwarded awaiting, manual, cadence) and code implications.
- `lib/services/reminderService.js` — get reminders for date range; `lib/services/followUpCalculator.js` — next send date and (future) followUpReason.
- Outreach layout already has `OutreachContext` (campaigns, hydrating, refresh). Could extend or add a separate ReminderContext.

## Next steps

- [ ] Decide: extend OutreachContext vs new ReminderContext vs store (e.g. Zustand).
- [ ] Define minimal state shape and where it’s set (layout vs page vs both).
- [ ] Wire dashboard and tracker to same source; add “reminder for this contact” to compose/contact detail.
- [ ] Implement followUpReason in calculator + reminderService (see OUTREACH_FOLLOW_UP_REASON_ENUM.md); ensure connector/forwarded = 7 days.
