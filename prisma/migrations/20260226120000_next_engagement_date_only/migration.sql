-- Next engagement date: DateTime -> DATE-ONLY string (YYYY-MM-DD) to eliminate timezone drift.
-- Converts existing timestamps to UTC calendar date string.
ALTER TABLE "contacts"
  ALTER COLUMN "nextEngagementDate" TYPE VARCHAR(10)
  USING (
    CASE
      WHEN "nextEngagementDate" IS NOT NULL
      THEN to_char("nextEngagementDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ELSE NULL
    END
  );
