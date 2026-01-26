-- Direct SQL to mark all failed migrations as applied
-- Run this with: psql $DATABASE_URL -f scripts/resolve-migrations-direct.sql

-- First, show what we're about to fix
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM _prisma_migrations
WHERE finished_at IS NULL
   OR rolled_back_at IS NOT NULL
ORDER BY started_at ASC;

-- Mark all failed migrations as applied
UPDATE _prisma_migrations 
SET 
  finished_at = COALESCE(finished_at, started_at + INTERVAL '1 second'),
  rolled_back_at = NULL,
  applied_steps_count = COALESCE(applied_steps_count, 1)
WHERE finished_at IS NULL
   OR rolled_back_at IS NOT NULL;

-- Show the result
SELECT 
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count
FROM _prisma_migrations
WHERE migration_name IN (
  SELECT migration_name
  FROM _prisma_migrations
  WHERE finished_at IS NOT NULL
    AND rolled_back_at IS NULL
  ORDER BY started_at DESC
  LIMIT 30
)
ORDER BY started_at ASC;







