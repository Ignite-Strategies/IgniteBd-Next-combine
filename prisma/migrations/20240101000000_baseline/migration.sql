-- CreateEnum
CREATE TYPE "BillSendStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RetainerStatus" AS ENUM ('DRAFT', 'LINK_SENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RetainerInterval" AS ENUM ('MONTH');

-- CreateEnum
CREATE TYPE "BuyerPerson" AS ENUM ('BUSINESS_OWNER', 'DIRECTOR_VP', 'PRODUCT_USER');

-- CreateEnum
CREATE TYPE "BuyingReadiness" AS ENUM ('NOT_READY', 'READY_NO_MONEY', 'READY_WITH_MONEY');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('EMAIL', 'SEQUENCE', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "EventCostRange" AS ENUM ('FREE', 'LOW_0_500', 'MEDIUM_500_2000', 'HIGH_2000_5000', 'PREMIUM_5000_PLUS', 'NO_LIMIT');

-- CreateEnum
CREATE TYPE "EventOppStatus" AS ENUM ('CONSIDERING', 'SHORTLIST', 'GOING', 'PASSED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('PERSONA', 'USER_PREF', 'MANUAL', 'BD_INTEL');

-- CreateEnum
CREATE TYPE "EventSourceType" AS ENUM ('AI', 'CSV', 'MANUAL', 'WEB');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ASSOCIATION', 'COMMERCIAL', 'MEDIA', 'INDUSTRY', 'PRIVATE', 'CORPORATE');

-- CreateEnum
CREATE TYPE "OrganizationArchetype" AS ENUM ('ASSOCIATION', 'TRADE_GROUP', 'GUILD', 'NONPROFIT', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationshipEnum" AS ENUM ('COLD', 'WARM', 'ESTABLISHED', 'DORMANT');

-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TravelDistance" AS ENUM ('LOCAL', 'REGIONAL', 'DOMESTIC', 'INTERNATIONAL', 'NO_LIMIT');

-- CreateEnum
CREATE TYPE "TypeOfPersonEnum" AS ENUM ('CURRENT_CLIENT', 'FORMER_CLIENT', 'FORMER_COWORKER', 'PROSPECT', 'PARTNER', 'FRIEND_OF_FRIEND');

-- CreateEnum
CREATE TYPE "WorkCollateralStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_NEEDED', 'CHANGES_IN_PROGRESS', 'APPROVED');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('BLOG', 'PERSONA', 'OUTREACH_TEMPLATE', 'EVENT_CLE_PLAN', 'PRESENTATION_DECK', 'LANDING_PAGE');

-- CreateEnum
CREATE TYPE "WorkPackageItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_NEEDED', 'CHANGES_IN_PROGRESS', 'APPROVED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_PAID', 'PAID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PLATFORM_FEE', 'MONTHLY_RECURRING', 'CUSTOM', 'WORK_PACKAGE', 'PLAN_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "PlatformAccessStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PersonaType" AS ENUM ('DECISION_MAKER', 'INFLUENCER', 'END_USER', 'GATEKEEPER', 'CHAMPION', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailSource" AS ENUM ('PLATFORM', 'OFF_PLATFORM');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('FIRST_TIME', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "ContextOfRelationship" AS ENUM ('DONT_KNOW', 'PRIOR_CONVERSATION', 'PRIOR_COLLEAGUE', 'PRIOR_SCHOOLMATE', 'CURRENT_CLIENT', 'CONNECTED_LINKEDIN_ONLY', 'REFERRAL', 'REFERRAL_FROM_WARM_CONTACT', 'USED_TO_WORK_AT_TARGET_COMPANY');

-- CreateEnum
CREATE TYPE "RelationshipRecency" AS ENUM ('NEW', 'RECENT', 'STALE', 'LONG_DORMANT');

-- CreateEnum
CREATE TYPE "CompanyAwareness" AS ENUM ('DONT_KNOW', 'KNOWS_COMPANY', 'KNOWS_COMPANY_COMPETITOR', 'KNOWS_BUT_DISENGAGED');

-- CreateEnum
CREATE TYPE "TemplatePosition" AS ENUM ('SUBJECT_LINE', 'OPENING_GREETING', 'CATCH_UP', 'BUSINESS_CONTEXT', 'VALUE_PROPOSITION', 'COMPETITOR_FRAME', 'TARGET_ASK', 'SOFT_CLOSE');

-- CreateTable
CREATE TABLE "GoogleOAuthToken" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "refreshToken" TEXT NOT NULL,
    "scopes" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleOAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicrosoftAccount" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "microsoftEmail" TEXT NOT NULL,
    "microsoftDisplayName" TEXT,
    "microsoftTenantId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyHQId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "industry" TEXT,
    "workTooMuch" TEXT,
    "assignTasks" TEXT,
    "wantMoreClients" TEXT,
    "revenueGrowthPercent" DOUBLE PRECISION,
    "totalVolume" DOUBLE PRECISION,
    "bdSpend" DOUBLE PRECISION,
    "score" INTEGER,
    "scoreInterpretation" TEXT,
    "relateWithUser" TEXT,
    "growthNeeds" TEXT,
    "rawGptResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_event_ops" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventPlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "whyGo" TEXT,
    "eventType" "EventType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "location" TEXT,
    "timeFrame" TEXT,
    "sponsor" TEXT,
    "costEstimate" TEXT,
    "costBand" TEXT,
    "source" "EventSource" NOT NULL DEFAULT 'MANUAL',
    "status" "EventOppStatus" NOT NULL DEFAULT 'CONSIDERING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventTunerId" TEXT,
    "prioritySource" TEXT,

    CONSTRAINT "bd_event_ops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_eventop_intel" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventMetaId" TEXT NOT NULL,
    "personaId" TEXT,
    "personaAlignment" INTEGER,
    "travelBurden" INTEGER,
    "costFit" INTEGER,
    "ecosystemFit" INTEGER,
    "bdOpportunity" INTEGER,
    "notes" TEXT,
    "status" "EventOppStatus" NOT NULL DEFAULT 'CONSIDERING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_eventop_intel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bd_intels" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "painAlignmentScore" INTEGER NOT NULL,
    "workflowFitScore" INTEGER NOT NULL,
    "urgencyScore" INTEGER NOT NULL,
    "adoptionBarrierScore" INTEGER NOT NULL,
    "risks" JSONB,
    "opportunities" JSONB,
    "recommendedTalkTrack" TEXT,
    "recommendedSequence" TEXT,
    "recommendedLeadSource" TEXT,
    "finalSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bd_intels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_analyses" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fitScore" INTEGER,
    "painAlignmentScore" INTEGER,
    "workflowFitScore" INTEGER,
    "urgencyScore" INTEGER,
    "adoptionBarrierScore" INTEGER,
    "risks" JSONB,
    "opportunities" JSONB,
    "recommendedTalkTrack" TEXT,
    "recommendedSequence" TEXT,
    "recommendedLeadSource" TEXT,
    "finalSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bdos_scores" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "personaId" TEXT,
    "totalScore" INTEGER NOT NULL,
    "personaFit" INTEGER NOT NULL,
    "productFit" INTEGER NOT NULL,
    "companyReadiness" INTEGER NOT NULL,
    "buyingPower" INTEGER NOT NULL,
    "seniority" INTEGER NOT NULL,
    "urgency" INTEGER NOT NULL,
    "rationale" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bdos_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blogs" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "blogText" TEXT,
    "description" TEXT,
    "presenter" TEXT,
    "sections" JSONB,
    "subtitle" TEXT,
    "googleDocUrl" TEXT,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "company_hq_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "CampaignType" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "preview_text" TEXT,
    "from_email" TEXT,
    "from_name" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "emails_sent" INTEGER NOT NULL DEFAULT 0,
    "emails_delivered" INTEGER NOT NULL DEFAULT 0,
    "emails_opened" INTEGER NOT NULL DEFAULT 0,
    "emails_clicked" INTEGER NOT NULL DEFAULT 0,
    "emails_replied" INTEGER NOT NULL DEFAULT 0,
    "emails_bounced" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "bounce_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "contact_list_id" TEXT,
    "body" TEXT,
    "template_id" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_uploads" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT,
    "size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'stored',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "address" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "revenue" DOUBLE PRECISION,
    "yearsInBusiness" INTEGER,
    "proposalId" TEXT,
    "contractId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "companyHealthScore" INTEGER,
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain" TEXT,
    "fundingStage" TEXT,
    "growthRate" DOUBLE PRECISION,
    "growthScore" INTEGER,
    "headcount" INTEGER,
    "headcountTier" TEXT,
    "lastFundingAmount" DOUBLE PRECISION,
    "lastFundingDate" TIMESTAMP(3),
    "marketPositionScore" INTEGER,
    "normalizedIndustry" TEXT,
    "numberOfFundingRounds" INTEGER,
    "positioningLabel" TEXT,
    "readinessScore" INTEGER,
    "revenueRange" TEXT,
    "revenueTier" TEXT,
    "stabilityScore" INTEGER,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_hqs" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyStreet" TEXT,
    "companyCity" TEXT,
    "companyState" TEXT,
    "companyZip" TEXT,
    "companyWebsite" TEXT,
    "whatYouDo" TEXT,
    "companyIndustry" TEXT,
    "teamSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "contactOwnerId" TEXT,
    "managerId" TEXT,
    "companyAnnualRev" TEXT,
    "yearsInBusiness" TEXT,
    "tier" TEXT,
    "stripeCustomerId" TEXT,
    "platformId" TEXT,
    "planId" TEXT,
    "planStatus" "PlatformAccessStatus",
    "stripeSubscriptionId" TEXT,
    "planStartedAt" TIMESTAMP(3),
    "planEndedAt" TIMESTAMP(3),

    CONSTRAINT "company_hqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyHqId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_deliverables" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "type" TEXT,
    "workContent" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proposalId" TEXT,
    "milestoneId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "companyHQId" TEXT NOT NULL,
    "contactCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultant_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'static',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filters" JSONB,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "crmId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "goesBy" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "seniority" TEXT,
    "department" TEXT,
    "linkedinUrl" TEXT,
    "linkedinConnectedOn" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "companyName" TEXT,
    "companyDomain" TEXT,
    "positionType" TEXT,
    "contactCompanyId" TEXT,
    "howMet" TEXT,
    "notes" TEXT,
    "contactListId" TEXT,
    "domain" TEXT,
    "enrichmentSource" TEXT,
    "enrichmentFetchedAt" TIMESTAMP(3),
    "enrichmentPayload" JSONB,
    "createdById" TEXT,
    "firebaseUid" TEXT,
    "clientPortalUrl" TEXT DEFAULT 'https://clientportal.ignitegrowth.biz',
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'contact',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "averageTenureMonths" DOUBLE PRECISION,
    "avgTenureYears" DOUBLE PRECISION,
    "budgetAuthority" BOOLEAN,
    "buyerLikelihoodScore" INTEGER,
    "buyingPowerScore" INTEGER,
    "buyingTriggers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "careerMomentumScore" INTEGER,
    "careerMomentum" TEXT,
    "careerProgression" TEXT,
    "careerStabilityScore" INTEGER,
    "whatTheyreLookingFor" TEXT,
    "careerTimeline" JSONB,
    "companyId" TEXT,
    "companyIndustry" TEXT,
    "companySize" TEXT,
    "currentRoleStartDate" TIMESTAMP(3),
    "currentTenureYears" DOUBLE PRECISION,
    "decisionMaker" BOOLEAN,
    "enrichmentRedisKey" TEXT,
    "gatekeeper" BOOLEAN,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "influencer" BOOLEAN,
    "jobRole" TEXT,
    "numberOfJobChanges" INTEGER,
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profileSummary" TEXT,
    "readinessToBuyScore" INTEGER,
    "recentJobChange" BOOLEAN,
    "recentPromotion" BOOLEAN,
    "rolePowerScore" INTEGER,
    "seniorityScore" INTEGER,
    "tenureYears" INTEGER,
    "timezone" TEXT,
    "totalExperienceYears" DOUBLE PRECISION,
    "totalYearsExperience" DOUBLE PRECISION,
    "urgencyScore" INTEGER,
    "buyingReadiness" "BuyingReadiness",
    "buyerPerson" "BuyerPerson",
    "persona_type" "PersonaType",
    "prior_relationship" "RelationshipEnum",
    "lastContact" TEXT,
    "remindMeOn" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "nextContactedAt" TIMESTAMP(3),
    "nextContactNote" TEXT,
    "doNotContactAgain" BOOLEAN NOT NULL DEFAULT false,
    "outreachPersonaSlug" TEXT,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_templates" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "deliverableType" TEXT NOT NULL,
    "deliverableLabel" TEXT NOT NULL,
    "defaultUnitOfMeasure" TEXT NOT NULL,
    "defaultDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliverable_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_registry" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "normalizedName" TEXT,
    "companyHqId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "confidenceScore" DOUBLE PRECISION DEFAULT 1.0,

    CONSTRAINT "domain_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecosystem_orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "city" TEXT,
    "state" TEXT,
    "archetype" "OrganizationArchetype" NOT NULL,
    "whatTheyDo" TEXT,
    "annualRevenue" INTEGER,
    "duesInfo" TEXT,
    "memberCount" INTEGER,
    "memberDescription" TEXT,
    "memberSeniority" TEXT,
    "memberIndustries" TEXT[],
    "memberReasonForAffiliation" TEXT,
    "memberAffiliationStrength" TEXT,
    "orgRelevanceToCompanyHQ" TEXT,
    "bdCompanyHQAffiliationScore" INTEGER,
    "targetPersonaAlignment" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecosystem_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_activities" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "tenant_id" TEXT,
    "email" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "event" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaign_id" TEXT,
    "sequence_id" TEXT,
    "sequence_step_id" TEXT,
    "reply_to_message_id" TEXT,
    "source" "EmailSource" DEFAULT 'PLATFORM',
    "platform" TEXT,
    "sentAt" TIMESTAMP(3),
    "hasResponded" BOOLEAN NOT NULL DEFAULT false,
    "contactResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "responseSubject" TEXT,

    CONSTRAINT "email_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "company_hq_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT',
    "auto_pause_on_reply" BOOLEAN NOT NULL DEFAULT true,
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "emails_sent" INTEGER NOT NULL DEFAULT 0,
    "emails_opened" INTEGER NOT NULL DEFAULT 0,
    "emails_clicked" INTEGER NOT NULL DEFAULT 0,
    "emails_replied" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_signatures" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_metas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seriesName" TEXT,
    "eventType" "EventType" NOT NULL,
    "organizerId" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dateRange" TEXT,
    "costMin" INTEGER,
    "costMax" INTEGER,
    "currency" TEXT,
    "sourceType" "EventSourceType" NOT NULL DEFAULT 'AI',
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_metas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_plan_opps" (
    "id" TEXT NOT NULL,
    "eventPlanId" TEXT NOT NULL,
    "bdEventOppId" TEXT NOT NULL,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_plan_opps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_plans" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "presenter" TEXT,
    "spacingScore" INTEGER,
    "totalCost" INTEGER,
    "totalTrips" INTEGER,
    "year" INTEGER,

    CONSTRAINT "event_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tuner_personas" (
    "id" TEXT NOT NULL,
    "eventTunerId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_tuner_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tuner_states" (
    "id" TEXT NOT NULL,
    "eventTunerId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_tuner_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tuners" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conferencesPerQuarter" INTEGER,
    "costRange" "EventCostRange",
    "eventSearchRawText" TEXT,
    "travelDistance" "TravelDistance",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_tuners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_milestones" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_template_milestones" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_template_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_settings" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "invoicePrefix" TEXT,
    "invoiceNumberFormat" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultPaymentTerms" TEXT,
    "defaultNotes" TEXT,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "billingEmail" TEXT,
    "autoGenerateNumber" BOOLEAN NOT NULL DEFAULT true,
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "platformFeeAmount" INTEGER,
    "platformFeeDescription" TEXT,
    "monthlyRecurringAmount" INTEGER,
    "monthlyRecurringDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "invoiceName" TEXT NOT NULL,
    "invoiceDescription" TEXT,
    "invoiceNumber" TEXT,
    "workPackageId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "totalExpected" INTEGER NOT NULL DEFAULT 0,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" DOUBLE PRECISION,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'NOT_PAID',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringFrequency" TEXT,
    "nextBillingDate" TIMESTAMP(3),
    "lastBilledDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidByContactId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" JSONB,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "presenter" TEXT,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "firebaseId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "photoURL" TEXT,
    "teamSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "sendgridVerifiedEmail" TEXT,
    "sendgridVerifiedName" TEXT,
    "tier" TEXT DEFAULT 'foundation',

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amountReceived" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidByContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "personName" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "seniority" TEXT,
    "role" TEXT,
    "industry" TEXT,
    "subIndustries" TEXT[],
    "company" TEXT,
    "companySize" TEXT,
    "annualRevenue" TEXT,
    "location" TEXT,
    "description" TEXT,
    "whatTheyWant" TEXT,
    "coreGoal" TEXT,
    "needForOurProduct" TEXT,
    "potentialPitch" TEXT,
    "painPoints" TEXT[],
    "risks" TEXT[],
    "decisionDrivers" TEXT[],
    "buyerTriggers" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_deliverable_templates" (
    "id" TEXT NOT NULL,
    "phaseTemplateId" TEXT NOT NULL,
    "deliverableTemplateId" TEXT NOT NULL,
    "defaultQuantity" INTEGER DEFAULT 1,
    "order" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_deliverable_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_templates" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentations" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slides" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "feedback" JSONB,
    "gammaBlob" TEXT,
    "gammaDeckUrl" TEXT,
    "gammaError" TEXT,
    "gammaPptxUrl" TEXT,
    "gammaStatus" TEXT,
    "presenter" TEXT,
    "gammaGenerationId" TEXT,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_fits" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "valuePropToThem" TEXT NOT NULL,
    "alignmentReasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_fits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueProp" TEXT,
    "price" DOUBLE PRECISION,
    "priceCurrency" TEXT DEFAULT 'USD',
    "pricingModel" TEXT,
    "category" TEXT,
    "deliveryTimeline" TEXT,
    "targetMarketSize" TEXT,
    "salesCycleLength" TEXT,
    "features" TEXT,
    "competitiveAdvantages" TEXT,
    "targetedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_deliverables" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_phases" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "phaseTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationWeeks" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estimatedStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalPrice" DOUBLE PRECISION,
    "purpose" TEXT,
    "phases" JSONB,
    "milestones" JSONB,
    "compensation" JSONB,
    "dateIssued" TIMESTAMP(3),
    "preparedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_candidates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventSeriesName" TEXT,
    "organizerName" TEXT NOT NULL,
    "producerType" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateOrRegion" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "costMin" INTEGER,
    "costMax" INTEGER,
    "currency" TEXT NOT NULL,
    "personaAlignment" INTEGER NOT NULL,
    "url" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "name" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "from_email" TEXT,
    "from_name" TEXT,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_opened" INTEGER NOT NULL DEFAULT 0,
    "total_clicked" INTEGER NOT NULL DEFAULT 0,
    "total_replied" INTEGER NOT NULL DEFAULT 0,
    "open_rate" DOUBLE PRECISION,
    "click_rate" DOUBLE PRECISION,
    "reply_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_relationship_helpers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "familiarityLevel" TEXT NOT NULL,
    "whyReachingOut" TEXT NOT NULL,
    "desiredOutcome" TEXT,
    "timeHorizon" TEXT,
    "contextNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_relationship_helpers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyHQId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT,
    "personaSlug" TEXT,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_snippets" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intentType" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_contexts" (
    "relationshipContextId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "contextOfRelationship" "ContextOfRelationship",
    "relationshipRecency" "RelationshipRecency",
    "companyAwareness" "CompanyAwareness",
    "formerCompany" TEXT,
    "primaryWork" TEXT,
    "relationshipQuality" TEXT,
    "opportunityType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_contexts_pkey" PRIMARY KEY ("relationshipContextId")
);

-- CreateTable
CREATE TABLE "outreach_personas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_snips" (
    "snipId" TEXT NOT NULL,
    "snipName" TEXT NOT NULL,
    "snipSlug" TEXT NOT NULL,
    "snipText" TEXT NOT NULL,
    "templatePosition" "TemplatePosition" NOT NULL,
    "personaSlug" TEXT,
    "bestUsedWhen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_snips_pkey" PRIMARY KEY ("snipId")
);

-- CreateTable
CREATE TABLE "template_variables" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "variableKey" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "dbField" TEXT,
    "computedRule" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_collateral" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT,
    "workPackageItemId" TEXT,
    "presentationId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "contentJson" JSONB,
    "status" "WorkCollateralStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reviewRequestedAt" TIMESTAMP(3),
    "reviewCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_collateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_package_items" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "workPackagePhaseId" TEXT NOT NULL,
    "deliverableType" TEXT NOT NULL,
    "deliverableLabel" TEXT NOT NULL,
    "deliverableDescription" TEXT,
    "itemType" TEXT NOT NULL DEFAULT '',
    "itemLabel" TEXT NOT NULL DEFAULT '',
    "itemDescription" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "estimatedHoursEach" INTEGER NOT NULL,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "WorkPackageItemStatus" NOT NULL DEFAULT 'NOT_STARTED',

    CONSTRAINT "work_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_package_phases" (
    "id" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT,
    "phaseTotalDuration" INTEGER,
    "totalEstimatedHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "estimatedStartDate" TIMESTAMP(3),
    "status" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_package_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_packages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prioritySummary" TEXT,
    "totalCost" DOUBLE PRECISION,
    "effectiveStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workPackageOwnerId" TEXT NOT NULL,
    "workPackageClientId" TEXT NOT NULL,
    "workPackageMemberId" TEXT,
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WorkPackageStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "work_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interval" "PlanInterval",
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "companyId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "checkoutUrl" TEXT,
    "status" "BillSendStatus" NOT NULL DEFAULT 'PENDING',
    "slug" TEXT,
    "publicBillUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_retainers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "interval" "RetainerInterval" NOT NULL DEFAULT 'MONTH',
    "startDate" TIMESTAMP(3),
    "status" "RetainerStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" TEXT,
    "publicRetainerUrl" TEXT,
    "stripeSubscriptionId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_retainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financials" (
    "id" TEXT NOT NULL,
    "companyHQId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "financialsId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "vendor" TEXT,
    "receiptUrl" TEXT,
    "csvImportId" TEXT,
    "csvRowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income" (
    "id" TEXT NOT NULL,
    "financialsId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeInvoiceId" TEXT,
    "invoiceId" TEXT,
    "csvImportId" TEXT,
    "csvRowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "company_hqsId" TEXT,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equity" (
    "id" TEXT NOT NULL,
    "financialsId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "csvImportId" TEXT,
    "csvRowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_imports" (
    "id" TEXT NOT NULL,
    "financialsId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "columnMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleOAuthToken_ownerId_idx" ON "GoogleOAuthToken"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthToken_ownerId_provider_key" ON "GoogleOAuthToken"("ownerId", "provider");

-- CreateIndex
CREATE INDEX "MicrosoftAccount_ownerId_idx" ON "MicrosoftAccount"("ownerId");

-- CreateIndex
CREATE INDEX "MicrosoftAccount_microsoftEmail_idx" ON "MicrosoftAccount"("microsoftEmail");

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftAccount_ownerId_key" ON "MicrosoftAccount"("ownerId");

-- CreateIndex
CREATE INDEX "assessments_companyHQId_idx" ON "assessments"("companyHQId");

-- CreateIndex
CREATE INDEX "assessments_ownerId_idx" ON "assessments"("ownerId");

-- CreateIndex
CREATE INDEX "bd_event_ops_companyHQId_idx" ON "bd_event_ops"("companyHQId");

-- CreateIndex
CREATE INDEX "bd_event_ops_eventPlanId_idx" ON "bd_event_ops"("eventPlanId");

-- CreateIndex
CREATE INDEX "bd_event_ops_eventTunerId_idx" ON "bd_event_ops"("eventTunerId");

-- CreateIndex
CREATE INDEX "bd_event_ops_ownerId_idx" ON "bd_event_ops"("ownerId");

-- CreateIndex
CREATE INDEX "bd_event_ops_prioritySource_idx" ON "bd_event_ops"("prioritySource");

-- CreateIndex
CREATE INDEX "bd_event_ops_source_idx" ON "bd_event_ops"("source");

-- CreateIndex
CREATE INDEX "bd_event_ops_status_idx" ON "bd_event_ops"("status");

-- CreateIndex
CREATE INDEX "bd_eventop_intel_companyHQId_idx" ON "bd_eventop_intel"("companyHQId");

-- CreateIndex
CREATE INDEX "bd_eventop_intel_eventMetaId_idx" ON "bd_eventop_intel"("eventMetaId");

-- CreateIndex
CREATE INDEX "bd_eventop_intel_ownerId_idx" ON "bd_eventop_intel"("ownerId");

-- CreateIndex
CREATE INDEX "bd_eventop_intel_personaId_idx" ON "bd_eventop_intel"("personaId");

-- CreateIndex
CREATE INDEX "bd_eventop_intel_status_idx" ON "bd_eventop_intel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bd_intels_personaId_key" ON "bd_intels"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_analyses_contactId_key" ON "contact_analyses"("contactId");

-- CreateIndex
CREATE INDEX "contact_analyses_contactId_idx" ON "contact_analyses"("contactId");

-- CreateIndex
CREATE INDEX "bdos_scores_contactId_idx" ON "bdos_scores"("contactId");

-- CreateIndex
CREATE INDEX "bdos_scores_createdAt_idx" ON "bdos_scores"("createdAt");

-- CreateIndex
CREATE INDEX "bdos_scores_personaId_idx" ON "bdos_scores"("personaId");

-- CreateIndex
CREATE INDEX "bdos_scores_productId_idx" ON "bdos_scores"("productId");

-- CreateIndex
CREATE INDEX "blogs_companyHQId_idx" ON "blogs"("companyHQId");

-- CreateIndex
CREATE INDEX "campaigns_company_hq_id_idx" ON "campaigns"("company_hq_id");

-- CreateIndex
CREATE INDEX "campaigns_contact_list_id_idx" ON "campaigns"("contact_list_id");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at");

-- CreateIndex
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_template_id_idx" ON "campaigns"("template_id");

-- CreateIndex
CREATE INDEX "client_uploads_ownerId_idx" ON "client_uploads"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "companies_domain_idx" ON "companies"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "company_hqs_stripeCustomerId_key" ON "company_hqs"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "company_hqs_stripeSubscriptionId_key" ON "company_hqs"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "company_hqs_stripeCustomerId_idx" ON "company_hqs"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "company_hqs_platformId_idx" ON "company_hqs"("platformId");

-- CreateIndex
CREATE INDEX "company_hqs_planId_idx" ON "company_hqs"("planId");

-- CreateIndex
CREATE INDEX "company_hqs_planStatus_idx" ON "company_hqs"("planStatus");

-- CreateIndex
CREATE INDEX "company_hqs_stripeSubscriptionId_idx" ON "company_hqs"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "company_memberships_companyHqId_idx" ON "company_memberships"("companyHqId");

-- CreateIndex
CREATE INDEX "company_memberships_userId_companyHqId_idx" ON "company_memberships"("userId", "companyHqId");

-- CreateIndex
CREATE INDEX "company_memberships_userId_idx" ON "company_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_userId_companyHqId_key" ON "company_memberships"("userId", "companyHqId");

-- CreateIndex
CREATE INDEX "consultant_deliverables_companyHQId_idx" ON "consultant_deliverables"("companyHQId");

-- CreateIndex
CREATE INDEX "consultant_deliverables_contactId_idx" ON "consultant_deliverables"("contactId");

-- CreateIndex
CREATE INDEX "consultant_deliverables_proposalId_idx" ON "consultant_deliverables"("proposalId");

-- CreateIndex
CREATE INDEX "contact_lists_companyId_idx" ON "contact_lists"("companyId");

-- CreateIndex
CREATE INDEX "contact_lists_isActive_idx" ON "contact_lists"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "contact_lists_companyId_name_key" ON "contact_lists"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_firebaseUid_key" ON "contacts"("firebaseUid");

-- CreateIndex
CREATE INDEX "contacts_companyDomain_idx" ON "contacts"("companyDomain");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE INDEX "contacts_domain_idx" ON "contacts"("domain");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_firebaseUid_idx" ON "contacts"("firebaseUid");

-- CreateIndex
CREATE INDEX "contacts_ownerId_idx" ON "contacts"("ownerId");

-- CreateIndex
CREATE INDEX "contacts_role_idx" ON "contacts"("role");

-- CreateIndex
CREATE INDEX "contacts_prior_relationship_idx" ON "contacts"("prior_relationship");

-- CreateIndex
CREATE INDEX "contacts_remindMeOn_idx" ON "contacts"("remindMeOn");

-- CreateIndex
CREATE INDEX "contacts_lastContactedAt_idx" ON "contacts"("lastContactedAt");

-- CreateIndex
CREATE INDEX "contacts_nextContactedAt_idx" ON "contacts"("nextContactedAt");

-- CreateIndex
CREATE INDEX "contacts_doNotContactAgain_idx" ON "contacts"("doNotContactAgain");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_crmId_key" ON "contacts"("email", "crmId");

-- CreateIndex
CREATE INDEX "deliverable_templates_companyHQId_idx" ON "deliverable_templates"("companyHQId");

-- CreateIndex
CREATE UNIQUE INDEX "deliverable_templates_companyHQId_deliverableType_key" ON "deliverable_templates"("companyHQId", "deliverableType");

-- CreateIndex
CREATE UNIQUE INDEX "domain_registry_domain_key" ON "domain_registry"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "domain_registry_companyHqId_key" ON "domain_registry"("companyHqId");

-- CreateIndex
CREATE INDEX "domain_registry_companyHqId_idx" ON "domain_registry"("companyHqId");

-- CreateIndex
CREATE INDEX "domain_registry_domain_idx" ON "domain_registry"("domain");

-- CreateIndex
CREATE INDEX "ecosystem_orgs_archetype_idx" ON "ecosystem_orgs"("archetype");

-- CreateIndex
CREATE INDEX "ecosystem_orgs_name_idx" ON "ecosystem_orgs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "email_activities_messageId_key" ON "email_activities"("messageId");

-- CreateIndex
CREATE INDEX "email_activities_campaign_id_idx" ON "email_activities"("campaign_id");

-- CreateIndex
CREATE INDEX "email_activities_contact_id_createdAt_idx" ON "email_activities"("contact_id", "createdAt");

-- CreateIndex
CREATE INDEX "email_activities_contact_id_idx" ON "email_activities"("contact_id");

-- CreateIndex
CREATE INDEX "email_activities_messageId_idx" ON "email_activities"("messageId");

-- CreateIndex
CREATE INDEX "email_activities_owner_id_idx" ON "email_activities"("owner_id");

-- CreateIndex
CREATE INDEX "email_activities_sequence_id_idx" ON "email_activities"("sequence_id");

-- CreateIndex
CREATE INDEX "email_activities_source_idx" ON "email_activities"("source");

-- CreateIndex
CREATE INDEX "email_activities_sentAt_idx" ON "email_activities"("sentAt");

-- CreateIndex
CREATE INDEX "email_activities_hasResponded_idx" ON "email_activities"("hasResponded");

-- CreateIndex
CREATE INDEX "email_sequences_campaign_id_idx" ON "email_sequences"("campaign_id");

-- CreateIndex
CREATE INDEX "email_sequences_owner_id_idx" ON "email_sequences"("owner_id");

-- CreateIndex
CREATE INDEX "email_sequences_status_idx" ON "email_sequences"("status");

-- CreateIndex
CREATE INDEX "email_signatures_owner_id_idx" ON "email_signatures"("owner_id");

-- CreateIndex
CREATE INDEX "email_signatures_owner_id_is_default_idx" ON "email_signatures"("owner_id", "is_default");

-- CreateIndex
CREATE INDEX "event_metas_eventType_idx" ON "event_metas"("eventType");

-- CreateIndex
CREATE INDEX "event_metas_name_idx" ON "event_metas"("name");

-- CreateIndex
CREATE INDEX "event_metas_organizerId_idx" ON "event_metas"("organizerId");

-- CreateIndex
CREATE INDEX "event_plan_opps_bdEventOppId_idx" ON "event_plan_opps"("bdEventOppId");

-- CreateIndex
CREATE INDEX "event_plan_opps_eventPlanId_idx" ON "event_plan_opps"("eventPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "event_plan_opps_eventPlanId_bdEventOppId_key" ON "event_plan_opps"("eventPlanId", "bdEventOppId");

-- CreateIndex
CREATE INDEX "event_plans_companyHQId_idx" ON "event_plans"("companyHQId");

-- CreateIndex
CREATE INDEX "event_plans_ownerId_idx" ON "event_plans"("ownerId");

-- CreateIndex
CREATE INDEX "event_tuner_personas_eventTunerId_idx" ON "event_tuner_personas"("eventTunerId");

-- CreateIndex
CREATE INDEX "event_tuner_personas_personaId_idx" ON "event_tuner_personas"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "event_tuner_personas_eventTunerId_personaId_key" ON "event_tuner_personas"("eventTunerId", "personaId");

-- CreateIndex
CREATE INDEX "event_tuner_states_eventTunerId_idx" ON "event_tuner_states"("eventTunerId");

-- CreateIndex
CREATE INDEX "event_tuner_states_state_idx" ON "event_tuner_states"("state");

-- CreateIndex
CREATE UNIQUE INDEX "event_tuner_states_eventTunerId_state_key" ON "event_tuner_states"("eventTunerId", "state");

-- CreateIndex
CREATE INDEX "event_tuners_companyHQId_idx" ON "event_tuners"("companyHQId");

-- CreateIndex
CREATE INDEX "event_tuners_isActive_idx" ON "event_tuners"("isActive");

-- CreateIndex
CREATE INDEX "event_tuners_ownerId_idx" ON "event_tuners"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_key" ON "invite_tokens"("token");

-- CreateIndex
CREATE INDEX "invite_tokens_contactId_idx" ON "invite_tokens"("contactId");

-- CreateIndex
CREATE INDEX "invite_tokens_email_idx" ON "invite_tokens"("email");

-- CreateIndex
CREATE INDEX "invite_tokens_token_idx" ON "invite_tokens"("token");

-- CreateIndex
CREATE INDEX "invoice_milestones_invoiceId_idx" ON "invoice_milestones"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_milestones_status_idx" ON "invoice_milestones"("status");

-- CreateIndex
CREATE INDEX "invoice_template_milestones_templateId_idx" ON "invoice_template_milestones"("templateId");

-- CreateIndex
CREATE INDEX "invoice_templates_companyHQId_idx" ON "invoice_templates"("companyHQId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_templates_companyHQId_name_key" ON "invoice_templates"("companyHQId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settings_companyHQId_key" ON "invoice_settings"("companyHQId");

-- CreateIndex
CREATE INDEX "invoice_settings_companyHQId_idx" ON "invoice_settings"("companyHQId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_invoiceType_idx" ON "invoices"("invoiceType");

-- CreateIndex
CREATE INDEX "invoices_companyHQId_idx" ON "invoices"("companyHQId");

-- CreateIndex
CREATE INDEX "invoices_workPackageId_idx" ON "invoices"("workPackageId");

-- CreateIndex
CREATE INDEX "invoices_contactId_idx" ON "invoices"("contactId");

-- CreateIndex
CREATE INDEX "invoices_companyId_idx" ON "invoices"("companyId");

-- CreateIndex
CREATE INDEX "invoices_stripeCustomerId_idx" ON "invoices"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_stripeSubscriptionId_idx" ON "invoices"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "invoices_isRecurring_idx" ON "invoices"("isRecurring");

-- CreateIndex
CREATE INDEX "invoices_nextBillingDate_idx" ON "invoices"("nextBillingDate");

-- CreateIndex
CREATE INDEX "landing_pages_companyHQId_idx" ON "landing_pages"("companyHQId");

-- CreateIndex
CREATE INDEX "landing_pages_published_idx" ON "landing_pages"("published");

-- CreateIndex
CREATE UNIQUE INDEX "owners_firebaseId_key" ON "owners"("firebaseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeSessionId_key" ON "payments"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_milestoneId_idx" ON "payments"("milestoneId");

-- CreateIndex
CREATE INDEX "payments_stripePaymentIntentId_idx" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_stripeSessionId_idx" ON "payments"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "phase_deliverable_templates_phaseTemplateId_deliverableTemp_key" ON "phase_deliverable_templates"("phaseTemplateId", "deliverableTemplateId");

-- CreateIndex
CREATE INDEX "phase_templates_companyHQId_idx" ON "phase_templates"("companyHQId");

-- CreateIndex
CREATE UNIQUE INDEX "phase_templates_companyHQId_name_key" ON "phase_templates"("companyHQId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_contactId_key" ON "pipelines"("contactId");

-- CreateIndex
CREATE INDEX "presentations_companyHQId_idx" ON "presentations"("companyHQId");

-- CreateIndex
CREATE INDEX "presentations_published_idx" ON "presentations"("published");

-- CreateIndex
CREATE UNIQUE INDEX "product_fits_personaId_key" ON "product_fits"("personaId");

-- CreateIndex
CREATE INDEX "proposal_deliverables_proposalId_idx" ON "proposal_deliverables"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_phases_proposalId_idx" ON "proposal_phases"("proposalId");

-- CreateIndex
CREATE INDEX "prospect_candidates_status_idx" ON "prospect_candidates"("status");

-- CreateIndex
CREATE INDEX "prospect_candidates_userId_idx" ON "prospect_candidates"("userId");

-- CreateIndex
CREATE INDEX "saved_events_createdAt_idx" ON "saved_events"("createdAt");

-- CreateIndex
CREATE INDEX "saved_events_userId_idx" ON "saved_events"("userId");

-- CreateIndex
CREATE INDEX "sequence_steps_sequence_id_idx" ON "sequence_steps"("sequence_id");

-- CreateIndex
CREATE INDEX "sequence_steps_sequence_id_step_number_idx" ON "sequence_steps"("sequence_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_steps_sequence_id_step_number_key" ON "sequence_steps"("sequence_id", "step_number");

-- CreateIndex
CREATE INDEX "template_relationship_helpers_createdAt_idx" ON "template_relationship_helpers"("createdAt");

-- CreateIndex
CREATE INDEX "template_relationship_helpers_ownerId_idx" ON "template_relationship_helpers"("ownerId");

-- CreateIndex
CREATE INDEX "templates_companyHQId_idx" ON "templates"("companyHQId");

-- CreateIndex
CREATE INDEX "templates_ownerId_idx" ON "templates"("ownerId");

-- CreateIndex
CREATE INDEX "templates_personaSlug_idx" ON "templates"("personaSlug");

-- CreateIndex
CREATE INDEX "template_snippets_companyHQId_idx" ON "template_snippets"("companyHQId");

-- CreateIndex
CREATE UNIQUE INDEX "template_snippets_companyHQId_variableName_key" ON "template_snippets"("companyHQId", "variableName");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_contexts_contactId_key" ON "relationship_contexts"("contactId");

-- CreateIndex
CREATE INDEX "relationship_contexts_contactId_idx" ON "relationship_contexts"("contactId");

-- CreateIndex
CREATE INDEX "relationship_contexts_contextOfRelationship_relationshipRec_idx" ON "relationship_contexts"("contextOfRelationship", "relationshipRecency", "companyAwareness");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_personas_slug_key" ON "outreach_personas"("slug");

-- CreateIndex
CREATE INDEX "outreach_personas_slug_idx" ON "outreach_personas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_snips_snipSlug_key" ON "content_snips"("snipSlug");

-- CreateIndex
CREATE INDEX "content_snips_templatePosition_idx" ON "content_snips"("templatePosition");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_idx" ON "template_variables"("companyHQId");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_source_idx" ON "template_variables"("companyHQId", "source");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_isActive_idx" ON "template_variables"("companyHQId", "isActive");

-- CreateIndex
CREATE INDEX "template_variables_companyHQId_isBuiltIn_idx" ON "template_variables"("companyHQId", "isBuiltIn");

-- CreateIndex
CREATE UNIQUE INDEX "template_variables_companyHQId_variableKey_key" ON "template_variables"("companyHQId", "variableKey");

-- CreateIndex
CREATE INDEX "work_collateral_presentationId_idx" ON "work_collateral"("presentationId");

-- CreateIndex
CREATE INDEX "work_collateral_status_idx" ON "work_collateral"("status");

-- CreateIndex
CREATE INDEX "work_collateral_type_idx" ON "work_collateral"("type");

-- CreateIndex
CREATE INDEX "work_collateral_workPackageId_idx" ON "work_collateral"("workPackageId");

-- CreateIndex
CREATE INDEX "work_collateral_workPackageItemId_idx" ON "work_collateral"("workPackageItemId");

-- CreateIndex
CREATE INDEX "work_package_items_deliverableType_idx" ON "work_package_items"("deliverableType");

-- CreateIndex
CREATE INDEX "work_package_items_itemType_idx" ON "work_package_items"("itemType");

-- CreateIndex
CREATE INDEX "work_package_items_workPackageId_idx" ON "work_package_items"("workPackageId");

-- CreateIndex
CREATE INDEX "work_package_items_workPackagePhaseId_idx" ON "work_package_items"("workPackagePhaseId");

-- CreateIndex
CREATE UNIQUE INDEX "work_package_items_workPackageId_workPackagePhaseId_deliver_key" ON "work_package_items"("workPackageId", "workPackagePhaseId", "deliverableLabel");

-- CreateIndex
CREATE INDEX "work_package_phases_position_idx" ON "work_package_phases"("position");

-- CreateIndex
CREATE INDEX "work_package_phases_workPackageId_idx" ON "work_package_phases"("workPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "work_package_phases_workPackageId_name_position_key" ON "work_package_phases"("workPackageId", "name", "position");

-- CreateIndex
CREATE INDEX "work_packages_companyId_idx" ON "work_packages"("companyId");

-- CreateIndex
CREATE INDEX "work_packages_status_idx" ON "work_packages"("status");

-- CreateIndex
CREATE INDEX "work_packages_workPackageClientId_idx" ON "work_packages"("workPackageClientId");

-- CreateIndex
CREATE INDEX "work_packages_workPackageMemberId_idx" ON "work_packages"("workPackageMemberId");

-- CreateIndex
CREATE INDEX "work_packages_workPackageOwnerId_idx" ON "work_packages"("workPackageOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_stripePriceId_key" ON "plans"("stripePriceId");

-- CreateIndex
CREATE INDEX "plans_stripeProductId_idx" ON "plans"("stripeProductId");

-- CreateIndex
CREATE INDEX "plans_stripePriceId_idx" ON "plans"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_stripeCheckoutSessionId_key" ON "bills"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "bills_slug_key" ON "bills"("slug");

-- CreateIndex
CREATE INDEX "bills_companyId_idx" ON "bills"("companyId");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE INDEX "bills_slug_idx" ON "bills"("slug");

-- CreateIndex
CREATE INDEX "bills_paidAt_idx" ON "bills"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_retainers_slug_key" ON "company_retainers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "company_retainers_stripeSubscriptionId_key" ON "company_retainers"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "company_retainers_companyId_idx" ON "company_retainers"("companyId");

-- CreateIndex
CREATE INDEX "company_retainers_status_idx" ON "company_retainers"("status");

-- CreateIndex
CREATE INDEX "company_retainers_slug_idx" ON "company_retainers"("slug");

-- CreateIndex
CREATE INDEX "company_retainers_stripeSubscriptionId_idx" ON "company_retainers"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "financials_companyHQId_key" ON "financials"("companyHQId");

-- CreateIndex
CREATE INDEX "expenses_financialsId_idx" ON "expenses"("financialsId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE UNIQUE INDEX "income_stripePaymentIntentId_key" ON "income"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "income_financialsId_idx" ON "income"("financialsId");

-- CreateIndex
CREATE INDEX "income_date_idx" ON "income"("date");

-- CreateIndex
CREATE INDEX "income_category_idx" ON "income"("category");

-- CreateIndex
CREATE INDEX "income_stripePaymentIntentId_idx" ON "income"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "equity_financialsId_idx" ON "equity"("financialsId");

-- CreateIndex
CREATE INDEX "equity_date_idx" ON "equity"("date");

-- CreateIndex
CREATE INDEX "equity_category_idx" ON "equity"("category");

-- CreateIndex
CREATE INDEX "csv_imports_financialsId_idx" ON "csv_imports"("financialsId");

-- AddForeignKey
ALTER TABLE "GoogleOAuthToken" ADD CONSTRAINT "GoogleOAuthToken_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicrosoftAccount" ADD CONSTRAINT "MicrosoftAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_event_ops" ADD CONSTRAINT "bd_event_ops_eventTunerId_fkey" FOREIGN KEY ("eventTunerId") REFERENCES "event_tuners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_eventop_intel" ADD CONSTRAINT "bd_eventop_intel_eventMetaId_fkey" FOREIGN KEY ("eventMetaId") REFERENCES "event_metas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bd_intels" ADD CONSTRAINT "bd_intels_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_analyses" ADD CONSTRAINT "contact_analyses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_hq_id_fkey" FOREIGN KEY ("company_hq_id") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_contact_list_id_fkey" FOREIGN KEY ("contact_list_id") REFERENCES "contact_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_contactOwnerId_fkey" FOREIGN KEY ("contactOwnerId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_hqs" ADD CONSTRAINT "company_hqs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyHqId_fkey" FOREIGN KEY ("companyHqId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_deliverables" ADD CONSTRAINT "consultant_deliverables_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_deliverables" ADD CONSTRAINT "consultant_deliverables_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_deliverables" ADD CONSTRAINT "consultant_deliverables_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contactCompanyId_fkey" FOREIGN KEY ("contactCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES "contact_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "company_hqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_outreachPersonaSlug_fkey" FOREIGN KEY ("outreachPersonaSlug") REFERENCES "outreach_personas"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_templates" ADD CONSTRAINT "deliverable_templates_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_registry" ADD CONSTRAINT "domain_registry_companyHqId_fkey" FOREIGN KEY ("companyHqId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_sequence_step_id_fkey" FOREIGN KEY ("sequence_step_id") REFERENCES "sequence_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activities" ADD CONSTRAINT "email_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_company_hq_id_fkey" FOREIGN KEY ("company_hq_id") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_plan_opps" ADD CONSTRAINT "event_plan_opps_bdEventOppId_fkey" FOREIGN KEY ("bdEventOppId") REFERENCES "bd_event_ops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tuner_personas" ADD CONSTRAINT "event_tuner_personas_eventTunerId_fkey" FOREIGN KEY ("eventTunerId") REFERENCES "event_tuners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tuner_personas" ADD CONSTRAINT "event_tuner_personas_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tuner_states" ADD CONSTRAINT "event_tuner_states_eventTunerId_fkey" FOREIGN KEY ("eventTunerId") REFERENCES "event_tuners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_milestones" ADD CONSTRAINT "invoice_milestones_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_template_milestones" ADD CONSTRAINT "invoice_template_milestones_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "invoice_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "invoice_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_deliverable_templates" ADD CONSTRAINT "phase_deliverable_templates_deliverableTemplateId_fkey" FOREIGN KEY ("deliverableTemplateId") REFERENCES "deliverable_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_deliverable_templates" ADD CONSTRAINT "phase_deliverable_templates_phaseTemplateId_fkey" FOREIGN KEY ("phaseTemplateId") REFERENCES "phase_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_templates" ADD CONSTRAINT "phase_templates_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fits" ADD CONSTRAINT "product_fits_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_fits" ADD CONSTRAINT "product_fits_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_deliverables" ADD CONSTRAINT "proposal_deliverables_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_phases" ADD CONSTRAINT "proposal_phases_phaseTemplateId_fkey" FOREIGN KEY ("phaseTemplateId") REFERENCES "phase_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_phases" ADD CONSTRAINT "proposal_phases_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_relationship_helpers" ADD CONSTRAINT "template_relationship_helpers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_snippets" ADD CONSTRAINT "template_snippets_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_contexts" ADD CONSTRAINT "relationship_contexts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_variables" ADD CONSTRAINT "template_variables_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package_items" ADD CONSTRAINT "work_package_items_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package_items" ADD CONSTRAINT "work_package_items_workPackagePhaseId_fkey" FOREIGN KEY ("workPackagePhaseId") REFERENCES "work_package_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package_phases" ADD CONSTRAINT "work_package_phases_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_workPackageClientId_fkey" FOREIGN KEY ("workPackageClientId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_workPackageMemberId_fkey" FOREIGN KEY ("workPackageMemberId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_workPackageOwnerId_fkey" FOREIGN KEY ("workPackageOwnerId") REFERENCES "company_hqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_retainers" ADD CONSTRAINT "company_retainers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financials" ADD CONSTRAINT "financials_companyHQId_fkey" FOREIGN KEY ("companyHQId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_financialsId_fkey" FOREIGN KEY ("financialsId") REFERENCES "financials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_csvImportId_fkey" FOREIGN KEY ("csvImportId") REFERENCES "csv_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_financialsId_fkey" FOREIGN KEY ("financialsId") REFERENCES "financials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_csvImportId_fkey" FOREIGN KEY ("csvImportId") REFERENCES "csv_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_company_hqsId_fkey" FOREIGN KEY ("company_hqsId") REFERENCES "company_hqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity" ADD CONSTRAINT "equity_financialsId_fkey" FOREIGN KEY ("financialsId") REFERENCES "financials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equity" ADD CONSTRAINT "equity_csvImportId_fkey" FOREIGN KEY ("csvImportId") REFERENCES "csv_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_financialsId_fkey" FOREIGN KEY ("financialsId") REFERENCES "financials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

