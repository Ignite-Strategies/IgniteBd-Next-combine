# Email Sequence Implementation Recommendation

**Date:** 2025-01-27  
**Based on:** eventscrm-backend implementation  
**Target:** IgniteBd-Next-combine

---

## Executive Summary

This document analyzes how **eventscrm-backend** implements email sequences and provides recommendations for implementing a similar system in **IgniteBd-Next-combine**. The key pattern is a three-tier hierarchy: **Campaign → ContactList → Sequence**.

---

## How eventscrm-backend Structures Email Sequences

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CAMPAIGN                               │
│  - Container for entire email campaign                       │
│  - Links to ContactList (WHO to send to)                    │
│  - Contains multiple Sequences (WHAT to send)                │
│  - Status: draft, active, sent                               │
└─────────────────────────────────────────────────────────────┘
         │                    │
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌──────────────────────────────────────┐
│  CONTACT LIST   │  │         SEQUENCE                     │
│                 │  │  - Individual email in sequence     │
│  - WHO to send  │  │  - Has order (1, 2, 3...)          │
│  - Reusable     │  │  - Has delayDays (0, 3, 7...)       │
│  - Smart lists  │  │  - Subject + HTML content           │
│                 │  │  - Can use Template                 │
└─────────────────┘  └──────────────────────────────────────┘
```

### Database Schema (from eventscrm-backend)

#### 1. Campaign Model
```prisma
model Campaign {
  id            String   @id @default(cuid())
  orgId         String
  org           Organization @relation(...)
  
  name          String
  description   String?
  
  // WHO - Links to contact list
  contactListId String?
  contactList   ContactList? @relation(...)
  
  // Email content (optional - can be in sequences)
  subject       String?
  body          String?
  
  status        String   @default("draft")
  
  // WHAT - Sequences belong to campaign
  sequences     Sequence[]
  attachments   CampaignAttachment[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([orgId, name])
  @@index([orgId])
  @@index([status])
}
```

**Key Points:**
- Campaign is the **container/orchestrator**
- `contactListId` defines **WHO** receives emails
- `sequences` array contains **WHAT** emails to send
- Campaign can have direct `subject`/`body` for single-email campaigns
- Status tracks campaign lifecycle

#### 2. ContactList Model
```prisma
model ContactList {
  id            String   @id @default(cuid())
  orgId         String
  org           Organization @relation(...)
  
  name          String
  description   String?
  type          String  // "smart", "static", "manual"
  
  // Filtering criteria
  eventId       String?
  audienceType  String?
  stages        String[]
  tagFilters    Json?
  filters       Json?
  
  // Metadata
  totalContacts Int     @default(0)
  lastUpdated   DateTime @default(now())
  isActive      Boolean @default(true)
  
  // Relations
  contacts      Contact[]
  campaigns     Campaign[]  // Multiple campaigns can use same list
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([orgId, name])
  @@index([orgId])
}
```

**Key Points:**
- ContactList is **reusable** - multiple campaigns can use the same list
- Can be "smart" (dynamic filters) or "static" (manual selection)
- Tracks `totalContacts` for quick reference
- Lists are **preserved** when campaigns are deleted (modular design)

#### 3. Sequence Model
```prisma
model Sequence {
  id            String   @id @default(cuid())
  campaignId    String
  campaign      Campaign @relation(...)
  
  name          String   // "Welcome Email", "Follow-up", etc.
  subject       String
  html          String
  
  // Optional template link
  templateId    String?
  template      Template? @relation(...)
  
  // Timing
  delayDays     Int      @default(0)  // Days after previous email
  order         Int                   // 1, 2, 3... (sequence order)
  
  // Status tracking
  status        String   @default("draft")
  sentAt        DateTime?
  totalSent     Int      @default(0)
  
  // Tracking
  sequenceContacts SequenceContact[]
  emailEvents      EmailEvent[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([campaignId, name])
  @@index([campaignId, order])
  @@index([status])
}
```

**Key Points:**
- Sequence = **one email** in a multi-step campaign
- `order` determines sequence (1 = first, 2 = second, etc.)
- `delayDays` = days to wait after previous email (0 = immediate)
- Can link to `Template` for reusable content
- Tracks sending status and metrics

#### 4. SequenceContact Model (Tracking)
```prisma
model SequenceContact {
  id            String   @id @default(cuid())
  sequenceId    String
  sequence      Sequence @relation(...)
  contactId     String
  contact       Contact  @relation(...)
  
  status        String   @default("pending")  // pending, sent, delivered, opened, clicked, responded
  
  // SendGrid tracking
  sgMessageId   String?
  sentAt        DateTime?
  deliveredAt   DateTime?
  openedAt      DateTime?
  clickedAt     DateTime?
  respondedAt   DateTime?
  
  suppressReason String?  // Why contact was skipped
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([sequenceId, contactId])
  @@index([sequenceId, status])
  @@index([contactId, status])
}
```

**Key Points:**
- Tracks **each contact's progress** through each sequence step
- Records email events (sent, delivered, opened, clicked, responded)
- Enables per-contact sequence progression

---

## Workflow: How Sequences Work

### 1. Campaign Creation Flow

```
Step 1: Create Campaign
  POST /api/campaigns
  {
    orgId: "org_123",
    name: "Bros & Brews 2025",
    description: "Event invitation campaign",
    contactListId: "list_456"  // Optional - can add later
  }

Step 2: Add Contact List (if not done in Step 1)
  PATCH /api/campaigns/:campaignId
  {
    contactListId: "list_456"
  }

Step 3: Create Sequences
  POST /api/sequences  (or create via campaign UI)
  {
    campaignId: "campaign_789",
    name: "Initial Invite",
    subject: "You're Invited: {{eventName}}",
    html: "<p>Hi {{firstName}}, ...</p>",
    order: 1,
    delayDays: 0
  }
  
  POST /api/sequences
  {
    campaignId: "campaign_789",
    name: "Follow-up Reminder",
    subject: "Reminder: {{eventName}}",
    html: "<p>Hi {{firstName}}, just a reminder...</p>",
    order: 2,
    delayDays: 3  // 3 days after first email
  }
```

### 2. Sending Flow

```
Step 1: User clicks "Send Campaign"
  Frontend calls: POST /api/enterprise-gmail/send-sequence

Step 2: Backend processes
  - Gets campaign.contactListId
  - Gets all contacts from ContactList
  - Gets all sequences ordered by `order`
  - For each sequence:
    - Personalizes subject/html with contact data
    - Sends via Gmail API
    - Creates SequenceContact records
    - Waits `delayDays` before next sequence

Step 3: Tracking
  - SequenceContact records track each contact's progress
  - EmailEvent records track opens/clicks
  - Campaign status updates to "sent"
```

### 3. Key Implementation Details

#### Contact List Reusability
```javascript
// ContactList is MODULAR - can be reused
const list = await prisma.contactList.findUnique({
  where: { id: "list_456" }
});

// Multiple campaigns can use same list
const campaigns = await prisma.campaign.findMany({
  where: { contactListId: "list_456" }
});
// Returns: [campaign1, campaign2, campaign3]
```

#### Sequence Ordering
```javascript
// Get sequences in order
const sequences = await prisma.sequence.findMany({
  where: { campaignId: "campaign_789" },
  orderBy: { order: 'asc' }
});
// Returns: [sequence1 (order: 1), sequence2 (order: 2), ...]
```

#### Delay Calculation
```javascript
// Calculate when to send each sequence
let sendDate = new Date(); // Start date

for (const sequence of sequences) {
  // First email: send immediately (delayDays = 0)
  // Second email: send after delayDays
  const actualSendDate = new Date(sendDate);
  actualSendDate.setDate(actualSendDate.getDate() + sequence.delayDays);
  
  // Schedule send for actualSendDate
  await scheduleSequenceSend(sequence.id, actualSendDate);
  
  // Update sendDate for next iteration
  sendDate = actualSendDate;
}
```

---

## Recommended Implementation for IgniteBd-Next-combine

### Phase 1: Database Schema

#### 1.1 Create Campaign Model
```prisma
model Campaign {
  id            String   @id @default(cuid())
  ownerId       String
  owner         Owner    @relation(fields: [ownerId], references: [id])
  
  name          String
  description   String?
  
  // WHO - Contact list
  contactListId String?
  contactList   ContactList? @relation(fields: [contactListId], references: [id])
  
  // Single email content (optional - for simple campaigns)
  subject       String?
  body          String?
  
  status        String   @default("draft")  // draft, scheduled, sending, sent, paused, cancelled
  
  // Relations
  sequences     EmailSequence[]
  attachments   CampaignAttachment[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([ownerId])
  @@index([status])
  @@index([contactListId])
}
```

#### 1.2 Create ContactList Model
```prisma
model ContactList {
  id            String   @id @default(cuid())
  ownerId       String
  owner         Owner    @relation(fields: [ownerId], references: [id])
  
  name          String
  description   String?
  type          String   @default("static")  // static, smart, manual
  
  // Filtering (for smart lists)
  filters       Json?    // { audienceType: "...", stages: [...], tags: [...] }
  
  // Metadata
  totalContacts Int      @default(0)
  lastUpdated   DateTime @default(now())
  isActive      Boolean  @default(true)
  
  // Relations
  contacts      Contact[]
  campaigns     Campaign[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([ownerId])
  @@index([isActive])
}
```

#### 1.3 Create EmailSequence Model
```prisma
model EmailSequence {
  id            String   @id @default(cuid())
  campaignId    String
  campaign      Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  name          String   // "Welcome", "Follow-up", "Final Reminder"
  subject       String
  html          String
  
  // Optional template
  templateId    String?
  template      Template? @relation(fields: [templateId], references: [id])
  
  // Timing
  delayDays     Int      @default(0)  // Days after previous sequence
  order         Int                   // 1, 2, 3...
  
  // Status
  status        String   @default("draft")  // draft, scheduled, sent, failed
  sentAt        DateTime?
  totalSent     Int      @default(0)
  
  // Tracking
  sequenceContacts SequenceContact[]
  emailEvents      EmailEvent[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([campaignId, name])
  @@index([campaignId, order])
  @@index([status])
}
```

#### 1.4 Create SequenceContact Model (Tracking)
```prisma
model SequenceContact {
  id            String   @id @default(cuid())
  sequenceId    String
  sequence      EmailSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  contactId     String
  contact       Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  status        String   @default("pending")  // pending, sent, delivered, opened, clicked, responded, bounced
  
  // SendGrid tracking
  messageId     String?  // SendGrid message ID
  sentAt        DateTime?
  deliveredAt  DateTime?
  openedAt      DateTime?
  clickedAt     DateTime?
  respondedAt   DateTime?
  bouncedAt     DateTime?
  
  suppressReason String?  // "unsubscribed", "bounced", "invalid_email"
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([sequenceId, contactId])
  @@index([sequenceId, status])
  @@index([contactId, status])
}
```

#### 1.5 Enhance Email Activities
```prisma
model email_activities {
  // ... existing fields ...
  
  // Add sequence tracking
  campaignId    String?
  campaign      Campaign? @relation(fields: [campaignId], references: [id])
  sequenceId    String?
  sequence      EmailSequence? @relation(fields: [sequenceId], references: [id])
  
  @@index([campaignId])
  @@index([sequenceId])
}
```

### Phase 2: API Endpoints

#### 2.1 Campaign CRUD
```javascript
// POST /api/campaigns
// GET /api/campaigns
// GET /api/campaigns/:campaignId
// PATCH /api/campaigns/:campaignId
// DELETE /api/campaigns/:campaignId
```

#### 2.2 Sequence Management
```javascript
// POST /api/campaigns/:campaignId/sequences
// GET /api/campaigns/:campaignId/sequences
// PATCH /api/sequences/:sequenceId
// DELETE /api/sequences/:sequenceId
// POST /api/sequences/:sequenceId/reorder  // Change order
```

#### 2.3 Contact List Management
```javascript
// POST /api/contact-lists
// GET /api/contact-lists
// GET /api/contact-lists/:listId/contacts
// PATCH /api/contact-lists/:listId
// DELETE /api/contact-lists/:listId
```

#### 2.4 Campaign Execution
```javascript
// POST /api/campaigns/:campaignId/send
// POST /api/campaigns/:campaignId/schedule
// POST /api/campaigns/:campaignId/pause
// POST /api/campaigns/:campaignId/resume
```

### Phase 3: Service Layer

#### 3.1 CampaignService
```javascript
class CampaignService {
  static async createCampaign(ownerId, data) {
    // Create campaign
    // Optionally create/assign contact list
    // Return campaign with sequences
  }
  
  static async getCampaign(campaignId) {
    // Get campaign with:
    // - contactList (with contact count)
    // - sequences (ordered by order)
    // - attachments
  }
  
  static async updateCampaign(campaignId, updates) {
    // Update campaign
    // Guardrails for contactListId changes
  }
}
```

#### 3.2 SequenceService
```javascript
class SequenceService {
  static async createSequence(campaignId, data) {
    // Create sequence
    // Auto-calculate order if not provided
    // Validate delayDays
  }
  
  static async getSequencesForCampaign(campaignId) {
    // Get all sequences ordered by order
  }
  
  static async reorderSequences(campaignId, sequenceIds) {
    // Update order for multiple sequences
  }
}
```

#### 3.3 CampaignExecutionService
```javascript
class CampaignExecutionService {
  static async sendCampaign(campaignId, options = {}) {
    // 1. Get campaign with contactList and sequences
    // 2. Get contacts from contactList
    // 3. For each sequence (in order):
    //    - Calculate send date (based on delayDays)
    //    - Personalize content for each contact
    //    - Send via SendGrid
    //    - Create SequenceContact records
    //    - Wait delayDays before next sequence
    // 4. Update campaign status
  }
  
  static async scheduleCampaign(campaignId, scheduledFor) {
    // Create scheduled job
    // Background worker picks up at scheduled time
  }
}
```

### Phase 4: Frontend Implementation

#### 4.1 Campaign Builder UI
```
/campaigns/create
  Step 1: Campaign Details
    - Name, description
    - Select/create contact list
  
  Step 2: Build Sequence
    - Add sequence steps
    - Set order and delays
    - Preview timeline
  
  Step 3: Review & Send
    - Preview campaign
    - Schedule or send immediately
```

#### 4.2 Sequence Builder Component
```jsx
<SequenceBuilder
  campaignId={campaignId}
  sequences={sequences}
  onAddSequence={(sequence) => {...}}
  onUpdateSequence={(sequenceId, updates) => {...}}
  onReorderSequences={(newOrder) => {...}}
  onDeleteSequence={(sequenceId) => {...}}
/>
```

#### 4.3 Campaign Dashboard
```
/campaigns/:campaignId
  - Campaign overview
  - Sequence timeline
  - Contact list preview
  - Send/schedule controls
  - Analytics (after sending)
```

---

## Key Differences from eventscrm-backend

### 1. Owner vs Organization
- **eventscrm-backend**: Uses `orgId` (Organization model)
- **IgniteBd-Next-combine**: Uses `ownerId` (Owner model)
- **Action**: Replace `orgId` with `ownerId` in all models

### 2. Email Provider
- **eventscrm-backend**: Uses Gmail API (personal email)
- **IgniteBd-Next-combine**: Uses SendGrid (transactional email)
- **Action**: Use SendGrid for sending, but keep same sequence logic

### 3. Contact Model
- **eventscrm-backend**: Has `Contact` model with `contactListId`
- **IgniteBd-Next-combine**: Has `contacts` table (different structure)
- **Action**: Map to existing contact structure or create junction table

### 4. Template System
- **eventscrm-backend**: Has `Template` model
- **IgniteBd-Next-combine**: Has `template_bases` table
- **Action**: Link sequences to existing template system

---

## Migration Strategy

### Step 1: Database Migration
1. Add new models to `schema.prisma`
2. Run `npx prisma migrate dev --name add_email_sequences`
3. Update existing `email_activities` to link to campaigns/sequences

### Step 2: Backend Services
1. Create `CampaignService`
2. Create `SequenceService`
3. Create `CampaignExecutionService`
4. Update `outreachSendService` to support sequences

### Step 3: API Routes
1. Create `/api/campaigns/*` routes
2. Create `/api/sequences/*` routes
3. Update `/api/outreach/send` to accept `campaignId`/`sequenceId`

### Step 4: Frontend
1. Build campaign builder UI
2. Build sequence builder component
3. Update outreach dashboard to show campaigns
4. Migrate localStorage campaigns to database

---

## Best Practices from eventscrm-backend

### 1. Modular Contact Lists
✅ **DO**: Make contact lists reusable across campaigns  
❌ **DON'T**: Delete contact lists when campaigns are deleted

### 2. Sequence Ordering
✅ **DO**: Use `order` field for sequence steps (1, 2, 3...)  
❌ **DON'T**: Rely on `createdAt` for ordering

### 3. Delay Calculation
✅ **DO**: Calculate send dates based on `delayDays` from previous email  
❌ **DON'T**: Use absolute dates (use relative delays)

### 4. Status Tracking
✅ **DO**: Track status at both campaign and sequence level  
❌ **DON'T**: Only track at campaign level

### 5. Contact-Level Tracking
✅ **DO**: Create `SequenceContact` record for each contact in each sequence  
❌ **DON'T**: Only track at sequence level

---

## Example: Complete Campaign Flow

### 1. Create Campaign
```javascript
POST /api/campaigns
{
  ownerId: "owner_123",
  name: "Q1 Outreach Campaign",
  description: "Reaching out to prospects",
  contactListId: "list_456"
}
```

### 2. Add Sequences
```javascript
POST /api/campaigns/campaign_789/sequences
{
  name: "Initial Outreach",
  subject: "Quick intro - {{firstName}}",
  html: "<p>Hi {{firstName}}, ...</p>",
  order: 1,
  delayDays: 0
}

POST /api/campaigns/campaign_789/sequences
{
  name: "Follow-up",
  subject: "Following up - {{firstName}}",
  html: "<p>Hi {{firstName}}, just following up...</p>",
  order: 2,
  delayDays: 3
}

POST /api/campaigns/campaign_789/sequences
{
  name: "Final Touch",
  subject: "Last check-in - {{firstName}}",
  html: "<p>Hi {{firstName}}, one last time...</p>",
  order: 3,
  delayDays: 7
}
```

### 3. Send Campaign
```javascript
POST /api/campaigns/campaign_789/send
{
  sendImmediately: true
}

// Backend flow:
// Day 0: Send sequence 1 to all contacts
// Day 3: Send sequence 2 to all contacts
// Day 10: Send sequence 3 to all contacts
```

### 4. Track Progress
```javascript
GET /api/campaigns/campaign_789/analytics
{
  campaign: {...},
  sequences: [
    {
      id: "seq_1",
      name: "Initial Outreach",
      totalSent: 150,
      opened: 45,
      clicked: 12,
      responded: 3
    },
    // ...
  ],
  contacts: [
    {
      contactId: "contact_123",
      progress: [
        { sequenceId: "seq_1", status: "opened" },
        { sequenceId: "seq_2", status: "sent" },
        { sequenceId: "seq_3", status: "pending" }
      ]
    }
  ]
}
```

---

## Conclusion

The eventscrm-backend pattern provides a clean, modular approach to email sequences:

1. **Campaign** = Container (orchestrates everything)
2. **ContactList** = WHO (reusable, modular)
3. **Sequence** = WHAT (individual emails with timing)

This pattern should be adapted for IgniteBd-Next-combine with:
- `ownerId` instead of `orgId`
- SendGrid instead of Gmail API
- Integration with existing contact/template systems

The key insight: **There is no "composeId"** - the Sequence itself IS the composed email content. The hierarchy is Campaign → ContactList → Sequence, not Campaign → ContactList → Compose → Sequence.

---

## Preview Capabilities

### Preview Service

The `CampaignPreviewService` provides comprehensive preview functionality:

1. **Email Content Preview** - See how emails will look with personalized content
2. **Timeline Preview** - See when each email will be sent
3. **Contact List Preview** - See who will receive the emails
4. **Validation** - Check campaign readiness before sending

### Preview API Endpoints

#### Comprehensive Preview
```javascript
GET /api/campaigns/:campaignId/preview
Query params:
  - contactId: Optional contact ID for email preview
  - startDate: Optional start date (ISO string)
  - contactLimit: Number of contacts to preview (default: 5)

Response:
{
  success: true,
  preview: {
    campaign: {...},
    contactList: {...},
    previewContact: {...},
    emailContent: {
      sequences: [
        {
          sequenceId: "...",
          sequenceName: "Initial Outreach",
          steps: [
            {
              stepNumber: 1,
              originalSubject: "Hi {{firstName}}",
              personalizedSubject: "Hi John",
              originalBody: "...",
              personalizedBody: "...",
              delayDays: 0
            }
          ]
        }
      ]
    },
    timeline: {
      startDate: "2025-01-27T10:00:00Z",
      timeline: [
        {
          sequenceName: "Initial Outreach",
          steps: [
            {
              stepNumber: 1,
              sendDate: "2025-01-27T10:00:00Z",
              sendDateFormatted: "1/27/2025, 10:00:00 AM"
            }
          ]
        }
      ],
      totalDurationDays: 10
    },
    contactList: {
      totalContacts: 150,
      contacts: [...]
    },
    summary: {
      totalSequences: 3,
      totalSteps: 5,
      totalContacts: 150,
      totalDurationDays: 10
    }
  }
}
```

#### Email Content Preview
```javascript
GET /api/campaigns/:campaignId/preview/email
Query params:
  - sequenceId: Optional - preview specific sequence
  - contactId: Optional - use specific contact

Response:
{
  success: true,
  preview: {
    campaign: {...},
    previewContact: {...},
    sequences: [
      {
        sequenceId: "...",
        steps: [
          {
            originalSubject: "Hi {{firstName}}",
            personalizedSubject: "Hi John",
            originalBody: "...",
            personalizedBody: "..."
          }
        ]
      }
    ]
  }
}
```

#### Timeline Preview
```javascript
GET /api/campaigns/:campaignId/preview/timeline
Query params:
  - startDate: Optional start date (ISO string)

Response:
{
  success: true,
  timeline: {
    startDate: "2025-01-27T10:00:00Z",
    timeline: [
      {
        sequenceName: "Initial Outreach",
        steps: [
          {
            stepNumber: 1,
            name: "Welcome Email",
            sendDate: "2025-01-27T10:00:00Z",
            sendDateFormatted: "1/27/2025, 10:00:00 AM",
            delayDays: 0
          },
          {
            stepNumber: 2,
            name: "Follow-up",
            sendDate: "2025-01-30T10:00:00Z",
            sendDateFormatted: "1/30/2025, 10:00:00 AM",
            delayDays: 3
          }
        ]
      }
    ],
    totalDurationDays: 10
  }
}
```

#### Contact List Preview
```javascript
GET /api/campaigns/:campaignId/preview/contacts
Query params:
  - limit: Number of contacts to preview (default: 10)

Response:
{
  success: true,
  contactListPreview: {
    contactList: {
      id: "...",
      name: "Q1 Prospects",
      totalContacts: 150
    },
    contacts: [
      {
        id: "...",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        companyName: "Example Corp"
      }
    ],
    previewCount: 10,
    totalContacts: 150,
    hasMore: true
  }
}
```

#### Campaign Validation
```javascript
GET /api/campaigns/:campaignId/preview/validate

Response:
{
  success: true,
  validation: {
    valid: true,
    errors: [],
    warnings: ["Only 3 contact(s) in list"],
    campaign: {
      id: "...",
      name: "Q1 Outreach",
      hasContactList: true,
      totalSequences: 3,
      totalSteps: 5
    }
  }
}
```

### Frontend Preview UI Components

```jsx
// Example: Campaign Preview Component
import { useState, useEffect } from 'react';

function CampaignPreview({ campaignId }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/preview`)
      .then(res => res.json())
      .then(data => {
        setPreview(data.preview);
        setLoading(false);
      });
  }, [campaignId]);

  if (loading) return <div>Loading preview...</div>;
  if (!preview) return <div>No preview available</div>;

  return (
    <div className="campaign-preview">
      {/* Email Content Preview */}
      <section>
        <h3>Email Preview</h3>
        {preview.emailContent.sequences.map(sequence => (
          <div key={sequence.sequenceId}>
            <h4>{sequence.sequenceName}</h4>
            {sequence.steps.map(step => (
              <div key={step.stepId}>
                <p><strong>Subject:</strong> {step.personalizedSubject}</p>
                <div dangerouslySetInnerHTML={{ __html: step.personalizedBody }} />
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Timeline Preview */}
      <section>
        <h3>Timeline</h3>
        <p>Starts: {preview.timeline.startDateFormatted}</p>
        <p>Total Duration: {preview.timeline.totalDurationDays} days</p>
        {preview.timeline.timeline.map(seq => (
          <div key={seq.sequenceId}>
            <h4>{seq.sequenceName}</h4>
            {seq.steps.map(step => (
              <div key={step.stepId}>
                Step {step.stepNumber}: {step.sendDateFormatted}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Contact List Preview */}
      <section>
        <h3>Recipients</h3>
        <p>Total: {preview.contactList.totalContacts} contacts</p>
        <ul>
          {preview.contactList.contacts.map(contact => (
            <li key={contact.id}>
              {contact.fullName} ({contact.email})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

## Next Steps

1. ✅ Review this document
2. ✅ Create preview service and API routes
3. ⬜ Create database migration
4. ⬜ Implement backend services (CampaignService, SequenceService, CampaignExecutionService)
5. ⬜ Build API routes for campaigns and sequences
6. ⬜ Create frontend UI with preview components
7. ⬜ Test end-to-end flow
8. ⬜ Migrate existing campaigns from localStorage

---

**Questions or clarifications needed?** Review the eventscrm-backend code:
- `/routes/campaignRoute.js` - Campaign CRUD
- `/routes/enterpriseGmailRoute.js` - Sequence sending
- `/prisma/schema.prisma` - Database models
- `/services/emailOrchestratorService.js` - Orchestration logic

