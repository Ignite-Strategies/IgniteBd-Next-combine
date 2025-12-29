# Joel (BusinessPointLaw) - Critical Path

**Client**: Joel Gulick  
**Company**: BusinessPoint Law  
**Email**: joel@businesspointlaw.com  
**Status**: 🟡 In Progress

---

## 🎯 Goal

Get Joel fully set up and operational in the CRM with:
1. ✅ Company seeded
2. ⏳ 5 contacts added (via LinkedIn enrichment)
3. ⏳ 3 personas built from those contacts
4. ⏳ 6 templates created (1 generic + 5 specific)
5. ⏳ Campaign system verified/blocked if needed

---

## ✅ Step 1: Seed Joel & Company

### Status: ✅ **COMPLETE** (Verify if needed)

**Script**: `scripts/seed-joel-companyhq.js`

**What it does**:
- Creates/finds Joel as Owner (`joel@businesspointlaw.com`)
- Creates/finds BusinessPoint Law CompanyHQ
- Sets Joel as OWNER
- Sets Adam as MANAGER

**Verification**:
```bash
# Run verification script (may need update if using UUID IDs)
node scripts/verify-joel-setup.js

# Or manually check (idempotent - safe to run multiple times)
node scripts/seed-joel-companyhq.js
```

**Note**: The verification script may look for old ID format. If CompanyHQ uses UUID, verification may need update.

**Expected Output**:
```
✅ CompanyHQ: BusinessPoint Law
✅ Joel (OWNER): joel@businesspointlaw.com
✅ Adam (MANAGER): adam.ignitestrategies@gmail.com
```

**Next Action**: 
- [ ] Verify seed completed successfully
- [ ] Ensure Joel can log in (Firebase ID may need update)

---

## ⏳ Step 2: Add Up to 5 Contacts

### Status: 🟡 **IN PROGRESS**

**Flow**: LinkedIn Enrichment → Save or Enrich Fork

**How it works**:
1. Navigate to `/contacts/enrich/linkedin`
2. Enter LinkedIn URL or contact info
3. System enriches via Apollo
4. **Fork Point**: 
   - **Option A**: Save immediately (skip intelligence)
   - **Option B**: Generate intelligence scores (full enrichment)
5. Contact saved to CRM with pipeline

**Key Files**:
- `/app/(authenticated)/contacts/enrich/linkedin/page.jsx` - Main enrichment UI
- `/app/api/contacts/enrich/route.ts` - Enrichment API
- `/app/api/contacts/enrich/save/route.ts` - Save endpoint

**Checklist**:
- [ ] Add Contact #1 (LinkedIn enrichment)
- [ ] Add Contact #2 (LinkedIn enrichment)
- [ ] Add Contact #3 (LinkedIn enrichment)
- [ ] Add Contact #4 (LinkedIn enrichment)
- [ ] Add Contact #5 (LinkedIn enrichment)

**Notes**:
- Each contact should have pipeline created (default: `prospect` + `interest`)
- Verify contacts appear in `/contacts` list
- Ensure `companyHQId` is set correctly (BusinessPoint Law)

**Blockers**:
- ❓ Apollo API key configured?
- ❓ Redis configured for enrichment caching?
- ❓ Pipeline creation working?

---

## ⏳ Step 3: Build 3 Personas from LinkedIn Contacts

### Status: 🟡 **PENDING**

**Flow**: Contact → Generate Persona → Save

**How it works**:
1. Navigate to contact detail page (`/contacts/[contactId]`)
2. Click "Generate Persona" or navigate to `/personas/from-contact?contactId=[id]`
3. System uses `EnrichmentToPersonaService` to:
   - Extract contact data (from Apollo enrichment or contact record)
   - Fetch CompanyHQ context (BusinessPoint Law)
   - Generate persona via GPT-4
   - Parse and normalize persona data
4. Save persona to `/personas/builder` for editing
5. Persona linked to CompanyHQ

**Key Files**:
- `/lib/services/EnrichmentToPersonaService.ts` - Persona generation service
- `/app/api/personas/generate/route.ts` - Persona generation API
- `/app/(authenticated)/personas/builder/page.jsx` - Persona builder UI
- `/app/(authenticated)/personas/from-contact/page.jsx` - Generate from contact

**Checklist**:
- [ ] Generate Persona #1 from Contact #1
- [ ] Generate Persona #2 from Contact #2
- [ ] Generate Persona #3 from Contact #3
- [ ] Review and refine each persona
- [ ] Verify personas appear in `/personas` list

**Persona Fields to Verify**:
- `personaName` - Name of the persona
- `title` - Role/title
- `industry` - Industry
- `painPoints` - Array of pain points
- `goals` - What they want
- `whatTheyWant` - Desired outcomes
- `description` - Full persona description

**Blockers**:
- ❓ OpenAI API key configured?
- ❓ Contact enrichment data available?
- ❓ CompanyHQ context properly set?

---

## ⏳ Step 4: Build Templates

### Status: 🟡 **PENDING**

**Required Templates**:
1. **Generic Template** - General outreach
2. **Job Change Template** - "Saw you changed jobs"
3. **2026 Looking Forward Template** - "Looking forward to 2026"
4. **Template #4** - TBD
5. **Template #5** - TBD
6. **Template #6** - TBD

**Flow**: Template Builder → Generate with Variables → Save

**How it works**:
1. Navigate to `/template/builder` or `/template/build`
2. Fill in template context:
   - Relationship type
   - Type of person
   - Why reaching out
   - **Template Context Fields** (Variables mode):
     - Time Since Connected
     - Time Horizon
     - My Business Description
     - Desired Outcome
     - Knowledge of Business
3. AI generates template with variable tags (`{{firstName}}`, `{{companyName}}`, etc.)
4. Review and edit template
5. Save template

**Key Files**:
- `/app/(authenticated)/template/builder/page.jsx` - Template builder UI
- `/app/api/template/generate-with-variables/route.js` - Template generation API
- `/app/api/template/build/route.js` - Template save API
- `/lib/templateVariables.js` - Variable hydration utilities

**Template Variables Available**:
- `{{firstName}}` - Contact's first name
- `{{lastName}}` - Contact's last name
- `{{fullName}}` - Contact's full name
- `{{companyName}}` - Contact's company
- `{{title}}` - Contact's job title
- `{{timeSinceConnected}}` - Time since last contact
- `{{timeHorizon}}` - When to connect (e.g., "2026")
- `{{myBusinessName}}` - Your business name
- `{{myRole}}` - Your name/role

**Checklist**:
- [ ] Create Generic Template
- [ ] Create "Job Change" Template
- [ ] Create "2026 Looking Forward" Template
- [ ] Create Template #4
- [ ] Create Template #5
- [ ] Create Template #6
- [ ] Test template hydration with sample contact
- [ ] Verify templates appear in template list

**Template Examples**:

**Job Change Template**:
```
Hi {{firstName}},

I saw you recently started working at {{companyName}} as {{title}}. Congratulations!

[Rest of template...]
```

**2026 Looking Forward Template**:
```
Hi {{firstName}},

Looking forward to 2026, I wanted to reach out and see if we could connect.

[Rest of template...]
```

**Blockers**:
- ❓ OpenAI API key configured?
- ❓ Template builder UI working?
- ❓ Variable hydration working?

---

## ⏳ Step 5: Campaign System

### Status: 🟡 **VERIFY/BLOCK**

**Current State**: Campaign system exists in schema and has UI pages, but may not be fully functional.

**Campaign Pages**:
- `/outreach/campaigns` - Campaign list
- `/outreach/campaigns/create` - Create campaign
- `/outreach/campaigns/[campaignId]/edit` - Edit campaign
- `/outreach/campaigns/[campaignId]` - Campaign detail

**Campaign Schema** (from `prisma/schema.prisma`):
- `campaigns` table exists
- Supports contact lists
- Supports templates
- Has status tracking (DRAFT, SCHEDULED, ACTIVE, etc.)

**Action Required**:
- [ ] Test campaign creation flow
- [ ] Verify campaign can link to contact list
- [ ] Verify campaign can link to template
- [ ] Test campaign sending (if implemented)
- [ ] **If broken**: Add "Feature Coming Soon" blocker UI

**Blocker UI Pattern** (if needed):
```jsx
<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
  <h3 className="font-semibold text-yellow-800">Feature Coming Soon</h3>
  <p className="text-yellow-700">
    Campaign sending is currently under development. 
    You can create and configure campaigns, but sending will be available soon.
  </p>
</div>
```

**Checklist**:
- [ ] Navigate to `/outreach/campaigns`
- [ ] Try creating a campaign
- [ ] Try linking contact list
- [ ] Try linking template
- [ ] Test campaign sending (if available)
- [ ] **If broken**: Document blocker and add UI message

---

## 🚨 Blockers & Issues

### Current Blockers
- [ ] **None identified yet** - Update as issues arise

### Known Issues
- [ ] Joel's Firebase ID may need update after authentication
- [ ] Pipeline creation may need verification in enrichment flow
- [ ] Campaign system may need "coming soon" blocker

---

## ✅ Completion Criteria

### Must Have (Critical Path)
- [x] Joel & Company seeded
- [ ] 5 contacts added via LinkedIn enrichment
- [ ] 3 personas generated from contacts
- [ ] 6 templates created (1 generic + 5 specific)
- [ ] Campaign system verified or blocked

### Nice to Have
- [ ] All contacts have proper pipeline records
- [ ] Personas have BD Intelligence scores
- [ ] Templates tested with real contact data
- [ ] Campaign system fully functional

---

## 📝 Testing Checklist

### After Each Step
- [ ] Verify data saved to database
- [ ] Verify UI shows correct data
- [ ] Check for console errors
- [ ] Verify `companyHQId` context is correct

### Final Verification
- [ ] Joel can log in
- [ ] Joel sees BusinessPoint Law as his company
- [ ] All 5 contacts visible in contacts list
- [ ] All 3 personas visible in personas list
- [ ] All 6 templates visible in templates list
- [ ] Campaign system works or shows blocker

---

## 🔄 Next Steps After Critical Path

Once critical path is complete:
1. Test end-to-end workflow: Contact → Persona → Template → Campaign
2. Send test emails using templates
3. Gather feedback from Joel
4. Iterate on templates based on feedback
5. Scale to more contacts and personas

---

## 📞 Support Contacts

- **Developer**: Adam (adam.ignitestrategies@gmail.com)
- **Client**: Joel (joel@businesspointlaw.com)

---

## 📅 Timeline

**Start Date**: [TBD]  
**Target Completion**: [TBD]  
**Last Updated**: [Current Date]

---

## 📋 Notes

- Keep this document updated as progress is made
- Mark items as complete with `[x]`
- Document any blockers or issues immediately
- Test each step before moving to the next

---

## 🔗 Quick Reference

### Key Routes
- **Contacts**: `/contacts` - List all contacts
- **Enrich Contact**: `/contacts/enrich/linkedin` - LinkedIn enrichment
- **Personas**: `/personas` - List all personas
- **Build Persona**: `/personas/builder` - Create/edit persona
- **From Contact**: `/personas/from-contact?contactId=[id]` - Generate from contact
- **Templates**: `/template/builder` or `/template/build` - Template builder
- **Campaigns**: `/outreach/campaigns` - Campaign list

### Key Scripts
- **Seed**: `node scripts/seed-joel-companyhq.js`
- **Verify**: `node scripts/verify-joel-setup.js`

### Key APIs
- **Enrich**: `POST /api/contacts/enrich`
- **Save Enrichment**: `POST /api/contacts/enrich/save`
- **Generate Persona**: `POST /api/personas/generate`
- **Generate Template**: `POST /api/template/generate-with-variables`
- **Campaigns**: `GET /api/campaigns`, `POST /api/campaigns`

