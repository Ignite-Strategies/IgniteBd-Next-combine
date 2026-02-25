-- Rename CompanyAwareness enum value NO_CLUE → DONT_KNOW to match ContextOfRelationship naming
ALTER TYPE "CompanyAwareness" RENAME VALUE 'NO_CLUE' TO 'DONT_KNOW';
