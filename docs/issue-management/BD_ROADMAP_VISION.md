# BD Roadmap - Vision & Requirements

## 🎯 Purpose

The BD Roadmap is a **strategic planning and timeline tool** for business development activities. It's not an onboarding checklist—it's a **12-month campaign and event calendar** that helps teams plan when to launch campaigns, schedule events, send emails, and execute engagement activities.

## ❌ What It's NOT

- ❌ **NOT** an onboarding checklist ("Set Up Your Contacts", "Configure Deal Pipeline")
- ❌ **NOT** a task management system for foundational setup
- ❌ **NOT** a hardcoded list of generic BD tasks

## ✅ What It SHOULD BE

- ✅ **Campaign Timeline** - Visual calendar showing when campaigns launch
- ✅ **Event Calendar** - 12-month plan for events, webinars, conferences
- ✅ **Email Schedule** - Timeline of when nurture emails go out
- ✅ **Strategic Planning** - "We want to launch the first campaign in January"
- ✅ **Activity Planning** - Month-by-month view of BD activities
- ✅ **Goal Setting** - "By month 6, we want these events completed"

## 📅 Core Functionality (Future)

### Timeline View
- **12-Month Calendar View** - See all activities across the year
- **Month View** - Detailed view of activities in a specific month
- **Week View** - Weekly breakdown of campaigns and events
- **Day View** - Daily schedule of emails and activities

### Campaign Planning
- **Campaign Launch Dates** - "Launch first campaign in January"
- **Email Send Dates** - Schedule when nurture emails go out
- **Campaign Milestones** - Track progress through campaign phases
- **Recurring Campaigns** - Set up recurring email sequences

### Event Planning
- **Event Dates** - Schedule events, webinars, conferences
- **Event Preparation** - Tasks leading up to events
- **Post-Event Activities** - Follow-up campaigns after events
- **Event Recurrence** - Quarterly events, annual conferences

### Integration Points
- **Campaigns** - Link to `/outreach/campaigns` to see scheduled campaigns
- **Events** - Link to event management (if exists)
- **Meetings** - Link to meeting scheduler
- **Email Sequences** - Link to email templates and sequences

## 🏗️ Implementation Approach

### Phase 1: Clean Slate (Current)
- Remove all hardcoded onboarding tasks
- Create empty state with clear messaging
- Show placeholder for future timeline view

### Phase 2: Basic Timeline (Future)
- Create calendar/timeline component
- Allow users to add campaign launch dates
- Allow users to add event dates
- Store timeline data in database

### Phase 3: Campaign Integration (Future)
- Integrate with campaign system
- Auto-populate timeline from scheduled campaigns
- Show email send dates from campaign sequences
- Link to campaign details from timeline

### Phase 4: Event Management (Future)
- Create event management system
- Allow scheduling events
- Set up event preparation tasks
- Create post-event follow-up campaigns

### Phase 5: Advanced Features (Future)
- Drag-and-drop timeline editing
- Recurring event templates
- Campaign templates with pre-set timelines
- Analytics integration (show campaign performance on timeline)
- Goal tracking (e.g., "By month 6, complete 3 events")

## 📊 Data Model (Future)

```javascript
// Roadmap Item
{
  id: string,
  type: 'campaign' | 'event' | 'email' | 'meeting' | 'milestone',
  title: string,
  description: string,
  startDate: Date,
  endDate: Date, // Optional
  status: 'planned' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled',
  priority: 'P0' | 'P1' | 'P2',
  recurring: boolean,
  recurrencePattern: string, // e.g., "monthly", "quarterly"
  linkedResourceId: string, // ID of campaign, event, etc.
  linkedResourceType: string, // 'campaign', 'event', etc.
  metadata: {
    // Type-specific data
  }
}

// Campaign Timeline Item
{
  type: 'campaign',
  campaignId: string,
  launchDate: Date,
  emailSendDates: Date[],
  milestones: {
    name: string,
    date: Date,
    status: string
  }[]
}

// Event Timeline Item
{
  type: 'event',
  eventId: string,
  eventDate: Date,
  preparationTasks: {
    name: string,
    dueDate: Date,
    status: string
  }[],
  postEventCampaigns: {
    campaignId: string,
    sendDate: Date
  }[]
}
```

## 🎨 UI/UX Vision

### Empty State
- Clear messaging: "Plan your BD activities for the year"
- Call-to-action: "Add your first campaign" or "Schedule your first event"
- Visual: Calendar illustration or timeline placeholder

### Timeline View
- **Visual Timeline** - Gantt-style or calendar view
- **Color Coding** - Different colors for campaigns, events, emails
- **Interactive** - Click items to see details, drag to reschedule
- **Filtering** - Filter by type (campaigns, events, emails)
- **Grouping** - Group by month, quarter, or custom periods

### Add/Edit Modal
- **Quick Add** - "Add Campaign", "Add Event", "Add Email"
- **Date Picker** - Easy date selection
- **Recurrence** - Option to make recurring
- **Link Resource** - Link to existing campaign or event
- **Notifications** - Set reminders for upcoming activities

## 🔗 Related Features

- **Campaigns** (`/outreach/campaigns`) - Source of campaign data
- **Events** (future) - Source of event data
- **Meetings** (future) - Source of meeting data
- **Email Sequences** (future) - Source of email send dates
- **BD Intelligence** (`/bd-intelligence`) - Target intelligence for campaigns
- **Personas** (`/personas`) - Persona targeting for campaigns

## 📝 Current State

- **Status**: Hardcoded onboarding tasks (to be removed)
- **Location**: `/pipelines/roadmap`
- **Next Step**: Remove hardcoded content, create empty state
- **Future**: Build timeline/calendar view with campaign and event integration

---

## 🚀 Quick Start (Future Implementation)

1. **User says**: "We want to launch the first campaign in January"
2. **System**: Creates roadmap item for January campaign launch
3. **User**: Links to existing campaign or creates new campaign
4. **System**: Auto-populates email send dates from campaign sequence
5. **Timeline**: Shows campaign launch date and email send dates on calendar
6. **User**: Can drag to reschedule, edit dates, add events
7. **Notifications**: System reminds user of upcoming campaign launches and events

---

**Last Updated**: 2025-01-XX
**Status**: Planning Phase - Hardcoded content to be removed

