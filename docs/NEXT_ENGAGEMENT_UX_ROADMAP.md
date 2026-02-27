# Next engagement UX — where we are vs where we need to be

## What we have now

We **hydrate** contacts who have a `nextEngagementDate` (e.g. one person who is seven days from their original send) and show them in a list on the outreach dashboard. That’s it: **no notifications, no emails, no “hey bro today is the day.”** Just the list (NextEngagementContainer, GET /api/outreach/next-engagements).

## What we need (proper UX) — not there yet

- **Email:** e.g. daily or “due today” email to the user: “You have N people to follow up with today” with names/links.
- **In-app notifications:** e.g. “Today is the day — 3 next engagements” (toast, bell, or similar).
- **Live “due now” feel:** Optional: real-time or same-day nudges when it’s the day (e.g. badge, banner, or push).

We’re **not there yet**. This doc is the placeholder: we need proper UX that includes emails and in-app notifications that are like “hey bro today is the day.” Right now we’re literally just hydrating and showing who has a next engagement (e.g. 7 days from send).
