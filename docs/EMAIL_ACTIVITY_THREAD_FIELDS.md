# Email activity thread: responseFromEmail

## Schema (no legacy)

| Field | Meaning |
|-------|---------|
| **responseFromEmail** | Id of the email_activities row that is the response to this one (owner or contact). Stored as text, not a FK. |
| **emailSequenceOrder** | OWNER_SEND \| CONTACT_SEND — sender-aware: we sent vs contact sent. |
| **body** | Message content. Response content lives in the response row’s body. |

Legacy columns (hasResponded, contactResponse, respondedAt, responseSubject) have been removed. “Has response” = `responseFromEmail != null`. Response text = load the row with `id = responseFromEmail` and use its `body` / `sentAt` / `subject`.

---

## How the thread is built (id stamp)

1. Create **first** row (e.g. OWNER_SEND). `responseFromEmail` = null.
2. Create **second** row (e.g. CONTACT_SEND). Then **update first** row: `responseFromEmail` = second.id.
3. Create **third** row (e.g. OWNER_SEND). Then **update second** row: `responseFromEmail` = third.id.

So each row stamps the id of the next message on itself. No FK; just a copy of the id.
