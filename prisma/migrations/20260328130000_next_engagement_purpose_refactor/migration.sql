-- Refactor NextEngagementPurpose: new motion values; FOLLOW_UP → POST_WARM_MEETING_NUDGE
-- PostgreSQL 10+ RENAME VALUE updates existing rows in place.

ALTER TYPE "NextEngagementPurpose" ADD VALUE 'PURSUE_INTRO';
ALTER TYPE "NextEngagementPurpose" ADD VALUE 'NO_INTRO_REASON_FOLLOW_UP';
ALTER TYPE "NextEngagementPurpose" ADD VALUE 'ONE_MORE_TOUCH';
ALTER TYPE "NextEngagementPurpose" ADD VALUE 'COMPETITOR_FOLLOW_UP';

ALTER TYPE "NextEngagementPurpose" RENAME VALUE 'FOLLOW_UP' TO 'POST_WARM_MEETING_NUDGE';
