# Email & Messaging Campaign System Audit

## Current State Analysis

### ✅ What We Have

#### 1. Email Sending Infrastructure
- **SendGrid Integration**: Configured with API key and webhook support
- **Two Email Endpoints**:
  - `/api/outreach/send` - 1-to-1 outreach emails with activity tracking
  - `/api/email/send` - Generic email sending (single & batch)
- **Email Services**:
  - `lib/services/outreachSendService.js` - Outreach-specific sending
  - `lib/sendgridClient.js` - Generic SendGrid wrapper
- **Tracking**: Open and click tracking enabled via SendGrid

#### 2. Email Activity Tracking
- **Database Model**: `email_activities` table
  ```prisma
  model email_activities {
    id         String   @id
    owner_id   String
    contact_id String?
    tenant_id  String?
    email      String
    subject    String
    body       String
    event      String?  // sent, delivered, opened, clicked, bounce, etc.
    messageId  String   @unique
    createdAt  DateTime @default(now())
    updatedAt  DateTime
  }
  ```
- **Webhook Handler**: `/api/webhooks/sendgrid` - Updates email activity events
- **Recent Emails API**: `/api/outreach/recent` - Fetches recent email activities

#### 3. Campaign UI (Frontend Only)
- **Outreach Dashboard**: `/outreach/page.jsx` - Shows campaign metrics
- **Campaign List**: `/outreach/campaigns/page.jsx` - Lists campaigns
- **Campaign Detail**: `/outreach/campaigns/[campaignId]/page.jsx` - Campaign details
- **Campaign Create**: `/outreach/campaigns/create/page.jsx` - Create new campaigns
- **Compose Page**: `/outreach/compose/page.jsx` - Send individual emails
- **Storage**: Campaigns stored in **localStorage** (not database!)

#### 4. Outreach Context
- **Context Provider**: `app/(authenticated)/outreach/OutreachContext.js`
- **Hook**: `hooks/useOutreach.js`
- **State Management**: Client-side only, no backend persistence

### ❌ What's Missing (Apollo-like Features)

#### 1. Database-Backed Campaigns
- **Current**: Campaigns exist only in localStorage
- **Needed**: 
  - `campaigns` table with proper schema
  - Campaign status (draft, scheduled, active, paused, completed)
  - Campaign metadata (name, description, created date, etc.)

#### 2. Email Sequences
- **Current**: No sequence support
- **Needed**:
  - `email_sequences` table for multi-step email flows
  - Sequence steps with delays
  - Conditional logic (if opened, if clicked, if replied)

#### 3. Campaign-to-Email Relationship
- **Current**: No link between campaigns and sent emails
- **Needed**:
  - Link `email_activities` to `campaigns`
  - Track which emails belong to which campaign
  - Track sequence step for each email

#### 4. Enhanced Email Tracking
- **Current**: Basic event tracking (sent, delivered, opened, clicked)
- **Needed**:
  - Reply tracking (requires email parsing/webhook)
  - Bounce categorization (hard vs soft)
  - Unsubscribe tracking
  - Multiple opens/clicks per email
  - Time-to-open, time-to-click metrics

#### 5. Email Analytics Dashboard
- **Current**: Basic metrics in outreach dashboard
- **Needed**:
  - Campaign performance metrics
  - Open rates, click rates, reply rates
  - Engagement timeline
  - Contact-level email history
  - A/B test results

#### 6. Contact Email History
- **Current**: Can link emails to contacts via `contact_id`
- **Needed**:
  - Dedicated contact email history view
  - Email thread view
  - Last email sent date
  - Engagement score based on email activity

#### 7. Sequence Automation
- **Current**: Manual email sending only
- **Needed**:
  - Automated sequence execution
  - Scheduled sends
  - Conditional step progression
  - Auto-pause on reply

## Apollo.io Feature Comparison

### Apollo Features We Should Implement

1. **Email Tracking**
   - ✅ Open tracking (via SendGrid webhook)
   - ✅ Click tracking (via SendGrid webhook)
   - ❌ Reply tracking (needs email parsing)
   - ❌ Multiple opens/clicks per email

2. **Campaign Management**
   - ❌ Database-backed campaigns
   - ❌ Campaign templates
   - ❌ A/B testing
   - ❌ Campaign scheduling

3. **Email Sequences**
   - ❌ Multi-step sequences
   - ❌ Conditional logic
   - ❌ Auto-pause on reply
   - ❌ Sequence templates

4. **Analytics**
   - ❌ Campaign performance dashboard
   - ❌ Contact engagement scores
   - ❌ Email performance metrics
   - ❌ Time-to-engage metrics

5. **Contact Email History**
   - ⚠️ Basic linking exists
   - ❌ Thread view
   - ❌ Email timeline
   - ❌ Engagement history

## Recommended Refactoring Plan

### Phase 1: Database Schema Enhancement
1. Create `campaigns` table
2. Create `email_sequences` table
3. Create `sequence_steps` table
4. Enhance `email_activities` with campaign/sequence links
5. Create `email_events` table for detailed tracking (multiple opens/clicks)

### Phase 2: Backend API Refactoring
1. Campaign CRUD APIs
2. Sequence management APIs
3. Enhanced email sending with campaign/sequence support
4. Email analytics APIs
5. Reply detection webhook/parser

### Phase 3: Frontend Refactoring
1. Migrate campaigns from localStorage to database
2. Build sequence builder UI
3. Create email analytics dashboard
4. Build contact email history view
5. Campaign performance views

### Phase 4: Automation & Advanced Features
1. Sequence automation engine
2. Scheduled campaign execution
3. A/B testing framework
4. Advanced analytics

## Files to Refactor

### Backend
- `app/api/outreach/send/route.js` - Add campaign/sequence support
- `app/api/email/send/route.js` - Add campaign tracking
- `app/api/webhooks/sendgrid/route.js` - Enhance event tracking
- `lib/services/outreachSendService.js` - Add campaign context
- `prisma/schema.prisma` - Add new models

### Frontend
- `app/(authenticated)/outreach/OutreachContext.js` - Connect to database
- `app/(authenticated)/outreach/page.jsx` - Real analytics
- `app/(authenticated)/outreach/campaigns/*` - Database-backed campaigns
- `app/(authenticated)/outreach/compose/page.jsx` - Link to campaigns

### New Files Needed
- `app/api/campaigns/*` - Campaign CRUD APIs
- `app/api/sequences/*` - Sequence management APIs
- `app/api/analytics/emails/route.js` - Email analytics
- `app/(authenticated)/outreach/sequences/*` - Sequence builder UI
- `app/(authenticated)/outreach/analytics/page.jsx` - Analytics dashboard
- `app/(authenticated)/contacts/[contactId]/emails/page.jsx` - Contact email history



