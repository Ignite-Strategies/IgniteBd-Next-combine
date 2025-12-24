# Email Campaign Refactor Progress

## ✅ Completed

### 1. Database Schema Enhancement
- ✅ Created `campaigns` table with Apollo-like features:
  - Campaign status (DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED, CANCELLED)
  - Campaign types (EMAIL, SEQUENCE, ONE_OFF)
  - Performance metrics (open rate, click rate, reply rate, bounce rate)
  - Scheduling support
  
- ✅ Created `email_sequences` table for multi-step email flows:
  - Sequence status management
  - Auto-pause on reply
  - Performance tracking
  
- ✅ Created `sequence_steps` table:
  - Step ordering and delays
  - Conditional logic support (JSON)
  - Individual step performance metrics
  
- ✅ Enhanced `email_activities` table:
  - Links to campaigns and sequences
  - Sequence step tracking
  - Reply tracking support
  
- ✅ Created `email_events` table for detailed tracking:
  - Multiple opens/clicks per email
  - Event metadata (IP, user agent, location)
  - Event timeline

### 2. Backend API Updates
- ✅ Updated `sendOutreachEmail` service to support campaigns and sequences
- ✅ Enhanced `/api/outreach/send` to accept campaign/sequence IDs
- ✅ Updated `/api/outreach/recent` to include campaign data
- ✅ Enhanced SendGrid webhook handler:
  - Detailed event tracking (multiple opens/clicks)
  - Campaign/sequence context preservation
  - Event metadata capture
  
- ✅ Created Campaign APIs:
  - `GET /api/campaigns` - List campaigns
  - `POST /api/campaigns` - Create campaign
  - `GET /api/campaigns/[campaignId]` - Get campaign with analytics
  - `PATCH /api/campaigns/[campaignId]` - Update campaign
  - `DELETE /api/campaigns/[campaignId]` - Delete draft campaigns

### 3. Documentation
- ✅ Created comprehensive audit document (`EMAIL_CAMPAIGN_AUDIT.md`)
- ✅ Documented Apollo-like features comparison

## 🚧 Next Steps

### 1. Database Migration
**Action Required**: Run Prisma migration to apply schema changes
```bash
npx prisma migrate dev --name add_email_campaigns_tracking
npx prisma generate
```

### 2. Frontend Refactoring (Pending)
- [ ] Update OutreachContext to fetch campaigns from database instead of localStorage
- [ ] Refactor campaign list page to use new API
- [ ] Update campaign detail page with real analytics
- [ ] Build sequence builder UI
- [ ] Create email analytics dashboard
- [ ] Add contact email history view

### 3. Sequence Management APIs (Pending)
- [ ] `GET /api/sequences` - List sequences
- [ ] `POST /api/sequences` - Create sequence
- [ ] `GET /api/sequences/[sequenceId]` - Get sequence with steps
- [ ] `POST /api/sequences/[sequenceId]/steps` - Add sequence step
- [ ] `PATCH /api/sequences/[sequenceId]/steps/[stepId]` - Update step
- [ ] `DELETE /api/sequences/[sequenceId]/steps/[stepId]` - Delete step

### 4. Email Analytics APIs (Pending)
- [ ] `GET /api/analytics/emails` - Email performance metrics
- [ ] `GET /api/analytics/campaigns` - Campaign analytics
- [ ] `GET /api/analytics/sequences` - Sequence analytics
- [ ] `GET /api/contacts/[contactId]/emails` - Contact email history

### 5. Automation Engine (Future)
- [ ] Sequence execution engine
- [ ] Scheduled campaign runner
- [ ] Conditional step progression
- [ ] Auto-pause on reply

### 6. Advanced Features (Future)
- [ ] A/B testing framework
- [ ] Reply detection (email parsing/webhook)
- [ ] Email thread view
- [ ] Engagement scoring

## 🔧 Technical Notes

### Schema Field Naming
- Database uses snake_case (e.g., `owner_id`, `campaign_id`)
- Prisma models use snake_case to match database
- API responses should use camelCase for frontend compatibility

### Email Event Types
The `EmailEventType` enum supports:
- `SENT` - Email sent
- `DELIVERED` - Email delivered
- `OPEN` - Email opened (can occur multiple times)
- `CLICK` - Link clicked (can occur multiple times)
- `REPLY` - Recipient replied
- `BOUNCE` - Email bounced
- `DROP` - Email dropped
- `DEFERRED` - Delivery deferred
- `UNSUBSCRIBE` - Recipient unsubscribed
- `SPAM_REPORT` - Marked as spam

### Campaign Status Flow
```
DRAFT → SCHEDULED → ACTIVE → COMPLETED
                ↓
             PAUSED
                ↓
           CANCELLED
```

### Sequence Status Flow
```
DRAFT → ACTIVE → COMPLETED
         ↓
      PAUSED
```

## 📝 Migration Checklist

Before deploying:
1. [ ] Run Prisma migration
2. [ ] Generate Prisma client
3. [ ] Test campaign creation API
4. [ ] Test email sending with campaign ID
5. [ ] Verify webhook event tracking
6. [ ] Update frontend to use new APIs
7. [ ] Migrate existing localStorage campaigns to database (if any)

## 🐛 Known Issues

1. **Field Name Mismatch**: The Prisma client may need field name mapping if using camelCase in API responses
2. **Reply Tracking**: Currently not implemented - requires email parsing or inbound webhook
3. **Campaign Metrics**: Real-time metrics calculated on-demand, may need caching for performance

## 📚 References

- Apollo.io Email Tracking: https://knowledge.apollo.io/hc/en-us/articles/4410838798349-Use-Open-Tracking
- SendGrid Webhook Events: https://docs.sendgrid.com/for-developers/tracking-events/event
- Prisma Relations: https://www.prisma.io/docs/concepts/components/prisma-schema/relations

